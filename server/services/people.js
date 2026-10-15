const mongoose = require('mongoose');
const { createHash } = require('node:crypto');
const User = require('../models/User');
const Connection = require('../models/SocialConnection');
const Message = require('../models/SocialMessage');
const Report = require('../models/CommunityReport');
const Notification = require('../models/Notification');
const DuelRoom = require('../models/DuelRoom');
const GroupTable = require('../models/GroupTable');
const FIELDS = 'displayName username usernameNormalized avatar avatarFrame isTestAccount testOwnerId';
const id = value => String(value?._id || value || '');
const digest = value => createHash('sha256').update(value).digest('hex');
const pairId = (a, b) => digest(`social:${[id(a), id(b)].sort().join(':')}`).slice(0, 24);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const sameScope = (a, b) => a && b && id(a) !== id(b) && Boolean(a.isTestAccount) === Boolean(b.isTestAccount) && (!a.isTestAccount || id(a.testOwnerId) === id(b.testOwnerId));
const metAtTable = (one, two, finished = false) => {
  const pair = [id(one), id(two)];
  return GroupTable.exists({ $or: [
    { members: { $all: pair }, status: { $in: finished ? ['FINISHED'] : ['WAITING', 'ACTIVE', 'FINISHED'] }, ...(finished ? { 'state.current.forfeited': { $nin: pair } } : {}) },
    { 'state.history': { $elemMatch: { players: { $all: pair }, forfeited: { $nin: pair } } } },
  ] });
};
const publicPerson = user => ({ displayName: user.displayName, username: user.username, avatar: user.avatar || null, avatarFrame: user.avatarFrame || 'plain' });
const read = key => Connection.findById(key).select('+blockedBy +receipts +outbox').lean();
const ensure = async (a, b) => {
  const key = pairId(a, b);
  await Connection.updateOne({ _id: key }, { $setOnInsert: { participants: [a._id, b._id], revision: 0, status: 'NONE', blockedBy: [], receipts: [], outbox: [], sequence: 0 } }, { upsert: true }).catch(error => { if (error.code !== 11000) throw error; });
  return read(key);
};
const visibleRelation = async (userId, key, { allowOwnBlock = false } = {}) => {
  if (!mongoose.isValidObjectId(key)) fail(404, 'Connection unavailable.');
  const connection = await read(key);
  if (!connection || !connection.participants.some(value => id(value) === userId)) fail(404, 'Connection unavailable.');
  const users = await User.find({ _id: { $in: connection.participants } }).select(FIELDS).lean();
  const actor = users.find(value => id(value) === userId), other = users.find(value => id(value) !== userId);
  if (!sameScope(actor, other) || connection.blockedBy.length && !(allowOwnBlock && connection.blockedBy.includes(userId))) fail(404, 'Connection unavailable.');
  return { connection, actor, other };
};
const byUsername = async (userId, username, { allowOwnBlock = false } = {}) => {
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) fail(404, 'Person unavailable.');
  const [actor, other] = await Promise.all([User.findById(userId).select(FIELDS).lean(), User.findOne({ usernameNormalized: username.toLowerCase() }).select(FIELDS).lean()]);
  if (!sameScope(actor, other)) fail(404, 'Person unavailable.');
  const connection = await read(pairId(actor, other));
  if (connection?.blockedBy.length && !(allowOwnBlock && connection.blockedBy.includes(userId))) fail(404, 'Person unavailable.');
  if ((!connection || !['CONNECTED', 'PENDING'].includes(connection.status)) && !await DuelRoom.exists({ _id: pairId(actor, other), 'state.current.id': { $exists: true } }) && !await metAtTable(actor, other)) fail(404, 'Meet at an open table first.');
  return { actor, other, connection };
};
const view = (connection, other, userId) => ({ id: id(connection), revision: connection.revision, status: connection.status, requestedByMe: connection.requestedBy === userId, partner: publicPerson(other), updatedAt: connection.updatedAt });
const closeCasualDuel = async key => {
  const connection = await Connection.findById(key).lean();
  if (connection) {
    const tables = await GroupTable.find({ members: { $all: connection.participants.map(id) }, status: { $in: ['ACTIVE', 'WAITING'] } }).select('_id').lean();
    await GroupTable.updateMany({ _id: { $in: tables.map(table => table._id) }, status: { $in: ['ACTIVE', 'WAITING'] } }, { $set: { status: 'CANCELLED', noticeQueue: [] }, $inc: { revision: 1 } });
    await Notification.deleteMany({ duelId: { $in: tables.map(table => `table_${table._id}`) } });
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const room = await DuelRoom.findById(key).select('+state').lean();
    if (!room) {
      const inserted = await DuelRoom.updateOne({ _id: key }, { $setOnInsert: { revision: 1, state: { current: null, wins: {}, draws: 0, lastStarterId: null, history: [], receipts: [] }, noticeQueue: [] } }, { upsert: true }).catch(error => { if (error.code === 11000) return {}; throw error; });
      if (inserted.upsertedId) return;
      continue;
    }
    const state = structuredClone(room.state);
    if (['INVITED', 'ACTIVE'].includes(state.current?.status)) { state.current.status = 'ABANDONED'; state.current.currentPlayerId = null; state.current.updatedAt = new Date().toISOString(); }
    const result = await DuelRoom.updateOne({ _id: key, revision: room.revision }, { $set: { state, noticeQueue: [] }, $inc: { revision: 1 } });
    if (result.matchedCount) return;
  }
  fail(503, 'The contact block is saved. Round cleanup is retrying.');
};
// Message authorization and its durable delivery job commit on the same document.
// Block and accept races therefore cannot admit a post-consent message.
const flush = async connection => {
  for (const job of connection.outbox || []) {
    if (job.kind === 'message') await Message.updateOne({ _id: job.data._id }, { $setOnInsert: job.data }, { upsert: true });
    else if (job.kind === 'close-duel') { await closeCasualDuel(id(connection)); await Notification.deleteMany({ $or: [{ connectionId: id(connection) }, { duelId: id(connection) }] }); }
    else {
      const latest = await Connection.findById(connection._id).select('+blockedBy').lean();
      if (latest && latest.blockedBy.length === 0 && job.revision === latest.revision) await Notification.updateOne({ _id: job.data._id }, { $setOnInsert: job.data }, { upsert: true });
    }
    await Connection.updateOne({ _id: connection._id }, { $pull: { outbox: { key: job.key } } });
  }
};
const getPerson = async (userId, username) => {
  const context = await byUsername(userId, username);
  return { person: publicPerson(context.other), connection: context.connection ? view(context.connection, context.other, userId) : null };
};
const prepareDuel = async (userId, username) => {
  const { actor, other, connection } = await byUsername(userId, username);
  const row = connection || await ensure(actor, other);
  return { id: id(row) };
};
const listConnections = async userId => {
  const actor = await User.findById(userId).select(FIELDS).lean();
  if (!actor) fail(404, 'Account unavailable.');
  const connections = await Connection.find({ participants: userId, status: { $in: ['CONNECTED', 'PENDING'] } }).select('+blockedBy +outbox').sort({ updatedAt: -1 }).limit(100).lean();
  const users = await User.find({ _id: { $in: connections.flatMap(value => value.participants) } }).select(FIELDS).lean();
  const result = [];
  for (const connection of connections) {
    const other = users.find(value => connection.participants.some(part => id(part) === id(value)) && id(value) !== userId);
    if (connection.blockedBy.length || !sameScope(actor, other)) continue;
    await flush(connection); result.push(view(connection, other, userId));
  }
  return { connections: result };
};
const mutate = async (userId, key, action, body) => {
  const { connection: initial, actor, other } = await visibleRelation(userId, key, { allowOwnBlock: ['BLOCK', 'UNBLOCK'].includes(action) });
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(body?.clientId || '') || !Number.isSafeInteger(body.revision) || body.revision < 0) fail(400, 'Refresh this connection before trying again.');
  const text = action === 'MESSAGE' && typeof body.text === 'string' ? body.text.trim() : '';
  if (action === 'MESSAGE' && (!text || text.length > 1000)) fail(400, 'Write a message of 1–1,000 characters.');
  const signature = digest(JSON.stringify([action, body.revision, text]));
  await flush(initial);
  const connection = await read(key);
  const prior = connection.receipts.find(value => value.userId === userId && value.key === body.clientId);
  if (prior) { if (prior.signature !== signature) fail(409, 'This retry key belongs to another action.'); return { success: true, connection: view(connection, other, userId) }; }
  if (connection.revision !== body.revision) fail(409, 'This connection changed. Refresh and try again.');
  const stamp = new Date(); let status = connection.status, requestedBy = connection.requestedBy;
  let blockedBy = [...connection.blockedBy], sequence = connection.sequence;
  const outbox = [];
  if (action === 'REQUEST') {
    if (!await DuelRoom.exists({ _id: key, $or: [{ 'state.current.status': 'FINISHED' }, { 'state.history.0': { $exists: true } }] }) && !await metAtTable(actor, other, true)) fail(403, 'Finish a round together before connecting.');
    if (['CONNECTED', 'PENDING'].includes(status)) fail(409, 'A connection or invitation already exists.');
    if (connection.requestedAt && stamp - new Date(connection.requestedAt) < 86400000) fail(429, 'Give this person a day before inviting them again.');
    if (await Connection.countDocuments({ participants: userId, requestedBy: userId, status: 'PENDING' }) >= 5) fail(429, 'You have five invitations waiting. Let people respond first.');
    status = 'PENDING'; requestedBy = userId;
  } else if (['ACCEPT', 'DECLINE', 'CANCEL'].includes(action)) {
    if (status !== 'PENDING' || (action === 'CANCEL') !== (requestedBy === userId)) fail(409, 'This invitation is no longer yours to answer.');
    status = action === 'ACCEPT' ? 'CONNECTED' : 'DECLINED';
  } else if (action === 'BLOCK') {
    if (blockedBy.includes(userId)) fail(409, 'This person is already blocked.');
    blockedBy.push(userId); status = 'NONE'; requestedBy = null;
    outbox.push({ key: `close-duel:${connection.revision + 1}`, kind: 'close-duel' });
  }
  else if (action === 'UNBLOCK') { blockedBy = blockedBy.filter(value => value !== userId); status = 'NONE'; }
  else if (action === 'MESSAGE') {
    if (status !== 'CONNECTED' || blockedBy.length) fail(403, 'Chat opens after you both accept a connection.');
    sequence += 1;
    outbox.push({ key: `message:${sequence}`, kind: 'message', data: { _id: digest(`message:${key}:${userId}:${body.clientId}`).slice(0, 24), connectionId: key, senderId: userId, sequence, text, createdAt: stamp } });
  } else fail(400, 'Choose a valid connection action.');
  if (['REQUEST', 'ACCEPT', 'MESSAGE'].includes(action)) {
    const notification = { _id: digest(`connection:${key}:${connection.revision + 1}`).slice(0, 24), toUserId: id(other), fromUserId: userId, type: action === 'MESSAGE' ? 'CONNECTION_MESSAGE' : action === 'REQUEST' ? 'CONNECTION_INVITE' : 'CONNECTION_ACCEPTED', title: action === 'MESSAGE' ? 'A new message' : action === 'REQUEST' ? 'Let’s connect' : 'You’re connected', message: action === 'MESSAGE' ? `${actor.displayName} sent you a message.` : action === 'REQUEST' ? `${actor.displayName} would like to connect. Chat opens if you accept.` : `${actor.displayName} accepted your connection.`, connectionId: key, connectionRevision: connection.revision + 1, createdAt: stamp };
    outbox.push({ key: `notice:${connection.revision + 1}`, kind: 'notice', revision: connection.revision + 1, data: notification });
  }
  const receipt = { userId, key: body.clientId, signature };
  const result = await Connection.updateOne({ _id: key, revision: connection.revision, blockedBy: connection.blockedBy }, { $set: { status, requestedBy, blockedBy, sequence, ...(action === 'REQUEST' ? { requestedAt: stamp } : {}) }, $inc: { revision: 1 }, $push: { receipts: { $each: [receipt], $slice: -64 }, outbox: { $each: outbox } } });
  if (!result.matchedCount) {
    const latest = await read(key), replay = latest.receipts.find(value => value.userId === userId && value.key === body.clientId);
    if (replay?.signature === signature && !latest.blockedBy.length) { await flush(latest); return { success: true, connection: view(latest, other, userId) }; }
    fail(409, 'This connection changed. Refresh and try again.');
  }
  const committed = await read(key); await flush(committed);
  return { success: true, connection: view(committed, other, userId) };
};
const requestConnection = async (userId, username, body) => {
  const { actor, other, connection } = await byUsername(userId, username);
  const row = connection || await ensure(actor, other);
  return mutate(userId, id(row), 'REQUEST', body);
};
const getChat = async (userId, key, before) => {
  const { connection, other } = await visibleRelation(userId, key);
  if (connection.status !== 'CONNECTED') fail(403, 'Chat opens after you both accept a connection.');
  if (before !== undefined && (!/^\d{1,10}$/.test(before) || Number(before) < 1)) fail(400, 'Invalid message cursor.');
  await flush(connection);
  const messages = await Message.find({ connectionId: key, ...(before ? { sequence: { $lt: Number(before) } } : {}) }).sort({ sequence: -1 }).limit(31).lean();
  // Recheck consent after I/O. A concurrent block prevents the response too.
  await visibleRelation(userId, key);
  return { connection: view(connection, other, userId), messages: messages.slice(0, 30).reverse().map(value => ({ id: id(value), sequence: value.sequence, fromMe: value.senderId === userId, text: value.text, createdAt: value.createdAt })), next: messages.length > 30 ? messages[29].sequence : null };
};
const seen = async (userId, key, revision) => {
  const { connection } = await visibleRelation(userId, key);
  if (!Number.isSafeInteger(revision) || revision < 0 || revision > connection.revision) fail(400, 'Invalid connection view.');
  await Notification.updateMany({ toUserId: userId, connectionId: key, connectionRevision: { $lte: revision } }, { $set: { read: true } });
  return { success: true };
};
const blockPerson = async (userId, username, body) => {
  const { actor, other, connection } = await byUsername(userId, username, { allowOwnBlock: true });
  const row = connection || await ensure(actor, other);
  return mutate(userId, id(row), 'BLOCK', body);
};
const reportPerson = async (userId, username, body) => {
  const { actor, other } = await byUsername(userId, username);
  if (!['SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'OTHER'].includes(body?.reason) || typeof body.note !== 'string' || body.note.trim().length > 500) fail(400, 'Choose a reason and keep your note under 500 characters.');
  const key = digest(`report:${userId}:${id(other)}:${new Date().toISOString().slice(0, 10)}`).slice(0, 24);
  await Report.updateOne({ _id: key }, { $setOnInsert: { reporterId: userId, targetId: other._id, reason: body.reason, note: body.note.trim(), status: 'OPEN', isTestReport: Boolean(actor.isTestAccount) } }, { upsert: true });
  return { success: true };
};
const blocked = async (a, b) => Boolean(await Connection.exists({ _id: pairId(a, b), 'blockedBy.0': { $exists: true } }));
const listBlocked = async userId => {
  const rows = await Connection.find({ participants: userId, blockedBy: userId }).select('+blockedBy +outbox').limit(100).lean();
  for (const row of rows) await flush(row);
  const users = await User.find({ _id: { $in: rows.flatMap(value => value.participants) } }).select(FIELDS).lean();
  return { connections: rows.map(value => view(value, users.find(person => id(person) !== userId && value.participants.some(part => id(part) === id(person))) || { displayName: 'Unavailable account' }, userId)) };
};
module.exports = { ensure, getPerson, prepareDuel, listConnections, listBlocked, mutate, requestConnection, getChat, seen, blockPerson, reportPerson, visibleRelation, blocked, pairId, publicPerson, sameScope };
