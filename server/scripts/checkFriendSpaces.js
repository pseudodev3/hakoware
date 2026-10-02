const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const ContractEvent = require('../models/ContractEvent');
const ContractMoment = require('../models/ContractMoment');
const VoiceNote = require('../models/VoiceNote');
const Notification = require('../models/Notification');
const Bounty = require('../models/Bounty');
const { normalizeMessage, timelineView } = require('../services/contractTimeline');
const { buildSocialPresence } = require('../services/socialPresence');
const { contractView, notificationView } = require('../services/clientViews');
assert.throws(() => normalizeMessage({ clientId: randomUUID(), text: ' ' }), /Write a message/);
assert.throws(() => normalizeMessage({ clientId: randomUUID(), text: 'x'.repeat(1001) }), /1000/);
assert.throws(() => normalizeMessage({ clientId: 'short', text: 'hi' }), /retry key/);
assert.throws(() => normalizeMessage({ clientId: randomUUID(), text: 'hi', voiceNoteId: new mongoose.Types.ObjectId().toString() }), /separate/);

const run = async () => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server;
  try {
    await mongoose.connect(mongo.getUri());
    await Promise.all([User, Friendship, ContractEvent, ContractMoment, VoiceNote, Notification, Bounty].map((Model) => Model.init()));
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const [one, two, outsider] = await User.create(['Ari', 'Maya', 'Sol'].map((name) => ({ displayName: name, username: name.toLowerCase(), email: `${name.toLowerCase()}@example.test`, password: 'test-fixture-only', auraBalance: 100 })));
    const now = Date.now();
    const makeFriendship = async (first = one, second = two, status = 'ACTIVE') => Friendship.create({
      user1: first._id, user2: second._id, user1DisplayName: first.displayName, user2DisplayName: second.displayName, status,
      templateId: 'DONT_GHOST', duoXP: 0,
      season: { number: 1, status: 'ACTIVE', startedAt: new Date(now - 86400000), endsAt: new Date(now + 30 * 86400000) },
      user1Perspective: { limit: 3, lastInteraction: new Date(now - 86400000) }, user2Perspective: { limit: 3, lastInteraction: new Date(now - 86400000) }
    });
    const friendship = await makeFriendship(); const pending = await makeFriendship(one, outsider, 'PENDING');
    const app = express(); app.use(express.json()); app.use(require('../middleware/requestGuard'));
    app.use('/api/friendships', require('../routes/contractTimeline')); app.use('/api/friendships', require('../routes/friendships'));
    app.use('/api/voice-notes', require('../routes/voiceNotes')); app.use('/api/notifications', require('../routes/notifications'));
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (user, path, body = null) => {
      const token = user ? jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET) : null;
      const response = await fetch(base + '/api' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    const path = `/friendships/${friendship._id}`; const message = (text) => ({ clientId: randomUUID(), text });
    assert.equal((await request(null, path + '/timeline')).status, 401);
    assert.equal((await request(outsider, path + '/timeline')).status, 404);
    assert.equal((await request(outsider, path + '/messages', message('intrusion'))).status, 404);
    assert.equal((await request(one, `/friendships/${pending._id}/messages`, message('pending'))).status, 404);
    // Season activation is not a prior check-in, including the manual voice path.
    const voiceFirstContract = await makeFriendship(outsider, two);
    const voiceFirst = await VoiceNote.create({ friendshipId: voiceFirstContract._id, senderId: outsider._id, recipientId: two._id, filePath: '/pending', duration: 4, status: 'PENDING', expiresAt: new Date(now + 1800000) });
    const manualVoice = await request(outsider, `/friendships/${voiceFirstContract._id}/checkin`, { source: 'VOICE', voiceNoteId: String(voiceFirst._id), messageEventId: new mongoose.Types.ObjectId().toString() });
    assert.equal(manualVoice.status, 200);
    assert.equal((await VoiceNote.findById(voiceFirst._id)).status, 'COMMITTED');
    assert.equal(await Notification.countDocuments({ friendshipId: voiceFirstContract._id, type: 'CHECKIN' }), 1, 'a public messageEventId cannot suppress the manual check-in notification');
    const firstPayload = message('Made it through today. How was yours?');
    const first = await request(one, path + '/messages', firstPayload);
    assert.equal(first.status, 200); assert.equal(first.data.item.checkin.status, 'CHECKED_IN');
    const firstXP = (await Friendship.findById(friendship._id)).duoXP; assert.ok(firstXP > 0);
    const repeats = await Promise.all(Array.from({ length: 4 }, () => request(one, path + '/messages', firstPayload)));
    assert.ok(repeats.every((result) => result.data.item.id === first.data.item.id));
    assert.equal((await Friendship.findById(friendship._id)).duoXP, firstXP);
    assert.equal(await ContractEvent.countDocuments({ friendshipId: friendship._id, type: 'MESSAGE' }), 1);
    assert.equal(await Notification.countDocuments({ toUserId: two._id, type: 'CONTRACT_MESSAGE' }), 1);
    const followup = await request(one, path + '/messages', message('Still here, just chatting.'));
    assert.equal(followup.data.item.checkin.status, 'SOCIAL_ONLY'); assert.equal((await Friendship.findById(friendship._id)).duoXP, firstXP);
    assert.equal(await Notification.countDocuments({ toUserId: two._id, type: 'CONTRACT_MESSAGE', read: false }), 1, 'unread messages coalesce per conversation');
    assert.equal(String((await Notification.findOne({ toUserId: two._id, type: 'CONTRACT_MESSAGE', read: false })).contractEventId), followup.data.item.id);
    // Reading an older visible event cannot clear a newer coalesced message notification.
    await request(two, path + '/timeline/read', { eventIds: [first.data.item.id] });
    assert.equal(await Notification.countDocuments({ toUserId: two._id, type: 'CONTRACT_MESSAGE', read: false }), 1);
    await request(two, path + '/timeline/read', { eventIds: [followup.data.item.id] });
    assert.equal(await Notification.countDocuments({ toUserId: two._id, type: 'CONTRACT_MESSAGE', read: false }), 0);
    assert.equal((await request(outsider, path + '/timeline/read', { eventIds: [first.data.item.id] })).status, 404);
    const second = await request(two, path + '/messages', message('Same. Glad you showed up.'));
    assert.equal(second.data.item.checkin.status, 'CHECKED_IN');
    const presence = await buildSocialPresence(String(one._id), [await Friendship.findById(friendship._id)], new Date(now - 48 * 3600000));
    assert.ok(presence.contracts[String(friendship._id)].firstMutualCheckin);
    assert.ok(presence.pulse.some((item) => item.type === 'MESSAGE' && item.id === second.data.item.id));
    const received = await request(two, '/notifications'); const targeted = received.data.find((item) => item.type === 'CONTRACT_MESSAGE');
    assert.equal(targeted.contractKey, contractView(await Friendship.findById(friendship._id)).contractKey); assert.ok(targeted.focusEventId); assert.equal('friendshipId' in targeted, false);

    await Friendship.updateOne({ _id: friendship._id }, { $set: { 'user1Perspective.lastInteraction': new Date(now - 23 * 3600000), 'season.startedAt': new Date(now - 48 * 3600000) } });
    const beforeConcurrent = await ContractEvent.countDocuments({ friendshipId: friendship._id, type: 'CHECKIN' });
    await Promise.all([request(one, path + '/messages', message('Concurrent one')), request(one, path + '/messages', message('Concurrent two')), request(one, path + '/checkin', { source: 'TEXT' })]);
    assert.equal(await ContractEvent.countDocuments({ friendshipId: friendship._id, type: 'CHECKIN' }), beforeConcurrent + 1);
    assert.equal((await Friendship.findById(friendship._id)).checkinLease?.token, undefined);

    const voice = await VoiceNote.create({ friendshipId: friendship._id, senderId: one._id, recipientId: two._id, senderName: 'Ari', filePath: '/pending', storageKey: 'private-storage-key', duration: 12, status: 'PENDING', expiresAt: new Date(now + 1800000) });
    const voicePayload = { clientId: randomUUID(), voiceNoteId: String(voice._id) }; const voiceMessage = await request(one, path + '/messages', voicePayload);
    assert.equal(voiceMessage.status, 200); assert.equal(voiceMessage.data.item.voice.duration, 12); assert.equal(voiceMessage.data.item.checkin.status, 'SOCIAL_ONLY');
    assert.equal((await VoiceNote.findById(voice._id)).status, 'COMMITTED'); assert.equal((await request(one, path + '/messages', voicePayload)).data.item.id, voiceMessage.data.item.id);
    for (const user of [one, two]) assert.equal((await request(user, path + '/messages', { clientId: randomUUID(), voiceNoteId: String(voice._id) })).status, 409);
    assert.equal((await request(outsider, `/voice-notes/${voice._id}/audio`)).status, 403);
    const staleVoice = await VoiceNote.create({ friendshipId: friendship._id, senderId: one._id, recipientId: two._id, filePath: '/pending', status: 'PENDING', expiresAt: new Date(now - 1) });
    assert.equal((await request(one, path + '/messages', { clientId: randomUUID(), voiceNoteId: String(staleVoice._id) })).status, 409);
    assert.equal((await request(two, `/voice-notes/${staleVoice._id}/audio`)).status, 404);

    await Friendship.updateOne({ _id: friendship._id }, { $set: { templateId: 'CHAOS', 'user1Perspective.lastInteraction': new Date(now - 23 * 3600000), 'chaos.nextEventAt': new Date(now + 7 * 86400000), 'chaos.activeEvent': { eventId: randomUUID(), type: 'VOICE_TAX', name: 'Voice Tax', description: 'Use voice.', targetUserId: one._id, startedAt: new Date(now), expiresAt: new Date(now + 3600000), payload: { requiredSource: 'VOICE' } } } });
    const voiceRuleText = await request(one, path + '/messages', message('Can still talk.')); assert.equal(voiceRuleText.data.item.checkin.status, 'NEEDS_ACTION');
    assert.equal((await Friendship.findById(friendship._id)).chaos.activeEvent.name, 'Voice Tax');
    const freshVoice = await VoiceNote.create({ friendshipId: friendship._id, senderId: one._id, recipientId: two._id, filePath: '/pending', duration: 5, status: 'PENDING', expiresAt: new Date(now + 1800000) });
    const clearsVoice = await request(one, path + '/messages', { clientId: randomUUID(), voiceNoteId: String(freshVoice._id) });
    assert.equal(clearsVoice.data.item.checkin.status, 'CHECKED_IN'); assert.equal((await Friendship.findById(friendship._id)).chaos.activeEvent, null);

    await Friendship.updateOne({ _id: friendship._id }, { $set: { templateId: 'DONT_GHOST', 'user1Perspective.lastInteraction': new Date(now - 23 * 3600000) } });
    const bounty = await Bounty.create({ friendshipId: friendship._id, senderId: two._id, senderName: 'Maya', targetId: one._id, targetName: 'Ari', amount: 20, partnerAmount: 20, status: 'PRESSURE_SENT', hunterId: outsider._id, hunterName: 'Sol', hunterBond: 5, huntStartedAt: new Date(now), huntExpiresAt: new Date(now + 3600000), pressureSentAt: new Date(now), expiresAt: new Date(now + 86400000) });
    const proofMessage = await request(one, path + '/messages', message('Back, but I need to decide.')); assert.equal(proofMessage.data.item.checkin.status, 'NEEDS_ACTION');
    assert.equal((await Bounty.findById(bounty._id)).status, 'PRESSURE_SENT'); assert.equal((await request(one, path + '/checkin', { source: 'TEXT' })).status, 409);
    const escape = await request(one, path + '/checkin', { source: 'TEXT', bountyDecision: 'ESCAPE' }); assert.equal(escape.status, 200); assert.equal(escape.data.bounty.outcome, 'ESCAPED');

    await Friendship.updateOne({ _id: friendship._id }, { $set: { 'user1Perspective.lastInteraction': new Date(now - 23 * 3600000), 'user1Perspective.baseDebt': 6 } });
    assert.equal((await request(one, path + '/messages', message('Starting recovery.'))).data.item.checkin.status, 'CHECKED_IN');
    assert.equal((await Friendship.findById(friendship._id)).user1Perspective.recoveryRequired, true);
    assert.equal((await request(one, path + '/messages', message('No extra reward.'))).data.item.checkin.status, 'SOCIAL_ONLY');
    await Friendship.updateOne({ _id: friendship._id }, { $set: { 'user1Perspective.lastInteraction': new Date(now - 23 * 3600000) } });
    await request(one, path + '/messages', message('Finishing recovery.')); assert.equal((await Friendship.findById(friendship._id)).user1Perspective.recoveryRequired, false);

    const hidden = await ContractMoment.create({ friendshipId: friendship._id, type: 'HOT_SEAT', status: 'OPEN', promptId: 'test', promptText: 'A shared moment', options: ['A', 'B'], responses: [{ userId: two._id, value: 'HIDDEN_ANSWER' }], unlockAt: new Date(now), expiresAt: new Date(now + 3600000) });
    const revealedEvent = await ContractEvent.create({ friendshipId: friendship._id, userId: two._id, type: 'HOT_SEAT_REVEALED', metadata: { momentId: String(hidden._id), secret: 'raw-secret' } });
    let timeline = await request(one, path + '/timeline'); assert.equal(JSON.stringify(timeline.data).includes('HIDDEN_ANSWER'), false);
    await ContractMoment.updateOne({ _id: hidden._id }, { $set: { status: 'RESOLVED' }, $push: { responses: { userId: one._id, value: 'A' } } });
    timeline = await request(one, path + '/timeline'); assert.equal(timeline.data.items.find((item) => item.id === String(revealedEvent._id)).moment.answers.length, 2);
    for (const secret of ['private-storage-key', 'raw-secret', 'friendshipId', 'senderId', 'recipientId', 'metadata']) assert.equal(JSON.stringify(timeline.data).includes(secret), false, `timeline leaked ${secret}`);
    const tiedAt = new Date(now + 10000);
    const inserted = await ContractEvent.insertMany(Array.from({ length: 85 }, (_, index) => ({ friendshipId: friendship._id, userId: two._id, type: 'MESSAGE', createdAt: tiedAt, metadata: { clientId: randomUUID(), kind: 'TEXT', notified: true, text: `history-${index}` } })));
    const collected = new Set(); let cursor = null; let pages = 0;
    do {
      const page = await request(one, path + '/timeline' + (cursor ? `?before=${cursor}` : '')); assert.equal(page.status, 200);
      for (const item of page.data.items) { assert.equal(collected.has(item.id), false, 'pagination repeated an event'); collected.add(item.id); }
      cursor = page.data.nextCursor; pages += 1;
    } while (cursor);
    assert.ok(pages >= 3); assert.ok(inserted.every((item) => collected.has(String(item._id))));
    const foreign = await ContractEvent.create({ friendshipId: pending._id, userId: outsider._id, type: 'MESSAGE', metadata: { clientId: randomUUID(), text: 'FOREIGN_SECRET' } });
    assert.equal((await request(one, path + `/timeline?focus=${foreign._id}`)).data.focusItem, null);
    assert.equal((await request(one, path + `/timeline?before=${foreign._id}`)).status, 400);
    assert.equal((await request(one, path + `/timeline?focus=${first.data.item.id}`)).data.focusItem.text, firstPayload.text);
    await Friendship.updateOne({ _id: friendship._id }, { $set: { 'season.status': 'COMPLETE' } });
    assert.equal((await request(one, path + '/messages', message('We can talk after the season.'))).data.item.checkin.status, 'SOCIAL_ONLY');
    assert.ok((await request(one, path + '/timeline')).data.items.length);
    await Friendship.deleteOne({ _id: friendship._id }); assert.equal((await request(one, path + '/timeline')).status, 404);
    assert.equal((await request(one, path + '/messages', message('ended'))).status, 404);
    assert.equal(notificationView({ friendshipId: pending._id }).contractKey, contractView(pending).contractKey);
    assert.equal(timelineView({ type: 'PRIVATE_INTERNAL_EVENT' }, pending, one._id), null);
    console.log('Friend spaces: auth, idempotency, concurrent progression, voice ownership, Chaos, bounty decisions, recovery, privacy, pagination and ended contracts passed.');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect(); await mongo.stop();
  }
};
run().catch((error) => { console.error(error); process.exitCode = 1; });
