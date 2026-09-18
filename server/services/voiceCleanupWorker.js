const VoiceNote = require('../models/VoiceNote');
const { deleteObject } = require('./bucketStorage');

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;
const MIN_INTERVAL_MS = 60 * 1000;

let stopped = true;
let timer = null;
let currentSweep = null;

const configuredInterval = () => {
  const parsed = Number(process.env.VOICE_CLEANUP_INTERVAL_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, Math.floor(parsed));
};

const runVoiceCleanupSweep = async (now = new Date()) => {
  if (currentSweep) return currentSweep;

  currentSweep = (async () => {
    const notes = await VoiceNote.find({
      status: 'PENDING',
      expiresAt: { $lte: now }
    }).select('_id storageKey');

    for (const note of notes) {
      try {
        if (note.storageKey) await deleteObject(note.storageKey);
        await VoiceNote.deleteOne({ _id: note._id, status: 'PENDING' });
      } catch (error) {
        console.error('Voice cleanup failed for pending note:', note._id, error.message);
      }
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
    await runVoiceCleanupSweep();
  } catch (error) {
    console.error('Voice cleanup sweep failed:', error.message);
  }

  if (stopped) return;
  timer = setTimeout(tick, configuredInterval());
  timer.unref?.();
};

const startVoiceCleanupWorker = () => {
  if (String(process.env.VOICE_CLEANUP_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('Voice cleanup worker disabled');
    return;
  }
  if (!stopped) return;

  stopped = false;
  console.log('Voice cleanup worker enabled');
  void tick();
};

const stopVoiceCleanupWorker = async () => {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;

  if (currentSweep) {
    try {
      await currentSweep;
    } catch (error) {
      console.error('Voice cleanup worker stopped after a failed sweep:', error.message);
    }
  }
};

module.exports = {
  runVoiceCleanupSweep,
  startVoiceCleanupWorker,
  stopVoiceCleanupWorker
};
