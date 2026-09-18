const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const PendingInvite = require('../models/PendingInvite');
const AuraTransaction = require('../models/AuraTransaction');
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { sendResetPasswordEmail, sendWelcomeEmail } = require('../services/emailService');
const { initializeContractGame, recordEvent } = require('../services/contractGame');
const { normalizeUsername, validateUsername } = require('../services/username');

const NEN_TYPES = new Set(['ENHANCER', 'TRANSMUTER', 'CONJURER', 'EMITTER', 'MANIPULATOR', 'SPECIALIST']);
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const frontendUrl = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const signToken = (user) => jwt.sign({ user: { id: user.id, v: Number(user.authVersion) || 0 } }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = (user) => {
  const data = user.toObject();
  delete data.password;
  delete data.resetPasswordToken;
  delete data.resetPasswordExpire;
  delete data.welcomeAuraGranted;
  delete data.lastDailyAuraBonusKey;
  delete data.authVersion;
  return data;
};
const signupLimiter = createRateLimiter({
  name: 'auth-signup',
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many signup attempts. Try again later.'
});
const loginLimiter = createRateLimiter({
  name: 'auth-login',
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many sign-in attempts. Try again later.'
});
const forgotLimiter = createRateLimiter({
  name: 'auth-forgot',
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: 'Too many password-reset attempts. Try again later.'
});
const resetLimiter = createRateLimiter({
  name: 'auth-reset',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many reset attempts. Try again later.'
});
const usernameLimiter = createRateLimiter({
  name: 'auth-username',
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: 'Too many username attempts. Try again later.'
});


router.post('/signup', signupLimiter, async (req, res) => {
  try {
    const usernameCheck = validateUsername(req.body.username);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!usernameCheck.valid) return res.status(400).json({ msg: usernameCheck.message });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ msg: 'Enter a valid email address' });
    if (password.length < 8) return res.status(400).json({ msg: 'Password must be at least 8 characters' });

    const existing = await User.findOne({
      $or: [
        { email },
        { usernameNormalized: usernameCheck.normalized }
      ]
    });
    if (existing?.usernameNormalized === usernameCheck.normalized) {
      return res.status(400).json({ msg: 'That username is unavailable' });
    }
    if (existing) return res.status(400).json({ msg: 'An account with this email already exists' });

    const user = new User({
      displayName: usernameCheck.username,
      username: usernameCheck.username,
      usernameNormalized: usernameCheck.normalized,
      email,
      password: await bcrypt.hash(password, 10),
      auraBalance: 100,
      welcomeAuraGranted: true
    });
    await user.save();
    await AuraTransaction.create({
      userId: user._id,
      amount: 100,
      type: 'WELCOME_BONUS',
      description: 'Welcome to Hakoware'
    });

    const pendingInvites = await PendingInvite.find({
      recipientEmail: email,
      expiresAt: { $gt: new Date() }
    });

    for (const invite of pendingInvites) {
      if (invite.inviterId.toString() === user._id.toString()) continue;
      const inviter = await User.findById(invite.inviterId).select('displayName username');
      if (!inviter) continue;

      const existingFriendship = await Friendship.findOne({
        $or: [
          { user1: inviter._id, user2: user._id },
          { user1: user._id, user2: inviter._id }
        ]
      });
      if (existingFriendship) continue;

      const friendship = new Friendship({
        user1: inviter._id,
        user2: user._id,
        user1DisplayName: inviter.displayName,
        user2DisplayName: user.displayName,
        status: 'PENDING'
      });
      initializeContractGame(friendship, invite.templateId || 'DONT_GHOST', invite.limit);
      await friendship.save();
      await recordEvent(friendship._id, 'CONTRACT_CREATED', {
        userId: inviter._id,
        metadata: { templateId: friendship.templateId, convertedFromInvite: true }
      });
    }
    if (pendingInvites.length) await PendingInvite.deleteMany({ recipientEmail: email });

    void sendWelcomeEmail(user.email, user.displayName);
    return res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.usernameNormalized) {
      return res.status(400).json({ msg: 'That username is unavailable' });
    }
    console.error('Signup failed:', err.message);
    return res.status(500).json({ msg: 'Could not create account' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const identifier = String(req.body.identifier || req.body.email || '').trim();
    const password = String(req.body.password || '');
    const isEmail = identifier.includes('@');
    const query = isEmail
      ? { email: normalizeEmail(identifier) }
      : { usernameNormalized: normalizeUsername(identifier) };

    const user = identifier ? await User.findOne(query) : null;
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ msg: 'Invalid username/email or password' });
    }
    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('Login failed:', err.message);
    return res.status(500).json({ msg: 'Could not sign in' });
  }
});

router.put('/username', auth, usernameLimiter, async (req, res) => {
  try {
    const usernameCheck = validateUsername(req.body.username);
    if (!usernameCheck.valid) return res.status(400).json({ msg: usernameCheck.message });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (user.usernameNormalized) return res.status(409).json({ msg: 'Username is already set' });

    const existing = await User.findOne({
      usernameNormalized: usernameCheck.normalized,
      _id: { $ne: user._id }
    }).select('_id');
    if (existing) return res.status(400).json({ msg: 'That username is unavailable' });

    user.username = usernameCheck.username;
    user.usernameNormalized = usernameCheck.normalized;
    await user.save();
    return res.json(publicUser(user));
  } catch (err) {
    if (err?.code === 11000) return res.status(400).json({ msg: 'That username is unavailable' });
    console.error('Claim username failed:', err.message);
    return res.status(500).json({ msg: 'Could not claim username' });
  }
});

router.get('/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -resetPasswordToken -resetPasswordExpire -welcomeAuraGranted -lastDailyAuraBonusKey -authVersion');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    return res.json(user);
  } catch (err) {
    console.error('Load user failed:', err.message);
    return res.status(500).json({ msg: 'Could not load account' });
  }
});

router.put('/nen-type', auth, async (req, res) => {
  try {
    const nenType = String(req.body.nenType || '').toUpperCase();
    if (!NEN_TYPES.has(nenType)) return res.status(400).json({ msg: 'Choose a valid Nen affinity' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (user.nenType) return res.status(400).json({ msg: 'Nen affinity is already set' });

    user.nenType = nenType;
    await user.save();
    return res.json(publicUser(user));
  } catch (err) {
    console.error('Set Nen failed:', err.message);
    return res.status(500).json({ msg: 'Could not set Nen affinity' });
  }
});

router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const genericMessage = 'If an account exists for that email, a reset link has been sent.';

  try {
    const email = normalizeEmail(req.body.email);
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.json({ msg: genericMessage });

    const user = await User.findOne({ email });
    if (!user) return res.json({ msg: genericMessage });

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 3600000;
    await user.save();

    try {
      await sendResetPasswordEmail(user.email, `${frontendUrl()}/reset-password#token=${encodeURIComponent(resetToken)}`);
    } catch (emailError) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      console.error('Password reset email delivery failed:', emailError.message);
    }

    return res.json({ msg: genericMessage });
  } catch (err) {
    console.error('Forgot password failed:', err.message);
    return res.status(500).json({ msg: 'Could not process password reset' });
  }
});

const resetPasswordHandler = async (req, res) => {
  try {
    const password = String(req.body.password || '');
    if (password.length < 8) return res.status(400).json({ msg: 'Password must be at least 8 characters' });

    const rawToken = String(req.body.token || req.params.token || '');
    if (!rawToken) return res.status(400).json({ msg: 'Reset link is invalid or expired' });

    const resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    if (!user) return res.status(400).json({ msg: 'Reset link is invalid or expired' });

    user.password = await bcrypt.hash(password, 10);
    user.authVersion = (Number(user.authVersion) || 0) + 1;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    return res.json({ msg: 'Password updated' });
  } catch (err) {
    console.error('Reset password failed:', err.message);
    return res.status(500).json({ msg: 'Could not reset password' });
  }
};

router.post('/reset-password', resetLimiter, resetPasswordHandler);
// Temporary compatibility for reset links issued before fragment-based reset URLs.
router.post('/reset-password/:token', resetLimiter, resetPasswordHandler);

module.exports = router;
