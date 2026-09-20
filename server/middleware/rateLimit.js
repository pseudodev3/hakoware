const crypto = require('crypto');

const buckets = new Map();
const MAX_BUCKETS = 10000;
const hashKey = (value) => crypto
  .createHash('sha256')
  .update(String(value || 'unknown'))
  .digest('hex')
  .slice(0, 32);

const cleanup = (now = Date.now()) => {
  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
};

const cleanupTimer = setInterval(() => cleanup(), 10 * 60 * 1000);
cleanupTimer.unref?.();

const defaultKey = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const createRateLimiter = ({
  name = 'request',
  windowMs = 15 * 60 * 1000,
  max = 30,
  keyGenerator = defaultKey,
  message = 'Too many requests. Try again later.'
} = {}) => {
  const safeWindowMs = Math.max(1000, Number(windowMs) || 15 * 60 * 1000);
  const safeMax = Math.max(1, Math.floor(Number(max) || 30));

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const rawKey = keyGenerator(req);
    const key = `${name}:${hashKey(rawKey)}`;
    let entry = buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      cleanup(now);
      entry = buckets.get(key);

      if (!entry && buckets.size >= MAX_BUCKETS) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ msg: 'Too many requests. Try again shortly.' });
      }

      if (!entry) {
        entry = { count: 0, resetAt: now + safeWindowMs, lastSeenAt: now };
        buckets.set(key, entry);
      }
    }

    entry.count += 1;
    entry.lastSeenAt = now;

    const remaining = Math.max(0, safeMax - entry.count);
    res.setHeader('RateLimit-Limit', String(safeMax));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > safeMax) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ msg: message });
    }

    return next();
  };
};

module.exports = {
  createRateLimiter
};
