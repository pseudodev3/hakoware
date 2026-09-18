const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const multer = require('multer');
const { randomUUID } = require('crypto');
const { Readable } = require('stream');
const VoiceNote = require('../models/VoiceNote');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { deleteObject, getObject, putObject } = require('../services/bucketStorage');
const { prepareCheckinGame } = require('../services/contractGame');

const AUDIO_TYPES = new Map([
  ['audio/webm', '.webm'],
  ['audio/mp4', '.m4a'],
  ['audio/x-m4a', '.m4a'],
  ['audio/mpeg', '.mp3'],
  ['audio/ogg', '.ogg'],
  ['audio/wav', '.wav'],
  ['audio/x-wav', '.wav'],
  ['audio/aac', '.aac']
]);

const uploadLimiter = createRateLimiter({
  name: 'voice-upload',
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Too many voice uploads. Try again later.'
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const mime = String(file.mimetype || '').toLowerCase().split(';')[0].trim();
    if (!AUDIO_TYPES.has(mime)) return cb(new Error('Only supported audio uploads are allowed'));
    file.safeMime = mime;
    return cb(null, true);
  }
});

router.post('/upload', auth, uploadLimiter, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: 'No audio file uploaded' });
    if (!req.body.friendshipId) return res.status(400).json({ msg: 'Contract is required' });

    const friendship = await Friendship.findById(req.body.friendshipId);
    if (!friendship || friendship.status !== 'ACTIVE') return res.status(404).json({ msg: 'Active contract not found' });

    const isUser1 = friendship.user1.toString() === req.user.id;
    const isUser2 = friendship.user2.toString() === req.user.id;
    if (!isUser1 && !isUser2) return res.status(403).json({ msg: 'Not authorized' });

    const key = isUser1 ? 'user1Perspective' : 'user2Perspective';
    const lastInteraction = new Date(friendship[key].lastInteraction || 0);
    if ((Date.now() - lastInteraction.getTime()) / 3600000 < 20) {
      return res.status(400).json({ msg: 'You already checked in today' });
    }
    await prepareCheckinGame(friendship, req.user.id, 'VOICE');

    const recipientId = isUser1 ? friendship.user2 : friendship.user1;
    const sender = await User.findById(req.user.id).select('displayName');
    if (!sender) return res.status(404).json({ msg: 'User not found' });

    const mime = req.file.safeMime || String(req.file.mimetype || '').toLowerCase().split(';')[0].trim();
    const extension = AUDIO_TYPES.get(mime);
    if (!extension) return res.status(415).json({ msg: 'Unsupported audio format' });
    const storageKey = `voice_notes/${req.user.id}/${Date.now()}-${randomUUID()}${extension}`;
    await putObject(storageKey, req.file.buffer, mime);

    const duration = Math.max(0, Math.min(300, Number(req.body.duration) || 0));
    const voiceNote = new VoiceNote({
      friendshipId: friendship._id,
      senderId: req.user.id,
      senderName: sender.displayName,
      recipientId,
      filePath: '/pending',
      storageKey,
      duration,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + (30 * 60 * 1000)),
      listened: false
    });
    voiceNote.filePath = `/api/voice-notes/${voiceNote._id}/audio`;

    try {
      await voiceNote.save();
    } catch (saveError) {
      await deleteObject(storageKey).catch(() => null);
      throw saveError;
    }

    return res.status(201).json(voiceNote);
  } catch (err) {
    console.error('Voice note upload failed:', err.message);
    return res.status(err.status || 500).json({ msg: err.message || 'Voice note upload failed' });
  }
});

router.get('/my-inbox', auth, async (req, res) => {
  try {
    const notes = await VoiceNote.find({
      recipientId: req.user.id,
      $or: [{ status: 'COMMITTED' }, { status: { $exists: false } }]
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('senderId', 'displayName avatar');
    return res.json(notes);
  } catch (err) {
    console.error('Voice inbox failed:', err.message);
    return res.status(500).json({ msg: 'Could not load voice notes' });
  }
});

router.get('/:id/audio', auth, async (req, res) => {
  try {
    const note = await VoiceNote.findById(req.params.id).select('senderId recipientId storageKey status');
    if (!note) return res.status(404).json({ msg: 'Note not found' });

    const userId = req.user.id;
    const isSender = note.senderId.toString() === userId;
    const isRecipient = note.recipientId.toString() === userId;
    if (!isSender && !isRecipient) return res.status(403).json({ msg: 'Not authorized' });
    const isCommitted = note.status === 'COMMITTED' || !note.status;
    if (isRecipient && !isCommitted) return res.status(404).json({ msg: 'Note not found' });
    if (!note.storageKey) return res.status(410).json({ msg: 'Audio is no longer available' });

    const object = await getObject(note.storageKey);
    const contentType = String(object.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
    const contentLength = object.headers.get('content-length');
    res.setHeader('Content-Type', AUDIO_TYPES.has(contentType) ? contentType : 'application/octet-stream');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (!object.body) return res.status(404).end();

    Readable.fromWeb(object.body).pipe(res);
  } catch (err) {
    console.error('Voice note playback failed:', err.message);
    const status = err.status === 404 ? 404 : 500;
    return res.status(status).json({ msg: status === 404 ? 'Audio not found' : 'Voice note playback failed' });
  }
});

router.put('/:id/listened', auth, async (req, res) => {
  try {
    const note = await VoiceNote.findById(req.params.id);
    if (!note || (note.status && note.status !== 'COMMITTED')) return res.status(404).json({ msg: 'Note not found' });
    if (note.recipientId.toString() !== req.user.id) return res.status(403).json({ msg: 'Not authorized' });

    note.listened = true;
    note.listenedAt = new Date();
    await note.save();
    return res.json(note);
  } catch (err) {
    console.error('Mark voice note listened failed:', err.message);
    return res.status(500).json({ msg: 'Could not update voice note' });
  }
});

module.exports = router;
