import React from 'react';
import { ArrowUpRight, Check, MessageCircle } from 'lucide-react';
import { UserAvatar } from '../../../shared/components/UserAvatar';
import { canCheckin, friendSummary, getContractSides } from '../contractState';
import './FriendCard.css';

export const FriendCard = ({ friendship, currentUserId, socialState, onOpen, onAction }) => {
  const { partner } = getContractSides(friendship, currentUserId);
  const summary = friendSummary(friendship, currentUserId);
  const available = canCheckin(friendship, currentUserId);
  const id = friendship._id || friendship.id;
  const latest = socialState?.lastMessage;
  const activity = socialState?.recentActivity?.[0];
  const preview = latest ? `${latest.mine ? 'You: ' : ''}${latest.text}` : activity?.text || 'Your space to stay in touch.';
  const unread = socialState?.unseenActivity?.length || 0;
  const moment = socialState?.moment;
  const momentLabel = moment?.type === 'SPLIT_DECISION' ? 'Split Decision' : moment?.type === 'DOUBLE_DARE' ? 'Double Dare' : 'Hot Seat';
  const shared = socialState?.firstMutualCheckin;
  return <article className={`friend-card ${summary.tone} ${unread ? 'has-new' : ''}`} aria-label={`Friend space with ${partner?.displayName || 'your friend'}`}>
    <button id={`friend-open-${id}`} className="friend-card-open" onClick={() => onOpen(friendship)}>
      <UserAvatar person={partner} size="lg" decorative />
      <span className="friend-card-copy">
        <span className="friend-card-heading"><strong>{partner?.displayName || 'Your friend'}</strong>{unread > 0 && <span className="friend-card-unread" aria-label={`${unread} new updates`}>{unread > 9 ? '9+' : unread}</span>}</span>
        {partner?.username && <span className="friend-card-handle">@{partner.username}</span>}
        <span className="friend-card-preview">{preview}</span>
      </span>
      <ArrowUpRight size={17} aria-hidden="true" />
    </button>
    <div className="friend-card-footer">
      <span className={`friend-card-state ${summary.tone}`}><i aria-hidden="true" />{summary.label}</span>
      {friendship.season?.status === 'COMPLETE' ? <button className="friend-card-checkin" onClick={() => onAction('RECAP', friendship)}>Recap</button> : <button className="friend-card-checkin" disabled={!available} onClick={() => onAction('CHECKIN', friendship)}><Check size={15} />{available ? 'Check in' : 'Checked in'}</button>}
    </div>
    {(shared || moment?.status === 'OPEN') && <button className="friend-card-moment" onClick={() => onOpen(friendship, { contract: moment?.status === 'OPEN' })}><MessageCircle size={15} /><span>{moment?.status === 'OPEN' ? `${momentLabel} · ${moment.answered ? 'Waiting on them' : 'Your turn'}` : 'Both showed up. Your first check-in together.'}</span><ArrowUpRight size={14} /></button>}
  </article>;
};
