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
const { sendResetPasswordEmail, sendWelcomeEmail } = require('../services/emailService');
const { initializeContractGame, recordEvent } = require('../services/contractGame');

const NEN_TYPES = new Set(['ENHANCER', 'TRANSMUTER', 'CONJURER', 'EMITTER', 'MANIPULATOR', 'SPECIALIST']);
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const frontendUrl = () => String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const signToken = (user) => jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = (user) => {
  const data = user.toObject();
  delete data.password;
  delete data.resetPasswordToken;
  delete data.resetPasswordExpire;
  delete data.welcomeAuraGranted;
  delete data.lastDailyAuraBonusKey;
  return data;
};

router.post('/signup', async (req, res) => {
  try {
    const displayName = String(req.body.displayName || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (displayName.length < 2 || displayName.length > 32) {
      return res.status(400).json({ msg: 'Display name must be between 2 and 32 characters' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ msg: 'Enter a valid email address' });
    if (password.length < 8) return res.status(400).json({ msg: 'Password must be at least 8 characters' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: 'An account with this email already exists' });

    const user = new User({
      displayName,
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
      const inviter = await User.findById(invite.inviterId).select('displayName');
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
    console.error('Signup failed:', err.message);
    return res.status(500).json({ msg: 'Could not create account' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ msg: 'Invalid email or password' });
    }
    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('Login failed:', err.message);
    return res.status(500).json({ msg: 'Could not sign in' });
  }
});

router.get('/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -resetPasswordToken -resetPasswordExpire -welcomeAuraGranted -lastDailyAuraBonusKey');
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

router.post('/forgot-password', async (req, res) => {
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
      await sendResetPasswordEmail(user.email, `${frontendUrl()}/reset-password/${resetToken}`);
    } catch (emailError) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      console.error('Password reset email delivery failed:', emailError.message);
      return res.status(503).json({ msg: 'Email delivery is temporarily unavailable. Try again shortly.' });
    }

    return res.json({ msg: genericMessage });
  } catch (err) {
    console.error('Forgot password failed:', err.message);
    return res.status(500).json({ msg: 'Could not process password reset' });
  }
});

router.post('/reset-password/:token', async (req, res) => {
  try {
    const password = String(req.body.password || '');
    if (password.length < 8) return res.status(400).json({ msg: 'Password must be at least 8 characters' });

    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    if (!user) return res.status(400).json({ msg: 'Reset link is invalid or expired' });

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    return res.json({ msg: 'Password updated' });
  } catch (err) {
    console.error('Reset password failed:', err.message);
    return res.status(500).json({ msg: 'Could not reset password' });
  }
});

module.exports = router;
