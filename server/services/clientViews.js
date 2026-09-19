const toPlain = (value) => {
  if (!value) return {};
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
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
  notificationView,
  voiceNoteInboxView,
  bountyArenaView,
  publicGrudgeView,
  auraTransactionView
};
