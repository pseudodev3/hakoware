const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server-core');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const CardTrade = require('../models/CardTrade');
const CardPurchase = require('../models/CardPurchase');
const ContractEvent = require('../models/ContractEvent');
const AuraTransaction = require('../models/AuraTransaction');
const Notification = require('../models/Notification');
const RoomWall = require('../models/RoomWall');
const { settleExpiredTrades } = require('../services/cardTrading');
const { CARD_CATALOG } = require('../services/cardCatalog');
assert.equal(Object.keys(CARD_CATALOG).length, 12);
assert.equal(Object.values(CARD_CATALOG).filter((card) => card.purchasable).length, 4);
assert.ok(Object.values(CARD_CATALOG).filter((card) => card.kind === 'STICKER').every((card) => !card.purchasable));

const run = async () => {
  const mongo = await MongoMemoryReplSet.create({
    binary: { version: '8.0.12' },
    replSet: { count: 1 },
  });
  let server;
  try {
    await mongoose.connect(mongo.getUri());
    await Promise.all(
      [
        User,
        Friendship,
        CardTrade,
        CardPurchase,
        ContractEvent,
        AuraTransaction,
        Notification,
        RoomWall,
      ].map((Model) => Model.init()),
    );
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    const [one, two, outsider, testUser] = await User.create(
      ['Ari', 'Maya', 'Sol', 'Test'].map((name) => ({
        username: name.toLowerCase(),
        displayName: name,
        email: name + '@example.test',
        password: 'fixture-only',
        auraBalance: 500,
        inventory: ['PURIFY', 'PURIFY', 'ORBIT', 'ECHO', ...(name === 'Ari' ? [] : ['SIGNAL_FLARE'])],
        ...(name === 'Test'
          ? { isTestAccount: true, testOwnerId: new mongoose.Types.ObjectId() }
          : {}),
      })),
    );
    const friendship = await Friendship.create({
      user1: one._id,
      user2: two._id,
      user1DisplayName: 'Ari',
      user2DisplayName: 'Maya',
      status: 'ACTIVE',
      templateId: 'DONT_GHOST',
      season: {
        number: 1,
        status: 'ACTIVE',
        startedAt: new Date(Date.now() - 86400000),
        endsAt: new Date(Date.now() + 30 * 86400000),
      },
      user1Perspective: { limit: 3, lastInteraction: new Date() },
      user2Perspective: { limit: 3, lastInteraction: new Date() },
    });
    const app = express();
    app.use(express.json());
    app.use(require('../middleware/requestGuard'));
    app.use('/api/cards', require('../routes/cards'));
    app.use('/api/aura', require('../routes/aura'));
    app.use('/api/after-hours/wall', require('../routes/roomWall'));
    app.use('/api/notifications', require('../routes/notifications'));
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (
      user,
      path,
      body = null,
      method = body ? 'POST' : 'GET',
    ) => {
      const token = user
        ? jwt.sign(
            { user: { id: String(user._id), v: 0 } },
            process.env.JWT_SECRET,
          )
        : null;
      const response = await fetch(base + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-auth-token': token } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, data: await response.json() };
    };
    const inventory = async (user) => (await User.findById(user._id)).inventory;
    const copies = (cards, type) =>
      cards.filter((card) => card === type).length;
    const offer = (offeredCardId, requestedCardId, extra = {}) => ({
      friendshipId: String(friendship._id),
      clientId: randomUUID(),
      offeredCardId,
      requestedCardId,
      ...extra,
    });
    assert.equal((await request(null, '/cards')).status, 401);
    assert.equal(
      (await request(outsider, '/cards/trades', offer('PURIFY', 'ORBIT')))
        .status,
      404,
    );
    const buy = { cardId: 'SIGNAL_FLARE', clientId: randomUUID() };
    const purchases = await Promise.all(
      Array.from({ length: 4 }, () => request(one, '/aura/buy-card', buy)),
    );
    assert.ok(purchases.every((item) => item.status === 200));
    assert.equal(copies(await inventory(one), 'SIGNAL_FLARE'), 1);
    assert.equal((await User.findById(one._id)).auraBalance, 455);
    assert.equal(
      await AuraTransaction.countDocuments({
        userId: one._id,
        type: 'MARKETPLACE_PURCHASE',
      }),
      1,
    );
    const firstBody = offer('PURIFY', 'ORBIT');
    const first = await request(one, '/cards/trades', firstBody);
    assert.equal(first.status, 200);
    assert.equal(copies(await inventory(one), 'PURIFY'), 1);
    const repeats = await Promise.all([
      request(one, '/cards/trades', firstBody),
      request(one, '/cards/trades', firstBody),
    ]);
    assert.ok(
      repeats.every((item) => item.data.tradeId === first.data.tradeId),
    );
    assert.equal(copies(await inventory(one), 'PURIFY'), 1);
    assert.equal(
      (
        await request(outsider, `/cards/trades/${first.data.tradeId}/respond`, {
          action: 'ACCEPT',
        })
      ).status,
      404,
    );
    const accepts = await Promise.all(
      Array.from({ length: 4 }, () =>
        request(two, `/cards/trades/${first.data.tradeId}/respond`, {
          action: 'ACCEPT',
        }),
      ),
    );
    assert.ok(accepts.every((item) => item.status === 200));
    assert.equal(copies(await inventory(one), 'ORBIT'), 2);
    assert.equal(copies(await inventory(two), 'PURIFY'), 3);
    assert.equal(copies(await inventory(two), 'ORBIT'), 0);
    assert.equal(
      await ContractEvent.countDocuments({ type: 'CARD_TRADE_ACCEPTED' }),
      1,
    );
    assert.equal((await User.findById(one._id)).auraBalance, 455);
    assert.equal((await User.findById(two._id)).auraBalance, 500);
    const second = await request(one, '/cards/trades', offer('ORBIT', 'ECHO'));
    assert.equal(second.status, 200);
    const counter = await request(
      two,
      '/cards/trades',
      offer('ECHO', 'PURIFY', { counterOf: second.data.tradeId }),
    );
    assert.equal(counter.status, 200);
    assert.equal(
      (await CardTrade.findById(second.data.tradeId)).status,
      'COUNTERED',
    );
    assert.equal(copies(await inventory(one), 'ORBIT'), 2);
    const cancel = await request(
      two,
      `/cards/trades/${counter.data.tradeId}/respond`,
      { action: 'CANCEL' },
    );
    assert.equal(cancel.status, 200);
    assert.equal(copies(await inventory(two), 'ECHO'), 1);
    await request(two, `/cards/trades/${counter.data.tradeId}/respond`, {
      action: 'CANCEL',
    });
    assert.equal(copies(await inventory(two), 'ECHO'), 1);
    const expiring = await request(
      one,
      '/cards/trades',
      offer('ECHO', 'PURIFY'),
    );
    await CardTrade.updateOne(
      { _id: expiring.data.tradeId },
      { $set: { expiresAt: new Date(Date.now() - 1) } },
    );
    await Promise.all([
      settleExpiredTrades(one._id),
      settleExpiredTrades(one._id),
    ]);
    assert.equal(copies(await inventory(one), 'ECHO'), 1);
    assert.equal(
      (await CardTrade.findById(expiring.data.tradeId)).status,
      'EXPIRED',
    );
    const unavailable = await request(
      one,
      '/cards/trades',
      offer('ORBIT', 'CHAOS_TICKET'),
    );
    assert.equal(unavailable.status, 200);
    assert.equal(
      (
        await request(
          two,
          `/cards/trades/${unavailable.data.tradeId}/respond`,
          { action: 'ACCEPT' },
        )
      ).status,
      409,
    );
    assert.equal(
      (await CardTrade.findById(unavailable.data.tradeId)).status,
      'PENDING',
    );
    await request(two, `/cards/trades/${unavailable.data.tradeId}/respond`, {
      action: 'DECLINE',
    });
    // A reserved last copy cannot also be used, and failed spell validation preserves the card.
    const flare = await request(
      one,
      '/cards/trades',
      offer('SIGNAL_FLARE', 'ORBIT'),
    );
    assert.equal(flare.status, 200);
    assert.equal(
      (
        await request(one, '/aura/use-card', {
          cardId: 'SIGNAL_FLARE',
          targetFriendshipId: String(friendship._id),
        })
      ).status,
      400,
    );
    await request(one, `/cards/trades/${flare.data.tradeId}/respond`, {
      action: 'CANCEL',
    });
    assert.equal(
      (await request(one, '/aura/use-card', { cardId: 'PURIFY' })).status,
      400,
    );
    assert.equal(copies(await inventory(one), 'PURIFY'), 1);
    const spellRace = await Promise.all([
      request(one, '/aura/use-card', {
        cardId: 'SIGNAL_FLARE',
        targetFriendshipId: String(friendship._id),
      }),
      request(one, '/cards/trades', offer('SIGNAL_FLARE', 'ORBIT')),
    ]);
    assert.equal(spellRace.filter((item) => item.status === 200).length, 1);
    // Legacy URLs and cached clients cannot write or reveal wall content after retirement.
    // Existing documents, collectible ownership and Activity history remain intact.
    const wallPath = '/after-hours/wall';
    const pieceId = randomUUID();
    const archivedWall = await RoomWall.create({
      scopeKey: 'live',
      weekKey: '2026-10-05',
      revision: 3,
      expiresAt: new Date(Date.now() + 86400000),
      pieces: [{ id: pieceId, actorId: one._id, kind: 'NOTE', text: 'Still here.', x: 0.35, y: 0.35, reactions: [] }],
    });
    await Notification.create({
      toUserId: one._id, fromUserId: two._id,
      type: 'AFTER_HOURS_WALL', title: 'Your wall mark got a reaction',
      message: 'An existing reaction.', wallPieceId: pieceId, wallWeekKey: '2026-10-05',
    });
    const beforeWall = await RoomWall.findById(archivedWall._id).lean();
    const beforePeople = await User.find({ _id: { $in: [one._id, two._id, outsider._id, testUser._id] } })
      .select('auraBalance inventory cardDiscoveries').sort({ _id: 1 }).lean();
    const beforeWallNotifications = await Notification.find({ type: 'AFTER_HOURS_WALL' }).lean();
    const retiredRequests = [
      [wallPath, null, 'GET'],
      [wallPath + '?week=2026-09-28', null, 'GET'],
      [wallPath, { clientId: randomUUID(), kind: 'NOTE', text: 'No new marks.' }, 'POST'],
      [wallPath + '/' + pieceId, { x: 0.4, y: 0.4 }, 'PATCH'],
      [wallPath + '/' + pieceId, null, 'DELETE'],
      [wallPath + '/' + pieceId + '/react', { reaction: '😭' }, 'POST'],
    ];
    for (const [path, body, method] of retiredRequests) {
      assert.equal((await request(null, path, body, method)).status, 401, method + ' still requires authentication');
      for (const actor of [one, two, outsider, testUser]) {
        const response = await request(actor, path, body, method);
        assert.equal(response.status, 410, method + ' is retired for every account scope');
        assert.equal(response.data.code, 'WALL_RETIRED');
        assert.match(response.data.msg, /retired/);
        assert.equal('pieces' in response.data, false);
      }
    }
    assert.deepEqual(await RoomWall.findById(archivedWall._id).lean(), beforeWall, 'retirement does not rewrite or purge an old wall');
    assert.equal(await RoomWall.countDocuments(), 1, 'cached clients cannot create new walls');
    assert.deepEqual(await User.find({ _id: { $in: [one._id, two._id, outsider._id, testUser._id] } })
      .select('auraBalance inventory cardDiscoveries').sort({ _id: 1 }).lean(), beforePeople);
    assert.deepEqual(await Notification.find({ type: 'AFTER_HOURS_WALL' }).lean(), beforeWallNotifications, 'no new reactions or notifications');
    assert.equal((await request(one, '/aura/use-card', { cardId: 'ORBIT' })).status, 410);
    assert.deepEqual(await User.find({ _id: { $in: [one._id, two._id, outsider._id, testUser._id] } })
      .select('auraBalance inventory cardDiscoveries').sort({ _id: 1 }).lean(), beforePeople, 'retired activation never consumes a collectible');
    const notifications = (await request(one, '/notifications')).data;
    assert.ok(notifications.some((item) => item.wallPieceId === pieceId), 'old wall activity remains available');
    assert.ok(notifications.some((item) => item.cardTradeId));
    assert.equal(JSON.stringify(notifications).includes('friendshipId'), false);
    const snapshot = (await request(one, '/cards')).data;
    assert.equal(snapshot.cards.length, 12);
    assert.ok(snapshot.cards.find((card) => card.id === 'SIGNAL_FLARE').discovered);
    assert.ok(snapshot.cards.find((card) => card.id === 'ORBIT').discovered, 'owned collectibles keep their discovery');
    assert.equal(snapshot.cards.find((card) => card.id === 'ORBIT').purchasable, false);
    assert.equal(JSON.stringify(snapshot).includes('senderId'), false);
    assert.equal(JSON.stringify(snapshot).includes(String(two._id)), false);
    // Ended contracts cancel pending offers and return reserved inventory exactly once.
    await Friendship.updateOne(
      { _id: friendship._id },
      { $set: { status: 'BLOCKED' } },
    );
    await settleExpiredTrades();
    assert.equal(await CardTrade.countDocuments({ status: 'PENDING' }), 0);
    console.log(
      'Cards and retired wall: purchases, collectible escrow/trades, concurrent accept/use, counter/cancel/expiry, privacy, authenticated retirement and preserved inventory/history passed.',
    );
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
};
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
