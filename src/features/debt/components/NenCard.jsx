import React from 'react';
import { Check, MessageCircle, Mic, Settings } from 'lucide-react';
import { useDebt } from '../../../hooks/useDebt';
import { Button } from '../../../shared/components/Button';
import './NenCard.css';

const statusCopy = (stats) => {
  if (stats.isBankrupt) return { label: 'Critical', detail: `${stats.totalDebt} debt`, tone: 'critical' };
  if (stats.totalDebt > 0) return { label: 'Overdue', detail: `${stats.totalDebt} debt`, tone: 'overdue' };
  const daysLeft = Math.max(0, stats.limit - stats.daysMissed);
  if (daysLeft <= 1) return { label: 'Due soon', detail: daysLeft === 0 ? 'Due today' : '1 day left', tone: 'due' };
  return { label: 'Good', detail: `${daysLeft} days left`, tone: 'good' };
};

export const NenCard = ({ friendship, currentUserId, onAction, compact = false }) => {
  const user1Id = friendship.user1?._id || friendship.user1;
  const isUser1 = String(user1Id) === String(currentUserId);
  const perspective = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
  const friend = isUser1 ? friendship.user2 : friendship.user1;
  const stats = useDebt(perspective);
  if (!stats || !friend) return null;

  const status = statusCopy(stats);
  const name = friend.displayName || 'Contract partner';
  const meterWidth = Math.min(100, (stats.daysMissed / Math.max(1, stats.limit * 2)) * 100);
  const hoursSinceCheckin = Math.max(0, Date.now() - new Date(perspective?.lastInteraction || 0)) / 3600000;
  const checkedInToday = hoursSinceCheckin < 20;

  return (
    <article className={`contract-card ${status.tone} ${compact ? 'compact' : ''}`}>
      <div className="contract-main">
        <div className="contract-avatar" aria-hidden="true">
          {friend.avatar ? <img src={friend.avatar} alt="" /> : <span>{name[0]?.toUpperCase()}</span>}
        </div>
        <div className="contract-identity">
          <div className="contract-name-row">
            <h3>{name}</h3>
            <span className={`contract-status ${status.tone}`}>{status.label}</span>
          </div>
          <p>{status.detail} · {stats.limit}-day grace</p>
        </div>
        <button className="contract-settings" onClick={() => onAction('SETTINGS', friendship)} aria-label={`Contract settings for ${name}`}>
          <Settings size={17} strokeWidth={1.8} />
        </button>
      </div>

      <div className="contract-meter" aria-hidden="true">
        <span style={{ width: `${meterWidth}%` }} />
      </div>

      {!compact && (
        <div className="contract-actions">
          <Button variant="secondary" icon={Mic} onClick={() => onAction('VOICE_CHECKIN', friendship)}>
            Voice
          </Button>
          <Button
            variant="aura"
            icon={checkedInToday ? Check : MessageCircle}
            disabled={checkedInToday}
            onClick={() => onAction('CHECKIN', friendship)}
          >
            {checkedInToday ? 'Checked in' : 'Check in'}
          </Button>
        </div>
      )}
    </article>
  );
};
