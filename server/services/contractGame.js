const ContractEvent = require('../models/ContractEvent');
const Friendship = require('../models/Friendship');
const Notification = require('../models/Notification');
const User = require('../models/User');
const AuraTransaction = require('../models/AuraTransaction');
const { syncDebtState } = require('./debtState');

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const TEMPLATES = Object.freeze({
  DONT_GHOST: {
    id: 'DONT_GHOST', name: "Don't Ghost Me", tagline: 'The classic.',
    description: 'Check in before three days of silence turns into debt.', limit: 3, seasonDays: 30, difficulty: 2
  },
  GYM_PACT: {
    id: 'GYM_PACT', name: 'Gym Pact', tagline: 'No disappearing after leg day.',
    description: 'A tighter two-day window for training partners who need pressure.', limit: 2, seasonDays: 30, difficulty: 3
  },
  STUDY_ARC: {
    id: 'STUDY_ARC', name: 'Study Arc', tagline: 'Lock in together.',
    description: 'Daily-ish pressure for study partners and exam season.', limit: 1, seasonDays: 30, difficulty: 4
  },
  LOCK_IN: {
    id: 'LOCK_IN', name: '30-Day Lock-In', tagline: 'No excuses for a month.',
    description: 'A one-day grace period and a fixed 30-day season.', limit: 1, seasonDays: 30, difficulty: 5
  },
  LONG_DISTANCE: {
    id: 'LONG_DISTANCE', name: 'Long Distance', tagline: 'Stay present from far away.',
    description: 'A four-day window with bonus Duo XP for voice check-ins.', limit: 4, seasonDays: 45, difficulty: 2
  },
  BUILD_IN_PUBLIC: {
    id: 'BUILD_IN_PUBLIC', name: 'Build in Public', tagline: 'Ship something. Say something.',
    description: 'Daily check-ins for builders keeping each other moving.', limit: 1, seasonDays: 30, difficulty: 4
  },
  CHAOS: {
    id: 'CHAOS', name: 'Chaos Contract', tagline: 'The rules will not stay still.',
    description: 'Surprise anomalies temporarily rewrite the contract. Survive them for extra XP and Aura.', limit: 3, seasonDays: 30, difficulty: 5, chaos: true
  },
  CUSTOM: {
    id: 'CUSTOM', name: 'Custom', tagline: 'Make your own problem.',
    description: 'Choose the grace period yourself. Everything else still runs on seasons and Duo XP.', limit: 7, seasonDays: 30, difficulty: 0
  }
});

const CHAOS_EVENTS = [
  {
    type: 'VOICE_TAX', minLevel: 1, name: 'Voice Tax',
    description: 'Your next check-in only counts if it is a voice check-in.',
    durationHours: 24, successXP: 25, requiredSource: 'VOICE', failureTitle: 'Silent Treatment'
  },
  {
    type: 'DOUBLE_TROUBLE', minLevel: 1, name: 'Double Trouble',
    description: 'The targeted check-in gets 2× Duo XP +10. Beat the clock.',
    durationHours: 18, xpMultiplier: 2, successXP: 10, failureTitle: 'Caught Sleeping'
  },
  {
    type: 'AURA_SURGE', minLevel: 2, name: 'Aura Surge',
    description: 'The next successful check-in pays a 25 Aura anomaly bonus.',
    durationHours: 20, auraBonus: 25, successXP: 15, failureTitle: 'Missed the Bag'
  },
  {
    type: 'WILDCARD', minLevel: 2, name: 'Wildcard',
    description: 'No special rule. Just beat the timer for a large Duo XP bonus.',
    durationHours: 14, successXP: 40, failureTitle: 'Wildcard Victim'
  },
  {
    type: 'SILENCE_TAX', minLevel: 3, name: 'Silence Is Expensive',
    description: 'Miss this window and two debt is added instantly. Clear it for bonus XP.',
    durationHours: 14, successXP: 35, failureDebt: 2, failureTitle: 'Communication Criminal'
  },
  {
    type: 'SUDDEN_DEATH', minLevel: 4, name: 'Sudden Death',
    description: 'Twelve hours. One check-in. No extensions.',
    durationHours: 12, successXP: 55, failureDebt: 2, failureTitle: 'Sudden Death Casualty'
  }
];

const WORLD_EVENTS = [
  { id: 'DUO_RUSH', name: 'Duo Rush', description: 'All Duo XP is boosted by 25% this week.', xpMultiplier: 1.25 },
  { id: 'OPEN_MIC', name: 'Open Mic', description: 'Voice check-ins earn +10 Duo XP this week.', voiceBonus: 10 },
  { id: 'CLEAN_SWEEP', name: 'Clean Sweep', description: 'Every successful check-in earns +5 Duo XP this week.', flatXp: 5 },
  { id: 'ANOMALY_SEASON', name: 'Anomaly Season', description: 'Chaos Contracts trigger anomalies faster this week.', chaosCooldownMultiplier: 0.68 }
];

const MONTH_THEMES = [
  'Fresh Start', 'Duo Month', 'Pressure Test', 'No Excuses', 'Momentum', 'Heat Check',
  'Survival Arc', 'Overtime', 'Hunter Season', 'Night Shift', 'Last Stretch', 'Final Boss'
];

const idString = (value) => String(value?._id || value || '');

const getTemplate = (id) => TEMPLATES[String(id || '').toUpperCase()] || TEMPLATES.DONT_GHOST;

const duoStateFromXP = (xp = 0) => {
  const safeXP = Math.max(0, Number(xp) || 0);
  const level = Math.max(1, Math.floor(Math.sqrt(safeXP / 50)) + 1);
  const floorXP = 50 * Math.pow(level - 1, 2);
  const nextXP = 50 * Math.pow(level, 2);
  const progress = nextXP === floorXP ? 100 : Math.round(((safeXP - floorXP) / (nextXP - floorXP)) * 100);
  let title = 'New Contract';
  if (level >= 50) title = 'Legendary Duo';
  else if (level >= 25) title = 'Unbreakable Contract';
  else if (level >= 15) title = 'Habitual Enablers';
  else if (level >= 10) title = 'Certified Menaces';
  else if (level >= 5) title = 'Partners in Crime';
  else if (level >= 3) title = 'Locked In';
  return { xp: safeXP, level, title, progress, nextLevelXP: nextXP };
};

const getWorldEvent = (now = new Date()) => {
  const week = Math.floor(now.getTime() / (7 * DAY));
  const modifier = WORLD_EVENTS[Math.abs(week) % WORLD_EVENTS.length];
  const start = new Date(week * 7 * DAY);
  const end = new Date(start.getTime() + 7 * DAY);
  return {
    ...modifier,
    theme: `${MONTH_THEMES[now.getUTCMonth()]} · ${now.getUTCFullYear()}`,
    startsAt: start,
    endsAt: end
  };
};

const recordEvent = (friendshipId, type, { userId = null, xp = 0, aura = 0, metadata = {} } = {}) => (
  ContractEvent.create({ friendshipId, userId, type, xp, aura, metadata })
);

const syncDuoState = (friendship) => {
  const duo = duoStateFromXP(friendship.duoXP || 0);
  friendship.duoLevel = duo.level;
  friendship.duoTitle = duo.title;
  return duo;
};

const initializeContractGame = (friendship, templateId, customLimit) => {
  const template = getTemplate(templateId);
  const limit = template.id === 'CUSTOM'
    ? Math.max(1, Math.min(30, Number(customLimit) || template.limit))
    : template.limit;

  friendship.templateId = template.id;
  friendship.user1Perspective.limit = limit;
  friendship.user2Perspective.limit = limit;
  friendship.season = {
    number: 1,
    status: 'PENDING',
    lengthDays: template.seasonDays,
    startedAt: null,
    endsAt: null
  };
  friendship.duoXP = friendship.duoXP || 0;
  syncDuoState(friendship);
  friendship.chaos = template.chaos
    ? { level: 1, nextEventAt: null, activeEvent: null, wantedUntil: null, lastConsequence: null }
    : { level: 0, nextEventAt: null, activeEvent: null, wantedUntil: null, lastConsequence: null };
  return { template, limit };
};

const chaosCooldownMs = (level = 1, world = getWorldEvent()) => {
  const min = Math.max(12, 42 - (level * 4));
  const max = Math.max(min + 6, 72 - (level * 6));
  const hours = min + Math.floor(Math.random() * (max - min + 1));
  return hours * HOUR * (world.chaosCooldownMultiplier || 1);
};

const scheduleNextChaos = (friendship, now = new Date()) => {
  if (friendship.templateId !== 'CHAOS') return;
  friendship.chaos.nextEventAt = new Date(now.getTime() + chaosCooldownMs(friendship.chaos.level || 1));
};

const activateSeason = async (friendship, now = new Date()) => {
  const template = getTemplate(friendship.templateId);
  friendship.season = friendship.season || {};
  friendship.season.number = friendship.season.number || 1;
  friendship.season.status = 'ACTIVE';
  friendship.season.lengthDays = friendship.season.lengthDays || template.seasonDays;
  friendship.season.startedAt = now;
  friendship.season.endsAt = new Date(now.getTime() + friendship.season.lengthDays * DAY);
  friendship.user1Perspective.lastInteraction = now;
  friendship.user2Perspective.lastInteraction = now;
  if (friendship.templateId === 'CHAOS') scheduleNextChaos(friendship, now);
  await friendship.save();
  await recordEvent(friendship._id, 'SEASON_STARTED', { metadata: { season: friendship.season.number, templateId: friendship.templateId } });
  return friendship;
};

const notifyBoth = async (friendship, title, message, type = 'GAME_EVENT', fromUserId = null) => {
  const ids = [friendship.user1, friendship.user2].map(idString).filter(Boolean);
  await Promise.all(ids.map((toUserId) => Notification.create({
    toUserId,
    fromUserId,
    type,
    title,
    message,
    friendshipId: friendship._id
  }).catch(() => null)));
};

const participantPerspectiveKey = (friendship, userId) => {
  const id = idString(userId);
  if (idString(friendship.user1) === id) return 'user1Perspective';
  if (idString(friendship.user2) === id) return 'user2Perspective';
  return null;
};

const pickEligibleChaosTarget = (friendship, now = new Date()) => {
  const candidates = [
    { id: idString(friendship.user1), key: 'user1Perspective' },
    { id: idString(friendship.user2), key: 'user2Perspective' }
  ].filter(({ key }) => {
    const last = new Date(friendship[key]?.lastInteraction || 0);
    return (now - last) / HOUR >= 20;
  });
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
};

const buildChaosEvent = (friendship, target, event, now = new Date()) => ({
  eventId: `${event.type}-${now.getTime()}`,
  type: event.type,
  name: event.name,
  description: event.description,
  targetUserId: target.id,
  startedAt: now,
  expiresAt: new Date(now.getTime() + event.durationHours * HOUR),
  payload: {
    requiredSource: event.requiredSource || null,
    xpMultiplier: event.xpMultiplier || 1,
    successXP: event.successXP || 0,
    auraBonus: event.auraBonus || 0,
    failureDebt: event.failureDebt || 0,
    failureTitle: event.failureTitle
  }
});

const syncChaosFromFresh = (friendship, fresh, perspectiveKey = null) => {
  if (!fresh) return;
  friendship.set('chaos', fresh.chaos);
  if (perspectiveKey && fresh[perspectiveKey] && friendship[perspectiveKey]) {
    friendship[perspectiveKey].baseDebt = fresh[perspectiveKey].baseDebt;
  }
};

const reloadChaosState = async (friendship, perspectiveKey = null) => {
  const selection = perspectiveKey
    ? `chaos ${perspectiveKey}.baseDebt`
    : 'chaos';
  const fresh = await Friendship.findById(friendship._id).select(selection);
  syncChaosFromFresh(friendship, fresh, perspectiveKey);
  return fresh;
};

const triggerChaosEvent = async (friendship, now = new Date(), options = {}) => {
  const forcedTargetId = idString(options.targetUserId);
  let target = null;

  if (forcedTargetId) {
    const key = participantPerspectiveKey(friendship, forcedTargetId);
    if (!key) {
      const error = new Error('Chaos target must be a contract participant');
      error.status = 400;
      throw error;
    }
    target = { id: forcedTargetId, key };
  } else {
    target = pickEligibleChaosTarget(friendship, now);
  }

  if (!target) {
    friendship.chaos.nextEventAt = new Date(now.getTime() + 6 * HOUR);
    await friendship.save();
    return null;
  }

  let event;
  if (options.type) {
    event = CHAOS_EVENTS.find((item) => item.type === String(options.type).toUpperCase());
    if (!event) {
      const error = new Error('Unknown Chaos anomaly');
      error.status = 400;
      throw error;
    }
    friendship.chaos.level = Math.max(friendship.chaos.level || 1, event.minLevel || 1);
  } else {
    const pool = CHAOS_EVENTS.filter((item) => item.minLevel <= (friendship.chaos.level || 1));
    event = pool[Math.floor(Math.random() * pool.length)];
  }

  friendship.chaos.activeEvent = buildChaosEvent(friendship, target, event, now);
  friendship.chaos.nextEventAt = null;
  await friendship.save();
  await recordEvent(friendship._id, 'CHAOS_TRIGGERED', {
    userId: target.id,
    metadata: {
      type: event.type,
      name: event.name,
      expiresAt: friendship.chaos.activeEvent.expiresAt,
      forced: Boolean(options.type || forcedTargetId)
    }
  });
  await notifyBoth(friendship, 'Anomaly detected', `${event.name}: ${event.description}`, 'CHAOS_EVENT');
  return friendship.chaos.activeEvent;
};

const claimDueChaosEvent = async (friendship, now = new Date()) => {
  const target = pickEligibleChaosTarget(friendship, now);

  if (!target) {
    const retryAt = new Date(now.getTime() + 6 * HOUR);
    const rescheduled = await Friendship.findOneAndUpdate(
      {
        _id: friendship._id,
        status: 'ACTIVE',
        templateId: 'CHAOS',
        'season.status': 'ACTIVE',
        'season.endsAt': { $gt: now },
        'chaos.activeEvent': null,
        'chaos.nextEventAt': { $lte: now }
      },
      { $set: { 'chaos.nextEventAt': retryAt } },
      { new: true }
    );

    if (rescheduled) syncChaosFromFresh(friendship, rescheduled);
    else await reloadChaosState(friendship);
    return null;
  }

  const pool = CHAOS_EVENTS.filter((item) => item.minLevel <= (friendship.chaos.level || 1));
  const event = pool[Math.floor(Math.random() * pool.length)];
  const activeEvent = buildChaosEvent(friendship, target, event, now);

  const eligibleBefore = new Date(now.getTime() - 20 * HOUR);
  const claimed = await Friendship.findOneAndUpdate(
    {
      _id: friendship._id,
      status: 'ACTIVE',
      templateId: 'CHAOS',
      'season.status': 'ACTIVE',
      'season.endsAt': { $gt: now },
      [`${target.key}.lastInteraction`]: { $lte: eligibleBefore },
      'chaos.activeEvent': null,
      'chaos.nextEventAt': { $lte: now }
    },
    {
      $set: {
        'chaos.activeEvent': activeEvent,
        'chaos.nextEventAt': null
      }
    },
    { new: true }
  );

  if (!claimed) {
    await reloadChaosState(friendship);
    return null;
  }

  syncChaosFromFresh(friendship, claimed);
  await recordEvent(friendship._id, 'CHAOS_TRIGGERED', {
    userId: target.id,
    metadata: {
      type: event.type,
      name: event.name,
      expiresAt: activeEvent.expiresAt,
      forced: false
    }
  }).catch((error) => console.error('Could not record Chaos trigger:', error.message));
  await notifyBoth(friendship, 'Anomaly detected', `${event.name}: ${event.description}`, 'CHAOS_EVENT');
  return friendship.chaos.activeEvent;
};

const failActiveChaos = async (friendship, now = new Date()) => {
  const event = friendship.chaos?.activeEvent;
  if (!event?.eventId) return false;

  const targetId = idString(event.targetUserId);
  const key = participantPerspectiveKey(friendship, targetId);
  const debtPenalty = Number(event.payload?.failureDebt) || 0;
  const consequence = event.payload?.failureTitle || 'Wanted';
  const wantedUntil = new Date(now.getTime() + 48 * HOUR);
  const nextEventAt = new Date(now.getTime() + chaosCooldownMs(friendship.chaos.level || 1));
  const update = {
    $set: {
      'chaos.wantedUntil': wantedUntil,
      'chaos.lastConsequence': consequence,
      'chaos.activeEvent': null,
      'chaos.nextEventAt': nextEventAt
    }
  };

  if (key && debtPenalty > 0) {
    update.$inc = { [`${key}.baseDebt`]: debtPenalty };
  }

  const claimed = await Friendship.findOneAndUpdate(
    {
      _id: friendship._id,
      status: 'ACTIVE',
      templateId: 'CHAOS',
      'season.status': 'ACTIVE',
      'season.endsAt': { $gt: now },
      'chaos.activeEvent.eventId': event.eventId,
      'chaos.activeEvent.expiresAt': { $lte: now }
    },
    update,
    { new: true }
  );

  if (!claimed) {
    await reloadChaosState(friendship, key);
    return false;
  }

  syncChaosFromFresh(friendship, claimed, key);
  await recordEvent(friendship._id, 'CHAOS_FAILED', {
    userId: targetId,
    metadata: { type: event.type, consequence, debtPenalty }
  }).catch((error) => console.error('Could not record Chaos failure:', error.message));
  await notifyBoth(
    friendship,
    'Chaos won this round',
    `${consequence}. Wanted status lasts 48 hours.`,
    'CHAOS_FAILED'
  );
  return true;
};

const claimChaosSurvival = async (friendship, event, userId, now = new Date()) => {
  if (!event?.eventId) return false;

  const nextLevel = Math.min(5, (friendship.chaos.level || 1) + 1);
  const nextEventAt = new Date(now.getTime() + chaosCooldownMs(nextLevel));
  const claimed = await Friendship.findOneAndUpdate(
    {
      _id: friendship._id,
      status: 'ACTIVE',
      templateId: 'CHAOS',
      'season.status': 'ACTIVE',
      'season.endsAt': { $gt: now },
      'chaos.activeEvent.eventId': event.eventId,
      'chaos.activeEvent.targetUserId': userId,
      'chaos.activeEvent.expiresAt': { $gt: now }
    },
    {
      $set: {
        'chaos.level': nextLevel,
        'chaos.activeEvent': null,
        'chaos.wantedUntil': null,
        'chaos.lastConsequence': null,
        'chaos.nextEventAt': nextEventAt
      }
    },
    { new: true }
  );

  if (!claimed) {
    await reloadChaosState(friendship);
    return false;
  }

  syncChaosFromFresh(friendship, claimed);
  return true;
};

const refreshChaosState = async (friendship, now = new Date()) => {
  if (
    friendship?.templateId !== 'CHAOS' ||
    friendship?.status !== 'ACTIVE' ||
    friendship?.season?.status !== 'ACTIVE'
  ) {
    return friendship;
  }

  if (friendship.season?.endsAt && new Date(friendship.season.endsAt) <= now) {
    return friendship;
  }

  if (friendship.chaos?.activeEvent && new Date(friendship.chaos.activeEvent.expiresAt) <= now) {
    await failActiveChaos(friendship, now);
  } else if (
    !friendship.chaos?.activeEvent &&
    friendship.chaos?.nextEventAt &&
    new Date(friendship.chaos.nextEventAt) <= now
  ) {
    await claimDueChaosEvent(friendship, now);
  }

  return friendship;
};

const bankruptcyNoticeKey = (friendship, perspective, state) => {
  const seasonNumber = Number(friendship.season?.number) || 1;
  const lastInteraction = new Date(perspective?.lastInteraction || 0).getTime();
  return `${seasonNumber}:${lastInteraction}:${state.limit}`;
};

const refreshDebtState = async (friendship, now = new Date()) => {
  if (!friendship?.season) return friendship;

  const bankruptParticipants = [];
  let debtChanged = false;
  const seasonEnd = friendship.season?.endsAt ? new Date(friendship.season.endsAt) : null;
  const debtClock = seasonEnd && seasonEnd < now ? seasonEnd : now;

  for (const [key, userId, displayName] of [
    ['user1Perspective', friendship.user1, friendship.user1DisplayName],
    ['user2Perspective', friendship.user2, friendship.user2DisplayName]
  ]) {
    const perspective = friendship[key];
    if (!perspective) continue;

    const before = {
      calculatedDebt: Number(perspective.calculatedDebt) || 0,
      daysMissed: Number(perspective.daysMissed) || 0,
      isBankrupt: Boolean(perspective.isBankrupt),
      isInWarningZone: Boolean(perspective.isInWarningZone),
      daysUntilBankrupt: Number(perspective.daysUntilBankrupt) || 0,
      wasBankrupt: Boolean(perspective.wasBankrupt),
      bankruptAt: perspective.bankruptAt ? new Date(perspective.bankruptAt).getTime() : null
    };

    const state = syncDebtState(perspective, debtClock);
    const afterBankruptAt = perspective.bankruptAt ? new Date(perspective.bankruptAt).getTime() : null;
    const changed =
      before.calculatedDebt !== state.totalDebt ||
      before.daysMissed !== state.daysMissed ||
      before.isBankrupt !== state.isBankrupt ||
      before.isInWarningZone !== state.isInWarningZone ||
      before.daysUntilBankrupt !== state.daysUntilBankrupt ||
      before.wasBankrupt !== Boolean(perspective.wasBankrupt) ||
      before.bankruptAt !== afterBankruptAt;

    if (changed) debtChanged = true;

    if (state.isBankrupt) {
      bankruptParticipants.push({
        key,
        userId: idString(userId),
        displayName: displayName || 'A contract partner',
        debt: state.totalDebt,
        limit: state.limit,
        becameBankrupt: !before.isBankrupt,
        noticeKey: bankruptcyNoticeKey(friendship, perspective, state)
      });
    }
  }

  if (debtChanged) await friendship.save();

  for (const participant of bankruptParticipants) {
    const noticeClaim = await Friendship.updateOne(
      {
        _id: friendship._id,
        [`${participant.key}.bankruptcyNoticeKey`]: { $ne: participant.noticeKey }
      },
      {
        $set: { [`${participant.key}.bankruptcyNoticeKey`]: participant.noticeKey }
      }
    );

    // Keep this document safe for any later save in the same request.
    friendship[participant.key].bankruptcyNoticeKey = participant.noticeKey;

    if (noticeClaim.modifiedCount === 0) continue;

    if (participant.becameBankrupt) {
      await recordEvent(friendship._id, 'BANKRUPTCY', {
        userId: participant.userId,
        metadata: {
          debt: participant.debt,
          limit: participant.limit,
          season: friendship.season?.number
        }
      }).catch((error) => console.error('Could not record bankruptcy event:', error.message));
    }

    await notifyBoth(
      friendship,
      'Bankruptcy triggered',
      `${participant.displayName} hit ${participant.debt} debt. Bounties and Claim are now unlocked until they recover.`,
      'BANKRUPTCY',
      participant.userId
    );
  }

  return friendship;
};

const refreshGameState = async (friendship, now = new Date()) => {
  if (!friendship?.season) return friendship;

  await refreshDebtState(friendship, now);

  if (friendship.season.status === 'ACTIVE' && friendship.season.endsAt && new Date(friendship.season.endsAt) <= now) {
    friendship.season.status = 'COMPLETE';
    await friendship.save();
    await recordEvent(friendship._id, 'SEASON_COMPLETED', { metadata: { season: friendship.season.number } });
    await notifyBoth(friendship, 'Season complete', `Season ${friendship.season.number} is complete. Run it back when you are ready.`, 'SEASON_COMPLETED');
  }

  if (friendship.templateId === 'CHAOS' && friendship.season.status === 'ACTIVE') {
    await refreshChaosState(friendship, now);
  }
  return friendship;
};

const prepareCheckinGame = async (friendship, userId, source = 'TEXT') => {
  await refreshGameState(friendship);
  if (friendship.season?.status === 'COMPLETE') {
    const error = new Error('This season is complete. Run it back to keep playing.');
    error.status = 409;
    throw error;
  }

  const active = friendship.chaos?.activeEvent;
  if (active && idString(active.targetUserId) === idString(userId)) {
    if (active.payload?.requiredSource && active.payload.requiredSource !== String(source).toUpperCase()) {
      const error = new Error(`${active.name} requires a voice check-in.`);
      error.status = 400;
      throw error;
    }
    return { chaosEvent: active };
  }
  return { chaosEvent: null };
};

const completeCheckinGame = async (friendship, userId, source = 'TEXT', prepared = {}) => {
  const template = getTemplate(friendship.templateId);
  const world = getWorldEvent();
  const voice = String(source).toUpperCase() === 'VOICE';
  let xp = voice ? 15 : 10;
  if (voice && template.id === 'LONG_DISTANCE') xp += 5;
  if (voice) xp += world.voiceBonus || 0;
  xp += world.flatXp || 0;
  xp = Math.round(xp * (world.xpMultiplier || 1));

  let auraBonus = 0;
  let chaosEvent = prepared.chaosEvent;
  let chaosResolved = false;

  if (chaosEvent) {
    const resolutionTime = new Date();
    chaosResolved = await claimChaosSurvival(friendship, chaosEvent, userId, resolutionTime);

    if (!chaosResolved) {
      await refreshChaosState(friendship, resolutionTime);
      chaosEvent = null;
    }
  }

  if (chaosResolved && chaosEvent) {
    xp = Math.round(xp * (chaosEvent.payload?.xpMultiplier || 1));
    xp += Number(chaosEvent.payload?.successXP) || 0;
    auraBonus += Number(chaosEvent.payload?.auraBonus) || 0;
  }

  const previousLevel = friendship.duoLevel || 1;
  friendship.duoXP = (friendship.duoXP || 0) + xp;
  const duo = syncDuoState(friendship);
  await friendship.save();

  await recordEvent(friendship._id, voice ? 'VOICE_CHECKIN' : 'CHECKIN', {
    userId,
    xp,
    aura: auraBonus,
    metadata: { source: voice ? 'VOICE' : 'TEXT', worldEvent: world.id, season: friendship.season?.number }
  });

  if (chaosResolved && chaosEvent) {
    await recordEvent(friendship._id, 'CHAOS_SURVIVED', {
      userId,
      metadata: {
        type: chaosEvent.type,
        name: chaosEvent.name,
        chaosLevel: friendship.chaos.level,
        bonusXP: Number(chaosEvent.payload?.successXP) || 0,
        auraBonus
      }
    });
    await notifyBoth(friendship, 'Anomaly survived', `${chaosEvent.name} cleared. Chaos Level ${friendship.chaos.level}.`, 'CHAOS_SURVIVED', userId);
  }

  if (auraBonus > 0) {
    await User.updateOne({ _id: userId }, { $inc: { auraBalance: auraBonus } });
    await AuraTransaction.create({
      userId,
      amount: auraBonus,
      type: 'CHAOS_BONUS',
      description: `${chaosEvent?.name || 'Chaos'} anomaly bonus`,
      metadata: { friendshipId: friendship._id }
    });
  }

  if (duo.level > previousLevel) {
    await recordEvent(friendship._id, 'DUO_LEVEL_UP', { userId, metadata: { level: duo.level, title: duo.title } });
    await notifyBoth(friendship, `Duo Level ${duo.level}`, `You unlocked “${duo.title}”.`, 'DUO_LEVEL_UP', userId);
  }

  return { xp, auraBonus, duo, chaosResolved, worldEvent: world };
};

const buildRecap = async (friendship) => {
  await refreshGameState(friendship);
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * DAY);
  const events = await ContractEvent.find({ friendshipId: friendship._id, createdAt: { $gte: weekStart } }).sort({ createdAt: 1 }).lean();
  const seasonStart = friendship.season?.startedAt || weekStart;
  const seasonEvents = await ContractEvent.find({ friendshipId: friendship._id, createdAt: { $gte: seasonStart } }).sort({ createdAt: 1 }).lean();

  const summarize = (items) => ({
    checkins: items.filter((event) => ['CHECKIN', 'VOICE_CHECKIN'].includes(event.type)).length,
    voiceNotes: items.filter((event) => event.type === 'VOICE_CHECKIN').length,
    chaosSurvived: items.filter((event) => event.type === 'CHAOS_SURVIVED').length,
    chaosFailed: items.filter((event) => event.type === 'CHAOS_FAILED').length,
    bounties: items.filter((event) => event.type.startsWith('BOUNTY_')).length,
    bankruptcies: items.filter((event) => event.type === 'BANKRUPTCY').length,
    xpGained: items.reduce((sum, event) => sum + (event.xp || 0), 0),
    auraChanged: items.reduce((sum, event) => sum + (event.aura || 0), 0)
  });

  const weekly = summarize(events);
  const season = summarize(seasonEvents);
  let line = 'Still alive. Still under contract.';
  if (weekly.chaosFailed > 0) line = 'The contract briefly became a crime scene.';
  else if (weekly.chaosSurvived >= 2) line = 'Chaos tried. You were worse.';
  else if (weekly.checkins >= 7) line = 'Disturbingly consistent.';
  else if (weekly.checkins === 0) line = 'Communication was apparently optional.';
  else if (weekly.voiceNotes >= 3) line = 'Apparently texting was not enough.';

  const duo = duoStateFromXP(friendship.duoXP || 0);
  return {
    friendshipId: friendship._id,
    template: getTemplate(friendship.templateId),
    duo,
    weekly: { ...weekly, line, from: weekStart, to: now },
    season: {
      ...season,
      number: friendship.season?.number || 1,
      status: friendship.season?.status || 'PENDING',
      startedAt: friendship.season?.startedAt,
      endsAt: friendship.season?.endsAt
    },
    chaos: friendship.templateId === 'CHAOS' ? friendship.chaos : null,
    worldEvent: getWorldEvent(now)
  };
};

const runItBack = async (friendship) => {
  await refreshGameState(friendship);
  if (friendship.season?.status !== 'COMPLETE') {
    const error = new Error('This season is still active.');
    error.status = 409;
    throw error;
  }
  const now = new Date();
  const template = getTemplate(friendship.templateId);
  friendship.season.number = (friendship.season.number || 1) + 1;
  friendship.season.status = 'ACTIVE';
  friendship.season.startedAt = now;
  friendship.season.endsAt = new Date(now.getTime() + (friendship.season.lengthDays || template.seasonDays) * DAY);
  for (const key of ['user1Perspective', 'user2Perspective']) {
    friendship[key].baseDebt = 0;
    friendship[key].lastInteraction = now;
    friendship[key].calculatedDebt = 0;
    friendship[key].daysMissed = 0;
    friendship[key].isBankrupt = false;
    friendship[key].isInWarningZone = false;
    friendship[key].recoveryRequired = false;
  }
  if (friendship.templateId === 'CHAOS') {
    friendship.chaos.activeEvent = null;
    friendship.chaos.wantedUntil = null;
    friendship.chaos.lastConsequence = null;
    scheduleNextChaos(friendship, now);
  }
  friendship.duoXP = (friendship.duoXP || 0) + 50;
  syncDuoState(friendship);
  await friendship.save();
  await recordEvent(friendship._id, 'SEASON_STARTED', { xp: 50, metadata: { season: friendship.season.number, runItBack: true } });
  await notifyBoth(friendship, 'Run it back', `Season ${friendship.season.number} starts now. +50 Duo XP.`, 'SEASON_STARTED');
  return friendship;
};

module.exports = {
  TEMPLATES,
  CHAOS_EVENTS,
  getTemplate,
  getWorldEvent,
  duoStateFromXP,
  initializeContractGame,
  activateSeason,
  refreshDebtState,
  refreshChaosState,
  refreshGameState,
  triggerChaosEvent,
  prepareCheckinGame,
  completeCheckinGame,
  buildRecap,
  runItBack,
  recordEvent
};
