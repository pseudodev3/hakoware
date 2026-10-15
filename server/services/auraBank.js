const User = require('../models/User');
const Friendship = require('../models/Friendship');
const AuraTransaction = require('../models/AuraTransaction');
const { duoStateFromXP } = require('./contractGame');
const mongoose = require('mongoose');
const { createHash } = require('node:crypto');
const DAY = 86400000;
const AMOUNTS = Object.freeze([25, 50, 100]);
const projection = '+auraBank +auraWalletReceipts';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const retryKey = value => { if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(value)) fail(400, 'A bank retry key is required'); return value; };
const upsertOnce = async (query, values) => {
  if (await AuraTransaction.exists(query)) return; // Keep historical random-ID entries.
  const entryId = new mongoose.Types.ObjectId(createHash('sha256').update('aura-wallet-journal:v1:' + query.idempotencyKey).digest('hex').slice(0, 24));
  try { await AuraTransaction.updateOne({ _id: entryId }, { $setOnInsert: { ...values, ...query } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000 || !await AuraTransaction.exists({ _id: entryId, ...query })) throw error; }
};
const journalReceipt = async (userId, receipt) => {
  const key = `wallet:${userId}:${receipt.key}`;
  await upsertOnce({ idempotencyKey: key }, { userId, amount: receipt.kind === 'REPAY' ? -receipt.amount : receipt.amount, type: receipt.type, description: receipt.description, metadata: receipt.metadata || {}, createdAt: receipt.createdAt });
  if (receipt.repaid > 0) await upsertOnce({ idempotencyKey: key + ':repayment' }, { userId, amount: -receipt.repaid, type: 'BANK_AUTOPAY', description: 'Aura bank · automatic repayment from earnings', createdAt: receipt.createdAt });
  await User.updateOne({ _id: userId }, { $set: { 'auraWalletReceipts.$[receipt].journaled': true } }, { arrayFilters: [{ 'receipt.key': receipt.key }] });
};
const finishReceipt = async (userId, receipt) => { if (!receipt.journaled) await journalReceipt(userId, receipt).catch(error => console.error('Aura wallet journal pending:', error.message)); };
const preserveDuoCredit = async friendship => {
  if (!friendship || friendship.status === 'PENDING') return;
  const level = duoStateFromXP(friendship.duoXP).level;
  const limit = level >= 5 ? 100 : level >= 2 ? 50 : 25;
  if (limit === 25) return;
  await User.updateMany({ _id: { $in: [friendship.user1, friendship.user2] } }, { $max: { 'auraBank.creditLimit': limit } });
};
const duoCredit = async (userId) => {
  const contracts = await Friendship.find({ status: 'ACTIVE', $or: [{ user1: userId }, { user2: userId }] }).select('duoXP user1Perspective user2Perspective season').lean();
  const established = contracts.some(contract => {
    const start = new Date(contract.season?.startedAt).getTime();
    const one = new Date(contract.user1Perspective?.lastInteraction).getTime();
    const two = new Date(contract.user2Perspective?.lastInteraction).getTime();
    return Number.isFinite(start) && one > start && two > start && one <= Date.now() && two <= Date.now();
  });
  return { established, level: Math.max(1, ...contracts.map(contract => duoStateFromXP(contract.duoXP).level)) };
};
const loanHistory = receipts => {
  let completed = 0, remaining = 0, principal = null;
  for (const receipt of receipts) {
    if (receipt.kind === 'BORROW') { principal = receipt.amount; remaining = receipt.amount; }
    else if (remaining > 0 && (receipt.kind === 'REPAY' || receipt.kind === 'EARNING' && receipt.repaid > 0)) {
      remaining = Math.max(0, remaining - (receipt.kind === 'REPAY' ? receipt.amount : receipt.repaid));
      if (remaining === 0) completed += 1;
    }
  }
  return { completed, principal };
};
const bankView = async userId => {
  const user = await User.findById(userId).select(projection);
  if (!user) fail(404, 'Account not found');
  const outstanding = Number(user.auraBank?.outstanding) || 0;
  const nextBorrowAt = user.auraBank?.lastBorrowedAt ? new Date(new Date(user.auraBank.lastBorrowedAt).getTime() + 7 * DAY) : null;
  const { established, level } = await duoCredit(userId);
  const history = loanHistory(user.auraWalletReceipts || []);
  const previousLimit = Math.max(25, ...[user.auraBank?.creditLimit, ...(user.auraWalletReceipts || []).filter(receipt => receipt.kind === 'BORROW').map(receipt => receipt.amount)].filter(amount => AMOUNTS.includes(amount)));
  const tiers = [
    { id: 'starter', name: 'Starter', limit: 25, unlocked: true, requirement: 'Start with a mutual check-in.' },
    { id: 'connected', name: 'Connected', limit: 50, unlocked: previousLimit >= 50 || level >= 2 || history.completed >= 1, requirement: 'Duo Level 2 or one repaid loan.' },
    { id: 'trusted', name: 'Trusted', limit: 100, unlocked: previousLimit >= 100 || level >= 5 || history.completed >= 3, requirement: 'Duo Level 5 or three repaid loans.' }
  ];
  const tier = tiers.filter(value => value.unlocked).at(-1);
  if (tier.limit > (user.auraBank?.creditLimit || 0)) await User.updateOne({ _id: userId }, { $max: { 'auraBank.creditLimit': tier.limit } });
  const reason = outstanding > 0 ? 'Repay your current loan before borrowing again.' : nextBorrowAt && nextBorrowAt > new Date() ? 'Your next loan opens after the seven-day cooldown.' : !established ? 'Make a valid check-in together in an accepted Duo first.' : user.auraBalance > 50 ? 'Loans open when your balance is 50 Aura or less.' : null;
  const principal = history.principal && outstanding <= history.principal ? history.principal : null;
  const recent = (user.auraWalletReceipts || []).map((receipt, index) => ({ receipt, index })).filter(({ receipt }) => ['BORROW', 'REPAY'].includes(receipt.kind) || receipt.kind === 'EARNING' && receipt.repaid > 0).slice(-6).reverse().map(({ receipt, index }) => ({ id: 'bank-' + index, kind: receipt.kind === 'EARNING' ? 'AUTOPAY' : receipt.kind, amount: receipt.kind === 'EARNING' ? receipt.repaid : receipt.amount, createdAt: receipt.createdAt }));
  return {
    balance: user.auraBalance, outstanding, principal, repaid: principal === null ? null : Math.max(0, principal - outstanding), repaymentProgress: principal === null ? null : Math.round((principal - outstanding) / principal * 100), completedLoans: history.completed,
    nextBorrowAt, amounts: AMOUNTS.filter(amount => amount <= tier.limit), eligible: !reason, reason, interest: 0, repaymentPercent: 50, maxLoan: tier.limit, tier, tiers, recent,
    checks: [
      { id: 'duo', label: 'A mutual Duo check-in', done: established },
      { id: 'balance', label: '50 Aura or less in your wallet', done: user.auraBalance <= 50 },
      { id: 'loan', label: 'Your previous loan is clear', done: outstanding === 0 },
      { id: 'cooldown', label: 'Seven days since your last loan', done: !nextBorrowAt || nextBorrowAt <= new Date() }
    ]
  };
};
const bankAction = async (userId, kind, body = {}) => {
  const clientId = retryKey(body.clientId);
  const amount = body.amount;
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100 || kind === 'BORROW' && !AMOUNTS.includes(amount)) fail(400, 'Choose a valid whole-Aura amount');
  const key = `bank:${clientId}`;
  let user = await User.findById(userId).select(projection);
  if (!user) fail(404, 'Account not found');
  let receipt = user.auraWalletReceipts.find(value => value.key === key);
  if (!receipt) {
    if (kind === 'BORROW') {
      const credit = await bankView(userId);
      if (!credit.checks.find(check => check.id === 'duo').done) fail(409, 'Check in together in an accepted Duo before borrowing.');
      if (amount > credit.maxLoan) fail(409, `Your ${credit.tier.name} limit is ${credit.maxLoan} Aura. Grow a Duo or repay loans to unlock more.`);
    }
    const conditions = kind === 'BORROW' ? { auraBalance: { $lte: 50 }, $and: [{ $or: [{ 'auraBank.outstanding': 0 }, { 'auraBank.outstanding': { $exists: false } }] }, { $or: [{ 'auraBank.lastBorrowedAt': null }, { 'auraBank.lastBorrowedAt': { $lte: new Date(Date.now() - 7 * DAY) } }] }] } : { auraBalance: { $gte: amount }, 'auraBank.outstanding': { $gte: amount } };
    const at = new Date();
    const values = { key, kind, amount, repaid: 0, type: kind === 'BORROW' ? 'BANK_LOAN' : 'BANK_REPAYMENT', description: kind === 'BORROW' ? 'Aura bank · interest-free loan' : 'Aura bank · manual repayment', createdAt: at, journaled: false };
    const update = [{ $set: { auraBalance: { $add: [{ $ifNull: ['$auraBalance', 0] }, kind === 'BORROW' ? amount : -amount] }, 'auraBank.outstanding': { $add: [{ $ifNull: ['$auraBank.outstanding', 0] }, kind === 'BORROW' ? amount : -amount] }, ...(kind === 'BORROW' ? { 'auraBank.lastBorrowedAt': at } : {}), auraWalletReceipts: { $concatArrays: [{ $ifNull: ['$auraWalletReceipts', []] }, [{ $literal: values }]] } } }];
    user = await User.findOneAndUpdate({ _id: userId, 'auraWalletReceipts.key': { $ne: key }, ...conditions }, update, { returnDocument: 'after', updatePipeline: true }).select(projection) || await User.findById(userId).select(projection);
    receipt = user?.auraWalletReceipts.find(value => value.key === key);
    if (!receipt) fail(409, kind === 'BORROW' ? 'This loan is unavailable. Refresh your bank balance and eligibility.' : 'Your balance or remaining loan changed. Refresh before repaying.');
  }
  if (receipt.kind !== kind || receipt.amount !== amount) fail(409, 'This retry key belongs to another bank action.');
  await finishReceipt(userId, receipt);
  return { success: true, bank: await bankView(userId) };
};

// Balance, loan repayment and its durable receipt commit in one user update.
const creditAuraEarnings = async (userId, amount, type, description, key, extra = {}) => {
  if (!Number.isSafeInteger(amount) || amount <= 0) return false;
  if (!['DAILY_BONUS', 'CHAOS_BONUS', 'BOUNTY_REWARD', 'GAME_REWARD'].includes(type)) throw new Error('Unsupported bank earnings type');
  let user = await User.findById(userId).select(projection);
  if (!user) return false;
  let receipt = user.auraWalletReceipts.find(value => value.key === key);
  if (!receipt) {
    const at = new Date();
    user = await User.findOneAndUpdate({ _id: userId, 'auraWalletReceipts.key': { $ne: key }, ...(extra.filter || {}) }, [
      { $set: { _walletRepayment: { $min: [{ $ifNull: ['$auraBank.outstanding', 0] }, Math.ceil(amount / 2)] } } },
      { $set: { auraBalance: { $add: [{ $ifNull: ['$auraBalance', 0] }, { $subtract: [amount, '$_walletRepayment'] }] }, 'auraBank.outstanding': { $subtract: [{ $ifNull: ['$auraBank.outstanding', 0] }, '$_walletRepayment'] }, ...(extra.set || {}), auraWalletReceipts: { $concatArrays: [{ $ifNull: ['$auraWalletReceipts', []] }, [{ key: { $literal: key }, kind: 'EARNING', amount, repaid: '$_walletRepayment', type: { $literal: type }, description: { $literal: description }, metadata: { $literal: extra.metadata || {} }, createdAt: at, journaled: false }]] } } },
      { $unset: '_walletRepayment' }
    ], { returnDocument: 'after', updatePipeline: true }).select(projection) || await User.findById(userId).select(projection);
    receipt = user?.auraWalletReceipts.find(value => value.key === key);
    if (!receipt) return false;
  }
  if (receipt.kind !== 'EARNING' || receipt.amount !== amount || receipt.type !== type) throw new Error('Earnings receipt mismatch');
  await finishReceipt(userId, receipt);
  return true;
};
const reconcileAuraWallet = async userId => {
  const people = await User.find({ ...(userId ? { _id: userId } : {}), 'auraWalletReceipts.journaled': false }).select({ _id: 1, auraWalletReceipts: 1 }).limit(50).lean();
  for (const person of people) for (const receipt of person.auraWalletReceipts.filter(value => !value.journaled).slice(0, 30)) await journalReceipt(person._id, receipt);
};
module.exports = { bankView, bankAction, creditAuraEarnings, reconcileAuraWallet, preserveDuoCredit };
