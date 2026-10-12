const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const AuraTransaction = require('../models/AuraTransaction');
const { bankAction, bankView, creditAuraEarnings, reconcileAuraWallet } = require('../services/auraBank');
const { buildAuraSummary } = require('../services/auraSummary');
const { currentUserView } = require('../services/clientViews');
async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } }); let server;
  try {
    await mongoose.connect(mongo.getUri()); await Promise.all([User, Friendship, AuraTransaction].map(model => model.init()));
    const [one, two, stranger] = await User.create(['Ari', 'Maya', 'Sol'].map(name => ({ displayName: name, username: name.toLowerCase(), email: name+'@example.test', password: 'local-fixture', welcomeAuraGranted: true, auraBalance: 20 })));
    const start = new Date(Date.now()-86400000), checked = new Date(Date.now()-60000);
    const contract = await Friendship.create({ user1: one._id, user2: two._id, user1DisplayName: 'Ari', user2DisplayName: 'Maya', status: 'ACTIVE', season: { number: 1, status: 'ACTIVE', startedAt: start, endsAt: new Date(Date.now()+86400000) }, user1Perspective: { limit: 3, lastInteraction: checked }, user2Perspective: { limit: 3, lastInteraction: start } });
    assert.equal((await bankView(one._id)).eligible, false, 'one-sided activation cannot unlock borrowing');
    await Friendship.updateOne({ _id: contract._id }, { $set: { 'user2Perspective.lastInteraction': checked } });
    assert.equal((await bankView(one._id)).eligible, true);
    const loan = { amount: 100, clientId: randomUUID() };
    const loans = await Promise.all(Array.from({ length: 6 }, () => bankAction(one._id, 'BORROW', loan)));
    assert.ok(loans.every(result => result.bank.outstanding===100&&result.bank.balance===120));
    assert.equal(await AuraTransaction.countDocuments({ userId: one._id, type: 'BANK_LOAN' }), 1);
    await assert.rejects(bankAction(one._id,'BORROW',{amount:25,clientId:randomUUID()}),/unavailable/);
    await assert.rejects(bankAction(one._id,'REPAY',{amount:25,clientId:loan.clientId}),/another bank action/);
    const earnKey='test:'+randomUUID();
    await Promise.all(Array.from({ length: 5 }, () => creditAuraEarnings(one._id,11,'CHAOS_BONUS','A real Chaos bonus',earnKey,{metadata:{friendshipId:contract._id}})));
    let bank=await bankView(one._id);assert.equal(bank.balance,125);assert.equal(bank.outstanding,94,'odd earnings repay the rounded-up half');
    assert.equal(await AuraTransaction.countDocuments({ userId: one._id, type:'CHAOS_BONUS' }),1);assert.equal(await AuraTransaction.countDocuments({ userId:one._id,type:'BANK_AUTOPAY' }),1);
    assert.equal(String((await AuraTransaction.findOne({userId:one._id,type:'CHAOS_BONUS'})).metadata.friendshipId),String(contract._id),'earnings keep their existing ledger linkage');
    const repayment={amount:25,clientId:randomUUID()};await Promise.all(Array.from({length:5},()=>bankAction(one._id,'REPAY',repayment)));
    bank=await bankView(one._id);assert.equal(bank.balance,100);assert.equal(bank.outstanding,69);
    // A ledger outage leaves a durable committed loan, then the same retry repairs it.
    await User.updateOne({_id:two._id},{$set:{auraBalance:10}});
    const original=AuraTransaction.updateOne;let failNext=true;
    AuraTransaction.updateOne=function(...args){if(failNext){failNext=false;return Promise.reject(new Error('Injected ledger outage'));}return original.apply(this,args);};
    const secondLoan={amount:50,clientId:randomUUID()};const committed=await bankAction(two._id,'BORROW',secondLoan);assert.equal(committed.bank.balance,60);
    AuraTransaction.updateOne=original;await reconcileAuraWallet(two._id);await bankAction(two._id,'BORROW',secondLoan);
    assert.equal((await bankView(two._id)).balance,60);assert.equal(await AuraTransaction.countDocuments({userId:two._id,type:'BANK_LOAN'}),1);
    // Competing repayments cannot spend the same balance twice.
    await User.updateOne({_id:one._id},{$set:{auraBalance:20}});
    const races=await Promise.allSettled(Array.from({length:4},()=>bankAction(one._id,'REPAY',{amount:15,clientId:randomUUID()})));
    assert.equal(races.filter(result=>result.status==='fulfilled').length,1);assert.equal((await bankView(one._id)).balance,5);
    const debt=(await bankView(one._id)).outstanding;await creditAuraEarnings(one._id,200,'BOUNTY_REWARD','A bounty reward','test:'+randomUUID());
    bank=await bankView(one._id);assert.equal(bank.outstanding,0);assert.equal(bank.balance,205-debt);assert.equal(bank.eligible,false,'repaid loans keep their cooldown');
    await User.updateOne({_id:one._id},{$set:{auraBalance:0,'auraBank.lastBorrowedAt':new Date(Date.now()-8*86400000)}});assert.equal((await bankView(one._id)).eligible,true);
    const summary=await buildAuraSummary(two._id);assert.equal(summary.reputation.lifetimeEarned,110,'rank counts the existing welcome and daily bonus, excluding borrowed principal');assert.equal(summary.totalEarned,110);
    const raw=await User.findById(two._id).select('+auraBank +auraWalletReceipts').lean();const view=currentUserView(raw);for(const key of ['auraBank','auraWalletReceipts','lastWorldActivitySeenAt'])assert.equal(key in view,false);
    process.env.JWT_SECRET=randomBytes(32).toString('hex');const app=express();app.use(express.json());app.use(require('../middleware/requestGuard'));app.use('/api/aura/bank',require('../routes/auraBank'));
    await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});const base=`http://127.0.0.1:${server.address().port}/api/aura/bank`;
    const request=async(user,path='',body)=>{const res=await fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(user?{'x-auth-token':jwt.sign({user:{id:String(user._id),v:0}},process.env.JWT_SECRET)}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:res.status,data:await res.json()};};
    assert.equal((await request(null)).status,401);assert.equal((await request(stranger,'/borrow',{amount:50,clientId:randomUUID()})).status,409);
    for(const amount of[-1,1.5,'50',1000])assert.equal((await request(one,'/borrow',{amount,clientId:randomUUID()})).status,400);
    AuraTransaction.updateOne=()=>Promise.reject(new Error('Injected persistent ledger outage'));
    const fresh=await request(one,'/borrow',{amount:25,clientId:randomUUID(),userId:String(stranger._id)});assert.equal(fresh.status,200);assert.equal((await bankView(stranger._id)).outstanding,0,'request bodies cannot target another account');
    const readable=await request(one);assert.equal(readable.status,200,'ledger recovery must not block committed bank reads');assert.equal(readable.data.outstanding,25);
    AuraTransaction.updateOne=original;assert.equal((await request(one)).status,200);assert.equal(await AuraTransaction.countDocuments({userId:one._id,type:'BANK_LOAN'}),2);
    console.log('Aura bank on standalone MongoDB: mutual activation, atomic loans/repayment/earnings, duplicate retries, ledger repair, cooldown, rank isolation, private payloads and ownership passed.');
  } finally { if(server)await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();await mongo.stop(); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
