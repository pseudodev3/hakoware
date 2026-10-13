const assert = require('node:assert/strict');
const { randomBytes } = require('crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const Event = require('../models/ContractEvent');
const { currentUserView, contractView } = require('../services/clientViews');
async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } }); let server;
  try {
    await mongoose.connect(mongo.getUri()); await Promise.all([User, Friendship, Event].map(model => model.init()));
    const [ari, maya, sol] = await User.create(['Ari', 'Maya', 'Sol'].map(name => ({ displayName: name, username: name.toLowerCase(), email: name+'@example.test', password: 'local-fixture', auraBalance: 35, inventory: name === 'Ari' ? ['SIGNAL_FLARE'] : [], notificationPreferences: { email: false } })));
    const contract = await Friendship.create({ user1: ari._id, user2: maya._id, user1DisplayName: 'Ari', user2DisplayName: 'Maya', status: 'ACTIVE', duoXP: 50, duoLevel: 2, user1Perspective: { limit: 3 }, user2Perspective: { limit: 3 } });
    const pending = await Friendship.create({ user1: ari._id, user2: sol._id, user1DisplayName: 'Ari', user2DisplayName: 'Sol', status: 'PENDING' });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); const app = express(); app.use(express.json()); app.use(require('../middleware/requestGuard')); app.use('/api/presentation', require('../routes/presentation'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); }); const base = `http://127.0.0.1:${server.address().port}/api/presentation`;
    const request = async (user, path, body) => { const res = await fetch(base+path, { method: body ? 'PATCH' : 'GET', headers: { 'content-type': 'application/json', ...(user ? { 'x-auth-token': jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: res.status, data: await res.json() }; };
    assert.equal((await request(null, '/profile')).status, 401);
    const identity = { name: 'Chaos twins', palette: 'iris', cover: 'waves' };
    assert.equal((await request(sol, '/duos/'+contract._id, identity)).status, 404);
    assert.equal((await request(ari, '/duos/'+pending._id, identity)).status, 404);
    const changed = await request(ari, '/duos/'+contract._id, identity); assert.equal(changed.status, 200); assert.deepEqual(changed.data.contract.identity, identity);
    assert.equal((await request(maya, '/duos/'+contract._id, { ...identity, name: 'Our orbit', cover: 'orbits' })).status, 200, 'either accepted participant can style the Duo');
    for (const invalid of [{ ...identity, name: 'x'.repeat(33) }, { ...identity, name: 'a\nb' }, { ...identity, palette: 'url(bad)' }, { ...identity, cover: 'unknown' }, { ...identity, duoXP: 5000 }]) assert.equal((await request(ari, '/duos/'+contract._id, invalid)).status, 400);
    const stored = await Friendship.findById(contract._id); assert.equal(stored.duoXP, 50); assert.equal(stored.duoLevel, 2); assert.equal(stored.user1Perspective.limit, 3);
    const profile = (await request(ari, '/profile')).data; assert.ok(profile.frames.find(frame => frame.id === 'linked').unlocked); assert.equal(profile.frames.find(frame => frame.id === 'orbit').unlocked, false);
    const pick = { avatarFrame: 'linked', favoriteCardId: 'SIGNAL_FLARE', featuredDuoId: String(contract._id) };
    assert.equal((await request(ari, '/profile', { ...pick, avatarFrame: 'crown' })).status, 409);
    assert.equal((await request(ari, '/profile', { ...pick, favoriteCardId: 'STEAL' })).status, 400);
    assert.equal((await request(maya, '/profile', { ...pick, featuredDuoId: String(pending._id), favoriteCardId: null })).status, 400);
    assert.equal((await request(ari, '/profile', { ...pick, auraBalance: 99999 })).status, 400);
    const saved = await request(ari, '/profile', pick); assert.equal(saved.status, 200); assert.equal(saved.data.profile.favoriteCardId, 'SIGNAL_FLARE');
    assert.equal((await User.findById(ari._id)).auraBalance, 35, 'cosmetics do not change Aura');
    const own = currentUserView(await User.findById(ari._id).select('+showcase')); assert.equal(own.avatarFrame, 'linked'); assert.equal('showcase' in own, false, 'private featured-Duo IDs never enter account/public participant payloads');
    const dto = contractView(await Friendship.findById(contract._id).populate('user1 user2', 'displayName username avatar avatarFrame')); assert.equal(dto.user1.avatarFrame, 'linked'); assert.equal('showcase' in dto.user1, false);
    const stranger = (await request(sol, '/profile')).data; assert.equal(stranger.duos.length, 0); assert.equal(stranger.favoriteCardId, null);
    assert.equal(await Event.countDocuments({ friendshipId: contract._id, type: 'DUO_IDENTITY_CHANGED' }), 2);
    await Friendship.deleteOne({ _id: contract._id });
    const afterEnding = (await request(ari, '/profile')).data;
    assert.ok(afterEnding.frames.find(frame => frame.id === 'linked').unlocked, 'earned cosmetics remain after a Duo ends');
    assert.equal(afterEnding.featuredDuoId, null, 'an ended connection cannot remain a featured private Duo');
    console.log('Presentation: accepted co-owner identity, foreign/pending rejection, name/color validation, earned frame gates, collected-card ownership, private featured Duos, safe projections and unchanged XP/Aura/rules passed.');
  } finally { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
