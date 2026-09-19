const toPlain = (value) => {
  if (!value) return {};
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
};


const participantView = (value) => {
  if (!value) return null;
  const data = toPlain(value);
  const id = data?._id || value;
  return {
    _id: id,
    displayName: data?.displayName,
    username: data?.username || null,
    avatar: data?.avatar || null
  };
};

const perspectiveView = (value) => {
  const data = toPlain(value);
  return {
    baseDebt: Number(data.baseDebt) || 0,
    limit: Number(data.limit) || 7,
    lastInteraction: data.lastInteraction || null,
    recoveryRequired: Boolean(data.recoveryRequired)
  };
};

const seasonView = (value) => {
  const data = toPlain(value);
  return {
    number: Number(data.number) || 1,
    status: data.status || 'PENDING',
    startedAt: data.startedAt || null,
    endsAt: data.endsAt || null
  };
};

const chaosView = (value) => {
  const data = toPlain(value);
  const active = data.activeEvent ? toPlain(data.activeEvent) : null;
  return {
    level: Number(data.level) || 0,
    nextEventAt: data.nextEventAt || null,
    activeEvent: active ? {
      name: active.name,
      description: active.description,
      targetUserId: active.targetUserId || null,
      expiresAt: active.expiresAt || null
    } : null,
    wantedUntil: data.wantedUntil || null,
    lastConsequence: data.lastConsequence || null
  };
};

const contractView = (value) => {
  const data = toPlain(value);
  return {
    _id: data._id,
    user1: participantView(data.user1),
    user2: participantView(data.user2),
    user1DisplayName: data.user1DisplayName,
    user2DisplayName: data.user2DisplayName,
    status: data.status,
    templateId: data.templateId,
    duoXP: Number(data.duoXP) || 0,
    duoLevel: Number(data.duoLevel) || 1,
    duoTitle: data.duoTitle || 'New Contract',
    season: seasonView(data.season),
    chaos: chaosView(data.chaos),
    user1Perspective: perspectiveView(data.user1Perspective),
    user2Perspective: perspectiveView(data.user2Perspective)
  };
};

const recapView = (value) => {
  const data = toPlain(value);
  const template = toPlain(data.template);
  const duo = toPlain(data.duo);
  const weekly = toPlain(data.weekly);
  const season = toPlain(data.season);
  const chaos = data.chaos ? toPlain(data.chaos) : null;

  return {
    template: {
      id: template.id,
      name: template.name,
      limit: Number(template.limit) || 0,
      seasonDays: Number(template.seasonDays) || 0,
      chaos: Boolean(template.chaos)
    },
    duo: {
      xp: Number(duo.xp) || 0,
      level: Number(duo.level) || 1,
      title: duo.title || 'New Contract',
      progress: Number(duo.progress) || 0
    },
    weekly: {
      checkins: Number(weekly.checkins) || 0,
      voiceNotes: Number(weekly.voiceNotes) || 0,
      chaosSurvived: Number(weekly.chaosSurvived) || 0,
      chaosFailed: Number(weekly.chaosFailed) || 0,
      xpGained: Number(weekly.xpGained) || 0,
      line: weekly.line
    },
    season: {
      checkins: Number(season.checkins) || 0,
      voiceNotes: Number(season.voiceNotes) || 0,
      chaosSurvived: Number(season.chaosSurvived) || 0,
      chaosFailed: Number(season.chaosFailed) || 0,
      bankruptcies: Number(season.bankruptcies) || 0,
      xpGained: Number(season.xpGained) || 0,
      number: Number(season.number) || 1,
      status: season.status || 'PENDING'
    },
    chaos: chaos ? {
      level: Number(chaos.level) || 0,
      activeEvent: chaos.activeEvent ? { name: chaos.activeEvent.name } : null,
      lastConsequence: chaos.lastConsequence || null
    } : null,
    players: Array.isArray(data.players)
      ? data.players.map((player) => ({
          displayName: player?.displayName,
          username: player?.username || null
        }))
      : []
  };
};

const notificationView = (value) => {
  const data = toPlain(value);
  return {
    _id: data._id,
    type: data.type,
    title: data.title,
    message: data.message,
    read: Boolean(data.read),
    createdAt: data.createdAt
  };
};

const voiceNoteInboxView = (value) => {
  const data = toPlain(value);
  return {
    _id: data._id,
    senderName: data.senderName,
    filePath: data.filePath,
    duration: Number(data.duration) || 0,
    listened: Boolean(data.listened),
    listenedAt: data.listenedAt || null,
    createdAt: data.createdAt
  };
};

const bountyArenaView = (value, viewerId) => {
  const data = toPlain(value);
  const viewer = String(viewerId || '');
  let viewerRole = 'VIEWER';

  if (String(data.targetId || '') === viewer) viewerRole = 'TARGET';
  else if (String(data.senderId || '') === viewer) viewerRole = 'SENDER';
  else if (String(data.hunterId || '') === viewer) viewerRole = 'HUNTER';

  const view = {
    _id: data._id,
    targetName: data.targetName,
    amount: Number(data.amount) || 0,
    message: data.message || '',
    status: data.status,
    hunterName: data.hunterName || null,
    huntExpiresAt: data.huntExpiresAt || null,
    viewerRole
  };

  if (viewerRole === 'HUNTER') view.hunterBond = Number(data.hunterBond) || 0;
  return view;
};

const publicGrudgeView = (friendship) => {
  const data = toPlain(friendship);
  const grudge = data.grudge || {};
  return {
    claimantName: grudge.claimantName,
    victimName: grudge.victimName,
    createdAt: grudge.createdAt,
    expiresAt: grudge.expiresAt,
    originalClaimAmount: Number(grudge.originalClaimAmount) || 0
  };
};

const auraTransactionView = (value) => {
  const data = toPlain(value);
  return {
    _id: data._id,
    amount: Number(data.amount) || 0,
    description: data.description,
    createdAt: data.createdAt
  };
};

module.exports = {
  contractView,
  recapView,
  notificationView,
  voiceNoteInboxView,
  bountyArenaView,
  publicGrudgeView,
  auraTransactionView
};
