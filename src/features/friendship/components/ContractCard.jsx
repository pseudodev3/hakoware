import React, { useState } from 'react';
import { Bell, Check, Flame, Mic, MoreHorizontal, Share2, Trophy } from 'lucide-react';
import { useDebt } from '../../../hooks/useDebt';
import { getContractSides } from '../contractState';
import { shareHakoware } from '../../../lib/share';
import { buildChaosShareImage } from '../../../lib/chaosShare';
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

const normalStateDetail = (status) => {
  if (status.label === 'Clear') return 'You are both on track.';
  if (status.label === 'Due soon') return 'The check-in window is getting tight.';
  if (status.label === 'Recovering') return 'One more check-in to stabilize this contract.';
  if (status.label === 'Bankrupt') return 'Recovery actions are live.';
  return 'Check in to start pulling this contract back.';
};

const checkedInAfterSeasonStart = (perspective, seasonStartedAt) => {
  const seasonStart = new Date(seasonStartedAt || 0).getTime();
  const lastInteraction = new Date(perspective?.lastInteraction || 0).getTime();
  if (!(seasonStart > 0)) return lastInteraction > 0;
  return lastInteraction > seasonStart;
};

export const ContractCard = ({ friendship, currentUserId, onAction, compact = false, socialState = null }) => {
  const [chaosShareState, setChaosShareState] = useState('');
  const [socialBusy, setSocialBusy] = useState('');
  const reactionOptions = ['💀', '🤝', '👀', '😭'];
  const { partner: friend, ownPerspective: perspective, partnerPerspective, partnerDebt } = getContractSides(friendship, currentUserId);
  const stats = useDebt(perspective);
  if (!stats || !friend) return null;

  const status = statusCopy(stats);
  const name = friend.displayName || 'Contract partner';
  const handle = friend.username ? `@${friend.username}` : null;
  const mode = MODE_NAMES[friendship.templateId] || MODE_NAMES.DONT_GHOST;
  const level = friendship.duoLevel || 1;
  const xpProgress = duoProgress(friendship.duoXP || 0, level);
  const season = friendship.season || {};
  const seasonNumber = season.number || 1;
  const seasonDone = season.status === 'COMPLETE';
  const seasonTimeLeft = seasonDone ? 'Complete' : formatTimeLeft(season.endsAt || Date.now());
  const activeChaos = friendship.templateId === 'CHAOS' ? friendship.chaos?.activeEvent : null;
  const wantedUserId = friendship.chaos?.wantedUserId;
  const wanted = Boolean(wantedUserId && friendship.chaos?.wantedUntil);
  const wantedTargetsCurrentUser = wanted && String(wantedUserId) === String(currentUserId || '');
  const mostWanted = wanted && new Date(friendship.chaos.wantedUntil).getTime() <= Date.now();
  const ownCheckedInThisSeason = checkedInAfterSeasonStart(perspective, season.startedAt);
  const partnerCheckedInThisSeason = checkedInAfterSeasonStart(partnerPerspective, season.startedAt);
  const hoursSinceCheckin = Math.max(0, Date.now() - new Date(perspective?.lastInteraction || 0)) / 3600000;
  const checkedInToday = ownCheckedInThisSeason && hoursSinceCheckin < 20;
  const firstDuoCycleOpen = season.status === 'ACTIVE'
    && seasonNumber === 1
    && (!ownCheckedInThisSeason || !partnerCheckedInThisSeason);
  const partnerBankrupt = Boolean(partnerDebt?.isBankrupt) && !seasonDone;
  const chaosTargetsCurrentUser = activeChaos && String(activeChaos.targetUserId || '') === String(currentUserId || '');
  const partnerPossessive = name.endsWith('s') ? `${name}’` : `${name}’s`;
  const chaosRule = activeChaos?.name === 'Double Trouble'
    ? chaosTargetsCurrentUser
      ? 'Your next check-in gets 2× Duo XP +10. Beat the clock.'
      : `${partnerPossessive} next check-in gets 2× Duo XP +10. They need to beat the clock.`
    : activeChaos?.description || '';
  const chaosTargetLabel = chaosTargetsCurrentUser ? 'Your move' : `${name}'s move`;

  const runSocialAction = async (type, payload = null) => {
    if (socialBusy) return;
    setSocialBusy(type);
    try {
      await onAction?.(type, friendship, payload);
    } finally {
      setSocialBusy('');
    }
  };

  const shareChaos = async () => {
    if (!activeChaos || chaosShareState === 'PREPARING') return;
    setChaosShareState('PREPARING');

    try {
      const timeLeft = formatTimeLeft(activeChaos.expiresAt);
      const blob = await buildChaosShareImage({
        eventName: activeChaos.name,
        rule: chaosRule,
        targetLabel: chaosTargetLabel,
        timeLeft,
        partnerName: name,
        seasonNumber,
        duoLevel: level,
        duoTitle: friendship.duoTitle || 'New Contract'
      });
      const filename = `hakoware-${String(activeChaos.name || 'chaos').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      const result = await shareHakoware({
        source: 'CHAOS',
        title: `${activeChaos.name} · Hakoware`,
        text: `${activeChaos.name} is live on my Chaos Contract with ${name}. ${chaosRule}\n${window.location.origin}`,
        url: '',
        files: [file]
      });

      if (result.cancelled) {
        setChaosShareState('');
        return;
      }

      if (result.success) {
        setChaosShareState(result.method === 'CLIPBOARD' ? 'COPIED' : 'SHARED');
        window.setTimeout(() => setChaosShareState(''), 1800);
      } else {
        setChaosShareState('');
      }
    } catch (error) {
      console.error('Could not build Chaos share card:', error);
      setChaosShareState('');
    }
  };

  let displayState = {
    label: status.label,
    hero: stats.totalDebt > 0 ? `${stats.totalDebt} debt` : status.detail,
    detail: normalStateDetail(status),
    context: '',
    tone: status.tone,
    meta: [`${stats.limit}d rule`, `Season ${seasonNumber}`, seasonTimeLeft]
  };

  if (firstDuoCycleOpen) {
    if (!ownCheckedInThisSeason && !partnerCheckedInThisSeason) {
      displayState = {
        label: 'Season 1 live',
        hero: 'Make the first move',
        detail: `Check in now. Then ${name} can match you.`,
        context: '',
        tone: 'good',
        meta: [`${stats.limit}d rule`, 'First check-in']
      };
    } else if (!ownCheckedInThisSeason) {
      displayState = {
        label: 'Your move',
        hero: 'Check in',
        detail: `${name} already checked in. Match them.`,
        context: '',
        tone: 'good',
        meta: [`${stats.limit}d rule`, 'First check-in']
      };
    } else {
      displayState = {
        label: 'Waiting on them',
        hero: `${name}'s move`,
        detail: 'Your first check-in is in. Now they need theirs.',
        context: '',
        tone: 'good',
        meta: [`${stats.limit}d rule`, 'First check-in']
      };
    }
  }

  if (seasonDone) {
    displayState = {
      label: 'Season complete',
      hero: `Season ${seasonNumber} closed`,
      detail: 'Your report is ready.',
      context: `Duo Lv. ${level} · ${friendship.duoXP || 0} XP`,
      tone: 'due',
      meta: ['Complete']
    };
  } else if (activeChaos) {
    const timeLeft = formatTimeLeft(activeChaos.expiresAt);
    displayState = chaosTargetsCurrentUser
      ? {
          label: activeChaos.name === 'Double Trouble' ? 'Anomaly live' : activeChaos.name,
          hero: activeChaos.name === 'Double Trouble' ? '2× XP +10' : 'Your move',
          detail: chaosRule,
          context: timeLeft,
          tone: 'chaos',
          meta: [activeChaos.name, 'Your move']
        }
      : {
          label: activeChaos.name,
          hero: `${name}'s move`,
          detail: chaosRule,
          context: `${timeLeft} · you are still ${status.label}`,
          tone: 'chaos',
          meta: [`Season ${seasonNumber}`, 'Anomaly live']
        };
  } else if (wanted) {
    const consequence = friendship.chaos?.lastConsequence || 'Chaos consequence';
    const wantedLabel = mostWanted ? 'Most Wanted' : 'Wanted';
    displayState = wantedTargetsCurrentUser
      ? {
          label: stats.isBankrupt ? `${wantedLabel} · Bankrupt` : wantedLabel,
          hero: mostWanted ? 'Arena open' : formatTimeLeft(friendship.chaos.wantedUntil),
          detail: `${consequence}. A public Chaos bounty is on you.`,
          context: stats.isBankrupt
            ? 'Bankrupt · partner Aura can raise the bounty. Check in to escape.'
            : mostWanted
              ? 'Check in to escape.'
              : 'Check in before this escalates.',
          tone: 'chaos',
          meta: [`Season ${seasonNumber}`, wantedLabel, ...(stats.isBankrupt ? ['Bankrupt'] : [])]
        }
      : {
          label: wantedLabel,
          hero: `${name} is ${wantedLabel}`,
          detail: `${consequence}. Their Chaos bounty is live in the Arena.`,
          context: partnerBankrupt ? 'Bankrupt · partner Aura can raise the bounty.' : '',
          tone: 'chaos',
          meta: [`Season ${seasonNumber}`, wantedLabel]
        };
  } else if (partnerBankrupt) {
    displayState = {
      label: 'Partner bankrupt',
      hero: `${partnerDebt.totalDebt} debt`,
      detail: `${name} is bankrupt. Bounties + Claim are unlocked.`,
      context: 'Arena open',
      tone: 'chaos',
      meta: [`Season ${seasonNumber}`, seasonTimeLeft]
    };
  }

  const hideDuo = seasonDone || chaosTargetsCurrentUser;

  return (
    <article className={`contract-card ${status.tone} ${friendship.templateId === 'CHAOS' ? 'chaos-contract' : ''} ${activeChaos ? 'chaos-active' : ''} ${wanted ? 'wanted' : ''} ${partnerBankrupt ? 'partner-bankrupt' : ''} ${compact ? 'compact' : ''}`}>
      <div className="contract-main">
        <div className="contract-avatar" aria-hidden="true">
          {friend.avatar ? <img src={friend.avatar} alt="" /> : <span>{name[0]?.toUpperCase()}</span>}
        </div>

        <div className="contract-identity">
          <h3>{name}</h3>
          <p>{handle || mode}</p>
        </div>

        <div className="contract-head-meta" aria-label={`${mode}, season ${seasonNumber}`}>
          <span className={friendship.templateId === 'CHAOS' ? 'chaos' : ''}>{mode}</span>
          <span>Season {seasonNumber}</span>
        </div>

        <button className="contract-settings" onClick={() => onAction('SETTINGS', friendship)} aria-label={`More options for ${name}'s contract`}>
          <MoreHorizontal size={18} strokeWidth={1.6} />
        </button>
      </div>

      <div className="contract-live-state">
        <strong className={`contract-status ${displayState.tone}`}>{displayState.label}</strong>
        <div className="contract-state-hero">{displayState.hero}</div>
        <p className="contract-state-detail">{displayState.detail}</p>
        {displayState.context && <p className={`contract-state-context ${displayState.tone}`}>{displayState.context}</p>}
      </div>

      <div className="contract-meta-line">
        {displayState.meta.map((item, index) => (
          <React.Fragment key={`${item}-${index}`}>
            {index > 0 && <span className="contract-meta-separator" aria-hidden="true">·</span>}
            <span>{item}</span>
          </React.Fragment>
        ))}
      </div>

      {!hideDuo && (
        <div className="contract-duo">
          <div className="contract-duo-copy">
            <strong>Duo Lv. {level}</strong>
            <span>{friendship.duoTitle || 'New Contract'} · {friendship.duoXP || 0} XP</span>
          </div>
          <div className="duo-meter" aria-label={`Duo level progress ${xpProgress}%`}><span style={{ width: `${xpProgress}%` }} /></div>
        </div>
      )}

      {!compact && (
        <>
          <div className="contract-actions">
            <button type="button" className="contract-report-link" onClick={() => onAction('RECAP', friendship)}>
              {seasonDone ? 'Season report' : 'Report'}
            </button>

            <div className="contract-action-spacer" aria-hidden="true" />

            {!seasonDone && activeChaos && (
              <button
                type="button"
                className="contract-secondary-action"
                onClick={shareChaos}
                disabled={chaosShareState === 'PREPARING'}
              >
                <Share2 size={16} strokeWidth={1.6} />
                {chaosShareState === 'PREPARING' ? 'Preparing…' : chaosShareState === 'COPIED' ? 'Copied' : chaosShareState === 'SHARED' ? 'Shared' : 'Share'}
              </button>
            )}

            {!seasonDone && !activeChaos && partnerBankrupt && (
              <button type="button" className="contract-secondary-action danger" onClick={() => onAction('ARENA', friendship)}>
                <Flame size={16} strokeWidth={1.6} />
                Arena
              </button>
            )}

            {!seasonDone && !activeChaos && !partnerBankrupt && (
              checkedInToday ? (
                <button
                  type="button"
                  className="contract-secondary-action"
                  disabled={socialBusy === 'POKE' || socialState?.canPoke === false}
                  onClick={() => runSocialAction('POKE')}
                >
                  <Bell size={16} strokeWidth={1.6} />
                  {socialBusy === 'POKE' ? 'Poking…' : socialState?.canPoke === false ? 'Poked' : 'Poke'}
                </button>
              ) : (
                <button type="button" className="contract-secondary-action" onClick={() => onAction('VOICE_CHECKIN', friendship)}>
                  <Mic size={16} strokeWidth={1.6} />
                  Voice
                </button>
              )
            )}

            {seasonDone ? (
              <button type="button" className="contract-primary-action" onClick={() => onAction('RECAP', friendship)}>
                <Trophy size={16} strokeWidth={1.6} />
                View recap
              </button>
            ) : (
              <button type="button" className="contract-primary-action" disabled={checkedInToday} onClick={() => onAction('CHECKIN', friendship)}>
                <Check size={16} strokeWidth={1.6} />
                {checkedInToday ? 'Checked in' : 'Check in'}
              </button>
            )}
          </div>

          {!seasonDone && socialState?.latestPartnerCheckin && (
            <div className="contract-reaction-row">
              <span>{name} checked in · react</span>
              <div className="contract-reactions" aria-label={`React to ${name}'s check-in`}>
                {reactionOptions.map((reaction) => (
                  <button
                    type="button"
                    key={reaction}
                    className={socialState?.reaction === reaction ? 'active' : ''}
                    disabled={Boolean(socialBusy)}
                    onClick={() => runSocialAction('REACT', reaction)}
                    aria-label={`React ${reaction}`}
                    aria-pressed={socialState?.reaction === reaction}
                  >
                    {reaction}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </article>
  );
};
