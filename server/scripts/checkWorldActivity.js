const assert=require('node:assert/strict');
const {randomBytes,randomUUID}=require('crypto');
const mongoose=require('mongoose');
const express=require('express');
const jwt=require('jsonwebtoken');
const {MongoMemoryServer}=require('mongodb-memory-server-core');
const User=require('../models/User'),Friendship=require('../models/Friendship'),Event=require('../models/ContractEvent'),World=require('../models/WorldActivity'),Notification=require('../models/Notification');
const {recordEvent}=require('../services/contractGame');
const {publishWorldEvent,reconcileWorldActivity,worldFeed,markWorldRead}=require('../services/worldActivity');
async function run(){
  const mongo=await MongoMemoryServer.create({binary:{version:'8.0.12'}});let server;
  try{
    await mongoose.connect(mongo.getUri());await Promise.all([User,Friendship,Event,World,Notification].map(model=>model.init()));
    const owner=new mongoose.Types.ObjectId();
    const [ari,maya,sol,hunter,testOne,testTwo]=await User.create(['Ari','Maya','Sol','Hunter','TestOne','TestTwo'].map(name=>({displayName:name,username:name.toLowerCase(),email:name+'@example.test',password:'local-fixture',auraBalance:100,inventory:name==='Ari'?['SIGNAL_FLARE','SIGNAL_FLARE','SIGNAL_FLARE']:[],...(name.startsWith('Test')?{isTestAccount:true,testOwnerId:owner}:{}),privacySettings:{optOutPublicBankruptcy:false}})));
    const make=(one,two)=>Friendship.create({user1:one._id,user2:two._id,user1DisplayName:one.displayName,user2DisplayName:two.displayName,status:'ACTIVE',season:{number:1,status:'ACTIVE',startedAt:new Date(Date.now()-86400000),endsAt:new Date(Date.now()+86400000)},user1Perspective:{limit:3},user2Perspective:{limit:3}});
    const contract=await make(ari,maya),testContract=await make(testOne,testTwo);
    // Historical Flare users were never told their action was public.
    await recordEvent(contract._id,'SIGNAL_FLARE',{userId:ari._id,metadata:{targetId:maya._id}});
    assert.equal(await World.countDocuments(),0);
    await recordEvent(contract._id,'DUO_LEVEL_UP',{userId:ari._id,metadata:{level:3,privateAnswer:'private-secret'}});
    await recordEvent(contract._id,'SEASON_COMPLETED',{metadata:{season:1}});
    await recordEvent(testContract._id,'DUO_LEVEL_UP',{userId:testOne._id,metadata:{level:7}});
    await recordEvent(contract._id,'BOUNTY_REWARD',{userId:hunter._id,aura:50,metadata:{targetId:maya._id}});
    const snapshot=await worldFeed(sol._id);assert.equal(snapshot.events.length,3);assert.ok(snapshot.events.filter(event=>event.type!=='BOUNTY_REWARD').every(event=>event.actor===null));
    assert.equal((await worldFeed(testOne._id)).events.length,1,'Founder Lab scopes stay isolated');
    for(const forbidden of ['friendshipId','sourceEventId','targetId','email','private-secret','outstanding','auraBank','scopeKey'])assert.equal(JSON.stringify(snapshot).includes(forbidden),false,forbidden+' leaked');
    await User.updateOne({_id:hunter._id},{$set:{'privacySettings.optOutPublicBankruptcy':true}});
    assert.equal((await worldFeed(sol._id)).events.find(event=>event.type==='BOUNTY_REWARD').actor,null,'current privacy opt-out hides the hunter identity');
    // A board outage cannot cancel a saved game milestone; recovery deduplicates it.
    const original=World.updateOne;let failNext=true;
    World.updateOne=function(...args){if(failNext){failNext=false;return Promise.reject(new Error('Injected board outage'));}return original.apply(this,args);};
    const pending=await recordEvent(contract._id,'DUO_LEVEL_UP',{metadata:{level:4}});World.updateOne=original;
    assert.equal(await World.countDocuments({sourceEventId:pending._id}),0);await reconcileWorldActivity();await publishWorldEvent(pending);assert.equal(await World.countDocuments({sourceEventId:pending._id}),1);
    process.env.JWT_SECRET=randomBytes(32).toString('hex');const app=express();app.use(express.json());app.use(require('../middleware/requestGuard'));app.use('/api/aura',require('../routes/aura'));app.use('/api/world-activity',require('../routes/worldActivity'));
    await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});const base=`http://127.0.0.1:${server.address().port}/api`;
    const request=async(user,path,body)=>{const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(user?{'x-auth-token':jwt.sign({user:{id:String(user._id),v:0}},process.env.JWT_SECRET)}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,data:await response.json()};};
    assert.equal((await request(null,'/world-activity')).status,401);
    const createNotification=Notification.create;let notificationUnavailable=true;
    Notification.create=function(...args){if(notificationUnavailable&&args[0]?.type==='SIGNAL_FLARE')return Promise.reject(new Error('Injected recipient notification outage'));return createNotification.apply(this,args);};
    const flares=await Promise.all(Array.from({length:3},()=>request(ari,'/aura/use-card',{cardId:'SIGNAL_FLARE',targetFriendshipId:String(contract._id)})));
    assert.equal(flares.filter(result=>result.status===200).length,1,'concurrent Flare uses respect one cooldown');
    assert.equal((await User.findById(ari._id)).inventory.filter(card=>card==='SIGNAL_FLARE').length,2,'losing requests keep their card');
    assert.equal(await Notification.countDocuments({toUserId:maya._id,type:'SIGNAL_FLARE'}),0);
    assert.equal((await Friendship.findById(contract._id).select('+flareReceipts')).flareReceipts[0].done,false,'committed Flare keeps a durable pending delivery');
    notificationUnavailable=false;Notification.create=createNotification;
    await Promise.all([reconcileWorldActivity(),reconcileWorldActivity()]);assert.equal(await World.countDocuments({type:'SIGNAL_FLARE'}),1);assert.equal(await Notification.countDocuments({toUserId:maya._id,type:'SIGNAL_FLARE'}),1);
    assert.equal((await Friendship.findById(contract._id).select('+flareReceipts')).flareReceipts[0].done,true,'concurrent recovery completes once');
    const publicFlare=(await request(sol,'/world-activity')).data.events.find(event=>event.type==='SIGNAL_FLARE');assert.equal(publicFlare.actor.username,'ari');assert.equal(JSON.stringify(publicFlare).includes('Maya'),false);
    const before=(await worldFeed(sol._id)).unreadCount;assert.ok(before>0);await markWorldRead(testOne._id,[publicFlare.id]);assert.equal((await worldFeed(sol._id)).unreadCount,before,'another scope cannot clear your badge');
    await markWorldRead(sol._id,(await worldFeed(sol._id)).events.map(event=>event.id));assert.equal((await worldFeed(sol._id)).unreadCount,0);
    assert.equal((await request(sol,'/world-activity?before=bad')).status,400);assert.equal((await request(sol,'/world-activity/read',{eventIds:['bad']})).status,400);
    const at=new Date();await World.insertMany(Array.from({length:25},(_,index)=>({sourceEventId:new mongoose.Types.ObjectId(),scopeKey:'live',type:'DUO_LEVEL_UP',value:index+1,createdAt:at})));
    const page=await worldFeed(sol._id),next=await worldFeed(sol._id,{before:page.nextCursor});assert.equal(page.events.length,20);assert.equal(new Set([...page.events,...next.events].map(event=>event.id)).size,30);
    await World.create({sourceEventId:new mongoose.Types.ObjectId(),scopeKey:'live',type:'DUO_LEVEL_UP',value:999,createdAt:new Date(Date.now()-8*86400000)});assert.equal((await worldFeed(sol._id)).events.some(event=>event.value===999),false);
    console.log('World activity: real public Flare delivery, concurrent cooldown/card preservation, private-recipient and Duo projection, scope/privacy isolation, outbox recovery, unread acknowledgement, pagination and retention window passed.');
  }finally{if(server)await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();await mongo.stop();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
