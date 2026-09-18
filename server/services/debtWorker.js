const Friendship = require('../models/Friendship');
const { refreshDebtState } = require('./contractGame');

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;

let stopped = true;
let timer = null;
let currentSweep = null;

const configuredInterval = () => {
  const parsed = Number(process.env.DEBT_WORKER_INTERVAL_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, Math.floor(parsed));
};

const runDebtSweep = async () => {
  if (currentSweep) return currentSweep;

  currentSweep = (async () => {
    let checked = 0;
    let failed = 0;
    const cursor = Friendship.find({ status: 'ACTIVE' }).cursor();

    for await (const friendship of cursor) {
      try {
        await refreshDebtState(friendship);
        checked += 1;
      } catch (error) {
        failed += 1;
        console.error(`Debt worker could not refresh contract ${friendship._id}:`, error.message);
      }
    }

    if (failed > 0) {
      console.warn(`Debt worker finished with ${failed} failure(s) after checking ${checked} contract(s)`);
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
    await runDebtSweep();
  } catch (error) {
    console.error('Debt worker sweep failed:', error.message);
  }

  if (stopped) return;
  timer = setTimeout(tick, configuredInterval());
  timer.unref?.();
};

const startDebtWorker = () => {
  if (String(process.env.DEBT_WORKER_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('Debt worker disabled');
    return;
  }
  if (!stopped) return;

  stopped = false;
  console.log(`Debt worker enabled (every ${Math.round(configuredInterval() / 1000)}s)`);
  void tick();
};

const stopDebtWorker = async () => {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;
  if (currentSweep) await currentSweep;
};

module.exports = {
  runDebtSweep,
  startDebtWorker,
  stopDebtWorker
};
