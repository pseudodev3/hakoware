const ContractEvent = require('../models/ContractEvent');
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
    description: 'Check in before the anomaly closes. Survive it for double Duo XP.',
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

  friendship.chaos.activeEvent = {
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
  };
  friendship.chaos.nextEventAt = null;
  await friendship.save();
  await recordEvent(friendship._id, 'CHAOS_TRIGGERED', {
    userId: target.id,
    metadata: { type: event.type, name: event.name, expiresAt: friendship.chaos.activeEvent.expiresAt, forced: Boolean(options.type || forcedTargetId) }
  });
  await notifyBoth(friendship, 'Anomaly detected', `${event.name}: ${event.description}`, 'CHAOS_EVENT');
  return friendship.chaos.activeEvent;
};

const failActiveChaos = async (friendship, now = new Date()) => {
  const event = friendship.chaos?.activeEvent;
  if (!event) return false;
  const targetId = idString(event.targetUserId);
  const key = participantPerspectiveKey(friendship, targetId);
  const debtPenalty = Number(event.payload?.failureDebt) || 0;
  if (key && debtPenalty > 0) friendship[key].baseDebt = (friendship[key].baseDebt || 0) + debtPenalty;

  friendship.chaos.wantedUntil = new Date(now.getTime() + 48 * HOUR);
  friendship.chaos.lastConsequence = event.payload?.failureTitle || 'Wanted';
  friendship.chaos.activeEvent = null;
  scheduleNextChaos(friendship, now);
  await friendship.save();
  await recordEvent(friendship._id, 'CHAOS_FAILED', {
    userId: targetId,
    metadata: { type: event.type, consequence: friendship.chaos.lastConsequence, debtPenalty }
  });
  await notifyBoth(friendship, 'Chaos won this round', `${friendship.chaos.lastConsequence}. Wanted status lasts 48 hours.`, 'CHAOS_FAILED');
  return true;
};

const refreshGameState = async (friendship, now = new Date()) => {
  if (!friendship?.season) return friendship;

  const bankruptcyEvents = [];
  let debtChanged = false;
  for (const [key, userId, displayName] of [
    ['user1Perspective', friendship.user1, friendship.user1DisplayName],
    ['user2Perspective', friendship.user2, friendship.user2DisplayName]
  ]) {
    const perspective = friendship[key];
    if (!perspective) continue;
    const wasBankrupt = Boolean(perspective.isBankrupt);
    const state = syncDebtState(perspective, now);
    debtChanged = true;
    if (state.isBankrupt && !wasBankrupt) {
      bankruptcyEvents.push({
        userId: idString(userId),
        displayName: displayName || 'A contract partner',
        debt: state.totalDebt,
        limit: state.limit
      });
    }
  }

  if (debtChanged) await friendship.save();

  for (const event of bankruptcyEvents) {
    await recordEvent(friendship._id, 'BANKRUPTCY', {
      userId: event.userId,
      metadata: {
        debt: event.debt,
        limit: event.limit,
        season: friendship.season?.number
      }
    });
    await notifyBoth(
      friendship,
      'Bankruptcy triggered',
      `${event.displayName} hit ${event.debt} debt. Bounties are now unlocked until they check in.`,
      'BANKRUPTCY',
      event.userId
    );
  }

  if (friendship.season.status === 'ACTIVE' && friendship.season.endsAt && new Date(friendship.season.endsAt) <= now) {
    friendship.season.status = 'COMPLETE';
    await friendship.save();
    await recordEvent(friendship._id, 'SEASON_COMPLETED', { metadata: { season: friendship.season.number } });
    await notifyBoth(friendship, 'Season complete', `Season ${friendship.season.number} is complete. Run it back when you are ready.`, 'SEASON_COMPLETED');
  }

  if (friendship.templateId === 'CHAOS' && friendship.season.status === 'ACTIVE') {
    if (friendship.chaos?.activeEvent && new Date(friendship.chaos.activeEvent.expiresAt) <= now) {
      await failActiveChaos(friendship, now);
    } else if (!friendship.chaos?.activeEvent && friendship.chaos?.nextEventAt && new Date(friendship.chaos.nextEventAt) <= now) {
      await triggerChaosEvent(friendship, now);
    }
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
  const chaosEvent = prepared.chaosEvent;
  if (chaosEvent) {
    xp = Math.round(xp * (chaosEvent.payload?.xpMultiplier || 1));
    xp += Number(chaosEvent.payload?.successXP) || 0;
    auraBonus += Number(chaosEvent.payload?.auraBonus) || 0;
    friendship.chaos.level = Math.min(5, (friendship.chaos.level || 1) + 1);
    friendship.chaos.activeEvent = null;
    friendship.chaos.wantedUntil = null;
    friendship.chaos.lastConsequence = null;
    scheduleNextChaos(friendship);
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

  if (chaosEvent) {
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

  return { xp, auraBonus, duo, chaosResolved: Boolean(chaosEvent), worldEvent: world };
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
  refreshGameState,
  triggerChaosEvent,
  prepareCheckinGame,
  completeCheckinGame,
  buildRecap,
  runItBack,
  recordEvent
};
