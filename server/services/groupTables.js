const { createHash, randomInt } = require('node:crypto');
const mongoose = require('mongoose');
const Table = require('../models/GroupTable');
const User = require('../models/User');
const Connection = require('../models/SocialConnection');
const Notification = require('../models/Notification');
const people = require('./people');
const rules = require('./tableRules');
const { rewardJobs, flushRewards, rewardView } = require('./gameRewards');

const { atTable, touchSeat } = require('./tablePresence');
const { effectiveBack } = require('./gameStyles');
const { auraMoments } = require('./auraMoments');

const hash = value => createHash('sha256').update(value).digest('hex');
const id = value => String(value?._id || value || '');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const codeFor = value => { if (typeof value !== 'string' || !/^[A-F0-9]{12}$/i.test(value)) fail(404, 'Table unavailable.'); return value.toUpperCase(); };
const retryKey = body => { if (typeof body?.clientId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.clientId)) fail(400, 'A retry key is required.'); };
const read = code => Table.findById(code).select('+state +rewardQueue +noticeQueue +presence').lean();
const checkPlayers = async members => {
  const users = await User.find({ _id: { $in: members } }).select('displayName username avatar avatarFrame cardBack isTestAccount testOwnerId +cosmeticUnlocks +gameRewardDays').lean();
  if (users.length !== members.length) fail(404, 'Table unavailable.');
  const pairs = [];
  for (let a = 0; a < users.length; a += 1) for (let b = a + 1; b < users.length; b += 1) {
    if (!people.sameScope(users[a], users[b])) fail(404, 'Table unavailable.');
    pairs.push(people.pairId(users[a], users[b]));
  }
  if (await Connection.exists({ _id: { $in: pairs }, 'blockedBy.0': { $exists: true } })) fail(404, 'Table unavailable.');
  return users;
};
const guarded = async (userId, code, { joining = false } = {}) => {
  let room = await read(codeFor(code));
  if (!room || !joining && !room.members.includes(userId)) fail(404, 'Table unavailable.');
  if (new Date(room.expiresAt) <= new Date() && ['ACTIVE', 'WAITING'].includes(room.status)) {
    await Table.updateOne({ _id: room._id, revision: room.revision }, { $set: { status: 'EXPIRED', noticeQueue: [] }, $inc: { revision: 1 } });
    room = await read(room._id);
  }
  if (!room.members.includes(userId) && room.status !== 'WAITING') fail(404, 'This table is no longer taking players.');
  let users;
  try { users = await checkPlayers(room.members); }
  catch (error) {
    if (error.status === 404 && ['WAITING', 'ACTIVE'].includes(room.status)) await Table.updateOne({ _id: room._id, revision: room.revision }, { $set: { status: 'CANCELLED', noticeQueue: [] }, $inc: { revision: 1 } });
    throw error;
  }
  if (!room.members.includes(userId)) users = await checkPlayers([...room.members, userId]);
  return { room, users };
};
const flush = async room => {
  await flushRewards(Table, room);
  for (const job of room.noticeQueue || []) {
    if (job.duelRevision !== room.revision || !['ACTIVE', 'FINISHED'].includes(room.status)) {
      await Table.updateOne({ _id: room._id }, { $pull: { noticeQueue: { _id: job._id } } }); continue;
    }
    try {
      await checkPlayers(room.members);
      await Notification.updateOne({ _id: job._id }, { $setOnInsert: job }, { upsert: true });
      await Table.updateOne({ _id: room._id }, { $pull: { noticeQueue: { _id: job._id } } });
    } catch (error) { if (error.status !== 404) console.error('Table activity pending:', error.message); }
  }
};
const view = async (room, users, userId, { summary = false } = {}) => {
  const game = room.state.current;
  const member = room.members.includes(userId);
  if (!member) return { id: room._id, status: room.status, canJoin: true, count: room.members.length, maxPlayers: 4 };
  const finished = room.status === 'FINISHED';
  const players = room.members.map(playerId => {
    const user = users.find(person => id(person) === playerId);
    return { ...people.publicPerson(user), cardBack: effectiveBack(user), atTable: atTable(room, playerId), id: playerId, me: playerId === userId, host: room.hostId === playerId,
      ready: room.state.ready.includes(playerId), eliminated: game?.eliminated.includes(playerId) || false,
      forfeited: game?.forfeited.includes(playerId) || false, protected: game?.protected.includes(playerId) || false,
      winner: finished && game.winnerIds.includes(playerId),
      ...(finished ? { hand: [...game.hands[playerId]] } : {}) };
  });
  const base = { id: room._id, revision: room.revision, status: room.status, host: room.hostId === userId,
    matchId: game?.id || null, myTurn: room.status === 'ACTIVE' && game.currentPlayerId === userId,
    currentPlayerId: room.status === 'ACTIVE' ? game.currentPlayerId : null,
    players, expiresAt: room.expiresAt, updatedAt: room.updatedAt, turn: game?.turn || 0,
    winner: finished && game.winnerIds.includes(userId) ? game.reason === 'DRAW' ? 'DRAW' : 'YOU' : finished ? 'OTHER' : null };
  if (summary) return base;
  return { ...base, cards: rules.cards(), hand: room.status === 'ACTIVE' ? [...game.hands[userId]] : [],
    remaining: game?.deck.length || 0, peek: room.status === 'ACTIVE' ? game.peeks[userId] || null : null,
    moves: game?.moves || [], reason: finished ? game.reason : null,
    rewards: await rewardView(userId, game), auraMoments: auraMoments(game),
  };
};
const getTable = async (userId, code) => {
  let { room, users } = await guarded(userId, code, { joining: true });
  if (room.members.includes(userId)) await flush(room);
  ({ room, users } = await guarded(userId, code, { joining: true }));
  if (room.members.includes(userId)) await touchSeat(Table, room, userId).catch(() => {});
  return view(room, users, userId);
};
const listTables = async userId => {
  const rooms = await Table.find({ members: userId, expiresAt: { $gt: new Date() }, status: { $in: ['WAITING', 'ACTIVE', 'FINISHED'] } }).select('+state +rewardQueue +noticeQueue +presence').sort({ updatedAt: -1 }).limit(12).lean();
  const result = [];
  for (const room of rooms) {
    try { await checkPlayers(room.members); await flush(room); const users = await checkPlayers(room.members); result.push(await view(room, users, userId, { summary: true })); }
    catch (error) { if (error.status !== 404) throw error; }
  }
  return { tables: result };
};
const createTable = async (userId, body) => {
  retryKey(body);
  const code = hash(`group-table:${userId}:${body.clientId}`).slice(0, 12).toUpperCase();
  if (await Table.exists({ _id: code, hostId: userId })) return getTable(userId, code);
  await checkPlayers([userId]);
  if (await Table.countDocuments({ members: userId, status: { $in: ['WAITING', 'ACTIVE'] }, expiresAt: { $gt: new Date() } }) >= 5) fail(429, 'You have five tables open. Finish or leave one first.');
  await Table.updateOne({ _id: code }, { $setOnInsert: { hostId: userId, members: [userId], revision: 0, status: 'WAITING', expiresAt: new Date(Date.now() + 3 * 3600000), state: { ready: [userId], current: null, history: [], receipts: [] }, noticeQueue: [], rewardQueue: [] } }, { upsert: true }).catch(error => { if (error.code !== 11000) throw error; });
  return getTable(userId, code);
};
const mutateTable = async (userId, code, action, body = {}) => {
  retryKey(body); code = codeFor(code);
  if (!['JOIN', 'READY', 'START', 'PLAY', 'LEAVE', 'REMATCH'].includes(action)) fail(400, 'Choose a valid table action.');
  if (action !== 'JOIN' && (!Number.isSafeInteger(body.revision) || body.revision < 0)) fail(400, 'Refresh the table before making a move.');
  const signature = hash(JSON.stringify([action, body.revision ?? null, body.matchId || null, body.cardId || null, body.targetId || null, body.guess || null, body.ready ?? null]));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (action === 'LEAVE') {
      const departed = await read(code);
      const receipt = departed?.state.receipts.find(value => value.userId === userId && value.key === body.clientId);
      if (receipt && !departed.members.includes(userId)) {
        if (receipt.signature !== signature) fail(409, 'This retry key belongs to another move.');
        return { id: code, status: 'LEFT' };
      }
    }
    const { room } = await guarded(userId, code, { joining: action === 'JOIN' });
    const prior = room.state.receipts.find(receipt => receipt.userId === userId && receipt.key === body.clientId);
    if (prior) { if (prior.signature !== signature) fail(409, 'This retry key belongs to another move.'); return getTable(userId, code); }
    if (action !== 'JOIN' && room.revision !== body.revision) fail(409, 'The table changed. Refresh for the latest turn.');
    const state = structuredClone(room.state), members = [...room.members], now = new Date(), stamp = now.toISOString();
    let status = room.status, hostId = room.hostId;
    const rewards = [];
    if (action === 'JOIN') {
      if (members.includes(userId)) return getTable(userId, code);
      if (status !== 'WAITING' || members.length >= 4) fail(409, 'This table is full or has already started.');
      if (await Table.countDocuments({ members: userId, status: { $in: ['WAITING', 'ACTIVE'] }, expiresAt: { $gt: now } }) >= 5) fail(429, 'Finish or leave one of your five open tables first.');
      members.push(userId);
    } else if (action === 'READY') {
      if (status !== 'WAITING' || typeof body.ready !== 'boolean') fail(409, 'Readiness is only available before the round.');
      state.ready = state.ready.filter(player => player !== userId); if (body.ready) state.ready.push(userId);
    } else if (action === 'START') {
      if (userId !== hostId) fail(403, 'Only the host can start the round.');
      if (status !== 'WAITING' || members.length < 2 || !members.every(player => state.ready.includes(player))) fail(409, 'Wait for two to four players to be ready.');
      status = 'ACTIVE';
      state.current = { ...rules.deal(members, members[randomInt(members.length)]), id: hash(`table-round:${code}:${body.clientId}`).slice(0, 24), createdAt: stamp, updatedAt: stamp };
    } else if (action === 'PLAY') {
      if (status !== 'ACTIVE' || state.current.id !== body.matchId) fail(409, 'This round has changed. Open the current table.');
      if (state.current.currentPlayerId !== userId) fail(409, 'It is not your turn.');
      state.current = { ...state.current, ...rules.play(state.current, userId, body, now), updatedAt: stamp };
      status = state.current.status;
    } else if (action === 'LEAVE') {
      if (status === 'WAITING') {
        members.splice(members.indexOf(userId), 1); state.ready = state.ready.filter(player => player !== userId);
        if (!members.length) status = 'CANCELLED'; else if (hostId === userId) hostId = members[0];
      } else if (status === 'ACTIVE') {
        if (state.current.id !== body.matchId) fail(409, 'This round has changed. Refresh first.');
        state.current = { ...state.current, ...rules.forfeit(state.current, userId, now), updatedAt: stamp }; status = state.current.status;
      } else fail(409, 'This round has already ended.');
    } else if (action === 'REMATCH') {
      if (userId !== hostId) fail(403, 'Only the host can open another round.');
      if (status !== 'FINISHED') fail(409, 'Finish this round first.');
      status = 'WAITING'; state.current = null; state.ready = [userId];
    }
    if (status === 'FINISHED' && room.status !== 'FINISHED') {
      state.current.rewardVersion = 1; rewards.push(...rewardJobs(state.current, members, stamp));
      state.history = [{ id: state.current.id, players: [...state.current.players], forfeited: [...state.current.forfeited], endedAt: stamp }, ...(state.history || [])].slice(0, 20);
    }
    state.receipts = [...state.receipts, { userId, key: body.clientId, signature }].slice(-96);
    const jobs = [];
    if (status === 'ACTIVE' || status === 'FINISHED') for (const player of status === 'ACTIVE' ? [state.current.currentPlayerId] : members) jobs.push({
      _id: new mongoose.Types.ObjectId(hash(`table-notice:${code}:${room.revision + 1}:${player}`).slice(0, 24)), toUserId: player, fromUserId: userId,
      type: status === 'ACTIVE' ? 'DUEL_TURN' : 'DUEL_RESULT', title: status === 'ACTIVE' ? 'Your turn at the group table' : 'Group round finished',
      message: status === 'ACTIVE' ? 'Choose one card to play. Keep the other hidden.' : 'See the final cards and your round reward.',
      duelId: `table_${code}`, duelMatchId: state.current.id, duelRevision: room.revision + 1, createdAt: now,
    });
    await checkPlayers([...new Set([...members, userId])]);
    const committed = await Table.updateOne({ _id: code, revision: room.revision }, { $set: { members, hostId, state, status, expiresAt: new Date(+now + (status === 'WAITING' ? 3 * 3600000 : 7 * 86400000)) }, ...(action === 'LEAVE' && room.status === 'WAITING' ? { $unset: { [`presence.${userId}`]: '' } } : {}), $inc: { revision: 1 }, $push: { rewardQueue: { $each: rewards }, noticeQueue: { $each: jobs, $slice: -32 } } });
    if (committed.matchedCount) {
      if (!members.includes(userId)) return { id: code, status: 'LEFT' };
      return getTable(userId, code);
    }
  }
  fail(409, 'The table changed. Refresh and try again.');
};
const seenTable = async (userId, code, body = {}) => {
  const { room } = await guarded(userId, code);
  if (typeof body.matchId !== 'string' || !/^[a-f0-9]{24}$/.test(body.matchId) || !Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision > room.revision) fail(400, 'Invalid table view.');
  await Notification.updateMany({ toUserId: userId, duelId: `table_${room._id}`, duelMatchId: body.matchId, duelRevision: { $lte: body.revision } }, { $set: { read: true } });
  return { success: true };
};
module.exports = { createTable, listTables, getTable, mutateTable, seenTable };
