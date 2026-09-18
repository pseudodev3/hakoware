import React, { useMemo, useState } from 'react';
import { BookOpen, Check, Clock3, Copy, Dice5, Dumbbell, Hammer, HeartHandshake, LockKeyhole, Mail, MessageCircle, Share2, SlidersHorizontal } from 'lucide-react';
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

export const AddFriendModal = ({ isOpen, onClose, onRefresh, showToast, templates = [] }) => {
  const modes = templates.length ? templates : FALLBACK_TEMPLATES;
  const [email, setEmail] = useState('');
  const [limit, setLimit] = useState(7);
  const [templateId, setTemplateId] = useState('DONT_GHOST');
  const [loading, setLoading] = useState(false);
  const [shareInvite, setShareInvite] = useState(null);
  const [copied, setCopied] = useState(false);

  const selected = useMemo(() => modes.find((mode) => mode.id === templateId) || modes[0], [modes, templateId]);

  const selectMode = (mode) => {
    setTemplateId(mode.id);
    if (mode.id !== 'CUSTOM') setLimit(mode.limit);
  };

  const reset = () => {
    setEmail('');
    setLimit(7);
    setTemplateId('DONT_GHOST');
    setShareInvite(null);
    setCopied(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    const effectiveLimit = selected.id === 'CUSTOM' ? limit : selected.limit;
    const result = await sendFriendInvitation(email, effectiveLimit, selected.id);
    if (result.success && result.inviteReady) {
      setShareInvite({ ...result, modeName: selected.name });
      await onRefresh?.();
      showToast?.('Invite saved — share it with them', 'SUCCESS');
    } else if (result.success) {
      showToast?.(`${selected.name} request sent`, 'SUCCESS');
      reset();
      await onRefresh?.();
      onClose();
    } else {
      showToast?.(result.error || 'Could not send contract request', 'ERROR');
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
    const text = `I sent you a ${shareInvite.modeName || 'Hakoware'} contract. Open Hakoware with ${shareInvite.recipientEmail} and it’ll be waiting for you.`;
    const result = await shareHakoware({
      source: 'INVITE',
      title: 'Hakoware contract',
      text,
      url: shareInvite.inviteUrl
    });

    if (result.cancelled) return;
    if (result.success && result.method === 'CLIPBOARD') {
      setCopied(true);
      showToast?.('Invite copied — send it anywhere', 'SUCCESS');
    } else if (!result.success) {
      showToast?.(result.error || 'Could not share the invite', 'ERROR');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={shareInvite ? 'Invite ready' : 'Choose a contract'} size="lg">
      {shareInvite ? (
        <div className="invite-share-state">
          <div className="invite-share-icon"><Check size={20} strokeWidth={2} /></div>
          <div className="invite-share-copy">
            <strong>{shareInvite.modeName || 'Contract'} is waiting.</strong>
            <p>Share this link too. When <b>{shareInvite.recipientEmail}</b> opens Hakoware, the request will be waiting.</p>
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
        <form className="new-contract-form" onSubmit={handleSubmit}>
          <div className="mode-intro">
            <div><p className="mode-kicker">Game mode</p><strong>What kind of trouble are you starting?</strong></div>
            <span>Every mode has seasons + Duo XP</span>
          </div>

          <div className="template-grid" role="radiogroup" aria-label="Contract type">
            {modes.map((mode) => {
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

          <div className={`mode-rule-card ${selected?.chaos ? 'chaos' : ''}`}>
            <div>
              <strong>{selected?.name}</strong>
              <p>{selected?.description}</p>
            </div>
            <div className="mode-rule-stats">
              <span><b>{selected?.id === 'CUSTOM' ? limit : selected?.limit}d</b> grace</span>
              <span><b>{selected?.seasonDays}d</b> season</span>
              <span><b>{selected?.difficulty || '—'}/5</b> heat</span>
            </div>
          </div>

          <Input
            label="Who are you challenging?"
            type="email"
            placeholder="friend@example.com"
            icon={Mail}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          {selected?.id === 'CUSTOM' && (
            <>
              <Input
                label="Grace period"
                type="number"
                min="1"
                max="30"
                icon={Clock3}
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                required
              />
              <p className="contract-field-note">Debt starts after {limit} day{limit === 1 ? '' : 's'} without a check-in.</p>
            </>
          )}

          <div className="new-contract-actions">
            <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" variant={selected?.chaos ? 'danger' : 'aura'} loading={loading}>Send {selected?.name}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
