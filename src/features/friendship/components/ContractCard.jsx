import React, { useState } from 'react';
import { ArrowRight, BarChart3, Check, Dice5, Flame, MessageCircle, Mic, Settings, Share2, TriangleAlert, Trophy } from 'lucide-react';
import { useDebt } from '../../../hooks/useDebt';
import { Button } from '../../../shared/components/Button';
import { getContractSides } from '../contractState';
import { shareHakoware } from '../../../lib/share';
import './ContractCard.css';

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
  if (stats.isBankrupt) return { label: 'Bankrupt', detail: `${stats.totalDebt} debt`, tone: 'critical' };
  if (stats.isRecovering) return { label: 'Recovering', detail: `${stats.totalDebt} debt · 1 check-in left`, tone: 'overdue' };
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

const formatTimeLeft = (date) => {
  const remaining = new Date(date).getTime() - Date.now();
  if (remaining <= 0) return 'ending now';
  const hours = Math.ceil(remaining / 3600000);
  if (hours < 24) return `${hours}h left`;
  return `${Math.ceil(hours / 24)}d left`;
};

export const ContractCard = ({ friendship, currentUserId, onAction, compact = false }) => {
  const [chaosShared, setChaosShared] = useState(false);
  const { partner: friend, ownPerspective: perspective, partnerDebt } = getContractSides(friendship, currentUserId);
  const stats = useDebt(perspective);
  if (!stats || !friend) return null;

  const status = statusCopy(stats);
  const name = friend.displayName || 'Contract partner';
  const handle = friend.username ? `@${friend.username}` : null;
  const mode = MODE_NAMES[friendship.templateId] || MODE_NAMES.DONT_GHOST;
  const level = friendship.duoLevel || 1;
  const xpProgress = duoProgress(friendship.duoXP || 0, level);
  const season = friendship.season || {};
  const seasonDone = season.status === 'COMPLETE';
  const activeChaos = friendship.templateId === 'CHAOS' ? friendship.chaos?.activeEvent : null;
  const wanted = friendship.chaos?.wantedUntil && new Date(friendship.chaos.wantedUntil).getTime() > Date.now();
  const hoursSinceCheckin = Math.max(0, Date.now() - new Date(perspective?.lastInteraction || 0)) / 3600000;
  const checkedInToday = hoursSinceCheckin < 20;
  const partnerBankrupt = Boolean(partnerDebt?.isBankrupt) && !seasonDone;

  const shareChaos = async () => {
    if (!activeChaos) return;
    const result = await shareHakoware({
      source: 'CHAOS',
      title: 'Hakoware Chaos event',
      text: `${name} and I got hit with ${activeChaos.name} on Hakoware. ${activeChaos.description}`,
      url: window.location.origin
    });

    if (result.success && result.method === 'CLIPBOARD') {
      setChaosShared(true);
      window.setTimeout(() => setChaosShared(false), 1800);
    }
  };

  return (
    <article className={`contract-card ${status.tone} ${friendship.templateId === 'CHAOS' ? 'chaos-contract' : ''} ${wanted ? 'wanted' : ''} ${partnerBankrupt ? 'partner-bankrupt' : ''} ${compact ? 'compact' : ''}`}>
      <div className="contract-main">
        <div className="contract-avatar" aria-hidden="true">
          {friend.avatar ? <img src={friend.avatar} alt="" /> : <span>{name[0]?.toUpperCase()}</span>}
        </div>
        <div className="contract-identity">
          <h3>{name}</h3>
          <p>{handle || mode}</p>
        </div>
        <button className="contract-settings" onClick={() => onAction('SETTINGS', friendship)} aria-label={`Contract settings for ${name}`}>
          <Settings size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div className="contract-meta-line">
        <span className={friendship.templateId === 'CHAOS' ? 'chaos' : ''}>{friendship.templateId === 'CHAOS' && <Dice5 size={11} strokeWidth={2} />} {mode}</span>
        <span>Season {season.number || 1}</span>
        <span>{seasonDone ? 'Complete' : formatTimeLeft(season.endsAt || Date.now())}</span>
      </div>

      {partnerBankrupt && (
        <div className="partner-bankruptcy-alert">
          <TriangleAlert size={16} strokeWidth={2} />
          <div>
            <strong>{name} is bankrupt</strong>
            <span>{partnerDebt.totalDebt} debt · Bounties + Claim unlocked</span>
          </div>
          <button type="button" onClick={() => onAction('ARENA', friendship)}>
            Arena <ArrowRight size={13} strokeWidth={2} />
          </button>
        </div>
      )}

      {activeChaos && (
        <div className="contract-anomaly">
          <Flame size={15} strokeWidth={1.9} />
          <div><strong>{activeChaos.name}</strong><span>{formatTimeLeft(activeChaos.expiresAt)} · {activeChaos.description}</span></div>
          <button type="button" className="contract-anomaly-share" onClick={shareChaos}>
            <Share2 size={12} strokeWidth={1.9} /> {chaosShared ? 'Copied' : 'Share'}
          </button>
        </div>
      )}

      {wanted && !activeChaos && (
        <div className="contract-wanted">
          <Flame size={14} strokeWidth={1.9} />
          <span>WANTED · {friendship.chaos?.lastConsequence || 'Chaos consequence'} · {formatTimeLeft(friendship.chaos.wantedUntil)}</span>
        </div>
      )}

      <div className="contract-state-row">
        <div className="contract-state-copy">
          <strong className={`contract-status ${status.tone}`}>{seasonDone ? 'Season complete' : status.label}</strong>
          <span>{seasonDone ? 'Report ready' : `${status.detail} · ${stats.limit}d rule`}</span>
        </div>
        <div className="duo-summary">
          <strong>Lv. {level}</strong>
          <span>{friendship.duoTitle || 'New Contract'} · {friendship.duoXP || 0} XP</span>
        </div>
      </div>

      <div className="duo-meter" aria-label={`Duo level progress ${xpProgress}%`}><span style={{ width: `${xpProgress}%` }} /></div>

      {!compact && (
        <div className="contract-actions">
          <button type="button" className="contract-report-link" onClick={() => onAction('RECAP', friendship)}>
            <BarChart3 size={14} strokeWidth={1.8} /> {seasonDone ? 'View report' : 'Report'}
          </button>
          {seasonDone ? (
            <Button variant="aura" icon={Trophy} onClick={() => onAction('RECAP', friendship)}>View recap</Button>
          ) : (
            <div className="contract-primary-actions">
              <Button variant="secondary" icon={Mic} disabled={checkedInToday} onClick={() => onAction('VOICE_CHECKIN', friendship)}>Voice</Button>
              <Button variant="aura" icon={checkedInToday ? Check : MessageCircle} disabled={checkedInToday} onClick={() => onAction('CHECKIN', friendship)}>
                {checkedInToday ? 'Checked in' : 'Check in'}
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
};
