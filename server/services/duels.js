const mongoose = require('mongoose');
const { createHash } = require('node:crypto');
const DuelRoom = require('../models/DuelRoom');
const Friendship = require('../models/Friendship');
const Connection = require('../models/SocialConnection');
const people = require('./people');
const Notification = require('../models/Notification');
const { publicKey } = require('./clientViews');
const { CARDS, deal, play } = require('./duelRules');
const WEEK = 7 * 86400000;
const LIVE = ['INVITED', 'ACTIVE'];
const id = value => String(value?._id || value || '');
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const readRoom = roomId => DuelRoom.findById(roomId).select('+state +noticeQueue').lean();
const person = value => ({ displayName: value.displayName || 'Your friend', username: value.username || null, avatar: value.avatar || null, avatarFrame: value.avatarFrame || 'plain' });
const relation = async (userId, roomId) => {
  if (!mongoose.isValidObjectId(roomId)) fail(404, 'Duo not found.');
  const friendship = await Friendship.findOne({ _id: roomId, status: 'ACTIVE', $or: [{ user1: userId }, { user2: userId }] })
    .populate('user1 user2', 'displayName username avatar avatarFrame isTestAccount testOwnerId').lean();
  if (!friendship?.user1 || !friendship.user2) {
    const { connection, actor, other } = await people.visibleRelation(userId, roomId);
    return { _id: connection._id, user1: actor, user2: other, casual: true, connectionStatus: connection.status };
  }
  const [a, b] = [friendship.user1, friendship.user2];
  if (id(a) === id(b) || Boolean(a.isTestAccount) !== Boolean(b.isTestAccount) || a.isTestAccount && id(a.testOwnerId) !== id(b.testOwnerId)) fail(404, 'Duo not found.');
  if (await people.blocked(a, b)) fail(404, 'Duel unavailable.');
  return friendship;
};
const expireRoom = async room => {
  if (!room || !LIVE.includes(room.state.current?.status) || new Date(room.state.current.expiresAt) > new Date()) return room;
  const state = structuredClone(room.state);
  state.current.status = 'EXPIRED'; state.current.currentPlayerId = null; state.current.updatedAt = new Date().toISOString();
  await DuelRoom.updateOne({ _id: room._id, revision: room.revision }, { $set: { state }, $inc: { revision: 1 } });
  return readRoom(room._id);
};
const flushNotices = async room => {
  for (const job of room?.noticeQueue || []) {
    // A superseded invitation/turn is no longer actionable. Never resend it.
    if (job.duelRevision !== room.revision || job.duelMatchId !== room.state.current?.id) {
      await DuelRoom.updateOne({ _id: room._id }, { $pull: { noticeQueue: { _id: job._id } } }); continue;
    }
    if (await Connection.exists({ _id: room._id, 'blockedBy.0': { $exists: true } })) {
      await DuelRoom.updateOne({ _id: room._id }, { $pull: { noticeQueue: { _id: job._id } } }); continue;
    }
    try {
      await Notification.updateOne({ _id: job._id }, { $setOnInsert: job }, { upsert: true });
      await DuelRoom.updateOne({ _id: room._id }, { $pull: { noticeQueue: { _id: job._id } } });
    } catch (error) { console.error('Duel activity pending:', error.message); }
  }
};
const summary = (room, friendship, userId) => {
  const current = room?.state.current;
  const partner = id(friendship.user1) === userId ? friendship.user2 : friendship.user1;
  return {
    id: id(friendship), contractKey: friendship.casual ? null : publicKey(friendship._id, 'contract'), casual: Boolean(friendship.casual), connectionId: friendship.casual ? id(friendship) : null, connectionStatus: friendship.connectionStatus || null, partner: person(partner), revision: room?.revision || 0,
    matchId: current?.id || null, status: current?.status || 'NONE', invitedByMe: current?.inviterId === userId,
    myTurn: current?.status === 'ACTIVE' && current.currentPlayerId === userId,
    turn: current?.turn || 0, updatedAt: current?.updatedAt || null, expiresAt: current?.expiresAt || null,
    winner: current?.winnerId ? current.winnerId === userId ? 'YOU' : 'PARTNER' : null,
    score: { you: room?.state.wins?.[userId] || 0, partner: room?.state.wins?.[id(partner)] || 0, draws: room?.state.draws || 0 },
  };
};
const detail = (room, friendship, userId) => {
  const base = summary(room, friendship, userId), current = room?.state.current;
  const otherId = id(friendship.user1) === userId ? id(friendship.user2) : id(friendship.user1);
  const role = value => value === userId ? 'YOU' : 'PARTNER';
  return {
    ...base, cards: Object.values(CARDS), hand: current?.status === 'ACTIVE' ? [...current.hands[userId]] : [],
    remaining: current?.deck?.length || 0,
    protected: { you: current?.protected?.includes(userId) || false, partner: current?.protected?.includes(otherId) || false },
    peek: current?.status === 'ACTIVE' && current.peeks[userId] ? { cardId: current.peeks[userId].cardId, turn: current.peeks[userId].turn, createdAt: current.peeks[userId].createdAt, stale: current.peeks[userId].stale } : null,
    moves: (current?.moves || []).map(move => ({ turn: move.turn, actor: role(move.actorId), cardId: move.cardId, blocked: move.blocked, outcome: move.outcome, createdAt: move.createdAt,
      ...(move.targetId ? { target: role(move.targetId) } : {}), ...(move.guess ? { guess: move.guess } : {}), ...(move.discardedCardId ? { discardedCardId: move.discardedCardId } : {}) })),
    result: current?.status === 'FINISHED' ? { winner: base.winner, reason: current.reason, you: [...current.hands[userId]], partner: [...current.hands[otherId]] } : null,
    history: (room?.state.history || []).map(item => ({ matchId: item.id, winner: item.winnerId ? role(item.winnerId) : null, reason: item.reason, endedAt: item.endedAt })),
  };
};
const getDuel = async (userId, roomId) => {
  const friendship = await relation(userId, roomId);
  const room = await expireRoom(await readRoom(roomId));
  await flushNotices(room);
  if (friendship.casual) await people.visibleRelation(userId, roomId);
  return detail(room, friendship, userId);
};
const listDuels = async userId => {
  const friendships = await Friendship.find({ status: 'ACTIVE', $or: [{ user1: userId }, { user2: userId }] })
    .populate('user1 user2', 'displayName username avatar avatarFrame isTestAccount testOwnerId').lean();
  let allowed = friendships.filter(f => f.user1 && f.user2 && id(f.user1) !== id(f.user2) && Boolean(f.user1.isTestAccount) === Boolean(f.user2.isTestAccount)
    && (!f.user1.isTestAccount || id(f.user1.testOwnerId) === id(f.user2.testOwnerId)));
  const [connections, blocks] = await Promise.all([
    Connection.find({ participants: userId, 'blockedBy.0': { $exists: false } }).populate('participants', 'displayName username avatar avatarFrame discovery isTestAccount testOwnerId').sort({ updatedAt: -1 }).limit(100).lean(),
    Connection.find({ participants: userId, 'blockedBy.0': { $exists: true } }).select('_id').lean(),
  ]);
  const blockedPairs = new Set(blocks.map(value => id(value)));
  allowed = allowed.filter(value => !blockedPairs.has(people.pairId(value.user1, value.user2)));
  for (const connection of connections) {
    const actor = connection.participants.find(value => id(value) === userId), other = connection.participants.find(value => id(value) !== userId);
    if (people.sameScope(actor, other)) allowed.push({ _id: connection._id, user1: actor, user2: other, casual: true, connectionStatus: connection.status });
  }
  const rooms = await DuelRoom.find({ _id: { $in: allowed.map(f => f._id) } }).select('+state +noticeQueue').lean();
  const byId = new Map();
  for (const value of rooms) { const room = await expireRoom(value); await flushNotices(room); byId.set(id(room), room); }
  const partners = allowed.filter(value => !value.casual || value.connectionStatus === 'CONNECTED' || byId.get(id(value))?.state.current).map(friendship => summary(byId.get(id(friendship)), friendship, userId));
  return { rooms: partners.filter(item => item.matchId).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)), partners, cards: Object.values(CARDS) };
};
const notices = (roomId, revision, current, userId, otherId, actorName, kind) => {
  const jobs = [];
  const add = (toUserId, type, title, message) => jobs.push({ _id: new mongoose.Types.ObjectId(hash(`duel:${roomId}:${current.id}:${revision}:${toUserId}`).slice(0, 24)),
    toUserId, fromUserId: userId, type, title, message, duelId: roomId, duelMatchId: current.id, duelRevision: revision, createdAt: new Date() });
  if (current.status === 'INVITED') add(otherId, 'DUEL_INVITE', 'A card duel?', `${actorName} invited you to a short card duel.`);
  else if (current.status === 'FINISHED') {
    for (const player of [userId, otherId]) add(player, 'DUEL_RESULT', current.winnerId ? current.winnerId === player ? 'You won the duel' : 'Duel finished' : 'A draw', 'The cards are on the table. See the result or play again.');
  } else if (current.status === 'ACTIVE') {
    if (kind === 'ACCEPT' && current.currentPlayerId === userId) add(otherId, 'DUEL_UPDATE', 'Duel accepted', `${actorName} accepted your duel and is taking the first turn.`);
    else add(current.currentPlayerId, 'DUEL_TURN', 'Your turn', `${actorName} made their move. Choose your next card.`);
  } else add(otherId, 'DUEL_UPDATE', 'Duel update', `${actorName} ${current.status === 'DECLINED' ? 'declined the invitation' : current.status === 'CANCELLED' ? 'cancelled the invitation' : 'left the round'}.`);
  return jobs;
};
const mutateDuel = async (userId, roomId, kind, body) => {
  const friendship = await relation(userId, roomId);
  roomId = id(friendship);
  body ||= {};
  if (typeof body.clientId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.clientId)) fail(400, 'A retry key is required.');
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) fail(400, 'Refresh the duel before making a move.');
  const players = [id(friendship.user1), id(friendship.user2)], otherId = players.find(value => value !== userId);
  const signature = hash(JSON.stringify([kind, body.revision, body.matchId || null, body.previousMatchId || null, body.cardId || null, body.guess || null, body.target || null]));
  await DuelRoom.updateOne({ _id: roomId }, { $setOnInsert: { revision: 0, state: { current: null, wins: {}, draws: 0, lastStarterId: null, history: [], receipts: [] }, noticeQueue: [] } }, { upsert: true }).catch(error => { if (error.code !== 11000) throw error; });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const room = await expireRoom(await readRoom(roomId));
    const prior = room.state.receipts.find(item => item.userId === userId && item.key === body.clientId);
    if (prior) { if (prior.signature !== signature) fail(409, 'This retry key belongs to another move.'); await flushNotices(room); return detail(room, friendship, userId); }
    if (body.revision !== room.revision) fail(409, 'The duel changed. Refresh to see the latest turn.');
    const state = structuredClone(room.state), before = state.current;
    const now = new Date(), stamp = now.toISOString();
    if (kind === 'INVITE') {
      if (friendship.casual && friendship.connectionStatus !== 'CONNECTED') {
        if (!friendship.user1.discovery?.enabled || !friendship.user2.discovery?.enabled) fail(403, 'Both profiles must be visible in Discover to send a new invitation.');
        if (['DECLINED', 'CANCELLED', 'ABANDONED'].includes(before?.status) && now - new Date(before.updatedAt) < 86400000) fail(429, 'Give this person a day before inviting them again.');
        const pairs = await Connection.find({ participants: userId }).select('_id').lean();
        if (await DuelRoom.countDocuments({ _id: { $in: pairs.map(value => value._id) }, 'state.current.status': 'INVITED', 'state.current.inviterId': userId, 'state.current.expiresAt': { $gt: stamp } }) >= 5) fail(429, 'You have five duel invitations waiting. Let people respond first.');
      }
      if ((before?.id || null) !== (body.previousMatchId || null)) fail(409, 'Refresh before inviting your friend again.');
      if (LIVE.includes(before?.status)) fail(409, 'You already have a duel in progress with this friend.');
      const starterId = state.lastStarterId ? players.find(value => value !== state.lastStarterId) : otherId;
      state.current = { id: hash(`duel-round:${roomId}:${userId}:${body.clientId}`).slice(0, 24), status: 'INVITED', inviterId: userId, starterId, turn: 0, createdAt: stamp, updatedAt: stamp, expiresAt: new Date(now.getTime() + WEEK).toISOString() };
    } else {
      if (!before || before.id !== body.matchId) fail(409, 'This round has changed. Open the current duel.');
      if (kind === 'ACCEPT' || kind === 'DECLINE' || kind === 'CANCEL') {
        if (before.status !== 'INVITED') fail(409, 'This invitation has already been answered.');
        if ((kind === 'CANCEL') !== (before.inviterId === userId)) fail(403, 'Only the invited friend can answer this invitation.');
        if (kind === 'ACCEPT') { state.current = { ...before, ...deal(players, before.starterId) }; state.lastStarterId = before.starterId; }
        else state.current.status = kind === 'DECLINE' ? 'DECLINED' : 'CANCELLED';
      } else if (kind === 'PLAY') {
        if (before.status !== 'ACTIVE' || before.currentPlayerId !== userId) fail(409, 'It is not your turn.');
        state.current = { ...before, ...play(before, userId, body, now) };
      } else if (kind === 'ABANDON') {
        if (before.status !== 'ACTIVE') fail(409, 'This round has already ended.');
        state.current.status = 'ABANDONED'; state.current.currentPlayerId = null;
      } else fail(400, 'Unknown duel action.');
      state.current.updatedAt = stamp; state.current.expiresAt = new Date(now.getTime() + WEEK).toISOString();
    }
    if (state.current.status === 'FINISHED' && before.status !== 'FINISHED') {
      if (state.current.winnerId) state.wins[state.current.winnerId] = (state.wins[state.current.winnerId] || 0) + 1;
      else state.draws += 1;
      state.history = [{ id: state.current.id, winnerId: state.current.winnerId, reason: state.current.reason, endedAt: stamp }, ...state.history].slice(0, 20);
    }
    state.receipts = [...state.receipts, { userId, key: body.clientId, signature }].slice(-64);
    const actor = id(friendship.user1) === userId ? friendship.user1 : friendship.user2;
    const jobs = notices(roomId, room.revision + 1, state.current, userId, otherId, actor.displayName || 'Your friend', kind);
    const result = await DuelRoom.updateOne({ _id: roomId, revision: room.revision }, { $set: { state }, $inc: { revision: 1 }, $push: { noticeQueue: { $each: jobs, $slice: -24 } } });
    if (result.matchedCount) { const committed = await readRoom(roomId); await flushNotices(committed); return detail(committed, friendship, userId); }
  }
  fail(409, 'The duel changed. Refresh to see the latest turn.');
};
const markDuelSeen = async (userId, roomId, body) => {
  await relation(userId, roomId);
  body ||= {};
  const room = await readRoom(roomId);
  if (!room || !/^[a-f0-9]{24}$/.test(String(body.matchId || '')) || !Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision > room.revision) fail(400, 'Invalid duel view.');
  await Notification.updateMany({ toUserId: userId, duelId: roomId, duelMatchId: body.matchId, duelRevision: { $lte: body.revision } }, { $set: { read: true } });
  return { success: true };
};

module.exports = { listDuels, getDuel, mutateDuel, markDuelSeen };
