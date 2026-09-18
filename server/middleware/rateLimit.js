const buckets = new Map();

const cleanup = () => {
  const now = Date.now();
  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
};

const cleanupTimer = setInterval(cleanup, 10 * 60 * 1000);
cleanupTimer.unref?.();

const defaultKey = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const createRateLimiter = ({
  name = 'request',
  windowMs = 15 * 60 * 1000,
  max = 30,
  keyGenerator = defaultKey,
  message = 'Too many requests. Try again later.'
} = {}) => (
  function rateLimit(req, res, next) {
    const now = Date.now();
    const rawKey = keyGenerator(req);
    const key = name + ':' + String(rawKey || 'unknown');
    let entry = buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ msg: message });
    }

    return next();
  }
);

module.exports = {
  createRateLimiter
};
