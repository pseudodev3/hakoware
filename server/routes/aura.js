const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const AuraTransaction = require('../models/AuraTransaction');
const Notification = require('../models/Notification');
const { refreshGameState, recordEvent } = require('../services/contractGame');

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const GRUDGE_DAYS = 7;
const REVENGE_COST = 60;
const SIGNAL_FLARE_COOLDOWN_HOURS = 48;

const CARD_CATALOG = Object.freeze({
  PURIFY: {
    id: 'PURIFY',
    name: 'Clean Slate',
    cost: 120,
    description: 'Reset your debt across every active contract. Grace periods do not change.'
  },
  STEAL: {
    id: 'STEAL',
    name: 'Claim',
    cost: 180,
    description: 'Take 10% Aura from a bankrupt partner. Financially questionable. Spiritually rewarding.'
  },
  SIGNAL_FLARE: {
    id: 'SIGNAL_FLARE',
    name: 'Signal Flare',
    cost: 45,
    description: 'Send one high-visibility pressure signal to a contract partner. 48h cooldown per contract.'
  },
  CHAOS_TICKET: {
    id: 'CHAOS_TICKET',
    name: 'Chaos Ticket',
    cost: 90,
    description: 'Force your Chaos Contract to roll for its next anomaly now.'
  }
});

const calculateDebt = (perspective, now = new Date()) => {
  const limit = Number(perspective?.limit) || 7;
  const lastInteraction = new Date(perspective?.lastInteraction || now);
  const daysMissed = Math.floor(Math.max(0, now - lastInteraction) / DAY);
  return (perspective?.baseDebt || 0) + Math.max(0, daysMissed - limit);
};

const isBankruptPerspective = (perspective, now = new Date()) => {
  const limit = Number(perspective?.limit) || 7;
  return calculateDebt(perspective, now) >= limit * 2;
};

const activeGrudge = (grudge, now = new Date()) => Boolean(
  grudge?.active &&
  !grudge?.revengeUsed &&
  grudge?.expiresAt &&
  new Date(grudge.expiresAt) > now
);

const sameMoment = (left, right) => {
  if (!left || !right) return false;
  return new Date(left).getTime() === new Date(right).getTime();
};

const auraRankFromEarned = (earned = 0) => {
  const value = Math.max(0, Number(earned) || 0);
  const ranks = [
    { name: 'Spark', floor: 0, next: 250 },
    { name: 'Charged', floor: 250, next: 750 },
    { name: 'Radiant', floor: 750, next: 2000 },
    { name: 'Overflow', floor: 2000, next: 5000 },
    { name: 'Ascendant', floor: 5000, next: null }
  ];
  const rank = [...ranks].reverse().find((item) => value >= item.floor) || ranks[0];
  const progress = rank.next
    ? Math.max(0, Math.min(100, Math.round(((value - rank.floor) / (rank.next - rank.floor)) * 100)))
    : 100;
  return { name: rank.name, lifetimeEarned: value, nextRankAt: rank.next, progress };
};

const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);

const ensureWelcomeBonus = async (userId) => {
  let user = await User.findById(userId);
  if (!user) return null;

  const existing = await AuraTransaction.findOne({ userId: user._id, type: 'WELCOME_BONUS' });
  if (existing) {
    if (!user.welcomeAuraGranted) {
      await User.updateOne({ _id: user._id }, { $set: { welcomeAuraGranted: true } });
      user.welcomeAuraGranted = true;
    }
    if (!existing.idempotencyKey) {
      try {
        existing.idempotencyKey = `welcome:${user._id}`;
        await existing.save();
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }
    return user;
  }

  if (user.welcomeAuraGranted) {
    try {
      await AuraTransaction.create({
        userId: user._id,
        amount: 100,
        type: 'WELCOME_BONUS',
        description: 'Welcome to Hakoware',
        idempotencyKey: `welcome:${user._id}`
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    return user;
  }

  const granted = await User.findOneAndUpdate(
    { _id: user._id, welcomeAuraGranted: { $ne: true } },
    { $inc: { auraBalance: 100 }, $set: { welcomeAuraGranted: true } },
    { new: true }
  );

  if (granted) {
    try {
      await AuraTransaction.create({
        userId: granted._id,
        amount: 100,
        type: 'WELCOME_BONUS',
        description: 'Welcome to Hakoware',
        idempotencyKey: `welcome:${granted._id}`
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    return granted;
  }

  return User.findById(userId);
};

const addDailyBonusIfEligible = async (userId) => {
  const now = new Date();
  const key = dayKey(now);
  const user = await User.findById(userId);
  if (!user) return 0;
  if (user.lastDailyAuraBonusKey === key) return 0;

  const startOfDay = new Date(`${key}T00:00:00.000Z`);
  const endOfDay = new Date(startOfDay.getTime() + DAY);
  const existing = await AuraTransaction.findOne({
    userId: user._id,
    type: 'DAILY_BONUS',
    createdAt: { $gte: startOfDay, $lt: endOfDay }
  });

  if (existing) {
    await User.updateOne({ _id: user._id }, { $set: { lastDailyAuraBonusKey: key } });
    if (!existing.idempotencyKey) {
      try {
        existing.idempotencyKey = `daily:${user._id}:${key}`;
        await existing.save();
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }
    return 0;
  }

  const friendships = await Friendship.find({
    $or: [{ user1: user._id }, { user2: user._id }],
    status: 'ACTIVE'
  });
  if (friendships.length === 0) return 0;

  const debtFree = friendships.every((friendship) => {
    const isUser1 = friendship.user1.toString() === user._id.toString();
    const perspective = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
    return calculateDebt(perspective, now) === 0;
  });
  if (!debtFree) return 0;

  const updated = await User.findOneAndUpdate(
    { _id: user._id, lastDailyAuraBonusKey: { $ne: key } },
    { $inc: { auraBalance: 10 }, $set: { lastDailyAuraBonusKey: key } },
    { new: true }
  );
  if (!updated) return 0;

  try {
    await AuraTransaction.create({
      userId: updated._id,
      amount: 10,
      type: 'DAILY_BONUS',
      description: 'Daily clean-contract bonus',
      idempotencyKey: `daily:${updated._id}:${key}`
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
  return 10;
};

const buildAuraSummary = async (userId) => {
  let user = await ensureWelcomeBonus(userId);
  if (!user) return null;

  await addDailyBonusIfEligible(user._id);
  user = await User.findById(user._id);

  const [history, earned, spent, reputationEarned, count] = await Promise.all([
    AuraTransaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(40),
    AuraTransaction.aggregate([
      { $match: { userId: user._id, amount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    AuraTransaction.aggregate([
      { $match: { userId: user._id, amount: { $lt: 0 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    AuraTransaction.aggregate([
      {
        $match: {
          userId: user._id,
          amount: { $gt: 0 },
          type: { $nin: ['BOUNTY_REFUND', 'HUNTER_BOND_RETURN', 'REVENGE_STEAL'] }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    AuraTransaction.countDocuments({ userId: user._id })
  ]);

  const lifetimeEarned = reputationEarned[0]?.total || 0;
  return {
    balance: Number(user.auraBalance) || 0,
    totalEarned: earned[0]?.total || 0,
    totalSpent: Math.abs(spent[0]?.total || 0),
    totalTransactions: count,
    reputation: auraRankFromEarned(lifetimeEarned),
    history
  };
};

const publicGrudge = (friendship) => ({
  friendshipId: friendship._id,
  claimantId: friendship.grudge.claimantId,
  claimantName: friendship.grudge.claimantName,
  victimId: friendship.grudge.victimId,
  victimName: friendship.grudge.victimName,
  createdAt: friendship.grudge.createdAt,
  expiresAt: friendship.grudge.expiresAt,
  originalClaimAmount: friendship.grudge.originalClaimAmount || 0
});

router.get('/me', auth, async (req, res) => {
  try {
    const summary = await buildAuraSummary(req.user.id);
    if (!summary) return res.status(404).json({ msg: 'User not found' });
    return res.json(summary);
  } catch (err) {
    console.error('Aura summary failed:', err.message);
    return res.status(500).json({ msg: 'Could not load Aura' });
  }
});

router.get('/cards', auth, (req, res) => {
  res.json(Object.values(CARD_CATALOG));
});

router.get('/grudges/public', auth, async (req, res) => {
  try {
    const now = new Date();
    const friendships = await Friendship.find({
      status: 'ACTIVE',
      'grudge.active': true,
      'grudge.revengeUsed': { $ne: true },
      'grudge.expiresAt': { $gt: now }
    }).sort({ 'grudge.createdAt': -1 }).limit(100).lean();
    return res.json(friendships.map(publicGrudge));
  } catch (err) {
    console.error('Load public grudges failed:', err.message);
    return res.status(500).json({ msg: 'Could not load grudges' });
  }
});

router.get('/grudges/me', auth, async (req, res) => {
  try {
    const now = new Date();
    const friendships = await Friendship.find({
      status: 'ACTIVE',
      $or: [{ 'grudge.claimantId': req.user.id }, { 'grudge.victimId': req.user.id }],
      'grudge.active': true,
      'grudge.revengeUsed': { $ne: true },
      'grudge.expiresAt': { $gt: now }
    }).sort({ 'grudge.createdAt': -1 });

    return res.json(friendships.map((friendship) => {
      const isVictim = String(friendship.grudge.victimId) === String(req.user.id);
      const claimantIsUser1 = String(friendship.grudge.claimantId) === String(friendship.user1);
      const claimantPerspective = claimantIsUser1 ? friendship.user1Perspective : friendship.user2Perspective;
      return {
        ...publicGrudge(friendship),
        role: isVictim ? 'VICTIM' : 'CLAIMANT',
        revengeReady: isVictim && isBankruptPerspective(claimantPerspective, now),
        revengeCost: REVENGE_COST
      };
    }));
  } catch (err) {
    console.error('Load player grudges failed:', err.message);
    return res.status(500).json({ msg: 'Could not load your grudges' });
  }
});

router.post('/grudges/:friendshipId/revenge', auth, async (req, res) => {
  let reserved = false;
  try {
    const now = new Date();
    const friendship = await Friendship.findOne({
      _id: req.params.friendshipId,
      status: 'ACTIVE',
      'grudge.active': true,
      'grudge.revengeUsed': { $ne: true },
      'grudge.victimId': req.user.id,
      'grudge.expiresAt': { $gt: now }
    });
    if (!friendship) return res.status(404).json({ msg: 'No active revenge window on this contract' });

    const claimantId = friendship.grudge.claimantId;
    const claimantIsUser1 = String(claimantId) === String(friendship.user1);
    const claimantPerspective = claimantIsUser1 ? friendship.user1Perspective : friendship.user2Perspective;
    if (!isBankruptPerspective(claimantPerspective, now)) {
      return res.status(400).json({ msg: `${friendship.grudge.claimantName || 'They'} have not gone bankrupt yet` });
    }

    const claimant = await User.findById(claimantId).select('_id displayName auraBalance');
    if (!claimant) return res.status(404).json({ msg: 'Original claimer not found' });
    const stealAmount = Math.floor((Number(claimant.auraBalance) || 0) * 0.1);
    if (stealAmount <= 0) return res.status(400).json({ msg: 'They have no Aura to take right now' });

    const reservation = await Friendship.findOneAndUpdate(
      {
        _id: friendship._id,
        'grudge.active': true,
        'grudge.revengeUsed': { $ne: true },
        'grudge.victimId': req.user.id,
        'grudge.expiresAt': { $gt: now }
      },
      { $set: { 'grudge.active': false, 'grudge.revengeUsed': true } },
      { new: true }
    );
    if (!reservation) return res.status(409).json({ msg: 'That revenge window just changed' });
    reserved = true;

    const victim = await User.findOneAndUpdate(
      { _id: req.user.id, auraBalance: { $gte: REVENGE_COST } },
      { $inc: { auraBalance: -REVENGE_COST } },
      { new: true }
    ).select('_id displayName auraBalance');
    if (!victim) {
      await Friendship.updateOne({ _id: friendship._id }, { $set: { 'grudge.active': true, 'grudge.revengeUsed': false } });
      reserved = false;
      return res.status(400).json({ msg: `You need ${REVENGE_COST} Aura to return the favor` });
    }

    const debitedClaimant = await User.findOneAndUpdate(
      { _id: claimant._id, auraBalance: { $gte: stealAmount } },
      { $inc: { auraBalance: -stealAmount } },
      { new: true }
    );
    if (!debitedClaimant) {
      await Promise.all([
        User.updateOne({ _id: victim._id }, { $inc: { auraBalance: REVENGE_COST } }),
        Friendship.updateOne({ _id: friendship._id }, { $set: { 'grudge.active': true, 'grudge.revengeUsed': false } })
      ]);
      reserved = false;
      return res.status(409).json({ msg: 'Their Aura changed. Try revenge again.' });
    }

    await User.updateOne({ _id: victim._id }, { $inc: { auraBalance: stealAmount } });
    reserved = false;

    await Promise.all([
      AuraTransaction.create({ userId: victim._id, amount: -REVENGE_COST, type: 'REVENGE_FEE', description: `Returned the favor to ${claimant.displayName}` }),
      AuraTransaction.create({ userId: claimant._id, amount: -stealAmount, type: 'REVENGE_LOSS', description: `Aura taken in revenge by ${victim.displayName}` }),
      AuraTransaction.create({ userId: victim._id, amount: stealAmount, type: 'REVENGE_STEAL', description: `Revenge Claim on ${claimant.displayName}` })
    ]);

    await recordEvent(friendship._id, 'GRUDGE_REVENGE', {
      userId: victim._id,
      aura: stealAmount - REVENGE_COST,
      metadata: { claimantId: claimant._id, stealAmount, revengeCost: REVENGE_COST }
    }).catch(() => null);

    await Promise.all([
      Notification.create({
        toUserId: claimant._id,
        fromUserId: victim._id,
        type: 'GAME_EVENT',
        title: 'RETURN THE FAVOR',
        message: `${victim.displayName} caught you bankrupt and took ${stealAmount} Aura back. The Grudge is settled.`,
        friendshipId: friendship._id
      }).catch(() => null),
      Notification.create({
        toUserId: victim._id,
        fromUserId: claimant._id,
        type: 'GAME_EVENT',
        title: 'Revenge collected',
        message: `You spent ${REVENGE_COST} Aura to take ${stealAmount} from ${claimant.displayName}. Financially questionable. Completely justified.`,
        friendshipId: friendship._id
      }).catch(() => null)
    ]);

    const freshVictim = await User.findById(victim._id).select('auraBalance');
    return res.json({ success: true, stolen: stealAmount, cost: REVENGE_COST, balance: freshVictim?.auraBalance ?? victim.auraBalance });
  } catch (err) {
    if (reserved) {
      await Friendship.updateOne({ _id: req.params.friendshipId }, { $set: { 'grudge.active': true, 'grudge.revengeUsed': false } }).catch(() => null);
    }
    console.error('Revenge Claim failed:', err.message);
    return res.status(500).json({ msg: 'Could not return the favor' });
  }
});

router.post('/buy-card', auth, async (req, res) => {
  try {
    const card = CARD_CATALOG[String(req.body.cardId || '').toUpperCase()];
    if (!card) return res.status(400).json({ msg: 'Unknown card' });

    const user = await User.findOneAndUpdate(
      { _id: req.user.id, auraBalance: { $gte: card.cost } },
      { $inc: { auraBalance: -card.cost }, $push: { inventory: card.id } },
      { new: true }
    );

    if (!user) {
      const exists = await User.exists({ _id: req.user.id });
      return res.status(exists ? 400 : 404).json({ msg: exists ? 'Not enough Aura' : 'User not found' });
    }

    await AuraTransaction.create({
      userId: user._id,
      amount: -card.cost,
      type: 'MARKETPLACE_PURCHASE',
      description: `Purchased ${card.name}`
    });

    return res.json({ success: true, balance: user.auraBalance, inventory: user.inventory, card });
  } catch (err) {
    console.error('Card purchase failed:', err.message);
    return res.status(500).json({ msg: 'Could not purchase card' });
  }
});

router.post('/use-card', auth, async (req, res) => {
  try {
    const cardId = String(req.body.cardId || '').toUpperCase();
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (!CARD_CATALOG[cardId]) return res.status(400).json({ msg: 'Unknown card' });
    if (!user.inventory.includes(cardId)) return res.status(400).json({ msg: 'Card not found in inventory' });

    let effect = null;

    if (cardId === 'PURIFY') {
      const friendships = await Friendship.find({
        $or: [{ user1: user._id }, { user2: user._id }],
        status: 'ACTIVE'
      });
      const now = new Date();
      const withDebt = friendships.filter((friendship) => {
        const isUser1 = friendship.user1.toString() === req.user.id;
        const perspective = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
        return calculateDebt(perspective, now) > 0;
      });
      if (withDebt.length === 0) return res.status(400).json({ msg: 'You do not have any debt to clear' });

      for (const friendship of withDebt) {
        const isUser1 = friendship.user1.toString() === req.user.id;
        const key = isUser1 ? 'user1Perspective' : 'user2Perspective';
        friendship[key].baseDebt = 0;
        friendship[key].lastInteraction = now;
        friendship[key].calculatedDebt = 0;
        friendship[key].daysMissed = 0;
        friendship[key].isBankrupt = false;
        friendship[key].isInWarningZone = false;
        await friendship.save();
      }
      effect = { clearedContracts: withDebt.length };
    }

    if (cardId === 'STEAL') {
      const friendship = await Friendship.findById(req.body.targetFriendshipId);
      if (!friendship || friendship.status !== 'ACTIVE') return res.status(404).json({ msg: 'Contract not found' });

      const isUser1 = friendship.user1.toString() === req.user.id;
      const isUser2 = friendship.user2.toString() === req.user.id;
      if (!isUser1 && !isUser2) return res.status(403).json({ msg: 'Not authorized' });
      if (activeGrudge(friendship.grudge)) return res.status(400).json({ msg: 'This contract already has an active Grudge. Settle that beef first.' });

      const targetId = isUser1 ? friendship.user2 : friendship.user1;
      const targetPerspective = isUser1 ? friendship.user2Perspective : friendship.user1Perspective;
      if (!isBankruptPerspective(targetPerspective)) {
        return res.status(400).json({ msg: 'This contract partner is not bankrupt' });
      }

      const targetSide = isUser1 ? 'user2' : 'user1';
      const windowKeyField = `${targetSide}WindowKey`;
      const lastClaimedField = `${targetSide}LastClaimedAt`;
      if (sameMoment(friendship.claimState?.[windowKeyField], targetPerspective.lastInteraction)) {
        return res.status(400).json({ msg: 'You already Claimed this bankruptcy window. They need to recover before you can do it again.' });
      }

      const target = await User.findById(targetId);
      if (!target) return res.status(404).json({ msg: 'Target not found' });
      const amount = Math.floor((target.auraBalance || 0) * 0.1);
      if (amount <= 0) return res.status(400).json({ msg: 'There is no Aura to claim from this partner' });

      target.auraBalance -= amount;
      user.auraBalance += amount;
      await target.save();

      const now = new Date();
      friendship.claimState[windowKeyField] = targetPerspective.lastInteraction;
      friendship.claimState[lastClaimedField] = now;
      friendship.grudge = {
        active: true,
        claimantId: user._id,
        victimId: target._id,
        claimantName: user.displayName,
        victimName: target.displayName,
        createdAt: now,
        expiresAt: new Date(now.getTime() + GRUDGE_DAYS * DAY),
        revengeUsed: false,
        originalClaimAmount: amount
      };
      await friendship.save();

      await Promise.all([
        AuraTransaction.create({
          userId: target._id,
          amount: -amount,
          type: 'SPELL_EFFECT',
          description: `Aura claimed by ${user.displayName}`
        }),
        AuraTransaction.create({
          userId: user._id,
          amount,
          type: 'SPELL_EFFECT',
          description: `Claimed Aura from ${target.displayName}`
        })
      ]);

      await recordEvent(friendship._id, 'CLAIM_USED', {
        userId: user._id,
        aura: amount,
        metadata: { targetId: target._id, amount, grudgeExpiresAt: friendship.grudge.expiresAt }
      }).catch(() => null);

      await Promise.all([
        Notification.create({
          toUserId: target._id,
          fromUserId: user._id,
          type: 'GAME_EVENT',
          title: "YOU'VE BEEN CLAIMED",
          message: `${user.displayName} spent 180 Aura just to take ${amount} from you. A public Grudge is active for ${GRUDGE_DAYS} days.`,
          friendshipId: friendship._id
        }).catch(() => null),
        Notification.create({
          toUserId: user._id,
          fromUserId: target._id,
          type: 'GAME_EVENT',
          title: 'Claim complete',
          message: `You took ${amount} Aura from ${target.displayName}. They now have ${GRUDGE_DAYS} days to catch you bankrupt.`,
          friendshipId: friendship._id
        }).catch(() => null)
      ]);
      effect = { stolen: amount, grudgeExpiresAt: friendship.grudge.expiresAt };
    }

    if (cardId === 'SIGNAL_FLARE') {
      const friendship = await Friendship.findById(req.body.targetFriendshipId);
      if (!friendship || friendship.status !== 'ACTIVE') return res.status(404).json({ msg: 'Choose an active contract' });
      const isUser1 = friendship.user1.toString() === req.user.id;
      const isUser2 = friendship.user2.toString() === req.user.id;
      if (!isUser1 && !isUser2) return res.status(403).json({ msg: 'Not authorized' });

      const flareField = isUser1 ? 'user1LastFlareAt' : 'user2LastFlareAt';
      const previous = friendship.claimState?.[flareField] ? new Date(friendship.claimState[flareField]) : null;
      const now = new Date();
      if (previous && now - previous < SIGNAL_FLARE_COOLDOWN_HOURS * HOUR) {
        const hoursLeft = Math.max(1, Math.ceil((SIGNAL_FLARE_COOLDOWN_HOURS * HOUR - (now - previous)) / HOUR));
        return res.status(400).json({ msg: `Signal Flare is cooling down on this contract · ${hoursLeft}h left` });
      }

      const targetId = isUser1 ? friendship.user2 : friendship.user1;
      friendship.claimState[flareField] = now;
      await friendship.save();
      await Notification.create({
        toUserId: targetId,
        fromUserId: user._id,
        type: 'GAME_EVENT',
        title: 'SIGNAL FLARE',
        message: `${user.displayName} burned Aura to make sure you saw this: your contract is waiting.`,
        friendshipId: friendship._id
      });
      await recordEvent(friendship._id, 'SIGNAL_FLARE', { userId: user._id, metadata: { targetId, cooldownHours: SIGNAL_FLARE_COOLDOWN_HOURS } }).catch(() => null);
      effect = { cooldownHours: SIGNAL_FLARE_COOLDOWN_HOURS };
    }

    if (cardId === 'CHAOS_TICKET') {
      const friendship = await Friendship.findById(req.body.targetFriendshipId);
      if (!friendship || friendship.status !== 'ACTIVE') return res.status(404).json({ msg: 'Choose an active Chaos Contract' });
      const participant = [friendship.user1.toString(), friendship.user2.toString()].includes(req.user.id);
      if (!participant) return res.status(403).json({ msg: 'Not authorized' });
      if (friendship.templateId !== 'CHAOS') return res.status(400).json({ msg: 'Chaos Ticket only works on a Chaos Contract' });
      if (friendship.chaos?.activeEvent) return res.status(400).json({ msg: 'This contract already has a live anomaly' });
      friendship.chaos.nextEventAt = new Date();
      await friendship.save();
      await refreshGameState(friendship);
      await recordEvent(friendship._id, 'CHAOS_TICKET_USED', { userId: user._id }).catch(() => null);
      effect = { anomalyRollTriggered: true };
    }

    const cardIndex = user.inventory.indexOf(cardId);
    user.inventory.splice(cardIndex, 1);
    await user.save();
    return res.json({ success: true, balance: user.auraBalance, inventory: user.inventory, effect });
  } catch (err) {
    console.error('Use card failed:', err.message);
    return res.status(500).json({ msg: 'Could not use card' });
  }
});

module.exports = router;
