const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const CardTrade = require('../models/CardTrade');
const { catalog, saveShopWish, shopSnapshot } = require('../services/cosmetics');
const { updateProfile } = require('../services/presentation');
const { currentUserView, contractView } = require('../services/clientViews');

async function run() {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.0.12' } });
  let server;
  const originalUpdate = User.updateOne, originalFind = User.findById;
  try {
    await mongoose.connect(mongo.getUri(), { autoIndex: false });
    await Promise.all([User, Friendship, CardTrade].map(model => model.createCollection()));
    await mongoose.connection.db.admin().command({ setParameter: 1, indexBuildMinAvailableDiskSpaceMB: 10000000 });
    await assert.rejects(User.collection.createIndex({ cosmeticWishlist: 1 }), /available disk space.*less than required minimum/);
    const [ari, maya, sol] = await User.create(['Ari', 'Maya', 'Sol'].map(name => ({ displayName: name, email: name + '@example.test', password: 'fixture', inventory: ['SIGNAL_FLARE'], auraBalance: 35, welcomeAuraGranted: true, lastDailyAuraBonusKey: new Date().toISOString().slice(0, 10), notificationPreferences: { email: false } })));
    const duo = await Friendship.create({ user1: ari._id, user2: maya._id, user1DisplayName: 'Ari', user2DisplayName: 'Maya', status: 'ACTIVE', duoXP: 50 });
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const app = express(); app.use(express.json()); app.use(require('../middleware/requestGuard'));
    app.use('/api/cosmetics', require('../routes/cosmetics')); app.use('/api/presentation', require('../routes/presentation'));
    app.use('/api/auth', require('../routes/auth')); app.use('/api/bootstrap', require('../routes/bootstrap'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (user, path, method = 'GET', body) => {
      const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-auth-token': jwt.sign({ user: { id: String(user._id), v: 0 } }, process.env.JWT_SECRET) } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, data: response.headers.get('content-type')?.includes('application/json') ? await response.json() : null };
    };
    assert.equal((await request(null, '/cosmetics')).status, 401);
    assert.equal((await request(null, '/cosmetics/saved/nocturne', 'PUT', { saved: true })).status, 401);
    const shop = (await request(ari, '/cosmetics')).data;
    assert.equal(shop.status, 'preview'); assert.equal(shop.checkoutAvailable, false); assert.equal(shop.currency, null);
    assert.equal(shop.packs.length, 4); assert.ok(shop.packs.every(pack => pack.price === null && !pack.saved && !pack.owned));
    for (const body of [{ saved: 'true' }, {}, [], { saved: true, userId: String(maya._id) }, { saved: true, cosmeticUnlocks: catalog.packs[0].grants }, { saved: true, $set: { auraBalance: 999 } }]) {
      assert.equal((await request(ari, '/cosmetics/saved/nocturne', 'PUT', body)).status, 400);
    }
    assert.equal((await request(ari, '/cosmetics/saved/unknown', 'PUT', { saved: true })).status, 404);
    assert.equal((await request(ari, '/cosmetics/checkout', 'POST', { packId: 'nocturne' })).status, 400, 'checkout requires a durable retry key');
    assert.equal((await request(ari, '/cosmetics/checkout', 'POST', { packId: 'nocturne', clientId: 'valid-preview-key-01' })).status, 503, 'unconfigured sales stay closed');
    assert.equal((await request(ari, '/cosmetics/unlock', 'POST', { packId: 'nocturne' })).status, 404);
    await Promise.all(Array.from({ length: 6 }, () => saveShopWish(ari._id, 'nocturne', { saved: true })));
    let savedUser = await User.findById(ari._id).select('+cosmeticWishlist +cosmeticUnlocks');
    assert.deepEqual([...savedUser.cosmeticWishlist], ['nocturne']); assert.deepEqual([...savedUser.cosmeticUnlocks], []);
    assert.equal((await shopSnapshot(maya._id)).packs.some(pack => pack.saved), false, 'saved collections belong to the authenticated account');
    await Promise.all(catalog.packs.map(pack => saveShopWish(ari._id, pack.id, { saved: true })));
    assert.equal((await User.findById(ari._id).select('+cosmeticWishlist')).cosmeticWishlist.length, 4);
    await Promise.all(Array.from({ length: 6 }, () => saveShopWish(ari._id, 'prism', { saved: false })));
    assert.equal((await shopSnapshot(ari._id)).packs.find(pack => pack.id === 'prism').saved, false);
    // Simulate a committed save whose response snapshot fails. Retrying stays idempotent.
    User.findById = function () { return { select: () => ({ lean: () => Promise.reject(new Error('Interrupted response')) }) }; };
    await assert.rejects(saveShopWish(ari._id, 'prism', { saved: true }), /Interrupted response/);
    User.findById = originalFind;
    await saveShopWish(ari._id, 'prism', { saved: true });
    assert.equal((await User.findById(ari._id).select('+cosmeticWishlist')).cosmeticWishlist.filter(id => id === 'prism').length, 1);
    for (const pack of catalog.packs.filter(pack => !pack.bundle)) {
      for (const patch of [{ avatarFrame: pack.frameId }, { cardFinish: pack.finishId }, { profileDecoration: pack.decorationId }]) assert.equal((await request(ari, '/presentation/profile', 'PATCH', patch)).status, 409);
    }
    assert.equal((await request(ari, '/presentation/profile', 'PATCH', { avatarFrame: 'crown' })).status, 409, 'earned frames retain their level gates');
    for (const patch of [{}, { cosmeticUnlocks: catalog.packs[0].grants }, { cardFinish: 'classic', userId: String(sol._id) }]) assert.equal((await request(ari, '/presentation/profile', 'PATCH', patch)).status, 400);
    const signature = { avatarFrame: 'linked', favoriteCardId: 'SIGNAL_FLARE', featuredDuoId: String(duo._id) };
    assert.equal((await request(ari, '/presentation/profile', 'PATCH', signature)).status, 200, 'legacy profile updates remain compatible');
    await User.updateOne({ _id: ari._id }, { $set: { cosmeticUnlocks: catalog.packs[0].grants } });
    const applied = await request(ari, '/presentation/profile', 'PATCH', { avatarFrame: 'gilt', cardFinish: 'nocturne', profileDecoration: 'midnight' });
    assert.equal(applied.status, 200); assert.equal(applied.data.profile.favoriteCardId, signature.favoriteCardId); assert.equal(applied.data.profile.featuredDuoId, signature.featuredDuoId);
    for (const account of [(await request(ari, '/auth/user')).data, (await request(ari, '/bootstrap')).data.user]) {
      assert.equal(account.cardFinish, 'nocturne'); assert.equal(account.profileDecoration, 'midnight');
      assert.equal('cosmeticUnlocks' in account, false); assert.equal('cosmeticWishlist' in account, false);
    }
    assert.equal((await shopSnapshot(ari._id)).packs.find(pack => pack.id === 'nocturne').owned, true);
    assert.equal((await shopSnapshot(ari._id)).packs.find(pack => pack.id === 'complete').owned, false);
    assert.equal((await request(sol, '/presentation/profile', 'PATCH', { avatarFrame: 'gilt' })).status, 409, 'one account cannot use another account’s styles');
    // Entitlement revocation between the snapshot and update must prevent an apply.
    User.updateOne = async function (filter, update, ...rest) {
      if (update.$set?.cardFinish === 'nocturne') {
        assert.deepEqual(filter.cosmeticUnlocks, { $all: ['finish:nocturne'] });
        await originalUpdate.call(this, { _id: ari._id }, { $pull: { cosmeticUnlocks: 'finish:nocturne' } });
      }
      return originalUpdate.call(this, filter, update, ...rest);
    };
    await assert.rejects(updateProfile(ari._id, { cardFinish: 'nocturne' }), error => error.status === 409);
    User.updateOne = originalUpdate;
    await User.updateOne({ _id: sol._id }, { $set: { cosmeticUnlocks: ['finish:prism'] } });
    assert.equal((await request(sol, '/presentation/profile', 'PATCH', { cardFinish: 'prism' })).status, 200);
    assert.equal((await request(sol, '/presentation/profile', 'PATCH', { avatarFrame: 'prismatic' })).status, 409);
    assert.equal((await shopSnapshot(sol._id)).packs.find(pack => pack.id === 'prism').owned, false);
    await User.updateOne({ _id: ari._id }, { $set: { cosmeticUnlocks: catalog.packs.find(pack => pack.bundle).grants } });
    assert.ok((await shopSnapshot(ari._id)).packs.every(pack => pack.owned));
    savedUser = await User.findById(ari._id).select('+cosmeticWishlist +cosmeticUnlocks +showcase');
    assert.equal(savedUser.auraBalance, 35); assert.deepEqual([...savedUser.inventory], ['SIGNAL_FLARE']);
    for (const dto of [currentUserView(savedUser), contractView({ user1: savedUser }).user1]) {
      for (const key of ['cosmeticUnlocks', 'cosmeticWishlist', 'showcase', 'password']) assert.equal(key in dto, false);
      assert.equal(dto.avatarFrame, 'gilt');
    }
    assert.equal(currentUserView(savedUser).cardFinish, 'nocturne');
    const defaultProjection = await User.findById(ari._id).lean();
    assert.equal('cosmeticUnlocks' in defaultProjection, false); assert.equal('cosmeticWishlist' in defaultProjection, false);
    assert.equal((await Friendship.findById(duo._id)).duoXP, 50);
    console.log('Cosmetic shop: preview-only catalog, authenticated private saves, concurrent/retried saves, paid ownership and revocation gates, partial profile compatibility, safe DTOs and unchanged game balances passed on standalone MongoDB with blocked indexes.');
  } finally {
    User.updateOne = originalUpdate; User.findById = originalFind;
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); await mongo.stop();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
