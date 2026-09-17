const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { randomUUID } = require('crypto');
const { Readable } = require('stream');
const VoiceNote = require('../models/VoiceNote');
const User = require('../models/User');
const { getObject, putObject } = require('../services/bucketStorage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype?.startsWith('audio/')) {
      return cb(new Error('Only audio uploads are allowed'));
    }
    return cb(null, true);
  }
});

router.post('/upload', auth, upload.single('audio'), async (req, res) => {
  try {
    const { friendshipId, senderName, recipientId } = req.body;

    if (!req.file) {
      return res.status(400).json({ msg: 'No audio file uploaded' });
    }

    if (!friendshipId || !recipientId) {
      return res.status(400).json({ msg: 'friendshipId and recipientId are required' });
    }

    const extension = path.extname(req.file.originalname) || '.webm';
    const storageKey = `voice_notes/${req.user.id}/${Date.now()}-${randomUUID()}${extension}`;

    await putObject(
      storageKey,
      req.file.buffer,
      req.file.mimetype || 'audio/webm'
    );

    const voiceNote = new VoiceNote({
      friendshipId,
      senderId: req.user.id,
      senderName,
      recipientId,
      filePath: '/pending',
      storageKey,
      duration: req.body.duration || 0,
      listened: false
    });

    voiceNote.filePath = `/api/voice-notes/${voiceNote._id}/audio`;
    await voiceNote.save();

    const user = await User.findById(req.user.id);
    if (user) {
      user.examTasks.voiceNoteSent = true;
      if (user.examTasks.nenTypeSet && user.examTasks.friendAdded) {
        user.hunterLicense = true;
      }
      await user.save();
    }

    res.json(voiceNote);
  } catch (err) {
    console.error('Voice note upload failed:', err.message);
    res.status(500).json({ msg: 'Voice note upload failed' });
  }
});

router.get('/my-inbox', auth, async (req, res) => {
  try {
    const notes = await VoiceNote.find({ recipientId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('senderId', 'displayName avatar');
    res.json(notes);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/:id/audio', auth, async (req, res) => {
  try {
    const note = await VoiceNote.findById(req.params.id).select('senderId recipientId storageKey');
    if (!note) return res.status(404).json({ msg: 'Note not found' });

    const userId = req.user.id;
    const canListen = note.recipientId.toString() === userId || note.senderId.toString() === userId;
    if (!canListen) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    if (!note.storageKey) {
      return res.status(410).json({ msg: 'This voice note predates the Railway storage migration' });
    }

    const object = await getObject(note.storageKey);
    const contentType = object.headers.get('content-type');
    const contentLength = object.headers.get('content-length');

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    if (!object.body) {
      return res.status(404).end();
    }

    Readable.fromWeb(object.body).pipe(res);
  } catch (err) {
    console.error('Voice note playback failed:', err.message);
    const status = err.status === 404 ? 404 : 500;
    res.status(status).json({ msg: status === 404 ? 'Audio not found' : 'Voice note playback failed' });
  }
});

router.put('/:id/listened', auth, async (req, res) => {
  try {
    const note = await VoiceNote.findById(req.params.id);
    if (!note) return res.status(404).json({ msg: 'Note not found' });

    if (note.recipientId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    note.listened = true;
    note.listenedAt = new Date();
    await note.save();
    res.json(note);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
