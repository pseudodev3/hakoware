const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { randomUUID } = require('crypto');
const { Readable } = require('stream');
const VoiceNote = require('../models/VoiceNote');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getObject, putObject } = require('../services/bucketStorage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype?.startsWith('audio/')) return cb(new Error('Only audio uploads are allowed'));
    return cb(null, true);
  }
});

router.post('/upload', auth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: 'No audio file uploaded' });
    if (!req.body.friendshipId) return res.status(400).json({ msg: 'Contract is required' });

    const friendship = await Friendship.findById(req.body.friendshipId);
    if (!friendship || friendship.status !== 'ACTIVE') return res.status(404).json({ msg: 'Active contract not found' });

    const isUser1 = friendship.user1.toString() === req.user.id;
    const isUser2 = friendship.user2.toString() === req.user.id;
    if (!isUser1 && !isUser2) return res.status(403).json({ msg: 'Not authorized' });

    const recipientId = isUser1 ? friendship.user2 : friendship.user1;
    const sender = await User.findById(req.user.id).select('displayName');
    if (!sender) return res.status(404).json({ msg: 'User not found' });

    const extension = path.extname(req.file.originalname).toLowerCase() || '.webm';
    const storageKey = `voice_notes/${req.user.id}/${Date.now()}-${randomUUID()}${extension}`;
    await putObject(storageKey, req.file.buffer, req.file.mimetype || 'audio/webm');

    const duration = Math.max(0, Math.min(300, Number(req.body.duration) || 0));
    const voiceNote = new VoiceNote({
      friendshipId: friendship._id,
      senderId: req.user.id,
      senderName: sender.displayName,
      recipientId,
      filePath: '/pending',
      storageKey,
      duration,
      listened: false
    });
    voiceNote.filePath = `/api/voice-notes/${voiceNote._id}/audio`;
    await voiceNote.save();

    await Notification.create({
      toUserId: recipientId,
      fromUserId: req.user.id,
      type: 'VOICE_NOTE',
      title: 'Voice check-in',
      message: `${sender.displayName} sent you a voice check-in.`,
      friendshipId: friendship._id,
      voiceNoteId: voiceNote._id
    });

    const user = await User.findById(req.user.id);
    if (user) {
      user.examTasks.voiceNoteSent = true;
      user.hunterLicense = Boolean(user.examTasks.nenTypeSet && user.examTasks.friendAdded);
      await user.save();
    }

    return res.status(201).json(voiceNote);
  } catch (err) {
    console.error('Voice note upload failed:', err.message);
    return res.status(500).json({ msg: 'Voice note upload failed' });
  }
});

router.get('/my-inbox', auth, async (req, res) => {
  try {
    const notes = await VoiceNote.find({ recipientId: req.user.id })
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
    const note = await VoiceNote.findById(req.params.id).select('senderId recipientId storageKey');
    if (!note) return res.status(404).json({ msg: 'Note not found' });

    const userId = req.user.id;
    if (note.recipientId.toString() !== userId && note.senderId.toString() !== userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    if (!note.storageKey) return res.status(410).json({ msg: 'Audio is no longer available' });

    const object = await getObject(note.storageKey);
    const contentType = object.headers.get('content-type');
    const contentLength = object.headers.get('content-length');
    if (contentType) res.setHeader('Content-Type', contentType);
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
    if (!note) return res.status(404).json({ msg: 'Note not found' });
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
