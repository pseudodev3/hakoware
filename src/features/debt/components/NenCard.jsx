import React from 'react';
import { BarChart3, Check, Clock3, Dice5, Flame, MessageCircle, Mic, Settings, Trophy, UsersRound } from 'lucide-react';
import { useDebt } from '../../../hooks/useDebt';
import { Button } from '../../../shared/components/Button';
import './NenCard.css';

const MODE_NAMES = {
  DONT_GHOST: "Don't Ghost Me",
  GYM_PACT: 'Gym Pact',
  STUDY_ARC: 'Study Arc',
  LOCK_IN: '30-Day Lock-In',
  LONG_DISTANCE: 'Long Distance',
  BUILD_IN_PUBLIC: 'Build in Public',
  CHAOS: 'Chaos Contract',
  CUSTOM: 'Custom'
};

const statusCopy = (stats) => {
  if (stats.isBankrupt) return { label: 'Critical', detail: `${stats.totalDebt} debt`, tone: 'critical' };
  if (stats.totalDebt > 0) return { label: 'Overdue', detail: `${stats.totalDebt} debt`, tone: 'overdue' };
  const daysLeft = Math.max(0, stats.limit - stats.daysMissed);
  if (daysLeft <= 1) return { label: 'Due soon', detail: daysLeft === 0 ? 'Due today' : '1 day left', tone: 'due' };
  return { label: 'Clear', detail: `${daysLeft} days left`, tone: 'good' };
};

const duoProgress = (xp = 0, level = 1) => {
  const floor = 50 * Math.pow(Math.max(0, level - 1), 2);
  const next = 50 * Math.pow(level, 2);
  return Math.max(0, Math.min(100, Math.round(((xp - floor) / Math.max(1, next - floor)) * 100)));
};

const seasonProgress = (season) => {
  if (!season?.startedAt || !season?.endsAt) return 0;
  const start = new Date(season.startedAt).getTime();
  const end = new Date(season.endsAt).getTime();
  return Math.max(0, Math.min(100, ((Date.now() - start) / Math.max(1, end - start)) * 100));
};

const formatTimeLeft = (date) => {
  const remaining = new Date(date).getTime() - Date.now();
  if (remaining <= 0) return 'ending now';
  const hours = Math.ceil(remaining / 3600000);
  if (hours < 24) return `${hours}h left`;
  return `${Math.ceil(hours / 24)}d left`;
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
  const mode = MODE_NAMES[friendship.templateId] || MODE_NAMES.DONT_GHOST;
  const level = friendship.duoLevel || 1;
  const xpProgress = duoProgress(friendship.duoXP || 0, level);
  const season = friendship.season || {};
  const seasonDone = season.status === 'COMPLETE';
  const activeChaos = friendship.templateId === 'CHAOS' ? friendship.chaos?.activeEvent : null;
  const wanted = friendship.chaos?.wantedUntil && new Date(friendship.chaos.wantedUntil).getTime() > Date.now();
  const hoursSinceCheckin = Math.max(0, Date.now() - new Date(perspective?.lastInteraction || 0)) / 3600000;
  const checkedInToday = hoursSinceCheckin < 20;

  return (
    <article className={`contract-card ${status.tone} ${friendship.templateId === 'CHAOS' ? 'chaos-contract' : ''} ${wanted ? 'wanted' : ''} ${compact ? 'compact' : ''}`}>
      <div className="contract-mode-row">
        <span className="contract-mode">{friendship.templateId === 'CHAOS' && <Dice5 size={12} strokeWidth={2} />} {mode}</span>
        <span className="season-chip">S{season.number || 1} · {seasonDone ? 'Complete' : formatTimeLeft(season.endsAt || Date.now())}</span>
      </div>

      <div className="contract-main">
        <div className="contract-avatar" aria-hidden="true">
          {friend.avatar ? <img src={friend.avatar} alt="" /> : <span>{name[0]?.toUpperCase()}</span>}
        </div>
        <div className="contract-identity">
          <div className="contract-name-row">
            <h3>{name}</h3>
            <span className={`contract-status ${status.tone}`}>{seasonDone ? 'Season clear' : status.label}</span>
          </div>
          <p>{seasonDone ? 'Final report ready' : `${status.detail} · ${stats.limit}-day rule`}</p>
        </div>
        <button className="contract-settings" onClick={() => onAction('SETTINGS', friendship)} aria-label={`Contract settings for ${name}`}>
          <Settings size={17} strokeWidth={1.8} />
        </button>
      </div>

      {activeChaos && (
        <div className="contract-anomaly">
          <Flame size={16} strokeWidth={1.9} />
          <div><strong>{activeChaos.name}</strong><span>{formatTimeLeft(activeChaos.expiresAt)} · {activeChaos.description}</span></div>
        </div>
      )}

      {wanted && !activeChaos && (
        <div className="contract-wanted">
          <Flame size={15} strokeWidth={1.9} />
          <span>WANTED · {friendship.chaos?.lastConsequence || 'Chaos consequence'} · {formatTimeLeft(friendship.chaos.wantedUntil)}</span>
        </div>
      )}

      <div className="contract-game-row">
        <div className="duo-state">
          <span className="game-row-icon"><UsersRound size={14} strokeWidth={1.9} /></span>
          <div><span>Duo Lv. {level}</span><strong>{friendship.duoTitle || 'New Contract'}</strong></div>
        </div>
        <div className="duo-xp"><b>{friendship.duoXP || 0}</b> XP</div>
      </div>
      <div className="duo-meter" aria-label={`Duo level progress ${xpProgress}%`}><span style={{ width: `${xpProgress}%` }} /></div>

      <div className="season-meter-row">
        <span><Clock3 size={12} /> Season {season.number || 1}</span>
        <span>{Math.round(seasonProgress(season))}%</span>
      </div>
      <div className="season-meter"><span style={{ width: `${seasonProgress(season)}%` }} /></div>

      {!compact && (
        <div className="contract-actions">
          <Button variant="ghost" icon={BarChart3} onClick={() => onAction('RECAP', friendship)}>Report</Button>
          {seasonDone ? (
            <Button variant="aura" icon={Trophy} onClick={() => onAction('RECAP', friendship)}>Season recap</Button>
          ) : (
            <>
              <Button variant="secondary" icon={Mic} disabled={checkedInToday} onClick={() => onAction('VOICE_CHECKIN', friendship)}>Voice</Button>
              <Button variant="aura" icon={checkedInToday ? Check : MessageCircle} disabled={checkedInToday} onClick={() => onAction('CHECKIN', friendship)}>
                {checkedInToday ? 'Checked in' : 'Check in'}
              </Button>
            </>
          )}
        </div>
      )}
    </article>
  );
};
