import React, { useEffect, useState } from 'react';
import { Clock3, Dice5, ShieldCheck, Trash2, Trophy } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Input } from '../../../shared/components/Input';
import { Button } from '../../../shared/components/Button';
import { api } from '../../../lib/api';
import './FriendshipSettingsModal.css';
import { DuoIdentity } from '../../../shared/components/DuoIdentity';
import { DUO_PALETTES, DUO_COVERS } from '../../../lib/duoIdentity';
import { saveDuoIdentity } from '../../../services/presentationService';
import { usePresentationViewport } from '../../../shared/hooks/usePresentationViewport';

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

export const FriendshipSettingsModal = ({ isOpen, onClose, friendship, currentUserId, onRefresh, showToast }) => {
  usePresentationViewport(isOpen);
  const user1Id = friendship?.user1?._id || friendship?.user1;
  const isUser1 = String(user1Id) === String(currentUserId);
  const perspective = isUser1 ? friendship?.user1Perspective : friendship?.user2Perspective;
  const friend = isUser1 ? friendship?.user2 : friendship?.user1;
  const [limit, setLimit] = useState(7);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [identity, setIdentity] = useState({ name: '', palette: 'citron', cover: 'orbits' });
  const [identityBusy, setIdentityBusy] = useState(false);
  const [identityError, setIdentityError] = useState('');
  useEffect(() => { if (isOpen) { setIdentity({ name: friendship?.identity?.name || '', palette: friendship?.identity?.palette || 'citron', cover: friendship?.identity?.cover || 'orbits' }); setIdentityError(''); } }, [isOpen, friendship?._id]);

  useEffect(() => {
    if (isOpen) setLimit(perspective?.limit || 7);
  }, [isOpen, perspective?.limit, friendship?._id]);

  if (!friendship || !friend) return null;
  const id = friendship._id || friendship.id;
  const templateId = friendship.templateId || 'DONT_GHOST';
  const isCustom = templateId === 'CUSTOM';
  const isChaos = templateId === 'CHAOS';
  const modeName = MODE_NAMES[templateId] || MODE_NAMES.DONT_GHOST;
  const season = friendship.season || {};

  const updateLimit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.put(`/friendships/${id}/limit`, { limit });
      showToast?.('Grace period updated', 'SUCCESS');
      await onRefresh();
      onClose();
    } catch (error) {
      showToast?.(error.message || 'Could not update contract', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  const terminate = async () => {
    if (!window.confirm(`End your contract with ${friend.displayName}?`)) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/friendships/${id}`);
      showToast?.('Contract ended', 'SUCCESS');
      await onRefresh();
      onClose();
    } catch (error) {
      showToast?.(error.message || 'Could not end contract', 'ERROR');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Contract with ${friend.displayName}`} size="md">
      <div className="contract-settings-content">
        <form className="duo-style-form" onSubmit={async event => { event.preventDefault(); if (identityBusy) return; setIdentityBusy(true); setIdentityError(''); try { await saveDuoIdentity(id, identity); await onRefresh(); showToast?.('Your Duo has a new look.', 'SUCCESS'); onClose(); } catch (error) { setIdentityError(error.message); } finally { setIdentityBusy(false); } }}>
          <div><h3>Make this Duo yours.</h3><p>One shared name and look. Either of you can change it.</p></div>
          <DuoIdentity friendship={{ ...friendship, identity }} userId={currentUserId} variant="preview" />
          <Input label="Duo name" value={identity.name} maxLength={32} placeholder="Your inside joke goes here" onChange={event => setIdentity({ ...identity, name: event.target.value })} disabled={identityBusy} />
          <fieldset><legend>Color</legend><div className="duo-color-choices">{Object.entries(DUO_PALETTES).map(([key, palette]) => <button key={key} type="button" aria-pressed={identity.palette === key} aria-label={palette.name} style={{ '--swatch': palette.color }} disabled={identityBusy} onClick={() => setIdentity({ ...identity, palette: key })}><span />{palette.name}</button>)}</div></fieldset>
          <fieldset><legend>Cover</legend><div className="duo-cover-choices">{Object.entries(DUO_COVERS).map(([key, label]) => <button key={key} type="button" aria-pressed={identity.cover === key} disabled={identityBusy} onClick={() => setIdentity({ ...identity, cover: key })}>{label}</button>)}</div></fieldset>
          {identityError && <p role="alert" className="duo-style-error">{identityError}</p>}<Button variant="aura" type="submit" loading={identityBusy}>Save Duo look</Button>
        </form>
        <section className={`contract-rule-summary ${isChaos ? 'chaos' : ''}`}>
          <span className="contract-rule-icon">{isChaos ? <Dice5 size={18} /> : <ShieldCheck size={18} />}</span>
          <div>
            <strong>{modeName}</strong>
            <p>{perspective?.limit || 7}-day rule · Season {season.number || 1} · {season.status?.toLowerCase() || 'active'}</p>
          </div>
          <span className="contract-duo-badge"><Trophy size={12} /> Duo Lv. {friendship.duoLevel || 1}</span>
        </section>

        {isCustom ? (
          <form className="contract-settings-form" onSubmit={updateLimit}>
            <div><h3>Your grace period</h3><p>Set your check-in window.</p></div>
            <Input label="Days" type="number" min="1" max="30" icon={Clock3} value={limit} onChange={(event) => setLimit(Number(event.target.value))} required />
            <p className="settings-help">Debt starts after {limit} day{limit === 1 ? '' : 's'} of silence.</p>
            <Button variant="primary" type="submit" loading={loading}>Save rule</Button>
          </form>
        ) : (
          <section className="fixed-rule-panel">
            <Clock3 size={17} strokeWidth={1.8} />
            <div><strong>{perspective?.limit || 7}-day grace period</strong><p>Fixed for this season.</p></div>
          </section>
        )}

        {isChaos && (
          <section className="chaos-settings-panel">
            <div><span>CHAOS LEVEL</span><strong>{friendship.chaos?.level || 1} / 5</strong></div>
            <p>{friendship.chaos?.activeEvent ? `${friendship.chaos.activeEvent.name} is active now.` : friendship.chaos?.nextEventAt ? `Next anomaly can strike around ${new Date(friendship.chaos.nextEventAt).toLocaleString()}.` : 'Next anomaly unscheduled.'}</p>
          </section>
        )}

        <div className="contract-danger">
          <div><strong>End contract</strong><p>Ends the season and connection. Open bounty escrow is refunded. Can’t be undone.</p></div>
          <Button variant="danger" icon={Trash2} loading={deleteLoading} onClick={terminate}>End contract</Button>
        </div>
      </div>
    </Modal>
  );
};
