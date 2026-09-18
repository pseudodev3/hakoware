const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function auth(req, res, next) {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.user?.id;
    if (!userId) return res.status(401).json({ msg: 'Token is not valid' });

    const user = await User.findById(userId).select('_id authVersion');
    if (!user) return res.status(401).json({ msg: 'Token is not valid' });

    const tokenVersion = Number(decoded.user.v) || 0;
    const currentVersion = Number(user.authVersion) || 0;
    if (tokenVersion !== currentVersion) {
      return res.status(401).json({ msg: 'Session has expired. Sign in again.' });
    }

    req.user = { id: String(user._id) };
    return next();
  } catch {
    return res.status(401).json({ msg: 'Token is not valid' });
  }
};
