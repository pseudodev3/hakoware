const mongoose = require('mongoose');
const ContractEvent = require('../models/ContractEvent');
const ContractMoment = require('../models/ContractMoment');
const VoiceNote = require('../models/VoiceNote');
const Notification = require('../models/Notification');
const { eligibleForCheckin, performContractCheckin } = require('./contractCheckin');
const { getBountyDecisionRequirement } = require('./bountyEscrow');

const PAGE_SIZE = 40;
const MESSAGE_MAX_LENGTH = 1000;
const id = (value) => String(value?._id || value || '');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const TIMELINE_TYPES = Object.freeze([
  'MESSAGE', 'CHECKIN', 'VOICE_CHECKIN', 'CHECKIN_REPLY', 'CHECKIN_REACTION', 'POKE', 'MUTUAL_POKE',
  'CONTRACT_CREATED', 'CONTRACT_ACCEPTED', 'SEASON_STARTED', 'SEASON_COMPLETED', 'DUO_LEVEL_UP',
  'CHAOS_TRIGGERED', 'CHAOS_SURVIVED', 'CHAOS_FAILED', 'BANKRUPTCY',
  'BANKRUPTCY_RECOVERY_STARTED', 'BANKRUPTCY_RECOVERED', 'BOUNTY_REWARD', 'BOUNTY_ESCAPED',
  'HOT_SEAT_OPENED', 'HOT_SEAT_ANSWERED', 'HOT_SEAT_REVEALED',
  'SPLIT_DECISION_OPENED', 'SPLIT_DECISION_ANSWERED', 'SPLIT_DECISION_REVEALED',
  'DOUBLE_DARE_STARTED', 'DOUBLE_DARE_SENT', 'DOUBLE_DARE_REVEALED'
]);
const actorName = (actorId, friendship, viewerId) => {
  if (!actorId) return 'Hakoware';
  if (id(actorId) === id(viewerId)) return 'You';
  if (id(actorId) === id(friendship.user1)) return friendship.user1DisplayName || 'Your friend';
  if (id(actorId) === id(friendship.user2)) return friendship.user2DisplayName || 'Your friend';
  return 'Hakoware';
};

// This projection deliberately excludes raw event metadata and unrevealed moment answers.
const timelineView = (event, friendship, viewerId, voice = null, moment = null) => {
  if (!event || !TIMELINE_TYPES.includes(event.type)) return null;
  const meta = event.metadata || {};
  const actor = actorName(event.userId, friendship, viewerId);
  const mine = id(event.userId) === id(viewerId);
  let text = '';
  switch (event.type) {
    case 'MESSAGE': text = meta.kind === 'VOICE' ? 'Voice message' : String(meta.text || ''); break;
    case 'CHECKIN': case 'VOICE_CHECKIN':
      text = `${actor} ${event.type === 'VOICE_CHECKIN' ? 'sent a voice check-in' : 'checked in'}${meta.checkinStatus ? ` · ${String(meta.checkinStatus).toLowerCase().replace('_', ' ')}` : ''}${meta.note ? ` · ${meta.note}` : ''}`; break;
    case 'CHECKIN_REPLY': text = String(meta.text || ''); break;
    case 'CHECKIN_REACTION': text = `${actor} reacted ${meta.reaction || '👀'}`; break;
    case 'POKE': text = `${actor} poked ${mine ? 'your friend' : 'you'}`; break;
    case 'MUTUAL_POKE': text = 'You both hit Mutual Menace'; break;
    case 'CONTRACT_CREATED': text = 'Your contract began'; break;
    case 'CONTRACT_ACCEPTED': text = 'Your contract was accepted'; break;
    case 'SEASON_STARTED': text = `Season ${Number(meta.season) || 1} started`; break;
    case 'SEASON_COMPLETED': text = `Season ${Number(meta.season) || 1} completed`; break;
    case 'DUO_LEVEL_UP': text = `Your duo reached level ${Number(meta.level) || 1}${meta.title ? ` · ${meta.title}` : ''}`; break;
    case 'CHAOS_TRIGGERED': text = `${meta.name || 'An anomaly'} went live`; break;
    case 'CHAOS_SURVIVED': text = `${actor} survived ${meta.name || 'Chaos'}`; break;
    case 'CHAOS_FAILED': text = `${actor} lost to Chaos${meta.consequence ? ` · ${meta.consequence}` : ''}`; break;
    case 'BANKRUPTCY': text = `${actor} went bankrupt`; break;
    case 'BANKRUPTCY_RECOVERY_STARTED': text = `${actor} started recovery · one clean check-in remains`; break;
    case 'BANKRUPTCY_RECOVERED': text = `${actor} completed recovery`; break;
    case 'BOUNTY_REWARD': text = 'A bounty was claimed'; break;
    case 'BOUNTY_ESCAPED': text = 'A bounty was escaped'; break;
    default: {
      const label = event.type.startsWith('HOT_SEAT') ? 'Hot Seat' : event.type.startsWith('SPLIT_DECISION') ? 'Split Decision' : 'Double Dare';
      text = event.type.endsWith('REVEALED') ? `${label} revealed` : event.type.endsWith('ANSWERED') ? `${actor} locked a ${label} answer` : event.type.endsWith('SENT') ? `${actor} sent a ${label}` : `${label} opened`;
    }
  }
  const committedVoice = voice && (!voice.status || voice.status === 'COMMITTED')
    && id(voice.friendshipId) === id(friendship._id)
    && [id(friendship.user1), id(friendship.user2)].includes(id(voice.senderId));
  const reveal = event.type.endsWith('_REVEALED') && moment?.status === 'RESOLVED'
    && id(moment.friendshipId) === id(friendship._id);
  return {
    id: id(event._id), type: event.type, mine, actorName: actor, text,
    xp: Number(event.xp) || 0, createdAt: event.createdAt,
    kind: event.type === 'MESSAGE' ? (meta.kind === 'VOICE' ? 'VOICE' : 'TEXT') : null,
    checkin: event.type === 'MESSAGE' && meta.checkin?.status ? {
      status: meta.checkin.status,
      xp: Number(meta.checkin.xp) || 0,
      reason: String(meta.checkin.reason || '')
    } : null,
    voice: committedVoice ? {
      id: id(voice._id), audioUrl: `/api/voice-notes/${id(voice._id)}/audio`,
      duration: Number(voice.duration) || 0, listened: Boolean(voice.listened),
      isRecipient: id(voice.recipientId) === id(viewerId)
    } : null,
    // Older voice check-ins did not store a note reference; expose that absence honestly.
    voiceUnavailable: (event.type === 'VOICE_CHECKIN' || meta.kind === 'VOICE') && !committedVoice,
    moment: reveal ? {
      type: moment.type, prompt: moment.promptText,
      answers: (moment.responses || []).map((response) => ({ name: actorName(response.userId, friendship, viewerId), value: response.value }))
    } : null
  };
};

const enrichEvents = async (events, friendship, viewerId) => {
  const voiceIds = events.map((event) => event.metadata?.voiceNoteId).filter((value) => mongoose.isValidObjectId(value));
  const momentIds = events.filter((event) => event.type.endsWith('_REVEALED')).map((event) => event.metadata?.momentId).filter((value) => mongoose.isValidObjectId(value));
  const [voices, moments] = await Promise.all([
    voiceIds.length ? VoiceNote.find({ _id: { $in: voiceIds }, friendshipId: friendship._id, $or: [{ status: 'COMMITTED' }, { status: { $exists: false } }] }).select('_id friendshipId senderId recipientId duration listened status').lean() : [],
    momentIds.length ? ContractMoment.find({ _id: { $in: momentIds }, friendshipId: friendship._id, status: 'RESOLVED' }).select('friendshipId type status promptText responses').lean() : []
  ]);
  const voiceById = new Map(voices.map((voice) => [id(voice._id), voice]));
  const momentById = new Map(moments.map((moment) => [id(moment._id), moment]));
  return events.map((event) => timelineView(event, friendship, viewerId, voiceById.get(id(event.metadata?.voiceNoteId)), momentById.get(id(event.metadata?.momentId)))).filter(Boolean);
};

const checkinState = async (friendship, viewerId, source = 'TEXT') => {
  if (friendship.season?.status === 'COMPLETE') return { eligible: false, reason: 'Season complete. You can still talk here.' };
  if (!eligibleForCheckin(friendship, viewerId)) return { eligible: false, reason: 'Checked in. Keep the conversation going.' };
  if (await getBountyDecisionRequirement(friendship._id, viewerId)) return { eligible: false, needsAction: true, reason: 'Choose hunter credit or escape in Check in.' };
  const chaos = friendship.chaos?.activeEvent;
  if (id(chaos?.targetUserId) === id(viewerId) && chaos?.payload?.requiredSource && chaos.payload.requiredSource !== source) {
    return { eligible: false, needsVoice: true, reason: `${chaos.name} needs a voice check-in.` };
  }
  return { eligible: true, reason: 'Your next message also checks you in.' };
};

const loadTimeline = async (friendship, viewerId, { before, focus } = {}) => {
  const visibility = { $or: [{ type: { $ne: 'MESSAGE' } }, { userId: viewerId }, { 'metadata.notified': true }] };
  const filter = { friendshipId: friendship._id, type: { $in: TIMELINE_TYPES }, $and: [visibility] };
  if (before) {
    if (!mongoose.isValidObjectId(before)) fail(400, 'Invalid history cursor');
    const cursor = await ContractEvent.findOne({ _id: before, friendshipId: friendship._id, type: { $in: TIMELINE_TYPES } }).select('createdAt').lean();
    if (!cursor) fail(400, 'History cursor is no longer available');
    filter.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: before } }];
  }
  const events = await ContractEvent.find(filter).sort({ createdAt: -1, _id: -1 }).limit(PAGE_SIZE + 1).lean();
  const hasMore = events.length > PAGE_SIZE;
  const page = events.slice(0, PAGE_SIZE);
  let focused = null;
  if (focus) {
    if (!mongoose.isValidObjectId(focus)) fail(400, 'Invalid activity target');
    focused = await ContractEvent.findOne({ _id: focus, friendshipId: friendship._id, type: { $in: TIMELINE_TYPES }, $and: [visibility] }).lean();
  }
  const [items, focusItems, state] = await Promise.all([
    enrichEvents(page.slice().reverse(), friendship, viewerId),
    focused ? enrichEvents([focused], friendship, viewerId) : [],
    checkinState(friendship, viewerId)
  ]);
  return { items, hasMore, nextCursor: hasMore ? id(page[page.length - 1]._id) : null, focusItem: focusItems[0] || null, checkin: state };
};

const normalizeMessage = (body) => {
  const clientId = String(body.clientId || '');
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(clientId)) fail(400, 'A message retry key is required');
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const voiceNoteId = body.voiceNoteId ? String(body.voiceNoteId) : null;
  if (voiceNoteId && !mongoose.isValidObjectId(voiceNoteId)) fail(400, 'Invalid voice note');
  if (voiceNoteId && text) fail(400, 'Send text and voice as separate messages');
  if (!text && !voiceNoteId) fail(400, 'Write a message or record a voice note');
  if (text.length > MESSAGE_MAX_LENGTH) fail(400, `Keep messages under ${MESSAGE_MAX_LENGTH} characters`);
  return { clientId, text, voiceNoteId, kind: voiceNoteId ? 'VOICE' : 'TEXT' };
};

const sendMessage = async (friendship, viewerId, body) => {
  const input = normalizeMessage(body);
  const query = { friendshipId: friendship._id, userId: viewerId, type: 'MESSAGE', 'metadata.clientId': input.clientId };
  let event = await ContractEvent.findOne(query);
  let isNew = false;
  if (!event) {
    let voice = null;
    if (input.voiceNoteId) {
      voice = await VoiceNote.findOne({ _id: input.voiceNoteId, friendshipId: friendship._id, senderId: viewerId, status: 'PENDING', expiresAt: { $gt: new Date() } });
      if (!voice) fail(409, 'Record a fresh voice message before sending');
    }
    try {
      event = await ContractEvent.create({ friendshipId: friendship._id, userId: viewerId, type: 'MESSAGE', metadata: {
        clientId: input.clientId, kind: input.kind, text: input.text || null,
        voiceNoteId: input.voiceNoteId || null, checkin: { status: 'PENDING' }
      } });
      isNew = true;
    } catch (error) {
      if (error.code !== 11000) throw error;
      event = await ContractEvent.findOne(query);
      if (!event) fail(409, 'This voice note is already in your conversation');
    }
  }
  if (isNew) {
    if (input.voiceNoteId) {
      const voice = await VoiceNote.findOneAndUpdate({ _id: input.voiceNoteId, friendshipId: friendship._id, senderId: viewerId, status: 'PENDING' }, { $set: { status: 'COMMITTED', expiresAt: null } }, { returnDocument: 'after' });
      if (!voice) {
        await ContractEvent.deleteOne({ _id: event._id });
        fail(409, 'Voice message expired. Record it again.');
      }
    }
    let outcome = { status: 'SOCIAL_ONLY' };
    const source = input.kind === 'VOICE' ? 'VOICE' : 'TEXT';
    try {
      const state = await checkinState(friendship, viewerId, source);
      if (state.eligible) {
        const result = await performContractCheckin(friendship._id, viewerId, { source, voiceNoteId: input.voiceNoteId, messageEventId: event._id });
        outcome = { status: 'CHECKED_IN', xp: Number(result.game?.xp) || 0 };
      } else if (state.needsAction || state.needsVoice) outcome = { status: 'NEEDS_ACTION', reason: state.reason };
    } catch (error) {
      // Delivery survives a check-in conflict. Progression keeps the existing server rules.
      outcome = error.message === 'You already checked in today' ? { status: 'SOCIAL_ONLY' } : { status: 'NEEDS_ACTION', reason: Number(error.status) >= 400 && Number(error.status) < 500 ? error.message : 'Message sent. Check-in could not complete; use Check in to retry.' };
      if (!error.status) console.error('Message check-in failed:', error.message);
    }
    await ContractEvent.updateOne({ _id: event._id }, { $set: { 'metadata.checkin': outcome } });
    event.metadata = { ...event.metadata, checkin: outcome };
  }
  const recipientId = id(friendship.user1) === id(viewerId) ? friendship.user2 : friendship.user1;
  const sender = actorName(viewerId, friendship, recipientId);
  if (!event.metadata.notified) {
    // Keep one unread notification per conversation, pointing at the latest message.
    try {
      await Notification.updateOne({
        toUserId: recipientId, friendshipId: friendship._id, type: 'CONTRACT_MESSAGE', read: false,
        createdAt: { $lte: event.createdAt }
      }, { $set: {
        fromUserId: viewerId, contractEventId: event._id, title: 'Message from your friend',
        message: `${sender}: ${event.metadata.kind === 'VOICE' ? 'Voice message' : String(event.metadata.text || '').slice(0, 120)}`,
        createdAt: event.createdAt
      } }, { upsert: true });
    } catch (error) {
      // A newer unread message (or a concurrent retry) already owns the notification.
      if (error.code !== 11000) throw error;
    }
    await ContractEvent.updateOne({ _id: event._id }, { $set: { 'metadata.notified': true } });
  }
  const items = await enrichEvents([event.toObject()], friendship, viewerId);
  return { success: true, item: items[0], duplicate: !isNew };
};
module.exports = { loadTimeline, sendMessage, timelineView, normalizeMessage, TIMELINE_TYPES, checkinState };
