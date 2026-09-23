const ContractMoment = require('../models/ContractMoment');
const { refreshMoment } = require('./contractMoments');

const DEFAULT_INTERVAL_MS = 60 * 1000;
const MIN_INTERVAL_MS = 30 * 1000;

let stopped = true;
let timer = null;
let currentSweep = null;

const configuredInterval = () => {
  const parsed = Number(process.env.MOMENT_WORKER_INTERVAL_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, Math.floor(parsed));
};

const dueMomentQuery = (now = new Date()) => ({
  $or: [
    { status: 'BREWING', unlockAt: { $lte: now } },
    { status: 'OPEN', expiresAt: { $lte: now } }
  ]
});

const runMomentSweep = async (now = new Date()) => {
  if (currentSweep) return currentSweep;

  currentSweep = (async () => {
    let checked = 0;
    let failed = 0;
    const cursor = ContractMoment.find(dueMomentQuery(now)).cursor();

    for await (const moment of cursor) {
      try {
        await refreshMoment(moment, now);
        checked += 1;
      } catch (error) {
        failed += 1;
        console.error(`Moment worker could not refresh ${moment._id}:`, error.message);
      }
    }

    if (failed > 0) {
      console.warn(`Moment worker finished with ${failed} failure(s) after checking ${checked} due moment(s)`);
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
    await runMomentSweep();
  } catch (error) {
    console.error('Moment worker sweep failed:', error.message);
  }

  if (stopped) return;
  timer = setTimeout(tick, configuredInterval());
  timer.unref?.();
};

const startMomentWorker = () => {
  if (String(process.env.MOMENT_WORKER_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('Moment worker disabled');
    return;
  }
  if (!stopped) return;

  stopped = false;
  console.log(`Moment worker enabled (every ${Math.round(configuredInterval() / 1000)}s)`);
  void tick();
};

const stopMomentWorker = async () => {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;

  if (currentSweep) {
    try {
      await currentSweep;
    } catch (error) {
      console.error('Moment worker stopped after a failed sweep:', error.message);
    }
  }
};

module.exports = {
  dueMomentQuery,
  runMomentSweep,
  startMomentWorker,
  stopMomentWorker
};
