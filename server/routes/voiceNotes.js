const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const VoiceNote = require('../models/VoiceNote');
const Friendship = require('../models/Friendship');

// Configure Multer for audio storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/voice_notes';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage: storage });

// @route    POST api/voice-notes/upload
// @desc     Upload and send a voice note
// @access   Private
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
    res.json(voiceNote);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route    GET api/voice-notes/my-inbox
// @desc     Get all voice notes sent to current user
// @access   Private
router.get('/my-inbox', auth, async (req, res) => {
  try {
    const notes = await VoiceNote.find({ recipientId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('senderId', 'displayName avatar');
    res.json(notes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route    PUT api/voice-notes/:id/listened
// @desc     Mark voice note as listened
// @access   Private
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
    res.status(500).send('Server error');
  }
});

module.exports = router;
