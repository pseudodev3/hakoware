const Friendship = require('../models/Friendship');
const PendingInvite = require('../models/PendingInvite');
const {
  getTemplate,
  duoStateFromXP,
  refreshGameState,
  recordEvent
} = require('./contractGame');
const { contractView } = require('./clientViews');

const DAY = 24 * 60 * 60 * 1000;

const ensureActiveGameState = async (friendship) => {
  if (!friendship || friendship.status !== 'ACTIVE') return friendship;

  const template = getTemplate(friendship.templateId || 'DONT_GHOST');
  let changed = false;

  if (!friendship.templateId) {
    friendship.templateId = template.id;
    changed = true;
  }

  if (!friendship.season?.startedAt) {
    const now = new Date();
    friendship.season = {
      number: friendship.season?.number || 1,
      status: 'ACTIVE',
      lengthDays: friendship.season?.lengthDays || template.seasonDays,
      startedAt: now,
      endsAt: new Date(now.getTime() + (friendship.season?.lengthDays || template.seasonDays) * DAY)
    };
    changed = true;
  }

  const duo = duoStateFromXP(friendship.duoXP || 0);
  if (friendship.duoLevel !== duo.level || friendship.duoTitle !== duo.title) {
    friendship.duoLevel = duo.level;
    friendship.duoTitle = duo.title;
    changed = true;
  }

  if (changed) {
    await friendship.save();
    await recordEvent(friendship._id, 'SEASON_STARTED', {
      metadata: {
        season: friendship.season.number,
        templateId: friendship.templateId,
        migrated: true
      }
    }).catch(() => null);
  }

  return refreshGameState(friendship);
};

const loadContractsForUser = async (userId) => {
  const [friendships, pendingExternal] = await Promise.all([
    Friendship.find({ $or: [{ user1: userId }, { user2: userId }] }).sort({ updatedAt: -1 }),
    PendingInvite.find({ inviterId: userId, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .lean()
  ]);

  await Promise.all(
    friendships
      .filter((friendship) => friendship.status === 'ACTIVE')
      .map(ensureActiveGameState)
  );

  await Promise.all(
    friendships.map((friendship) => (
      friendship.populate('user1 user2', 'displayName username avatar')
    ))
  );

  const userIdString = String(userId);
  const active = friendships
    .filter((friendship) => friendship.status === 'ACTIVE')
    .map(contractView);
  const pendingReceived = friendships
    .filter(
      (friendship) => friendship.status === 'PENDING' && String(friendship.user2?._id || friendship.user2) === userIdString
    )
    .map(contractView);
  const pendingSent = friendships
    .filter(
      (friendship) => friendship.status === 'PENDING' && String(friendship.user1?._id || friendship.user1) === userIdString
    )
    .map(contractView);

  return {
    active,
    pendingReceived,
    pendingSent,
    pendingExternal: pendingExternal.map((invite) => ({
      id: invite._id,
      recipientEmail: invite.recipientEmail,
      templateId: invite.templateId || 'DONT_GHOST',
      limit: invite.limit,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt
    }))
  };
};

module.exports = {
  ensureActiveGameState,
  loadContractsForUser
};
