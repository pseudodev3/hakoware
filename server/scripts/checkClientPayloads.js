const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  currentUserView,
  contractView,
  recapView,
  notificationView,
  voiceNoteInboxView,
  bountyArenaView,
  publicGrudgeView,
  auraTransactionView
} = require('../services/clientViews');

const assertMissing = (value, keys, label) => {
  for (const key of keys) {
    assert.ok(!(key in value), `${label} leaked ${key}`);
  }
};



const currentUser = currentUserView({
  _id: 'user-id',
  displayName: 'Player',
  username: 'player',
  usernameNormalized: 'player',
  email: 'private@example.com',
  password: 'hashed-password',
  avatar: null,
  nenType: 'ENHANCER',
  inventory: ['PURIFY'],
  auraBalance: 200,
  plusInterestAt: new Date(),
  defaultLimit: 7,
  emailVerified: true,
  authVersion: 4,
  isTestAccount: false,
  testOwnerId: 'private-owner-id',
  notificationPreferences: { email: true },
  privacySettings: { optOutPublicBankruptcy: true },
  createdAt: new Date(),
  updatedAt: new Date()
});
assertMissing(
  currentUser,
  ['email', 'password', 'usernameNormalized', 'nenType', 'defaultLimit', 'emailVerified', 'authVersion', 'testOwnerId', 'notificationPreferences', 'createdAt', 'updatedAt'],
  'currentUserView'
);
assert.strictEqual(currentUser.privacySettings.optOutPublicBankruptcy, true);

const contract = contractView({
  _id: 'contract-id',
  user1: { _id: 'user-1', displayName: 'One', username: 'one', avatar: null, auraBalance: 999, email: 'one@example.com', nenType: 'ENHANCER' },
  user2: { _id: 'user-2', displayName: 'Two', username: 'two', avatar: null, auraBalance: 888, email: 'two@example.com', nenType: 'SPECIALIST' },
  user1DisplayName: 'One',
  user2DisplayName: 'Two',
  status: 'ACTIVE',
  isTestData: true,
  testOwnerId: 'private-owner-id',
  templateId: 'CHAOS',
  duoXP: 80,
  duoLevel: 2,
  duoTitle: 'Locked In',
  season: { number: 1, status: 'ACTIVE', lengthDays: 30, startedAt: new Date(), endsAt: new Date() },
  chaos: {
    level: 2,
    nextEventAt: new Date(),
    wantedUntil: null,
    lastConsequence: 'Test',
    activeEvent: {
      eventId: 'private-event-id',
      type: 'VOICE_TAX',
      name: 'Voice Tax',
      description: 'Use voice.',
      targetUserId: 'user-1',
      startedAt: new Date(),
      expiresAt: new Date(),
      payload: { requiredSource: 'VOICE', auraBonus: 100 }
    }
  },
  grudge: { claimantId: 'private-claimant-id', victimId: 'private-victim-id' },
  claimState: { user1WindowKey: new Date() },
  user1Perspective: {
    baseDebt: 1,
    limit: 3,
    lastInteraction: new Date(),
    recoveryRequired: true,
    bankruptcyNoticeKey: 'private-notice-key',
    calculatedDebt: 7,
    calculatedAt: new Date(),
    daysMissed: 9,
    isBankrupt: true,
    isInWarningZone: false,
    daysUntilBankrupt: 0
  },
  user2Perspective: { baseDebt: 0, limit: 3, lastInteraction: new Date(), recoveryRequired: false }
});
assertMissing(contract, ['isTestData', 'testOwnerId', 'grudge', 'claimState', 'createdAt', 'updatedAt'], 'contractView');
assertMissing(contract.user1, ['auraBalance', 'email', 'nenType'], 'contractView user1');
assertMissing(contract.user2, ['auraBalance', 'email', 'nenType'], 'contractView user2');
assertMissing(contract.user1Perspective, ['bankruptcyNoticeKey', 'calculatedDebt', 'calculatedAt', 'daysMissed', 'isBankrupt', 'isInWarningZone', 'daysUntilBankrupt'], 'contractView perspective');
assertMissing(contract.chaos.activeEvent, ['eventId', 'type', 'startedAt', 'payload'], 'contractView chaos event');
assert.ok(!('lengthDays' in contract.season), 'contractView leaked season length bookkeeping');

const recap = recapView({
  friendshipId: 'private-contract-id',
  template: { id: 'CHAOS', name: 'Chaos', limit: 3, seasonDays: 30, chaos: true, privateRule: 'secret' },
  duo: { xp: 50, level: 2, title: 'Locked In', progress: 25, nextLevelXP: 200 },
  weekly: { checkins: 2, voiceNotes: 1, chaosSurvived: 1, chaosFailed: 0, xpGained: 25, auraChanged: 99, line: 'Still here.', from: new Date(), to: new Date() },
  season: { checkins: 8, voiceNotes: 3, chaosSurvived: 2, chaosFailed: 1, bankruptcies: 1, xpGained: 100, auraChanged: 200, number: 1, status: 'ACTIVE' },
  chaos: { level: 2, activeEvent: { name: 'Voice Tax', payload: { requiredSource: 'VOICE' }, targetUserId: 'private-user-id' }, lastConsequence: 'Wanted', nextEventAt: new Date() },
  worldEvent: { xpMultiplier: 2, privateRule: 'secret' },
  players: [{ id: 'private-user-id', displayName: 'One', username: 'one' }]
});
assertMissing(recap, ['friendshipId', 'worldEvent'], 'recapView');
assertMissing(recap.template, ['privateRule'], 'recapView template');
assertMissing(recap.duo, ['nextLevelXP'], 'recapView duo');
assertMissing(recap.weekly, ['auraChanged', 'from', 'to'], 'recapView weekly');
assertMissing(recap.season, ['auraChanged'], 'recapView season');
assertMissing(recap.chaos, ['nextEventAt'], 'recapView chaos');
assertMissing(recap.chaos.activeEvent, ['payload', 'targetUserId'], 'recapView chaos event');
assertMissing(recap.players[0], ['id'], 'recapView player');

const notification = notificationView({
  _id: 'notification-id',
  toUserId: 'private-recipient-id',
  fromUserId: 'private-sender-id',
  friendshipId: 'private-contract-id',
  voiceNoteId: 'private-voice-id',
  type: 'CHECKIN',
  title: 'Check-in',
  message: 'Hello',
  read: false,
  createdAt: new Date()
});
assertMissing(notification, ['toUserId', 'fromUserId', 'friendshipId', 'voiceNoteId'], 'notificationView');

const voice = voiceNoteInboxView({
  _id: 'voice-id',
  friendshipId: 'private-contract-id',
  senderId: 'private-sender-id',
  recipientId: 'private-recipient-id',
  senderName: 'Player',
  filePath: '/api/voice-notes/voice-id/audio',
  storageKey: 'voice_notes/private/object.m4a',
  status: 'COMMITTED',
  duration: 12,
  listened: false,
  createdAt: new Date()
});
assertMissing(voice, ['storageKey', 'friendshipId', 'senderId', 'recipientId', 'status'], 'voiceNoteInboxView');

const bountySource = {
  _id: 'bounty-id',
  senderId: 'sender-id',
  targetId: 'target-id',
  friendshipId: 'private-contract-id',
  isTestData: false,
  testOwnerId: 'private-owner-id',
  targetName: 'Target',
  amount: 100,
  listingFee: 5,
  message: 'Check in',
  status: 'HUNTING',
  hunterId: 'hunter-id',
  hunterName: 'Hunter',
  hunterBond: 10,
  attempts: [{ hunterId: 'older-hunter-id' }],
  huntExpiresAt: new Date()
};
const bountyViewer = bountyArenaView(bountySource, 'viewer-id');
assertMissing(bountyViewer, ['senderId', 'targetId', 'hunterId', 'friendshipId', 'isTestData', 'testOwnerId', 'attempts', 'listingFee', 'hunterBond'], 'bountyArenaView viewer');
const bountyHunter = bountyArenaView(bountySource, 'hunter-id');
assert.strictEqual(bountyHunter.viewerRole, 'HUNTER');
assert.strictEqual(bountyHunter.hunterBond, 10);
assertMissing(bountyHunter, ['senderId', 'targetId', 'hunterId', 'friendshipId', 'isTestData', 'testOwnerId', 'attempts', 'listingFee'], 'bountyArenaView hunter');

const publicGrudge = publicGrudgeView({
  _id: 'private-contract-id',
  grudge: {
    claimantId: 'private-claimant-id',
    victimId: 'private-victim-id',
    claimantName: 'Claimant',
    victimName: 'Victim',
    createdAt: new Date(),
    expiresAt: new Date(),
    originalClaimAmount: 20
  }
});
assertMissing(publicGrudge, ['friendshipId', 'claimantId', 'victimId'], 'publicGrudgeView');

const transaction = auraTransactionView({
  _id: 'transaction-id',
  userId: 'private-user-id',
  amount: -10,
  type: 'INTERNAL_TYPE',
  description: 'Spent Aura',
  metadata: { friendshipId: 'private-contract-id' },
  createdAt: new Date()
});
assertMissing(transaction, ['userId', 'metadata'], 'auraTransactionView');

const contractQueries = fs.readFileSync(path.join(__dirname, '..', 'services', 'contractQueries.js'), 'utf8');
assert.ok(
  !/populate\([^\n]*(?:auraBalance|nenType)/.test(contractQueries),
  'Contract partner population must not expose auraBalance or dormant nenType'
);

const friendshipRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'friendships.js'), 'utf8');
assert.ok(
  !friendshipRoutes.includes('return res.json(friendship);'),
  'Friendship action routes must not return raw Friendship documents'
);

const authRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'auth.js'), 'utf8');
assert.ok(authRoutes.includes('currentUserView'), 'Auth routes must use the minimized current-user view');

const bootstrapRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'bootstrap.js'), 'utf8');
assert.ok(bootstrapRoutes.includes('user: currentUserView(user)'), 'Bootstrap must use the minimized current-user view');

const bountyRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'bounties.js'), 'utf8');
assert.ok(bountyRoutes.includes('bountyArenaView'), 'Arena routes must use minimized bounty views');
assert.ok(!bountyRoutes.includes('return res.json(bounties);'), 'Arena must not return raw Bounty collections');
assert.ok(!bountyRoutes.includes('return res.json(bounty);'), 'Arena actions must not return raw Bounty documents');

const voiceRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'voiceNotes.js'), 'utf8');
assert.ok(voiceRoutes.includes('voiceNoteInboxView'), 'Voice inbox must use the minimized voice-note view');
assert.ok(!voiceRoutes.includes('return res.status(201).json(voiceNote);'), 'Voice upload must not return raw VoiceNote documents');

const notificationRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'notifications.js'), 'utf8');
assert.ok(notificationRoutes.includes('notificationView'), 'Notifications must use the minimized notification view');
assert.ok(!notificationRoutes.includes('return res.json(notifications);'), 'Notifications must not return raw Notification collections');

const viteConfig = fs.readFileSync(path.join(__dirname, '..', '..', 'vite.config.js'), 'utf8');
assert.ok(
  viteConfig.includes("envPrefix: ['VITE_', 'API_URL']"),
  'Frontend environment exposure must stay limited to VITE_* and API_URL'
);
assert.ok(!viteConfig.includes("'API_'"), 'Generic API_* environment exposure is forbidden');

console.log('Client payload minimization checks passed');
