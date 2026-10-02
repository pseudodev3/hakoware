const WINDOW_MS = 48 * 60 * 60 * 1000;
const DISCOVERY_TYPES = new Set([
  'MESSAGE', 'CHECKIN', 'VOICE_CHECKIN', 'CHECKIN_REPLY', 'CHECKIN_REACTION', 'POKE',
  'MUTUAL_POKE', 'HOT_SEAT_OPENED', 'HOT_SEAT_ANSWERED', 'HOT_SEAT_REVEALED',
  'SPLIT_DECISION_OPENED', 'SPLIT_DECISION_ANSWERED', 'SPLIT_DECISION_REVEALED',
  'DOUBLE_DARE_SENT', 'DOUBLE_DARE_REVEALED'
]);

const storageKey = (userId) => `hakoware-circle-seen:${userId}`;
const prune = (items, now = Date.now()) => Object.fromEntries(Object.entries(items || {})
  .filter(([id, at]) => id && Number.isFinite(at) && at >= now - WINDOW_MS && at <= now)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 512));

export const readCircleSeen = (storage, userId) => {
  try { return prune(JSON.parse(storage.getItem(storageKey(userId)) || '{}')); }
  catch { return {}; }
};

export const markCircleSeen = (storage, userId, seen, items, now = Date.now()) => {
  const next = prune({ ...seen, ...Object.fromEntries(items.filter((item) => item?.id)
    .map((item) => [item.id, new Date(item.createdAt).getTime()])) }, now);
  try { storage.setItem(storageKey(userId), JSON.stringify(next)); }
  catch { /* Keep acknowledgement working for this session when storage is unavailable. */ }
  return next;
};

export const applyCircleSeen = (presence, seen) => ({
  ...presence,
  pulse: (presence?.pulse || []).filter((item) => !seen[item.id]),
  contracts: Object.fromEntries(Object.entries(presence?.contracts || {}).map(([id, state]) => [id, {
    ...state,
    unseenActivity: (state.recentActivity || []).filter((item) => DISCOVERY_TYPES.has(item.type) && !seen[item.id]),
    firstMutualCheckin: state.firstMutualCheckin && !seen[state.firstMutualCheckin.id] ? state.firstMutualCheckin : null
  }]))
});

export const activityLabel = (type) => ({
  MESSAGE: 'New message', CHECKIN: 'New check-in', VOICE_CHECKIN: 'New voice check-in', CHECKIN_REPLY: 'New reply',
  CHECKIN_REACTION: 'New reaction', POKE: 'Poke back?', MUTUAL_POKE: 'Mutual Menace',
  HOT_SEAT_OPENED: 'Hot Seat is open', HOT_SEAT_ANSWERED: 'They answered Hot Seat',
  HOT_SEAT_REVEALED: 'Hot Seat revealed', SPLIT_DECISION_OPENED: 'Split Decision is open',
  SPLIT_DECISION_ANSWERED: 'They picked a side', SPLIT_DECISION_REVEALED: 'Split Decision revealed',
  DOUBLE_DARE_SENT: 'They sent a dare', DOUBLE_DARE_REVEALED: 'Double Dare resolved'
}[type] || 'New activity');
