const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { sendResetPasswordEmail } = require('../services/emailService');

// @route    POST api/auth/signup
// @desc     Register user
// @access   Public
router.post('/signup', async (req, res) => {
  const { displayName, email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      displayName,
      email,
      password
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'hakoware_secret_key',
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        const userResp = user.toObject();
        delete userResp.password;
        res.json({ token, user: userResp });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route    POST api/auth/login
// @desc     Authenticate user & get token
// @access   Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'hakoware_secret_key',
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        const userResp = user.toObject();
        delete userResp.password;
        res.json({ token, user: userResp });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route    GET api/auth/user
// @desc     Get user by token
// @access   Private
router.get('/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/auth/nen-type
// @desc     Set user's Nen type
// @access   Private
router.put('/nen-type', auth, async (req, res) => {
  try {
    const { nenType } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    user.nenType = nenType;
    await user.save();
    
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/auth/forgot-password
// @desc     Request password reset
// @access   Public
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'USER NOT REGISTERED' });

    // Generate token
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hour

    await user.save();

    // Ensure link uses the correct frontend URL
    const resetUrl = `https://hakoware.vercel.app/reset-password/${resetToken}`;
    
    const sent = await sendResetPasswordEmail(user.email, resetUrl);
    if (!sent) return res.status(500).json({ msg: 'EMAIL FAILED TO SEND' });

    res.json({ msg: 'RECOVERY PROTOCOL INITIATED' });
  } catch (err) {
    console.error('FORGOT PASSWORD ERROR:', err);
    res.status(500).json({ msg: 'SERVER ERROR', error: err.message, stack: err.stack });
  }
});

// @route    POST api/auth/reset-password/:token
// @desc     Reset password
// @access   Public
router.post('/reset-password/:token', async (req, res) => {
  const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  try {
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ msg: 'INVALID OR EXPIRED TOKEN' });

    // Set new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();
    res.json({ msg: 'PASSWORD RECOVERY SUCCESSFUL' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
