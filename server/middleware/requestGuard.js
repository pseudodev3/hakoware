const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_DEPTH = 20;
const MAX_KEYS = 1000;

const inspect = (value, state, depth = 0) => {
  if (value == null || typeof value !== 'object') return null;
  if (depth > MAX_DEPTH) return 'Request payload is too deeply nested';
  if (state.seen.has(value)) return null;
  state.seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const reason = inspect(item, state, depth + 1);
      if (reason) return reason;
    }
    return null;
  }

  for (const key of Object.keys(value)) {
    state.keys += 1;
    if (state.keys > MAX_KEYS) return 'Request payload has too many fields';
    if (key.startsWith('$') || key.includes('.') || DANGEROUS_KEYS.has(key)) {
      return 'Request contains a forbidden field name';
    }

    const reason = inspect(value[key], state, depth + 1);
    if (reason) return reason;
  }

  return null;
};

module.exports = function requestGuard(req, res, next) {
  const state = { keys: 0, seen: new WeakSet() };
  const reason = inspect(req.body, state) || inspect(req.query, state);

  if (reason) return res.status(400).json({ msg: reason });
  return next();
};
