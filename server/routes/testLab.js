const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = express.Router();
const auth = require('../middleware/auth');
const founder = require('../middleware/founder');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const Bounty = require('../models/Bounty');
const AuraTransaction = require('../models/AuraTransaction');
const ContractEvent = require('../models/ContractEvent');
const Notification = require('../models/Notification');
const PendingInvite = require('../models/PendingInvite');
const VoiceNote = require('../models/VoiceNote');
const { deleteObject } = require('../services/bucketStorage');
const {
  TEMPLATES,
  CHAOS_EVENTS,
  initializeContractGame,
  activateSeason,
  refreshGameState,
  triggerChaosEvent,
  recordEvent
} = require('../services/contractGame');

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

router.use(auth, founder);

const ownedPlayers = (ownerId) => User.find({ isTestAccount: true, testOwnerId: ownerId })
  .select('_id displayName username email auraBalance inventory isTestAccount testOwnerId')
  .sort({ createdAt: 1 });

const playerView = (user) => ({
  _id: user._id,
  displayName: user.displayName,
  username: user.username || null,
  email: user.email,
  auraBalance: Number(user.auraBalance) || 0,
  inventory: user.inventory || [],
  isTestAccount: true,
  testOwnerId: user.testOwnerId
});

const ownedPlayer = async (ownerId, playerId) => User.findOne({
  _id: playerId,
  isTestAccount: true,
  testOwnerId: ownerId
});

const ownedContract = async (ownerId, friendshipId) => {
  const players = await User.find({ isTestAccount: true, testOwnerId: ownerId }).select('_id');
  const ids = players.map((player) => player._id);
  return Friendship.findOne({
    _id: friendshipId,
    user1: { $in: ids },
    user2: { $in: ids }
  });
};

const contractView = async (friendship) => {
  const populated = await Friendship.findById(friendship._id)
    .populate('user1', 'displayName username email auraBalance isTestAccount')
    .populate('user2', 'displayName username email auraBalance isTestAccount')
    .lean();
  return populated;
};

const labSnapshot = async (ownerId) => {
  const players = await ownedPlayers(ownerId);
  const ids = players.map((player) => player._id);
  const contracts = ids.length
    ? await Friendship.find({ user1: { $in: ids }, user2: { $in: ids } })
      .populate('user1', 'displayName username email auraBalance isTestAccount')
      .populate('user2', 'displayName username email auraBalance isTestAccount')
      .sort({ createdAt: -1 })
      .lean()
    : [];

  return {
    players: players.map(playerView),
    contracts,
    templates: Object.values(TEMPLATES).map(({ id, name, limit, seasonDays }) => ({ id, name, limit, seasonDays })),
    chaosEvents: CHAOS_EVENTS.map(({ type, name, description, minLevel, durationHours, requiredSource }) => ({
      type, name, description, minLevel, durationHours, requiredSource: requiredSource || null
    }))
  };
};

router.get('/status', async (req, res) => {
  try {
    return res.json({ enabled: true, ...(await labSnapshot(req.user.id)) });
  } catch (error) {
    console.error('Founder lab status failed:', error.message);
    return res.status(500).json({ msg: 'Could not load Founder Test Lab' });
  }
});

router.post('/players', async (req, res) => {
  try {
    const displayName = String(req.body.displayName || '').trim().slice(0, 32);
    if (displayName.length < 2) return res.status(400).json({ msg: 'Test player name must be at least 2 characters' });

    const count = await User.countDocuments({ isTestAccount: true, testOwnerId: req.user.id });
    if (count >= 8) return res.status(400).json({ msg: 'Founder Lab is limited to 8 test players at once' });

    const unique = crypto.randomBytes(5).toString('hex');
    const password = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    const testUsername = `test_${unique}`;
    const user = await User.create({
      displayName,
      username: testUsername,
      usernameNormalized: testUsername,
      email: `test-${String(req.user.id).slice(-8)}-${unique}@hakoware.test`,
      password,
      auraBalance: 500,
      welcomeAuraGranted: true,
      isTestAccount: true,
      testOwnerId: req.user.id,
      emailVerified: true
    });

    await AuraTransaction.create({
      userId: user._id,
      amount: 500,
      type: 'TEST_SEED',
      description: 'Founder Lab starting Aura'
    });

    return res.status(201).json({ player: playerView(user), snapshot: await labSnapshot(req.user.id) });
  } catch (error) {
    console.error('Create test player failed:', error.message);
    return res.status(500).json({ msg: 'Could not create test player' });
  }
});

router.post('/contracts', async (req, res) => {
  try {
    const user1 = await ownedPlayer(req.user.id, req.body.user1Id);
    const user2 = await ownedPlayer(req.user.id, req.body.user2Id);
    if (!user1 || !user2) return res.status(404).json({ msg: 'Choose two Founder Lab players' });
    if (String(user1._id) === String(user2._id)) return res.status(400).json({ msg: 'A player cannot contract with themselves' });

    const templateId = String(req.body.templateId || 'DONT_GHOST').toUpperCase();
    if (!TEMPLATES[templateId]) return res.status(400).json({ msg: 'Unknown contract mode' });

    const existing = await Friendship.findOne({
      $or: [
        { user1: user1._id, user2: user2._id },
        { user1: user2._id, user2: user1._id }
      ]
    });
    if (existing) return res.status(400).json({ msg: 'Those test players already have a contract. Reset the Lab to recreate it.' });

    const friendship = new Friendship({
      user1: user1._id,
      user2: user2._id,
      user1DisplayName: user1.displayName,
      user2DisplayName: user2.displayName,
      status: 'ACTIVE',
      isTestData: true,
      testOwnerId: req.user.id
    });
    initializeContractGame(friendship, templateId, req.body.limit);
    await friendship.save();
    await activateSeason(friendship);

    return res.status(201).json({ contract: await contractView(friendship), snapshot: await labSnapshot(req.user.id) });
  } catch (error) {
    console.error('Create test contract failed:', error.message);
    return res.status(500).json({ msg: 'Could not create test contract' });
  }
});

router.patch('/contracts/:id/state', async (req, res) => {
  try {
    const friendship = await ownedContract(req.user.id, req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Test contract not found' });

    const target = await ownedPlayer(req.user.id, req.body.targetUserId);
    if (!target) return res.status(404).json({ msg: 'Test target not found' });

    const isUser1 = String(friendship.user1) === String(target._id);
    const isUser2 = String(friendship.user2) === String(target._id);
    if (!isUser1 && !isUser2) return res.status(400).json({ msg: 'Target is not on this contract' });

    const state = String(req.body.state || '').toUpperCase();
    const key = isUser1 ? 'user1Perspective' : 'user2Perspective';
    const perspective = friendship[key];
    const limit = Math.max(1, Number(perspective.limit) || 7);
    const now = new Date();
    const wasBankrupt = Boolean(perspective.isBankrupt);

    let elapsedMs = 0;
    if (state === 'READY') elapsedMs = 21 * HOUR;
    else if (state === 'OVERDUE') elapsedMs = (limit + 1) * DAY;
    else if (state === 'BANKRUPT') elapsedMs = (limit * 3) * DAY;
    else if (state !== 'CLEAR') return res.status(400).json({ msg: 'State must be CLEAR, READY, OVERDUE or BANKRUPT' });

    const daysMissed = Math.floor(elapsedMs / DAY);
    const debt = Math.max(0, daysMissed - limit);
    perspective.baseDebt = 0;
    perspective.lastInteraction = new Date(now.getTime() - elapsedMs);
    perspective.calculatedDebt = debt;
    perspective.calculatedAt = now;
    perspective.daysMissed = daysMissed;
    perspective.isBankrupt = debt >= limit * 2;
    perspective.isInWarningZone = debt > 0 && !perspective.isBankrupt;
    perspective.daysUntilBankrupt = Math.max(0, (limit * 2) - debt);
    perspective.recoveryRequired = false;
    perspective.wasBankrupt = perspective.wasBankrupt || perspective.isBankrupt;
    perspective.bankruptAt = perspective.isBankrupt ? (perspective.bankruptAt || now) : perspective.bankruptAt;
    await friendship.save();

    if (perspective.isBankrupt && !wasBankrupt) {
      await recordEvent(friendship._id, 'BANKRUPTCY', {
        userId: target._id,
        metadata: {
          debt,
          limit,
          season: friendship.season?.number,
          forcedByFounderLab: true
        }
      });
    }

    return res.json({ state, target: playerView(target), contract: await contractView(friendship) });
  } catch (error) {
    console.error('Set test contract state failed:', error.message);
    return res.status(500).json({ msg: 'Could not change test contract state' });
  }
});

router.post('/contracts/:id/season-complete', async (req, res) => {
  try {
    const friendship = await ownedContract(req.user.id, req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Test contract not found' });
    friendship.season.endsAt = new Date(Date.now() - 1000);
    await friendship.save();
    await refreshGameState(friendship);
    return res.json({ contract: await contractView(friendship) });
  } catch (error) {
    console.error('Complete test season failed:', error.message);
    return res.status(500).json({ msg: 'Could not complete test season' });
  }
});

router.post('/contracts/:id/chaos', async (req, res) => {
  try {
    const friendship = await ownedContract(req.user.id, req.params.id);
    if (!friendship) return res.status(404).json({ msg: 'Test contract not found' });
    if (friendship.templateId !== 'CHAOS') return res.status(400).json({ msg: 'Choose a Chaos Contract' });

    const target = await ownedPlayer(req.user.id, req.body.targetUserId);
    if (!target || ![String(friendship.user1), String(friendship.user2)].includes(String(target._id))) {
      return res.status(400).json({ msg: 'Choose a player on this contract' });
    }

    friendship.chaos.activeEvent = null;
    friendship.chaos.wantedUntil = null;
    friendship.chaos.lastConsequence = null;
    await friendship.save();

    const event = await triggerChaosEvent(friendship, new Date(), {
      type: String(req.body.type || '').toUpperCase(),
      targetUserId: target._id
    });
    return res.json({ event, contract: await contractView(friendship) });
  } catch (error) {
    console.error('Trigger test Chaos failed:', error.message);
    return res.status(error.status || 500).json({ msg: error.message || 'Could not trigger Chaos' });
  }
});

router.patch('/players/:id/aura', async (req, res) => {
  try {
    const player = await ownedPlayer(req.user.id, req.params.id);
    if (!player) return res.status(404).json({ msg: 'Test player not found' });

    const balance = Math.max(0, Math.min(10000, Math.floor(Number(req.body.balance))));
    if (!Number.isFinite(balance)) return res.status(400).json({ msg: 'Enter a valid Aura balance' });
    const previous = Number(player.auraBalance) || 0;
    player.auraBalance = balance;
    await player.save();

    const delta = balance - previous;
    if (delta !== 0) {
      await AuraTransaction.create({
        userId: player._id,
        amount: delta,
        type: 'TEST_ADJUSTMENT',
        description: 'Founder Lab Aura adjustment'
      });
    }

    return res.json({ player: playerView(player) });
  } catch (error) {
    console.error('Adjust test Aura failed:', error.message);
    return res.status(500).json({ msg: 'Could not adjust test Aura' });
  }
});

router.post('/players/:id/impersonate', async (req, res) => {
  try {
    const player = await ownedPlayer(req.user.id, req.params.id);
    if (!player) return res.status(404).json({ msg: 'Test player not found' });

    const token = jwt.sign(
      { user: { id: player.id, v: Number(player.authVersion) || 0 } },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );
    return res.json({ token, user: playerView(player) });
  } catch (error) {
    console.error('Impersonate test player failed:', error.message);
    return res.status(500).json({ msg: 'Could not enter test session' });
  }
});

router.delete('/reset', async (req, res) => {
  try {
    const players = await User.find({ isTestAccount: true, testOwnerId: req.user.id }).select('_id email');
    const ids = players.map((player) => player._id);
    const emails = players.map((player) => player.email);
    if (!ids.length) return res.json({ success: true, deletedPlayers: 0 });

    const friendships = await Friendship.find({
      $or: [{ user1: { $in: ids } }, { user2: { $in: ids } }]
    }).select('_id');
    const friendshipIds = friendships.map((friendship) => friendship._id);
    const voiceNotes = await VoiceNote.find({
      $or: [
        { senderId: { $in: ids } },
        { recipientId: { $in: ids } },
        { friendshipId: { $in: friendshipIds } }
      ]
    }).select('storageKey');

    await Promise.all(voiceNotes
      .filter((note) => note.storageKey)
      .map((note) => deleteObject(note.storageKey).catch((error) => {
        console.warn('Could not remove Founder Lab voice object:', error.message);
      })));

    await Promise.all([
      Bounty.deleteMany({
        $or: [
          { senderId: { $in: ids } },
          { targetId: { $in: ids } },
          { hunterId: { $in: ids } },
          { 'attempts.hunterId': { $in: ids } },
          { friendshipId: { $in: friendshipIds } }
        ]
      }),
      ContractEvent.deleteMany({ $or: [{ friendshipId: { $in: friendshipIds } }, { userId: { $in: ids } }] }),
      VoiceNote.deleteMany({ $or: [{ friendshipId: { $in: friendshipIds } }, { senderId: { $in: ids } }, { recipientId: { $in: ids } }] }),
      Notification.deleteMany({ $or: [{ toUserId: { $in: ids } }, { fromUserId: { $in: ids } }, { friendshipId: { $in: friendshipIds } }] }),
      AuraTransaction.deleteMany({ userId: { $in: ids } }),
      PendingInvite.deleteMany({ $or: [{ inviterId: { $in: ids } }, { recipientEmail: { $in: emails } }] }),
      Friendship.deleteMany({ _id: { $in: friendshipIds } })
    ]);

    await User.deleteMany({ _id: { $in: ids }, isTestAccount: true, testOwnerId: req.user.id });
    return res.json({ success: true, deletedPlayers: ids.length, deletedContracts: friendshipIds.length });
  } catch (error) {
    console.error('Reset Founder Lab failed:', error.message);
    return res.status(500).json({ msg: 'Could not reset Founder Test Lab' });
  }
});

module.exports = router;
