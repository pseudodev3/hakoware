const ContractEvent = require('../models/ContractEvent');
const ContractReaction = require('../models/ContractReaction');
const { getMomentViews } = require('./contractMoments');

const HOUR = 60 * 60 * 1000;
const POKE_COOLDOWN_MS = 4 * HOUR;
const MUTUAL_POKE_WINDOW_MS = 2 * HOUR;
const MUTUAL_MENACE_MS = 3 * HOUR;
const REACTION_WINDOW_MS = 36 * HOUR;
const REPLY_MAX_LENGTH = 40;
const MAX_PULSE_AGE_MS = 48 * HOUR;
const REACTIONS = Object.freeze(['💀', '🤝', '👀', '😭']);
const SOCIAL_EVENT_TYPES = new Set([
  'CHECKIN',
  'VOICE_CHECKIN',
  'POKE',
  'CHECKIN_REACTION',
  'CHECKIN_REPLY',
  'MUTUAL_POKE',
  'HOT_SEAT_BREWING',
  'HOT_SEAT_OPENED',
  'HOT_SEAT_ANSWERED',
  'HOT_SEAT_REVEALED',
  'CHAOS_TRIGGERED',
  'CHAOS_SURVIVED',
  'CHAOS_FAILED',
  'BANKRUPTCY',
  'BANKRUPTCY_RECOVERY_STARTED',
  'BANKRUPTCY_RECOVERED',
  'DUO_LEVEL_UP',
  'SEASON_COMPLETED'
]);

const idString = (value) => String(value?._id || value || '');

const partnerNameFor = (friendship, viewerId) => (
  idString(friendship.user1) === idString(viewerId)
    ? friendship.user2DisplayName || 'your partner'
    : friendship.user1DisplayName || 'your partner'
);

const actorNameFor = (event, friendship) => {
  if (event.userId?.displayName) return event.userId.displayName;
  const actorId = idString(event.userId);
  if (actorId && actorId === idString(friendship.user1)) return friendship.user1DisplayName || 'Your partner';
  if (actorId && actorId === idString(friendship.user2)) return friendship.user2DisplayName || 'Your partner';
  return 'Hakoware';
};

const formatPulseEvent = (event, friendship, viewerId) => {
  if (!friendship || !SOCIAL_EVENT_TYPES.has(event.type)) return null;
  const actorId = idString(event.userId);
  const viewer = idString(viewerId);
  if (['CHECKIN', 'VOICE_CHECKIN', 'POKE', 'CHECKIN_REACTION', 'CHECKIN_REPLY', 'HOT_SEAT_ANSWERED'].includes(event.type) && actorId === viewer) return null;

  const actor = actorNameFor(event, friendship);
  const partner = partnerNameFor(friendship, viewerId);
  const metadata = event.metadata || {};
  let text = null;
  let tone = 'neutral';

  switch (event.type) {
    case 'CHECKIN':
    case 'VOICE_CHECKIN': {
      const vibe = metadata.checkinStatus
        ? ` · ${String(metadata.checkinStatus).toLowerCase().replace('_', ' ')}`
        : '';
      const note = metadata.note ? ` · “${metadata.note}”` : '';
      text = event.type === 'VOICE_CHECKIN'
        ? `${actor} sent a voice check-in${vibe}${note}.`
        : `${actor} checked in${vibe}${note}.`;
      tone = 'good';
      break;
    }
    case 'POKE':
      text = `${actor} poked you.`;
      tone = 'gold';
      break;
    case 'MUTUAL_POKE':
      text = `You and ${partner} hit Mutual Menace.`;
      tone = 'gold';
      break;
    case 'HOT_SEAT_BREWING':
      text = `Hot Seat started brewing with ${partner}.`;
      tone = 'gold';
      break;
    case 'HOT_SEAT_OPENED':
      text = `Hot Seat is open with ${partner}.`;
      tone = 'gold';
      break;
    case 'HOT_SEAT_ANSWERED':
      text = `${actor} answered Hot Seat. Your turn.`;
      tone = 'gold';
      break;
    case 'HOT_SEAT_REVEALED':
      text = `Hot Seat revealed with ${partner}.`;
      tone = 'good';
      break;
    case 'CHECKIN_REACTION':
      text = `${actor} reacted ${metadata.reaction || '👀'} to a check-in.`;
      tone = 'gold';
      break;
    case 'CHECKIN_REPLY':
      text = `${actor} replied “${metadata.text || ''}”`;
      tone = 'gold';
      break;
    case 'CHAOS_TRIGGERED':
      text = `${metadata.name || 'An anomaly'} went live with ${partner}.`;
      tone = 'danger';
      break;
    case 'CHAOS_SURVIVED':
      text = `${actor} survived ${metadata.name || 'an anomaly'}.`;
      tone = 'good';
      break;
    case 'CHAOS_FAILED':
      text = `${actor} lost to Chaos · ${metadata.consequence || 'Wanted'}.`;
      tone = 'danger';
      break;
    case 'BANKRUPTCY':
      text = `${actor} went bankrupt.`;
      tone = 'danger';
      break;
    case 'BANKRUPTCY_RECOVERY_STARTED':
      text = `${actor} started bankruptcy recovery.`;
      tone = 'gold';
      break;
    case 'BANKRUPTCY_RECOVERED':
      text = `${actor} is stable again.`;
      tone = 'good';
      break;
    case 'DUO_LEVEL_UP':
      text = `Your duo with ${partner} reached Lv. ${Number(metadata.level) || '?'}.`;
      tone = 'good';
      break;
    case 'SEASON_COMPLETED':
      text = `Your season with ${partner} wrapped.`;
      tone = 'neutral';
      break;
    default:
      return null;
  }

  return {
    id: idString(event._id),
    type: event.type,
    friendshipId: idString(event.friendshipId),
    text,
    tone,
    createdAt: event.createdAt
  };
};

const boundedSince = (value, now = Date.now()) => {
  const parsed = new Date(value || now - 24 * HOUR).getTime();
  const oldest = now - MAX_PULSE_AGE_MS;
  if (!Number.isFinite(parsed)) return new Date(now - 24 * HOUR);
  return new Date(Math.max(oldest, Math.min(now, parsed)));
};

const findLatestPartnerCheckin = async (friendship, userId) => {
  const partnerId = idString(friendship.user1) === idString(userId) ? friendship.user2 : friendship.user1;
  const cutoff = new Date(Date.now() - REACTION_WINDOW_MS);
  const seasonStart = friendship.season?.startedAt ? new Date(friendship.season.startedAt) : cutoff;
  const earliest = seasonStart > cutoff ? seasonStart : cutoff;
  return ContractEvent.findOne({
    friendshipId: friendship._id,
    userId: partnerId,
    type: { $in: ['CHECKIN', 'VOICE_CHECKIN'] },
    createdAt: { $gte: earliest }
  }).sort({ createdAt: -1 }).lean();
};

const latestOwnPoke = async (friendshipId, userId) => ContractEvent.findOne({
  friendshipId,
  userId,
  type: 'POKE'
}).sort({ createdAt: -1 }).lean();

const findReplyForCheckin = async (friendshipId, checkinEventId, userId) => ContractEvent.findOne({
  friendshipId,
  userId,
  type: 'CHECKIN_REPLY',
  'metadata.checkinEventId': String(checkinEventId)
}).sort({ createdAt: -1 }).lean();

const findRecentPartnerPoke = async (friendship, userId, now = new Date()) => {
  const partnerId = idString(friendship.user1) === idString(userId) ? friendship.user2 : friendship.user1;
  return ContractEvent.findOne({
    friendshipId: friendship._id,
    userId: partnerId,
    type: 'POKE',
    createdAt: { $gte: new Date(now.getTime() - MUTUAL_POKE_WINDOW_MS) }
  }).sort({ createdAt: -1 }).lean();
};

const findRecentMutualPoke = async (friendshipId, since) => ContractEvent.findOne({
  friendshipId,
  type: 'MUTUAL_POKE',
  createdAt: { $gte: since }
}).sort({ createdAt: -1 }).lean();

const buildSocialPresence = async (userId, friendships, sinceValue) => {
  const active = friendships.filter((item) => item.status === 'ACTIVE');
  if (!active.length) return { pulse: [], contracts: {} };

  const ids = active.map((item) => item._id);
  const since = boundedSince(sinceValue);
  const momentViews = await getMomentViews(userId, active);
  const stateCutoff = new Date(Date.now() - Math.max(REACTION_WINDOW_MS, POKE_COOLDOWN_MS));
  const events = await ContractEvent.find({
    friendshipId: { $in: ids },
    createdAt: { $gte: new Date(Math.min(since.getTime(), stateCutoff.getTime())) }
  })
    .sort({ createdAt: -1 })
    .populate('userId', 'displayName username')
    .lean();

  const friendshipById = new Map(active.map((item) => [idString(item._id), item]));
  const contractState = Object.fromEntries(active.map((item) => [idString(item._id), {
    latestPartnerCheckin: null,
    reaction: null,
    reply: null,
    canPoke: true,
    pokeAvailableAt: null,
    lastOwnPokeAt: null,
    lastPokeFromPartnerAt: null,
    pokeBackAvailable: false,
    mutualMenace: null,
    moment: null
  }]));

  const partnerCheckinIds = [];
  for (const event of events) {
    const friendshipId = idString(event.friendshipId);
    const friendship = friendshipById.get(friendshipId);
    const state = contractState[friendshipId];
    if (!friendship || !state) continue;

    const actorId = idString(event.userId);
    const isViewer = actorId === idString(userId);
    const seasonStart = friendship.season?.startedAt ? new Date(friendship.season.startedAt) : null;
    const isCurrentSeasonEvent = !seasonStart || new Date(event.createdAt) >= seasonStart;
    if (!state.latestPartnerCheckin && !isViewer && isCurrentSeasonEvent && ['CHECKIN', 'VOICE_CHECKIN'].includes(event.type)) {
      state.latestPartnerCheckin = {
        eventId: idString(event._id),
        createdAt: event.createdAt,
        source: event.type === 'VOICE_CHECKIN' ? 'VOICE' : 'TEXT',
        checkinStatus: event.metadata?.checkinStatus || null,
        note: event.metadata?.note || null
      };
      partnerCheckinIds.push(event._id);
    }

    if (event.type === 'POKE') {
      if (isViewer && !state.lastOwnPokeAt) {
        state.lastOwnPokeAt = event.createdAt;
        const nextAt = new Date(new Date(event.createdAt).getTime() + POKE_COOLDOWN_MS);
        state.canPoke = nextAt <= new Date();
        state.pokeAvailableAt = state.canPoke ? null : nextAt;
      } else if (!isViewer && !state.lastPokeFromPartnerAt) {
        state.lastPokeFromPartnerAt = event.createdAt;
      }
    }

    if (event.type === 'MUTUAL_POKE' && !state.mutualMenace) {
      const expiresAt = new Date(event.metadata?.expiresAt || 0);
      if (expiresAt > new Date()) {
        state.mutualMenace = {
          startedAt: event.createdAt,
          expiresAt
        };
      }
    }
  }

  if (partnerCheckinIds.length) {
    const reactions = await ContractReaction.find({
      checkinEventId: { $in: partnerCheckinIds },
      fromUserId: userId
    }).lean();
    const reactionByEvent = new Map(reactions.map((item) => [idString(item.checkinEventId), item.reaction]));
    Object.values(contractState).forEach((state) => {
      if (state.latestPartnerCheckin) {
        state.reaction = reactionByEvent.get(state.latestPartnerCheckin.eventId) || null;
      }
    });
  }

  Object.values(contractState).forEach((state) => {
    if (!state.lastPokeFromPartnerAt || state.mutualMenace) return;
    const partnerPokeAt = new Date(state.lastPokeFromPartnerAt);
    const ownPokeAt = state.lastOwnPokeAt ? new Date(state.lastOwnPokeAt) : null;
    state.pokeBackAvailable = partnerPokeAt >= new Date(Date.now() - MUTUAL_POKE_WINDOW_MS)
      && (!ownPokeAt || ownPokeAt < partnerPokeAt)
      && state.canPoke;
  });

  Object.entries(momentViews).forEach(([friendshipId, moment]) => {
    if (contractState[friendshipId]) contractState[friendshipId].moment = moment;
  });

  const ownReplies = events.filter((event) => (
    event.type === 'CHECKIN_REPLY' && idString(event.userId) === idString(userId)
  ));
  Object.values(contractState).forEach((state) => {
    const eventId = state.latestPartnerCheckin?.eventId;
    if (!eventId) return;
    const reply = ownReplies.find((item) => String(item.metadata?.checkinEventId || '') === eventId);
    if (reply) {
      state.reply = {
        text: reply.metadata?.text || '',
        createdAt: reply.createdAt
      };
    }
  });

  const pulse = events
    .filter((event) => new Date(event.createdAt) >= since)
    .map((event) => formatPulseEvent(event, friendshipById.get(idString(event.friendshipId)), userId))
    .filter(Boolean)
    .slice(0, 6);

  return { pulse, contracts: contractState };
};

module.exports = {
  POKE_COOLDOWN_MS,
  MUTUAL_POKE_WINDOW_MS,
  MUTUAL_MENACE_MS,
  REACTIONS,
  REPLY_MAX_LENGTH,
  buildSocialPresence,
  findLatestPartnerCheckin,
  latestOwnPoke,
  findReplyForCheckin,
  findRecentPartnerPoke,
  findRecentMutualPoke
};
