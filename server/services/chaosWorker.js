const Friendship = require('../models/Friendship');
const { refreshChaosState } = require('./contractGame');

const DEFAULT_INTERVAL_MS = 60 * 1000;
const MIN_INTERVAL_MS = 30 * 1000;

let stopped = true;
let timer = null;
let currentSweep = null;

const configuredInterval = () => {
  const parsed = Number(process.env.CHAOS_WORKER_INTERVAL_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, Math.floor(parsed));
};

const dueChaosQuery = (now = new Date()) => ({
  status: 'ACTIVE',
  templateId: 'CHAOS',
  isTestData: { $ne: true },
  'season.status': 'ACTIVE',
  'season.endsAt': { $gt: now },
  $or: [
    { 'chaos.activeEvent.expiresAt': { $lte: now } },
    {
      'chaos.activeEvent': null,
      'chaos.nextEventAt': { $lte: now }
    }
  ]
});

const runChaosSweep = async (now = new Date()) => {
  if (currentSweep) return currentSweep;

  currentSweep = (async () => {
    let checked = 0;
    let failed = 0;
    const cursor = Friendship.find(dueChaosQuery(now)).cursor();

    for await (const friendship of cursor) {
      try {
        await refreshChaosState(friendship, now);
        checked += 1;
      } catch (error) {
        failed += 1;
        console.error(`Chaos worker could not refresh contract ${friendship._id}:`, error.message);
      }
    }

    if (failed > 0) {
      console.warn(`Chaos worker finished with ${failed} failure(s) after checking ${checked} due contract(s)`);
    }
  })();

  try {
    await currentSweep;
  } finally {
    currentSweep = null;
  }
};

const tick = async () => {
  if (stopped) return;

  try {
    await runChaosSweep();
  } catch (error) {
    console.error('Chaos worker sweep failed:', error.message);
  }

  if (stopped) return;
  timer = setTimeout(tick, configuredInterval());
  timer.unref?.();
};

const startChaosWorker = () => {
  if (String(process.env.CHAOS_WORKER_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('Chaos worker disabled');
    return;
  }
  if (!stopped) return;

  stopped = false;
  console.log(`Chaos worker enabled (every ${Math.round(configuredInterval() / 1000)}s)`);
  void tick();
};

const stopChaosWorker = async () => {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;

  if (currentSweep) {
    try {
      await currentSweep;
    } catch (error) {
      console.error('Chaos worker stopped after a failed sweep:', error.message);
    }
  }
};

module.exports = {
  dueChaosQuery,
  runChaosSweep,
  startChaosWorker,
  stopChaosWorker
};
