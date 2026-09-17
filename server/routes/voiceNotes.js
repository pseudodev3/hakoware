const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const VoiceNote = require('../models/VoiceNote');
const User = require('../models/User');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const root = req.app.locals.uploadDir || path.join(process.cwd(), 'uploads');
    const dir = path.join(root, 'voice_notes');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const extension = path.extname(file.originalname) || '.webm';
    cb(null, `${req.user.id}-${Date.now()}${extension}`);
  }
});

const upload = multer({
  storage,
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

    const voiceNote = new VoiceNote({
      friendshipId,
      senderId: req.user.id,
      senderName,
      recipientId,
      filePath: `/uploads/voice_notes/${req.file.filename}`,
      duration: req.body.duration || 0,
      listened: false
    });

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
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
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
