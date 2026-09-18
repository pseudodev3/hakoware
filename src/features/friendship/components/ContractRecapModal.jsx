import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Flame, Mic, RefreshCw, Share2, Sparkles, Trophy, UsersRound, Zap } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { getContractRecap, runContractBack } from '../../../services/friendshipService';
import './ContractRecapModal.css';

const formatTemplate = (value = '') => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

const seasonGrade = (recap) => {
  if (!recap?.season || !recap?.template) return '—';
  const length = Number(recap.template.seasonDays || recap.season.lengthDays || 30);
  const limit = Math.max(1, Number(recap.template.limit) || 3);
  const expected = Math.max(2, Math.ceil(length / limit) * 2);
  const ratio = Math.max(0, (recap.season.checkins || 0) / expected - (recap.season.chaosFailed || 0) * .04);
  if (ratio >= .95) return 'S';
  if (ratio >= .8) return 'A';
  if (ratio >= .62) return 'B';
  if (ratio >= .45) return 'C';
  return 'D';
};

const recapText = (recap) => {
  const names = (recap.players || []).map((player) => player.displayName).filter(Boolean).join(' × ');
  return [
    `HAKOWARE // WEEKLY REPORT`,
    names,
    `${recap.weekly?.checkins || 0} check-ins · ${recap.weekly?.voiceNotes || 0} voice`,
    `${recap.weekly?.chaosSurvived || 0} chaos survived · ${recap.weekly?.chaosFailed || 0} failed`,
    `+${recap.weekly?.xpGained || 0} Duo XP · Duo Lv. ${recap.duo?.level || 1}`,
    `“${recap.weekly?.line || 'Still under contract.'}”`
  ].join('\n');
};

const buildShareImage = async (recap) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create recap image');

  ctx.fillStyle = '#0a0a08';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createRadialGradient(180, 0, 0, 180, 0, 700);
  gradient.addColorStop(0, 'rgba(231,179,90,.24)');
  gradient.addColorStop(1, 'rgba(231,179,90,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, 760);

  const names = (recap.players || []).map((player) => player.displayName).filter(Boolean).join(' × ') || 'Hakoware Duo';
  const weekly = recap.weekly || {};

  ctx.fillStyle = '#e7b35a';
  ctx.font = '700 28px system-ui, -apple-system, sans-serif';
  ctx.fillText('HAKOWARE // WEEKLY REPORT', 84, 106);

  ctx.fillStyle = '#f7f4ec';
  ctx.font = '700 66px system-ui, -apple-system, sans-serif';
  const split = names.length > 24 ? names.split(' × ') : [names];
  split.forEach((line, index) => ctx.fillText(line, 84, 215 + index * 76));

  ctx.fillStyle = '#777268';
  ctx.font = '500 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${recap.template?.name || formatTemplate(recap.template?.id)} · Season ${recap.season?.number || 1}`, 84, 350);

  const metrics = [
    ['CHECK-INS', weekly.checkins || 0],
    ['VOICE', weekly.voiceNotes || 0],
    ['CHAOS CLEARED', weekly.chaosSurvived || 0],
    ['DUO XP', `+${weekly.xpGained || 0}`]
  ];

  metrics.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 84 + column * 460;
    const y = 500 + row * 210;
    ctx.fillStyle = '#777268';
    ctx.font = '700 21px system-ui, -apple-system, sans-serif';
    ctx.fillText(label, x, y);
    ctx.fillStyle = '#f7f4ec';
    ctx.font = '700 76px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(String(value), x, y + 86);
  });

  ctx.strokeStyle = 'rgba(247,244,236,.12)';
  ctx.beginPath();
  ctx.moveTo(84, 900);
  ctx.lineTo(996, 900);
  ctx.stroke();

  ctx.fillStyle = '#e7b35a';
  ctx.font = '700 25px system-ui, -apple-system, sans-serif';
  ctx.fillText(`DUO LEVEL ${recap.duo?.level || 1} // ${(recap.duo?.title || 'New Contract').toUpperCase()}`, 84, 980);

  ctx.fillStyle = '#f7f4ec';
  ctx.font = '600 40px system-ui, -apple-system, sans-serif';
  const line = `“${weekly.line || 'Still alive. Still under contract.'}”`;
  const words = line.split(' ');
  let current = '';
  let y = 1060;
  for (const word of words) {
    const next = `${current}${current ? ' ' : ''}${word}`;
    if (ctx.measureText(next).width > 850 && current) {
      ctx.fillText(current, 84, y);
      current = word;
      y += 52;
    } else current = next;
  }
  if (current) ctx.fillText(current, 84, y);

  ctx.fillStyle = '#777268';
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('hakoware.vercel.app', 84, 1270);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create recap image')), 'image/png'));
};

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
      setTab('week');
      load();
    } else setRecap(null);
  }, [isOpen, friendshipId]);

  const grade = useMemo(() => seasonGrade(recap), [recap]);
  const names = useMemo(() => (recap?.players || []).map((player) => player.displayName).filter(Boolean).join(' × '), [recap]);

  const share = async () => {
    if (!recap) return;
    setBusy(true);
    try {
      const blob = await buildShareImage(recap);
      const file = new File([blob], 'hakoware-weekly-recap.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Hakoware weekly recap', text: recap.weekly?.line, files: [file] });
      } else {
        await navigator.clipboard.writeText(recapText(recap));
        showToast?.('Recap copied — share it anywhere', 'SUCCESS');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') showToast?.(error.message || 'Could not share recap', 'ERROR');
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
    <Modal isOpen={isOpen} onClose={onClose} title="Contract report" size="lg">
      {loading && !recap ? (
        <div className="recap-loading"><RefreshCw className="animate-spin" size={20} /><span>Building report…</span></div>
      ) : recap ? (
        <div className="recap-wrap">
          <section className={`recap-hero ${recap.template?.chaos ? 'chaos' : ''}`}>
            <div className="recap-hero-top">
              <span className="recap-label">HAKOWARE // {tab === 'week' ? 'WEEKLY REPORT' : `SEASON ${recap.season?.number || 1}`}</span>
              <span className="recap-mode">{recap.template?.name}</span>
            </div>
            <h2>{names || 'Contract duo'}</h2>
            <p>{tab === 'week' ? recap.weekly?.line : `Season grade ${grade}. ${recap.duo?.title}.`}</p>

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
        <div className="recap-loading"><span>No report available yet.</span></div>
      )}
    </Modal>
  );
};
