import { canCheckin, getBankruptPartner, getContractSides } from '../features/friendship/contractState.js';

const fold = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const timestamp = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;

export const circleRoster = (friendships, userId, social = {}, now = Date.now()) => friendships.map(friendship => {
  const { partner } = getContractSides(friendship, userId, now);
  const state = social[friendship._id || friendship.id];
  return {
    friendship,
    search: [partner?.displayName, partner?.username, friendship.identity?.name].map(fold).join(' '),
    unread: Boolean(state?.unseenActivity?.length),
    due: canCheckin(friendship, userId, now),
    urgent: Boolean(getBankruptPartner(friendship, userId, now)),
    latestAt: Math.max(timestamp(state?.lastMessage?.createdAt), ...(state?.recentActivity || []).map(item => timestamp(item.createdAt)))
  };
}).sort((a, b) => Number(b.urgent) - Number(a.urgent) || Number(b.unread) - Number(a.unread) || b.latestAt - a.latestAt);

export const filterCircleRoster = (roster, query = '', filter = 'all') => {
  const term = fold(query.trim().replace(/^@/, ''));
  return roster.filter(row => (!term || row.search.includes(term)) && (filter === 'unread' ? row.unread : filter === 'due' ? row.due : true));
};
