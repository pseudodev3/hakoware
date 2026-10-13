import { UserAvatar } from './UserAvatar';
import { duoLabel, duoStyle } from '../../lib/duoIdentity';
import './DuoIdentity.css';

export const DuoCover = ({ cover = 'orbits', className = '' }) => <svg className={`duo-cover ${className}`} viewBox="0 0 600 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  {cover === 'waves' ? <g fill="none" stroke="currentColor" strokeWidth="2">{[0, 30, 60, 90, 120, 150].map(offset => <path key={offset} d={`M-60 ${offset+80}C90 ${offset-80} 175 ${offset+280} 340 ${offset+80}S540 ${offset-80} 660 ${offset+80}`} />)}</g> : cover === 'rays' ? <g fill="none" stroke="currentColor" strokeWidth="2">{Array.from({ length: 18 }, (_, index) => <path key={index} d="M440 150L750 150" transform={`rotate(${index*20} 440 150)`} />)}<circle cx="440" cy="150" r="67" /><circle cx="440" cy="150" r="112" /></g> : <g fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="425" cy="160" rx="190" ry="86" transform="rotate(-30 425 160)" /><ellipse cx="425" cy="160" rx="190" ry="86" transform="rotate(30 425 160)" /><ellipse cx="425" cy="160" rx="190" ry="86" transform="rotate(90 425 160)" /><circle cx="425" cy="160" r="12" fill="currentColor" /><circle cx="570" cy="80" r="9" fill="currentColor" /></g>}
</svg>;

export const DuoIdentity = ({ friendship, userId, variant = 'card', children }) => {
  const ownFirst = String(friendship.user1?._id || friendship.user1) === String(userId);
  const own = ownFirst ? friendship.user1 : friendship.user2;
  const partner = ownFirst ? friendship.user2 : friendship.user1;
  return <section className={`duo-identity duo-identity-${variant}`} style={duoStyle(friendship)} aria-label="Your shared Duo">
    <DuoCover cover={friendship.identity?.cover} />
    <div className="duo-identity-people"><UserAvatar person={own} size="lg" decorative /><UserAvatar person={partner} size="lg" decorative /><span>You + {partner?.displayName || 'your friend'}</span></div>
    <div className="duo-identity-copy"><span className="duo-identity-kicker">Season {friendship.season?.number || 1} · Duo Lv. {friendship.duoLevel || 1}</span><h2>{duoLabel(friendship, `${own?.displayName || 'You'} + ${partner?.displayName || 'your friend'}`)}</h2>{children}</div>
  </section>;
};
