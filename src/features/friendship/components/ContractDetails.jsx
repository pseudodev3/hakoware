import { useRef, useState } from 'react';
import { Check, Flame, MessageCircle, Mic, MoreHorizontal, Send, Share2, Trophy, X } from 'lucide-react';
import { useDebt } from '../../../hooks/useDebt';
import { getContractSides } from '../contractState';
import { UserAvatar } from '../../../shared/components/UserAvatar';
import { shareHakoware } from '../../../lib/share';
import { buildChaosShareImage } from '../../../lib/chaosShare';
import { activityLabel } from '../../../lib/circleActivity';
import './ContractDetails.css';

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

const formatMomentTime = (date) => {
  const remaining = new Date(date).getTime() - Date.now();
  if (remaining <= 0) return 'now';
  const minutes = Math.ceil(remaining / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.ceil(minutes / 60)}h`;
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

export const ContractDetails = ({ friendship, currentUserId, onAction, socialState = null, onActivitySeen, onOpenConversation }) => {
  const [chaosShareState, setChaosShareState] = useState('');
  const [duoSharing, setDuoSharing] = useState(false);
  const shareThisDuo = async () => {
    if (duoSharing) return;
    setDuoSharing(true);
    try { await onAction('SHARE_DUO', friendship); }
    finally { setDuoSharing(false); }
  };
  const [socialBusy, setSocialBusy] = useState('');
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [openedActivity, setOpenedActivity] = useState(null);
  const cardRef = useRef(null);
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
  const moment = socialState?.moment || null;
  const newActivity = socialState?.unseenActivity?.[0] || null;
  const firstMutualCheckin = socialState?.firstMutualCheckin || null;
  const urgentState = Boolean(seasonDone || activeChaos || wanted || partnerBankrupt
    || stats.isBankrupt || stats.isRecovering || stats.totalDebt > 0);
  const ownPerson = String(friendship.user1?._id || friendship.user1) === String(currentUserId)
    ? friendship.user1 : friendship.user2;

  const openActivity = (item) => {
    if (!item) return;
    setOpenedActivity(item);
    if (item.id === socialState?.latestPartnerCheckin?.eventId) setReplyOpen(true);
    cardRef.current?.focus({ preventScroll: true });
    onActivitySeen?.([item]);
  };
  const momentTitle = moment?.type === 'SPLIT_DECISION'
    ? 'Split Decision'
    : moment?.type === 'DOUBLE_DARE'
      ? 'Double Dare'
      : 'Hot Seat';

  const runSocialAction = async (type, payload = null) => {
    if (socialBusy) return null;
    setSocialBusy(type);
    try {
      return await onAction?.(type, friendship, payload);
    } finally {
      setSocialBusy('');
    }
  };

  const submitReply = async (event) => {
    event.preventDefault();
    const text = replyText.trim();
    if (!text || socialState?.reply || socialBusy) return;
    const result = await runSocialAction('REPLY', text);
    if (result?.success) {
      setReplyText('');
      setReplyOpen(false);
    }
  };

  const partnerCheckinStatus = socialState?.latestPartnerCheckin?.checkinStatus
    ? String(socialState.latestPartnerCheckin.checkinStatus).toLowerCase().replace('_', ' ')
    : null;

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

  if (firstDuoCycleOpen && !urgentState) {
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

  if (newActivity && !urgentState && !firstDuoCycleOpen && !moment) {
    displayState = {
      ...displayState,
      hero: activityLabel(newActivity.type),
      label: status.detail,
      tone: 'good'
    };
  }

  const seasonStartedAt = new Date(season.startedAt || 0).getTime();
  const seasonDay = seasonStartedAt > 0
    ? Math.max(1, Math.floor((Date.now() - seasonStartedAt) / 86400000) + 1)
    : 1;
  const currentXp = Number(friendship.duoXP) || 0;
  const nextXp = 50 * Math.pow(level, 2);
  const hasPartnerCheckin = !seasonDone && Boolean(socialState?.latestPartnerCheckin);
  const exceptionalState = Boolean(
    activeChaos
    || wanted
    || partnerBankrupt
    || stats.isBankrupt
    || stats.isRecovering
    || stats.totalDebt > 0
    || seasonDone
    || moment
  );

  const runHomeSecondary = () => {
    if (hasPartnerCheckin) {
      if (!replyOpen) {
        const checkin = socialState.recentActivity?.find((item) => item.id === socialState.latestPartnerCheckin.eventId);
        if (checkin) onActivitySeen?.([checkin]);
      }
      setReplyOpen((value) => !value);
      return;
    }
    if (activeChaos) {
      void shareChaos();
      return;
    }
    if (partnerBankrupt) {
      onAction('ARENA', friendship);
      return;
    }
    if (checkedInToday || seasonDone) {
      onOpenConversation?.();
      return;
    }
    onAction('VOICE_CHECKIN', friendship);
  };

  const secondaryIcon = hasPartnerCheckin
    ? <MessageCircle size={18} strokeWidth={1.65} />
    : activeChaos
      ? <Share2 size={18} strokeWidth={1.65} />
      : partnerBankrupt
        ? <Flame size={18} strokeWidth={1.65} />
        : (checkedInToday || seasonDone)
          ? <MessageCircle size={18} strokeWidth={1.65} />
          : <Mic size={18} strokeWidth={1.65} />;

  const secondaryLabel = hasPartnerCheckin
    ? `Respond to ${name}`
    : activeChaos
      ? 'Share Chaos'
      : partnerBankrupt
        ? 'Open Arena'
        : (checkedInToday || seasonDone)
          ? 'Open conversation'
          : 'Voice check-in';

  return (
    <article ref={cardRef} id={`contract-${friendship._id || friendship.id}`} tabIndex={-1} aria-label={`Contract with ${name}`} className={`contract-details ${status.tone} ${friendship.templateId === 'CHAOS' ? 'chaos-contract' : ''} ${activeChaos ? 'chaos-active' : ''} ${wanted ? 'wanted' : ''} ${partnerBankrupt ? 'partner-bankrupt' : ''}`}>
      <UserAvatar person={friend} size="lg" className="contract-detail-avatar" decorative />

      <div className="contract-detail-content">
        <div className="contract-detail-name-row">
          {friendship.identity?.name && <span className="eyebrow">{friendship.identity.name}</span>}
          <h3>{name}</h3>
        </div>
        <p className="contract-detail-line">{displayState.hero}</p>
        <div className={`contract-detail-state ${displayState.tone}`}>
          <i aria-hidden="true" />
          <span>{displayState.label}</span>
          {handle && <small>{handle}</small>}
        </div>

        <div className="contract-detail-chips" aria-label={`${mode}, day ${seasonDay}, season ${seasonNumber}`}>
          <span className={friendship.templateId === 'CHAOS' ? 'chaos' : ''}>{mode}</span>
          <span>Day {seasonDay}</span>
          <span>Season {seasonNumber}</span>
        </div>

        <div className="contract-detail-duo">
          <div className="contract-detail-meter" aria-label={`Duo XP progress ${xpProgress}%`}>
            <span style={{ width: `${xpProgress}%` }} />
          </div>
          <div className="contract-detail-duo-copy">
            <small>Duo XP</small>
            <strong>{currentXp.toLocaleString()} / {nextXp.toLocaleString()}</strong>
          </div>
        </div>
        <button type="button" className="contract-detail-share" disabled={duoSharing} onClick={() => void shareThisDuo()}><Share2 size={15} />{duoSharing ? 'Preparing your Duo…' : 'Share Duo'}</button>
      </div>

      <div className="contract-detail-actions" aria-label={`Actions for ${name}`}>
        <button
          type="button"
          className={`contract-detail-action secondary ${replyOpen ? 'active' : ''}`}
          onClick={runHomeSecondary}
          aria-label={secondaryLabel}
          title={secondaryLabel}
        >
          {secondaryIcon}
        </button>

        {seasonDone ? (
          <button
            type="button"
            className="contract-detail-action primary"
            onClick={() => onAction('RECAP', friendship)}
            aria-label="View season recap"
            title="View season recap"
          >
            <Trophy size={18} strokeWidth={1.65} />
          </button>
        ) : (
          <button
            type="button"
            className="contract-detail-action primary"
            disabled={checkedInToday}
            onClick={() => onAction('CHECKIN', friendship)}
            aria-label={checkedInToday ? 'Already checked in' : 'Check in'}
            title={checkedInToday ? 'Already checked in' : 'Check in'}
          >
            <Check size={18} strokeWidth={1.7} />
          </button>
        )}

        <button
          type="button"
          className="contract-detail-action"
          onClick={() => onAction('SETTINGS', friendship)}
          aria-label={`More options for ${name}'s contract`}
          title="More"
        >
          <MoreHorizontal size={19} strokeWidth={1.6} />
        </button>
      </div>

      {firstMutualCheckin && !urgentState && (
        <div className="contract-detail-first-duo">
          <div className="contract-detail-pair" aria-hidden="true">
            <UserAvatar person={ownPerson} size="sm" decorative />
            <UserAvatar person={friend} size="sm" decorative />
          </div>
          <div className="contract-detail-first-copy">
            <small>First check-in together</small>
            <strong>Both showed up.</strong>
            <p>You + {name} · {firstMutualCheckin.xp} Duo XP together.</p>
          </div>
          {hasPartnerCheckin && <button type="button" className="contract-detail-first-respond" onClick={() => {
            setReplyOpen(true);
            const checkin = socialState.recentActivity?.find((item) => item.id === socialState.latestPartnerCheckin.eventId);
            onActivitySeen?.([firstMutualCheckin, ...(checkin ? [checkin] : [])]);
          }}>React or reply</button>}
          <button type="button" className="contract-detail-first-dismiss" onClick={() => {
            cardRef.current?.focus({ preventScroll: true });
            onActivitySeen?.([firstMutualCheckin]);
          }} aria-label="Dismiss first shared check-in"><X size={16} strokeWidth={1.6} /></button>
        </div>
      )}

      {newActivity && !(firstMutualCheckin && !urgentState && hasPartnerCheckin
        && newActivity.id === socialState.latestPartnerCheckin.eventId) && (
        <button type="button" className="contract-detail-discovery" onClick={() => openActivity(newActivity)}>
          <span><strong>{activityLabel(newActivity.type)}</strong><small>{newActivity.text}</small></span>

        </button>
      )}

      {openedActivity && (
        <div className="contract-detail-arrival">
          <p>{openedActivity.text}</p>
          <button type="button" onClick={() => {
            setOpenedActivity(null);
            cardRef.current?.focus({ preventScroll: true });
          }} aria-label="Close activity"><X size={16} strokeWidth={1.6} /></button>
        </div>
      )}

      {exceptionalState && (
        <div className={`contract-detail-exception ${displayState.tone}`}>
          <div>
            <strong>{moment && !urgentState ? momentTitle : displayState.label}</strong>
            <p>{moment && !urgentState ? moment.prompt : displayState.detail}</p>
            {(!moment || urgentState) && displayState.context && <small>{displayState.context}</small>}
            {moment && urgentState && <small>{momentTitle} · {moment.prompt}</small>}
          </div>

          {moment?.status === 'OPEN' && moment.type !== 'DOUBLE_DARE' && !moment.answered && (
            <div className="contract-detail-moment-actions">
              {(moment.options || []).map((option) => (
                <button
                  type="button"
                  key={option}
                  disabled={socialBusy === 'MOMENT_RESPONSE'}
                  onClick={() => runSocialAction('MOMENT_RESPONSE', { momentId: moment.id, value: option })}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {moment?.status === 'OPEN' && moment.type === 'DOUBLE_DARE' && ['PICK', 'RESPOND'].includes(moment.phase) && (
            <div className="contract-detail-moment-actions">
              {(moment.options || []).map((option) => (
                <button
                  type="button"
                  key={option}
                  disabled={socialBusy === 'MOMENT_RESPONSE'}
                  onClick={() => runSocialAction('MOMENT_RESPONSE', { momentId: moment.id, value: option })}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {moment?.status === 'OPEN' && moment.answered && (
            <small className="contract-detail-waiting">{moment.partnerAnswered ? 'Revealing…' : `Waiting on ${name}.`}</small>
          )}
          {moment?.status === 'RESOLVED' && moment.type !== 'DOUBLE_DARE' && (
            <div className="contract-detail-reveal">
              <span>You <strong>{moment.yourAnswer || '—'}</strong></span>
              <span>{name} <strong>{moment.partnerAnswer || '—'}</strong></span>
            </div>
          )}
          {moment?.type === 'DOUBLE_DARE' && moment.dare && (
            <div className="contract-detail-reveal">
              <span>“{moment.dare}”</span>
              {moment.status === 'RESOLVED' && <strong>{moment.startedByYou ? `${name} ${moment.outcome === 'Accept' ? 'accepted' : 'passed'}.` : `You ${moment.outcome === 'Accept' ? 'accepted' : 'passed'}.`}</strong>}
            </div>
          )}
        </div>
      )}

      {replyOpen && hasPartnerCheckin && (
        <div className="contract-detail-social">
          <div className="contract-detail-social-head">
            <div>
              <strong>{name} checked in{partnerCheckinStatus ? ` · ${partnerCheckinStatus}` : ''}</strong>
              {socialState.latestPartnerCheckin.note && <p>“{socialState.latestPartnerCheckin.note}”</p>}
            </div>
            {socialState.reply && <small>You replied.</small>}
          </div>

          <div className="contract-detail-social-actions">
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

            {!socialState.reply && (
              <form className="contract-detail-reply-form" onSubmit={submitReply}>
                <input
                  type="text"
                  value={replyText}
                  maxLength={40}
                  onChange={(event) => setReplyText(event.target.value.slice(0, 40))}
                  placeholder="tiny reply…"
                  aria-label={`Reply to ${name}'s check-in`}
                  autoComplete="off"
                />
                <button type="submit" disabled={!replyText.trim() || socialBusy === 'REPLY'} aria-label="Send reply">
                  <Send size={15} strokeWidth={1.8} />
                </button>
              </form>
            )}

            {socialState.reply && <span className="contract-detail-reply-sent">“{socialState.reply.text}”</span>}
          </div>
        </div>
      )}
    </article>
  );
};
