import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Flame, Mic, RefreshCw, Share2, Sparkles, Trophy, UsersRound, Zap } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { getContractRecap, runContractBack } from '../../../services/friendshipService';
import { shareHakoware } from '../../../lib/share';
import { buildRecapShareCard, recapText, seasonGrade } from '../../../lib/recapShareCard';
import './ContractRecapModal.css';
import { DuoCover } from '../../../shared/components/DuoIdentity';
import { duoStyle } from '../../../lib/duoIdentity';

export const ContractRecapModal = ({ isOpen, onClose, friendship, onRefresh, showToast }) => {
  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('week');

  const friendshipId = friendship?._id || friendship?.id;

  const load = async () => {
    if (!friendshipId) return;
    setLoading(true);
    try {
      setRecap(await getContractRecap(friendshipId));
    } catch (error) {
      showToast?.(error.message || 'Could not load recap', 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTab(friendship?.season?.status === 'COMPLETE' ? 'season' : 'week');
      load();
    } else setRecap(null);
  }, [isOpen, friendshipId]);

  const grade = useMemo(() => seasonGrade(recap), [recap]);
  const names = useMemo(() => (recap?.players || []).map((player) => player.displayName).filter(Boolean).join(' × '), [recap]);

  const share = async () => {
    if (!recap) return;
    setBusy(true);
    try {
      const blob = await buildRecapShareCard(recap, tab, friendship?.identity);
      const file = new File([blob], `hakoware-${tab}-recap.png`, { type: 'image/png' });
      const result = await shareHakoware({
        source: tab === 'season' && recap.season?.status === 'COMPLETE' ? 'SEASON_COMPLETE' : 'RECAP',
        title: 'Hakoware recap',
        text: recapText(recap, tab, friendship?.identity?.name),
        url: window.location.origin,
        files: [file]
      });

      if (result.cancelled) return;
      if (result.success && result.method === 'CLIPBOARD') {
        showToast?.('Recap copied.', 'SUCCESS');
      } else if (!result.success) {
        showToast?.(result.error || 'Could not share recap', 'ERROR');
      }
    } catch (error) {
      showToast?.(error.message || 'Could not share recap', 'ERROR');
    } finally {
      setBusy(false);
    }
  };

  const runBack = async () => {
    setBusy(true);
    try {
      await runContractBack(friendshipId);
      showToast?.('Season restarted · +50 Duo XP', 'SUCCESS');
      await onRefresh?.();
      await load();
    } catch (error) {
      showToast?.(error.message || 'Could not run it back', 'ERROR');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Recap" size="lg">
      {loading && !recap ? (
        <div className="recap-loading"><RefreshCw className="animate-spin" size={20} /><span>Building recap…</span></div>
      ) : recap ? (
        <div className="recap-wrap">
          <section style={duoStyle(friendship)} className={`recap-hero ${recap.template?.chaos ? 'chaos' : ''}`}>
            <DuoCover cover={friendship?.identity?.cover} />
            <div className="recap-hero-top">
              <span className="recap-label">HAKOWARE · {tab === 'week' ? 'THIS WEEK' : `SEASON ${recap.season?.number || 1}`}</span>
              <span className="recap-mode">{recap.template?.name}</span>
            </div>
            <h2>{friendship?.identity?.name || names || 'Contract duo'}</h2>
            <p>{tab === 'week' ? recap.weekly?.line : `Grade ${grade} · ${recap.duo?.title}`}</p>

            <div className="duo-level-row">
              <div><UsersRound size={17} strokeWidth={1.8} /><span>Duo Lv. {recap.duo?.level || 1}</span><strong>{recap.duo?.title}</strong></div>
              <span>{recap.duo?.xp || 0} XP</span>
            </div>
            <div className="duo-progress"><span style={{ width: `${recap.duo?.progress || 0}%` }} /></div>
          </section>

          <div className="recap-tabs" role="tablist" aria-label="Report range">
            <button role="tab" aria-selected={tab === 'week'} className={tab === 'week' ? 'active' : ''} onClick={() => setTab('week')}>This week</button>
            <button role="tab" aria-selected={tab === 'season'} className={tab === 'season' ? 'active' : ''} onClick={() => setTab('season')}>Season</button>
          </div>

          {tab === 'week' ? (
            <div className="recap-stat-grid">
              <div><CalendarDays size={17} /><span>Check-ins</span><strong>{recap.weekly?.checkins || 0}</strong></div>
              <div><Mic size={17} /><span>Voice</span><strong>{recap.weekly?.voiceNotes || 0}</strong></div>
              <div><Flame size={17} /><span>Chaos cleared</span><strong>{recap.weekly?.chaosSurvived || 0}</strong></div>
              <div><Zap size={17} /><span>Duo XP</span><strong>+{recap.weekly?.xpGained || 0}</strong></div>
            </div>
          ) : (
            <div className="season-report">
              <div className="season-grade"><span>GRADE</span><strong>{grade}</strong></div>
              <div className="season-lines">
                <div><span>Check-ins</span><strong>{recap.season?.checkins || 0}</strong></div>
                <div><span>Voice notes</span><strong>{recap.season?.voiceNotes || 0}</strong></div>
                <div><span>Chaos survived</span><strong>{recap.season?.chaosSurvived || 0}</strong></div>
                <div><span>Chaos failed</span><strong>{recap.season?.chaosFailed || 0}</strong></div>
                <div><span>Bankruptcies</span><strong>{recap.season?.bankruptcies || 0}</strong></div>
                <div><span>XP gained</span><strong>+{recap.season?.xpGained || 0}</strong></div>
              </div>
            </div>
          )}

          {recap.chaos && (
            <section className="recap-chaos-state">
              <Sparkles size={18} strokeWidth={1.8} />
              <div><strong>Chaos Level {recap.chaos.level || 1}</strong><span>{recap.chaos.activeEvent ? `${recap.chaos.activeEvent.name} is live now.` : recap.chaos.lastConsequence ? `Last consequence: ${recap.chaos.lastConsequence}` : 'No active anomaly.'}</span></div>
            </section>
          )}

          <div className="recap-actions">
            {recap.season?.status === 'COMPLETE' ? (
              <Button variant="aura" icon={Trophy} loading={busy} onClick={runBack}>Run it back</Button>
            ) : (
              <Button variant="secondary" icon={RefreshCw} loading={loading} onClick={load}>Refresh</Button>
            )}
            <Button variant="primary" icon={Share2} loading={busy} onClick={share}>Share recap</Button>
          </div>
        </div>
      ) : (
        <div className="recap-loading"><span>No recap yet.</span></div>
      )}
    </Modal>
  );
};
