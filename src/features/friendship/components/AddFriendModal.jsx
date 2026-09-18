import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, AtSign, BookOpen, Check, Clock3, Copy, Dice5, Dumbbell, Hammer, HeartHandshake, LockKeyhole, MessageCircle, MoreHorizontal, Share2, SlidersHorizontal, UsersRound } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Input } from '../../../shared/components/Input';
import { Button } from '../../../shared/components/Button';
import { sendFriendInvitation } from '../../../services/friendshipService';
import { shareHakoware } from '../../../lib/share';
import './AddFriendModal.css';

const FALLBACK_TEMPLATES = [
  { id: 'DONT_GHOST', name: "Don't Ghost Me", tagline: 'The classic.', description: 'Three days of silence before debt starts.', limit: 3, seasonDays: 30, difficulty: 2 },
  { id: 'GYM_PACT', name: 'Gym Pact', tagline: 'No disappearing after leg day.', description: 'A tighter two-day window for training partners.', limit: 2, seasonDays: 30, difficulty: 3 },
  { id: 'STUDY_ARC', name: 'Study Arc', tagline: 'Lock in together.', description: 'Daily-ish pressure for study partners.', limit: 1, seasonDays: 30, difficulty: 4 },
  { id: 'LOCK_IN', name: '30-Day Lock-In', tagline: 'No excuses for a month.', description: 'A one-day grace period for 30 days.', limit: 1, seasonDays: 30, difficulty: 5 },
  { id: 'LONG_DISTANCE', name: 'Long Distance', tagline: 'Stay present from far away.', description: 'A four-day window with bonus voice XP.', limit: 4, seasonDays: 45, difficulty: 2 },
  { id: 'BUILD_IN_PUBLIC', name: 'Build in Public', tagline: 'Ship something. Say something.', description: 'Daily check-ins for builders.', limit: 1, seasonDays: 30, difficulty: 4 },
  { id: 'CHAOS', name: 'Chaos Contract', tagline: 'The rules will not stay still.', description: 'Surprise anomalies rewrite the contract temporarily.', limit: 3, seasonDays: 30, difficulty: 5, chaos: true },
  { id: 'CUSTOM', name: 'Custom', tagline: 'Make your own problem.', description: 'Choose your own grace period.', limit: 7, seasonDays: 30, difficulty: 0 }
];

const PRIMARY_MODE_IDS = new Set(['DONT_GHOST', 'LONG_DISTANCE', 'LOCK_IN', 'CHAOS']);

const ICONS = {
  DONT_GHOST: MessageCircle,
  GYM_PACT: Dumbbell,
  STUDY_ARC: BookOpen,
  LOCK_IN: LockKeyhole,
  LONG_DISTANCE: HeartHandshake,
  BUILD_IN_PUBLIC: Hammer,
  CHAOS: Dice5,
  CUSTOM: SlidersHorizontal
};

const stepTitle = (step, shareInvite) => {
  if (shareInvite) return 'Invite ready';
  if (step === 1) return 'Choose a person';
  if (step === 2) return 'Choose a contract';
  return 'Review contract';
};

export const AddFriendModal = ({ isOpen, onClose, onRefresh, showToast, templates = [] }) => {
  const modes = templates.length ? templates : FALLBACK_TEMPLATES;
  const [step, setStep] = useState(1);
  const [friendIdentifier, setFriendIdentifier] = useState('');
  const [limit, setLimit] = useState(7);
  const [templateId, setTemplateId] = useState('DONT_GHOST');
  const [showMoreModes, setShowMoreModes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stepError, setStepError] = useState('');
  const [shareInvite, setShareInvite] = useState(null);
  const [copied, setCopied] = useState(false);

  const selected = useMemo(() => modes.find((mode) => mode.id === templateId) || modes[0], [modes, templateId]);
  const visibleModes = useMemo(
    () => showMoreModes ? modes : modes.filter((mode) => PRIMARY_MODE_IDS.has(mode.id)),
    [modes, showMoreModes]
  );

  const selectMode = (mode) => {
    setTemplateId(mode.id);
    setStepError('');
    if (mode.id !== 'CUSTOM') setLimit(mode.limit);
  };

  const reset = () => {
    setStep(1);
    setFriendIdentifier('');
    setLimit(7);
    setTemplateId('DONT_GHOST');
    setShowMoreModes(false);
    setStepError('');
    setShareInvite(null);
    setCopied(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const continueFromPerson = () => {
    const value = friendIdentifier.trim();
    if (!value) {
      setStepError('Enter their @username or email first.');
      return;
    }
    setFriendIdentifier(value);
    setStepError('');
    setStep(2);
  };

  const continueFromContract = () => {
    if (!selected) {
      setStepError('Choose a contract first.');
      return;
    }
    if (selected.id === 'CUSTOM' && (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 30)) {
      setStepError('Grace period must be between 1 and 30 days.');
      return;
    }
    setStepError('');
    setStep(3);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setStepError('');
    const effectiveLimit = selected.id === 'CUSTOM' ? limit : selected.limit;
    const result = await sendFriendInvitation(friendIdentifier, effectiveLimit, selected.id);
    if (result.success && result.inviteReady) {
      setShareInvite({ ...result, modeName: selected.name });
      await onRefresh?.();
      showToast?.('Contract ready to share', 'SUCCESS');
    } else if (result.success) {
      showToast?.(`${selected.name} request sent`, 'SUCCESS');
      reset();
      await onRefresh?.();
      onClose();
    } else {
      setStepError(result.error || 'Could not send contract request');
    }
    setLoading(false);
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(shareInvite.inviteUrl);
      setCopied(true);
      showToast?.('Invite link copied', 'SUCCESS');
    } catch {
      showToast?.('Could not copy the invite link', 'ERROR');
    }
  };

  const share = async () => {
    if (!shareInvite) return;
    const shareText = shareInvite.requiresSignup
      ? `I sent you a ${shareInvite.modeName || 'Hakoware'} contract. Join Hakoware with ${shareInvite.recipientEmail} and it’ll be waiting for you.`
      : `I sent you a ${shareInvite.modeName || 'Hakoware'} contract on Hakoware. Open it and it’ll be waiting for you.`;
    const result = await shareHakoware({
      source: 'INVITE',
      title: 'Hakoware contract',
      text: shareText,
      url: shareInvite.inviteUrl
    });

    if (result.cancelled) return;
    if (result.success && result.method === 'CLIPBOARD') {
      setCopied(true);
      showToast?.('Invite copied - send it anywhere', 'SUCCESS');
    } else if (!result.success) {
      showToast?.(result.error || 'Could not share the invite', 'ERROR');
    }
  };

  const effectiveLimit = selected?.id === 'CUSTOM' ? limit : selected?.limit;

  return (
    <Modal isOpen={isOpen} onClose={close} title={stepTitle(step, shareInvite)} size="lg">
      {shareInvite ? (
        <div className="invite-share-state">
          <div className="invite-share-icon"><Check size={20} strokeWidth={2} /></div>
          <div className="invite-share-copy">
            <strong>{shareInvite.modeName || 'Contract'} is waiting.</strong>
            <p>Share this link too. When <b>{shareInvite.recipientLabel}</b> opens Hakoware, the request will be waiting.</p>
          </div>
          <button type="button" className="invite-link" onClick={copyInvite} aria-label="Copy Hakoware invite link">
            <span>{shareInvite.inviteUrl}</span>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <div className="new-contract-actions">
            <Button type="button" variant="secondary" onClick={close}>Done</Button>
            <Button type="button" variant="aura" icon={Share2} onClick={share}>Share invite</Button>
          </div>
        </div>
      ) : (
        <div className="contract-onboarding">
          <div className="contract-stepper" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((item) => (
              <span key={item} className={item === step ? 'active' : item < step ? 'complete' : ''}>
                <b>{String(item).padStart(2, '0')}</b>
                <small>{item === 1 ? 'Person' : item === 2 ? 'Contract' : 'Confirm'}</small>
              </span>
            ))}
          </div>

          {step === 1 && (
            <section className="contract-step-panel">
              <div className="contract-step-intro">
                <span className="contract-step-icon"><UsersRound size={20} strokeWidth={1.8} /></span>
                <div>
                  <p className="mode-kicker">Start with someone real</p>
                  <h3>Who are you putting under contract?</h3>
                  <p>Use an @username if they already play Hakoware, or their email if you are inviting them in.</p>
                </div>
              </div>

              <Input
                label="Username or email"
                type="text"
                placeholder="@username or friend@example.com"
                icon={AtSign}
                value={friendIdentifier}
                onChange={(event) => {
                  setFriendIdentifier(event.target.value);
                  setStepError('');
                }}
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                required
              />

              {stepError && <p className="contract-step-error" role="alert">{stepError}</p>}

              <div className="new-contract-actions single-primary">
                <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
                <Button type="button" variant="aura" icon={ArrowRight} onClick={continueFromPerson}>Choose the rules</Button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="contract-step-panel">
              <div className="mode-intro">
                <div><p className="mode-kicker">Playing with {friendIdentifier}</p><strong>What kind of contract is this?</strong></div>
                <span>Every mode runs on seasons + Duo XP</span>
              </div>

              <div className="template-grid" role="radiogroup" aria-label="Contract type">
                {visibleModes.map((mode) => {
                  const Icon = ICONS[mode.id] || MessageCircle;
                  const active = selected?.id === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`template-option ${active ? 'active' : ''} ${mode.chaos ? 'chaos' : ''}`}
                      onClick={() => selectMode(mode)}
                    >
                      <span className="template-icon"><Icon size={18} strokeWidth={1.8} /></span>
                      <span className="template-copy"><strong>{mode.name}</strong><small>{mode.tagline}</small></span>
                      {mode.chaos && <span className="chaos-tag">CHAOS</span>}
                    </button>
                  );
                })}
              </div>

              {!showMoreModes && modes.some((mode) => !PRIMARY_MODE_IDS.has(mode.id)) && (
                <button type="button" className="more-contracts-button" onClick={() => setShowMoreModes(true)}>
                  <MoreHorizontal size={16} /> More contracts
                </button>
              )}

              <div className={`mode-rule-card ${selected?.chaos ? 'chaos' : ''}`}>
                <div>
                  <strong>{selected?.name}</strong>
                  <p>{selected?.description}</p>
                </div>
                <div className="mode-rule-stats">
                  <span><b>{effectiveLimit}d</b> grace</span>
                  <span><b>{selected?.seasonDays}d</b> season</span>
                  <span><b>{selected?.difficulty || '-'}/5</b> heat</span>
                </div>
              </div>

              {selected?.id === 'CUSTOM' && (
                <>
                  <Input
                    label="Grace period"
                    type="number"
                    min="1"
                    max="30"
                    icon={Clock3}
                    value={limit}
                    onChange={(event) => {
                      setLimit(Number(event.target.value));
                      setStepError('');
                    }}
                    required
                  />
                  <p className="contract-field-note">Debt starts after {limit} day{limit === 1 ? '' : 's'} without a check-in.</p>
                </>
              )}

              {stepError && <p className="contract-step-error" role="alert">{stepError}</p>}

              <div className="new-contract-actions">
                <Button type="button" variant="secondary" icon={ArrowLeft} onClick={() => setStep(1)}>Person</Button>
                <Button type="button" variant={selected?.chaos ? 'danger' : 'aura'} icon={ArrowRight} onClick={continueFromContract}>Review contract</Button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="contract-step-panel">
              <div className="contract-confirm">
                <p className="mode-kicker">Ready to send</p>
                <div className="contract-confirm-duo">
                  <span>{friendIdentifier}</span>
                  <b>×</b>
                  <span>You</span>
                </div>
                <h3>{selected?.name}</h3>
                <p>{selected?.description}</p>
                <div className="contract-confirm-rules">
                  <span><b>{effectiveLimit} days</b><small>before debt starts</small></span>
                  <span><b>{selected?.seasonDays} days</b><small>in Season 1</small></span>
                  <span><b>{selected?.difficulty || '-'}/5</b><small>pressure level</small></span>
                </div>
                <div className="contract-confirm-note">
                  Season 1 begins when they accept. Successful check-ins build Duo XP. Missing the {effectiveLimit}-day window starts debt.
                </div>
              </div>

              {stepError && <p className="contract-step-error" role="alert">{stepError}</p>}

              <div className="new-contract-actions">
                <Button type="button" variant="secondary" icon={ArrowLeft} onClick={() => setStep(2)}>Back</Button>
                <Button type="button" variant={selected?.chaos ? 'danger' : 'aura'} loading={loading} onClick={handleSubmit}>
                  Send contract
                </Button>
              </div>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
};
