const express = require('express');
const router = express.Router();
const multer = require('multer');
const { randomUUID } = require('crypto');
const { Readable } = require('stream');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { calculateDebtState } = require('../services/debtState');
const { currentUserView, publicKey } = require('../services/clientViews');
const { deleteObject, getObject, putObject } = require('../services/bucketStorage');
const { IMAGE_TYPES, matchesImageSignature, normalizeMime } = require('../services/imageValidation');
const { normalizeUsername } = require('../services/username');

const avatarUploadLimiter = createRateLimiter({
  name: 'avatar-upload',
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Too many avatar changes. Try again later.'
});

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const mime = normalizeMime(file.mimetype);
    if (!IMAGE_TYPES.has(mime)) return cb(new Error('Use a JPG, PNG, or WebP image'));
    file.safeMime = mime;
    return cb(null, true);
  }
});

router.get('/avatar/:username', async (req, res) => {
  try {
    const usernameNormalized = normalizeUsername(req.params.username);
    if (!usernameNormalized) return res.status(404).end();

    const user = await User.findOne({ usernameNormalized })
      .select('avatarStorageKey')
      .lean();
    if (!user?.avatarStorageKey) return res.status(404).end();

    const object = await getObject(user.avatarStorageKey);
    const contentType = normalizeMime(object.headers.get('content-type'));
    const contentLength = object.headers.get('content-length');
    res.setHeader('Content-Type', IMAGE_TYPES.has(contentType) ? contentType : 'application/octet-stream');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    if (!object.body) return res.status(404).end();

    Readable.fromWeb(object.body).pipe(res);
  } catch (err) {
    const status = err.status === 404 ? 404 : 500;
    if (status === 500) console.error('Avatar read failed:', err.message);
    return res.status(status).end();
  }
});

router.post('/avatar', auth, avatarUploadLimiter, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: 'Choose an image first' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (!user.username) return res.status(409).json({ msg: 'Pick a username before adding an avatar' });

    const mime = req.file.safeMime || normalizeMime(req.file.mimetype);
    const extension = IMAGE_TYPES.get(mime);
    if (!extension || !matchesImageSignature(req.file.buffer, mime)) {
      return res.status(415).json({ msg: 'Image content does not match its file type' });
    }

    const storageKey = `avatars/${user._id}/${Date.now()}-${randomUUID()}${extension}`;
    await putObject(storageKey, req.file.buffer, mime);

    const oldStorageKey = user.avatarStorageKey || null;
    user.avatarStorageKey = storageKey;
    user.avatar = `/api/users/avatar/${encodeURIComponent(user.username)}?v=${Date.now()}`;

    try {
      await user.save();
    } catch (saveError) {
      await deleteObject(storageKey).catch(() => null);
      throw saveError;
    }

    if (oldStorageKey && oldStorageKey !== storageKey) {
      void deleteObject(oldStorageKey).catch((error) => {
        console.warn('Old avatar cleanup failed:', error.message);
      });
    }

    return res.json(currentUserView(user));
  } catch (err) {
    console.error('Avatar upload failed:', err.message);
    return res.status(500).json({ msg: 'Could not update avatar' });
  }
});

router.delete('/avatar', auth, avatarUploadLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const oldStorageKey = user.avatarStorageKey || null;
    user.avatar = null;
    user.avatarStorageKey = null;
    await user.save();

    if (oldStorageKey) {
      void deleteObject(oldStorageKey).catch((error) => {
        console.warn('Avatar cleanup failed:', error.message);
      });
    }

    return res.json(currentUserView(user));
  } catch (err) {
    console.error('Avatar removal failed:', err.message);
    return res.status(500).json({ msg: 'Could not remove avatar' });
  }
});

router.get('/leaderboard', auth, async (req, res) => {
  try {
    const actor = await User.findById(req.user.id).select('isTestAccount testOwnerId');
    if (!actor) return res.status(404).json({ msg: 'User not found' });
    const friendshipScope = actor.isTestAccount
      ? { status: 'ACTIVE', isTestData: true, testOwnerId: actor.testOwnerId }
      : { status: 'ACTIVE', isTestData: { $ne: true } };
    const allFriendships = await Friendship.find(friendshipScope);
    const bankruptStats = {};
    const now = new Date();

    allFriendships.forEach((friendship) => {
      const perspectives = [
        { userId: friendship.user1.toString(), perspective: friendship.user1Perspective },
        { userId: friendship.user2.toString(), perspective: friendship.user2Perspective }
      ];

      perspectives.forEach(({ userId, perspective }) => {
        const debt = calculateDebtState(perspective, now);
        if (!bankruptStats[userId]) bankruptStats[userId] = { isBankrupt: false, totalDebt: 0 };
        bankruptStats[userId].totalDebt += debt.totalDebt;
        if (debt.isBankrupt) bankruptStats[userId].isBankrupt = true;
      });
    });

    const bankruptUserIds = Object.keys(bankruptStats).filter((userId) => bankruptStats[userId].isBankrupt);
    const users = await User.find({
      _id: { $in: bankruptUserIds },
      ...(actor.isTestAccount
        ? { isTestAccount: true, testOwnerId: actor.testOwnerId }
        : { isTestAccount: { $ne: true } }),
      'privacySettings.optOutPublicBankruptcy': false
    })
      .select('displayName username avatar')
      .lean();

    const usersWithStats = users
      .map((user) => ({
        _id: publicKey(user._id, 'shame'),
        displayName: user.displayName,
        username: user.username || null,
        avatar: user.avatar || null,
        totalDebt: bankruptStats[user._id.toString()].totalDebt
      }))
      .sort((a, b) => b.totalDebt - a.totalDebt);

    return res.json(usersWithStats);
  } catch (err) {
    console.error('Leaderboard failed:', err.message);
    return res.status(500).json({ msg: 'Could not load the Shame Board' });
  }
});

router.patch('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (typeof req.body.optOutPublicBankruptcy === 'boolean') {
      user.privacySettings.optOutPublicBankruptcy = req.body.optOutPublicBankruptcy;
    }
    await user.save();
    return res.json({ privacySettings: user.privacySettings });
  } catch (err) {
    console.error('Update preferences failed:', err.message);
    return res.status(500).json({ msg: 'Could not update preferences' });
  }
});

module.exports = router;
