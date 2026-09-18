const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'support',
  'help',
  'system',
  'security',
  'moderator',
  'mod',
  'staff',
  'official',
  'founder',
  'team',
  'api',
  'root',
  'null',
  'undefined',
  'login',
  'signup',
  'register',
  'settings',
  'privacy',
  'terms',
  'community',
  'contact',
  'arena',
  'contracts',
  'home',
  'you',
  'auth',
  'account',
  'accounts',
  'user',
  'users',
  'profile',
  'profiles',
  'notifications',
  'resetpassword',
  'password',
  'email',
  'mail',
  'status',
  'health',
  'www',
  'hakoware',
  'hakowareapp',
  'hakowareofficial',
  'hakowaresupport'
]);

const cleanUsername = (value) => String(value || '')
  .trim()
  .replace(/^@+/, '');

const normalizeUsername = (value) => cleanUsername(value).toLowerCase();

const usernameCanonical = (value) => normalizeUsername(value).replace(/[._]/g, '');

const isReservedUsername = (value) => {
  const normalized = normalizeUsername(value);
  const canonical = usernameCanonical(value);
  if (!normalized) return false;
  if (canonical.startsWith('hakoware')) return true;
  return RESERVED_USERNAMES.has(normalized) || RESERVED_USERNAMES.has(canonical);
};

const validateUsername = (value) => {
  const username = cleanUsername(value);
  const normalized = normalizeUsername(value);

  if (username.length < 3 || username.length > 20) {
    return { valid: false, message: 'Username must be between 3 and 20 characters' };
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9._]*[A-Za-z0-9]$/.test(username)) {
    return {
      valid: false,
      message: 'Use only letters, numbers, dots or underscores, and start and end with a letter or number'
    };
  }

  if (isReservedUsername(username)) {
    return { valid: false, message: 'That username is unavailable' };
  }

  return { valid: true, username, normalized };
};

module.exports = {
  RESERVED_USERNAMES,
  cleanUsername,
  normalizeUsername,
  isReservedUsername,
  validateUsername
};
