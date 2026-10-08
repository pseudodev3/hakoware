import React from 'react';
import { ArrowRight, Check, MessageCircle } from 'lucide-react';
import { UserAvatar } from '../../../shared/components/UserAvatar';
import { canCheckin, friendSummary, getContractSides } from '../contractState';
import './FriendCard.css';

const timestamp = (value) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const activityTime = (value) => {
  const time = timestamp(value);
  if (time === null) return null;
  const age = Math.max(0, Date.now() - time);
  if (age < 60000) return 'now';
  if (age < 3600000) return `${Math.floor(age / 60000)}m`;
  if (age < 86400000) return `${Math.floor(age / 3600000)}h`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(time);
};

export const FriendCard = ({ friendship, currentUserId, socialState, onOpen, onAction }) => {
  const { partner, ownPerspective } = getContractSides(friendship, currentUserId);
  const name = partner?.displayName || 'Your friend';
  const summary = friendSummary(friendship, currentUserId);
  const available = canCheckin(friendship, currentUserId);
  const id = friendship._id || friendship.id;
  const latest = socialState?.lastMessage;
  const activity = socialState?.recentActivity?.[0];
  // Check-ins stay in the contract strip; a newer one should not bury a reply.
  const preview = latest ? `${latest.mine ? 'You: ' : ''}${latest.text}` : activity?.text || 'Send the first message.';
  const previewAt = latest?.createdAt || activity?.createdAt;
  const time = activityTime(previewAt);
  const unread = socialState?.unseenActivity?.length || 0;
  const moment = socialState?.moment;
  const momentLabel = moment?.type === 'SPLIT_DECISION' ? 'Split Decision' : moment?.type === 'DOUBLE_DARE' ? 'Double Dare' : 'Hot Seat';
  const shared = socialState?.firstMutualCheckin;
  const checkinLabel = available ? 'Check in' : friendship.status === 'ACTIVE' && ownPerspective ? 'Checked in' : 'Unavailable';
  return (
    <article
      className={`friend-card ${summary.tone} ${unread ? 'has-new' : ''}`}
      aria-label={`Friend space with ${name}`}
    >
      <button
        type="button"
        id={`friend-open-${id}`}
        className="friend-card-open"
        aria-label={`Open conversation with ${name}`}
        aria-describedby={`friend-preview-${id}${unread ? ` friend-updates-${id}` : ''}`}
        onClick={() => onOpen(friendship)}
      >
        <UserAvatar person={partner} size="lg" decorative />
        <span className="friend-card-copy">
          <span className="friend-card-identity">
            <strong>{name}</strong>
            {unread > 0 && <span id={`friend-updates-${id}`} className="friend-card-unread">New updates</span>}
            {time && <time className="friend-card-time" dateTime={new Date(previewAt).toISOString()}>{time}</time>}
          </span>
          <span id={`friend-preview-${id}`} className={`friend-card-preview ${!latest && !activity ? 'is-empty' : ''}`}>
            {preview}
          </span>
        </span>
      </button>
      <div className="friend-card-footer">
        <div className="friend-card-contract">
          <span className="friend-card-duo">Duo <b>Lv. {friendship.duoLevel || 1}</b></span>
          <span className={`friend-card-state ${summary.tone}`}>{summary.label}</span>
        </div>
        {friendship.season?.status === 'COMPLETE' ? (
          <button
            type="button"
            className="friend-card-checkin"
            aria-label={`Open recap with ${name}`}
            onClick={() => onAction('RECAP', friendship)}
          >
            Recap<ArrowRight size={14} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="friend-card-checkin"
            disabled={!available}
            aria-label={`${checkinLabel} with ${name}`}
            onClick={() => onAction('CHECKIN', friendship)}
          >
            {checkinLabel !== 'Unavailable' && <Check size={15} strokeWidth={2} aria-hidden="true" />}
            {checkinLabel}
          </button>
        )}
      </div>
      {(shared || moment?.status === 'OPEN') && (
        <button
          type="button"
          className="friend-card-moment"
          onClick={() => onOpen(friendship, { contract: moment?.status === 'OPEN' })}
        >
          <MessageCircle size={15} aria-hidden="true" />
          <span>
            {moment?.status === 'OPEN'
              ? `${momentLabel} · ${moment.answered ? 'Waiting on them' : 'Your turn'}`
              : 'Both showed up. Your first check-in together.'}
          </span>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      )}
    </article>
  );
};
