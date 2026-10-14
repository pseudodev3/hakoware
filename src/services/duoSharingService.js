import { getContractRecap } from './friendshipService';
import { buildDuoShareCard } from '../lib/duoShareCard';
import { shareHakoware } from '../lib/share';
import { duoLabel } from '../lib/duoIdentity';

export const shareDuo = async (friendship, user) => {
  const userId = String(user.uid || user.id || user._id);
  const partner = String(friendship.user1?._id || friendship.user1) === userId ? friendship.user2 : friendship.user1;
  const recap = await getContractRecap(friendship._id || friendship.id);
  const blob = await buildDuoShareCard({
    userName: user.username ? `@${user.username}` : user.displayName,
    partnerName: partner?.username ? `@${partner.username}` : partner?.displayName,
    duoName: friendship.identity?.name, palette: friendship.identity?.palette, cover: friendship.identity?.cover,
    duoLevel: recap.duo.level, duoTitle: recap.duo.title, duoXP: recap.duo.xp,
    templateName: recap.template?.name, seasonNumber: recap.season.number, seasonStatus: recap.season.status
  });
  return shareHakoware({
    source: 'DUO', title: duoLabel(friendship, 'Our Hakoware Duo'),
    text: `${duoLabel(friendship, `${user.displayName} + ${partner?.displayName || 'my friend'}`)} · Duo Lv. ${recap.duo.level}`,
    url: '', files: [new File([blob], 'hakoware-duo.png', { type: 'image/png' })]
  });
};

export const duoShareFeedback = result => {
  if (result.cancelled) return null;
  if (!result.success) return { message: result.error || 'Could not share your Duo', type: 'ERROR' };
  return result.method === 'CLIPBOARD' ? { message: 'Duo text copied. Image sharing is unavailable here.', type: 'SUCCESS' } : null;
};
