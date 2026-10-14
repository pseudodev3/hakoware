const { createHash } = require('node:crypto');
const User = require('../models/User');
const Queue = require('../models/OpenTableQueue');
const DuelRoom = require('../models/DuelRoom');
const Connection = require('../models/SocialConnection');
const people = require('./people');
const { startOpenTable, getDuel } = require('./duels');

const LEASE = 90000, WAIT = 5 * 60000, WEEK = 7 * 86400000, CAPACITY = 400;
const fail = (status, message) => { throw Object.assign(new Error(message), { status, ...(status === 503 ? { publicMessage: message } : {}) }); };
const id = value => String(value?._id || value || '');
const digest = value => createHash('sha256').update(value).digest('hex');
const read = key => Queue.findById(key).select('+seats').lean();
const scope = async userId => {
  const user = await User.findById(userId).select('displayName username avatar avatarFrame isTestAccount testOwnerId').lean();
  if (!user) fail(404, 'Account unavailable.');
  return { user, key: user.isTestAccount ? `lab:${id(user.testOwnerId)}` : 'players' };
};
const initialize = async key => {
  await Queue.updateOne({ _id: key }, { $setOnInsert: { revision: 0, seats: [] } }, { upsert: true }).catch(error => { if (error.code !== 11000) throw error; });
};
const live = (seat, now) => new Date(seat.expiresAt) > now;
const removeMatch = (key, matchId) => Queue.updateOne({ _id: key }, { $pull: { seats: { 'match.id': matchId } }, $inc: { revision: 1 } });
const resolve = async (key, seat, userId) => {
  if (!seat) return { status: 'IDLE' };
  if (seat.phase === 'WAITING') return { status: 'WAITING', ticketId: seat.ticketId, deadline: seat.deadline };
  // An asynchronous round can outlive its original journal lease when a player
  // returns for a move. Keep that active round as their single open table.
  if (!live(seat, new Date())) {
    const room = await DuelRoom.findById(seat.match.roomId).select('+state').lean();
    if (room?.state.current?.id !== seat.match.id || room.state.current.status !== 'ACTIVE' || new Date(room.state.current.expiresAt) <= new Date()) {
      await removeMatch(key, seat.match.id);
      return { status: 'IDLE' };
    }
  }
  try {
    const duel = await startOpenTable(seat.match);
    const view = duel.id ? await getDuel(userId, duel.id) : null;
    return { status: 'MATCHED', ticketId: seat.ticketId, duelId: view.id, roundStatus: view.status };
  } catch (error) {
    if (![403, 404, 409].includes(error.status)) throw error;
    await removeMatch(key, seat.match.id);
    return { status: 'IDLE', message: 'That table is no longer available. You can take another seat.' };
  }
};
const getOpenTable = async (userId, ticketId) => {
  const { key } = await scope(userId), queue = await read(key), now = new Date();
  const seat = queue?.seats.find(value => value.userId === userId && (value.phase === 'PAIRED' || live(value, now)));
  // A caller must hold the current ticket to renew it. A read never creates a seat.
  if (seat?.phase === 'WAITING' && ticketId === seat.ticketId && +new Date(seat.expiresAt) - +now < LEASE / 2) {
    await Queue.updateOne({ _id: key, revision: queue.revision, seats: { $elemMatch: { userId, ticketId, phase: 'WAITING' } } }, { $set: { 'seats.$.expiresAt': new Date(Math.min(+new Date(seat.deadline), +now + LEASE)).toISOString() }, $inc: { revision: 1 } });
  }
  return resolve(key, seat, userId);
};
const enterOpenTable = async (userId, body) => {
  if (typeof body?.clientId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.clientId)) fail(400, 'A retry key is required.');
  const { user, key } = await scope(userId);
  await initialize(key);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const queue = await read(key), now = new Date();
    const own = queue.seats.find(value => value.userId === userId && (value.phase === 'PAIRED' || live(value, now)));
    if (own?.phase === 'WAITING') return resolve(key, own, userId);
    if (own?.phase === 'PAIRED') {
      const result = await resolve(key, own, userId);
      // A retry of the same click always returns its round, even if it just ended.
      if (own.ticketId === body.clientId || ['ACTIVE', 'INVITED'].includes(result.roundStatus)) return result;
      if (result.status === 'IDLE') continue;
    }
    let seats = queue.seats.filter(value => (value.phase === 'PAIRED' || live(value, now)) && value.userId !== userId);
    const waiting = seats.filter(value => value.phase === 'WAITING');
    const [users, blocked, rounds] = await Promise.all([
      User.find({ _id: { $in: waiting.map(value => value.userId) } }).select('displayName username avatar avatarFrame isTestAccount testOwnerId').lean(),
      Connection.find({ participants: userId, 'blockedBy.0': { $exists: true } }).select('_id').lean(),
      DuelRoom.find({ _id: { $in: waiting.map(value => people.pairId(userId, value.userId)) } }).select('+state').lean(),
    ]);
    const blocks = new Set(blocked.map(value => id(value)));
    const unavailable = new Set(rounds.filter(value => ['ACTIVE', 'INVITED'].includes(value.state.current?.status) && new Date(value.state.current.expiresAt) > now || ['DECLINED', 'CANCELLED', 'ABANDONED'].includes(value.state.current?.status) && now - new Date(value.state.current.updatedAt) < 86400000).map(value => id(value)));
    const opponent = waiting.find(value => users.some(other => id(other) === value.userId && people.sameScope(user, other)) && !blocks.has(people.pairId(userId, value.userId)) && !unavailable.has(people.pairId(userId, value.userId)));
    const ticketId = body.clientId;
    let mine;
    if (opponent) {
      const match = { id: digest(`open-table:${key}:${opponent.userId}:${userId}:${opponent.ticketId}:${ticketId}`).slice(0, 24), players: [opponent.userId, userId], createdAt: now.toISOString(), roomId: people.pairId(userId, opponent.userId) };
      seats = seats.filter(value => value.userId !== opponent.userId);
      const expiresAt = new Date(+now + WEEK).toISOString();
      seats.push({ userId: opponent.userId, ticketId: opponent.ticketId, phase: 'PAIRED', match, expiresAt });
      mine = { userId, ticketId, phase: 'PAIRED', match, expiresAt };
    } else mine = { userId, ticketId, phase: 'WAITING', deadline: new Date(+now + WAIT).toISOString(), expiresAt: new Date(+now + LEASE).toISOString() };
    // Completed matches retain a short retry window; idle history cannot fill the queue.
    const older = seats.filter(value => value.phase === 'PAIRED' && now - new Date(value.match.createdAt) > 10 * 60000);
    if (older.length) {
      const saved = await DuelRoom.find({ _id: { $in: older.map(value => value.match.roomId) } }).select('+state').lean();
      const ongoing = new Set(saved.filter(value => ['ACTIVE', 'INVITED'].includes(value.state.current?.status) && new Date(value.state.current.expiresAt) > now).map(value => value.state.current.id));
      seats = seats.filter(value => !older.includes(value) || ongoing.has(value.match.id));
    }
    if (seats.length >= CAPACITY) fail(503, 'The open tables are full right now. Try again shortly.');
    seats.push(mine);
    const committed = await Queue.updateOne({ _id: key, revision: queue.revision, ...(opponent ? { seats: { $elemMatch: { userId: opponent.userId, phase: 'WAITING', expiresAt: { $gt: new Date().toISOString() } } } } : {}) }, { $set: { seats }, $inc: { revision: 1 } });
    if (committed.matchedCount) return resolve(key, mine, userId);
  }
  fail(409, 'The table changed. Try taking a seat again.');
};
const leaveOpenTable = async (userId, body) => {
  if (typeof body?.ticketId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.ticketId)) fail(400, 'Choose your current seat.');
  const { key } = await scope(userId);
  // Pairing and cancellation compete on the same document. A stale tab cannot
  // cancel a newer seat or undo a game that both players have already entered.
  await Queue.updateOne({ _id: key, seats: { $elemMatch: { userId, ticketId: body.ticketId, phase: 'WAITING' } } }, { $pull: { seats: { userId, ticketId: body.ticketId, phase: 'WAITING' } }, $inc: { revision: 1 } });
  return getOpenTable(userId);
};

module.exports = { getOpenTable, enterOpenTable, leaveOpenTable };
