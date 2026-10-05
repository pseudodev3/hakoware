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
  const newerActivity = activity && (!latest || (timestamp(activity.createdAt) ?? -Infinity) > (timestamp(latest.createdAt) ?? -Infinity));
  const preview = newerActivity ? activity.text : latest ? `${latest.mine ? 'You: ' : ''}${latest.text}` : 'Send the first message.';
  const previewAt = newerActivity ? activity.createdAt : latest?.createdAt;
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
        <span className="friend-card-identity">
          <UserAvatar person={partner} size="lg" decorative />
          <span className="friend-card-copy">
            <strong>{name}</strong>
            {partner?.username && <span className="friend-card-handle">@{partner.username}</span>}
          </span>
          {time && <time className="friend-card-time" dateTime={new Date(previewAt).toISOString()}>{time}</time>}
        </span>
        <span id={`friend-preview-${id}`} className={`friend-card-preview ${!latest && !activity ? 'is-empty' : ''}`}>
          {preview}
        </span>
        <span className="friend-card-conversation">
          <span>
            <MessageCircle size={16} strokeWidth={1.8} aria-hidden="true" />
            {latest || activity ? 'Open conversation' : 'Start conversation'}
            <ArrowRight size={14} aria-hidden="true" />
          </span>
          {unread > 0 && (
            <span id={`friend-updates-${id}`} className="friend-card-unread">
              {unread > 9 ? '9+' : unread} new
              <span className="friend-card-sr-only">
                {unread > 9 ? ` (${unread} total)` : ''} update{unread === 1 ? '' : 's'}
              </span>
            </span>
          )}
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
