const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const Event = require('../models/ContractEvent');
const Moment = require('../models/ContractMoment');
const Notification = require('../models/Notification');
const { buildSocialPresence } = require('../services/socialPresence');

async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server;
  try {
    await mongoose.connect(mongo.getUri()); await Promise.all([User, Friendship, Event, Moment, Notification].map(model => model.init()));
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const [one, two, outsider] = await User.create(['One', 'Two', 'Outside'].map(name => ({ displayName: name, email: `${name}@example.test`, password: 'local-fixture-only', notificationPreferences: { email: false } })));
    const now = new Date(), hour = 3600000;
    const friendship = await Friendship.create({ user1: one._id, user2: two._id, user1DisplayName: one.displayName, user2DisplayName: two.displayName, status: 'ACTIVE', templateId: 'DONT_GHOST', season: { number: 1, status: 'ACTIVE', startedAt: new Date(now - hour), endsAt: new Date(now.getTime() + 30 * 86400000) }, user1Perspective: { limit: 3, lastInteraction: now }, user2Perspective: { limit: 3, lastInteraction: now } });
    const app = express(); app.use(express.json()); app.use(require('../middleware/requestGuard')); app.use('/api/friendships', require('../routes/contractTimeline')); app.use('/api/friendships', require('../routes/friendships'));
    server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    const base = `http://127.0.0.1:${server.address().port}/api/friendships/${friendship._id}`;
    const request = async (user, endpoint, body = null) => {
      const token = user ? jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET) : null;
      const response = await fetch(base + endpoint, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    assert.equal((await request(null, '/poke', {})).status, 401);
    const attempts = await Promise.all([one, two, one, two, outsider].map(user => request(user, '/poke', {})));
    assert.ok(attempts.every(result => result.status === 410 && result.data.code === 'POKE_RETIRED'));
    assert.equal(await Event.countDocuments({ friendshipId: friendship._id }), 0);
    assert.equal(await Moment.countDocuments({ friendshipId: friendship._id }), 0);
    assert.equal(await Notification.countDocuments({ friendshipId: friendship._id }), 0);
    const history = await Event.create([{ friendshipId: friendship._id, userId: two._id, type: 'POKE', createdAt: now }, { friendshipId: friendship._id, userId: one._id, type: 'MUTUAL_POKE', createdAt: now, metadata: { expiresAt: new Date(now.getTime() + hour) } }]);
    const presence = await buildSocialPresence(String(one._id), [friendship]);
    assert.equal(presence.contracts[String(friendship._id)].canPoke, false);
    assert.equal(presence.contracts[String(friendship._id)].pokeBackAvailable, false);
    assert.equal(presence.contracts[String(friendship._id)].mutualMenace, null);
    assert.ok(!presence.pulse.some(item => ['POKE', 'MUTUAL_POKE'].includes(item.type)));
    assert.deepEqual(presence.contracts[String(friendship._id)].recentActivity, []);
    const timeline = await request(one, '/timeline'); assert.equal(timeline.status, 200);
    assert.ok(history.every(event => timeline.data.items.some(item => item.id === String(event._id))), 'old Poke events remain readable in chat history');
    const oldRound = await Moment.create({ friendshipId: friendship._id, type: 'HOT_SEAT', status: 'OPEN', promptId: 'legacy-round', promptText: 'A previously opened round.', options: ['One', 'Two'], unlockAt: now, expiresAt: new Date(now.getTime() + hour), metadata: { season: 1 } });
    assert.equal((await request(outsider, `/moments/${oldRound._id}/respond`, { value: 'One' })).status, 403);
    const first = await request(one, `/moments/${oldRound._id}/respond`, { value: 'One' }); assert.equal(first.status, 200);
    assert.equal(first.data.moment.status, 'OPEN'); assert.equal('partnerAnswer' in first.data.moment, false);
    const after = await buildSocialPresence(String(two._id), [friendship]);
    assert.equal(after.contracts[String(friendship._id)].moment.partnerAnswered, true);
    assert.equal('partnerAnswer' in after.contracts[String(friendship._id)].moment, false);
    const second = await request(two, `/moments/${oldRound._id}/respond`, { value: 'Two' }); assert.equal(second.status, 200); assert.equal(second.data.moment.status, 'RESOLVED');
    assert.equal(await Moment.countDocuments({ friendshipId: friendship._id }), 1, 'answering an existing round does not create a replacement quiz');
    console.log('Poke retirement: authenticated 410 responses with no new writes, no active Poke discovery, readable history and private/finishable existing rounds passed.');
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
