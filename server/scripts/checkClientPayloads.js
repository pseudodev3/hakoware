const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
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

console.log('Client payload minimization checks passed');
