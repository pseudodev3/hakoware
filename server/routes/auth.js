const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const AuraTransaction = require('../models/AuraTransaction');
const auth = require('../middleware/auth');
const { sendResetPasswordEmail, sendWelcomeEmail } = require('../services/emailService');

const frontendUrl = () => {
  const value = process.env.FRONTEND_URL || 'http://localhost:5173';
  return value.replace(/\/$/, '');
};

router.post('/signup', async (req, res) => {
  const { displayName, email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({ displayName, email, password });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    const initialAura = 100;
    user.auraBalance = initialAura;

    await user.save();

    const welcomeTransaction = new AuraTransaction({
      userId: user._id,
      amount: initialAura,
      type: 'WELCOME_BONUS',
      description: 'Welcome to Hakoware! Initial Aura gift.'
    });
    await welcomeTransaction.save();

    sendWelcomeEmail(user.email, user.displayName);

    const payload = { user: { id: user.id } };

    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      const userResp = user.toObject();
      delete userResp.password;
      res.json({ token, user: userResp });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const payload = { user: { id: user.id } };

    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      const userResp = user.toObject();
      delete userResp.password;
      res.json({ token, user: userResp });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.put('/nen-type', auth, async (req, res) => {
  try {
    const { nenType } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.nenType = nenType;
    user.examTasks.nenTypeSet = true;

    if (user.examTasks.friendAdded && user.examTasks.voiceNoteSent) {
      user.hunterLicense = true;
    }

    await user.save();
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'USER NOT REGISTERED' });

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 3600000;
    await user.save();

    const resetUrl = `${frontendUrl()}/reset-password/${resetToken}`;
    await sendResetPasswordEmail(user.email, resetUrl);

    res.json({ msg: 'RECOVERY PROTOCOL INITIATED' });
  } catch (err) {
    console.error('FORGOT PASSWORD ERROR:', err);
    res.status(500).json({ msg: 'SERVER ERROR' });
  }
});

router.post('/reset-password/:token', async (req, res) => {
  const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  try {
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ msg: 'INVALID OR EXPIRED TOKEN' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();
    res.json({ msg: 'PASSWORD RECOVERY SUCCESSFUL' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
