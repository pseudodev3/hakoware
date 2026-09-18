const User = require('../models/User');

const founderEmails = () => new Set(
  String(process.env.FOUNDER_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

module.exports = async function founder(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('email isTestAccount');
    if (!user || user.isTestAccount || !founderEmails().has(String(user.email).toLowerCase())) {
      return res.status(403).json({ msg: 'Founder access only' });
    }
    req.founder = user;
    return next();
  } catch (error) {
    console.error('Founder access check failed:', error.message);
    return res.status(500).json({ msg: 'Could not verify founder access' });
  }
};
