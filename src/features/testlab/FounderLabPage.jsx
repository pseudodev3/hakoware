import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Clock3, Crown, FlaskConical, Moon, Repeat2, RotateCcw, Share2, Skull, Sparkles, Sun, SwitchCamera, Target, UserPlus, UsersRound, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../shared/components/Button';
import { applyTheme, getInitialTheme } from '../../lib/theme';
import {
  beginTestSession,
  completeTestSeason,
  createTestContract,
  createTestPlayer,
  enterTestPlayer,
  getFounderLab,
  resetFounderLab,
  setTestAura,
  setTestContractState,
  triggerTestChaos
} from '../../services/testLabService';
import { getGrowthMetrics } from '../../services/growthService';
import './FounderLabPage.css';

const idOf = (value) => String(value?._id || value || '');
const nameOf = (value) => value?.displayName || 'Test player';

export const FounderLabPage = ({ showToast }) => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(getInitialTheme);
  const [lab, setLab] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorDetail, setErrorDetail] = useState('');
  const [busy, setBusy] = useState('');
  const [name, setName] = useState('Test A');
  const [user1Id, setUser1Id] = useState('');
  const [user2Id, setUser2Id] = useState('');
  const [templateId, setTemplateId] = useState('DONT_GHOST');
  const [targets, setTargets] = useState({});
  const [chaosTypes, setChaosTypes] = useState({});
  const [growth, setGrowth] = useState(null);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const load = async ({ quiet = false } = {}) => {
    try {
      const data = await getFounderLab();
      setLab(data);
      setErrorDetail('');
      setStatus('ready');
      return data;
    } catch (error) {
      if (error.status === 403 || error.message === 'Founder access only') {
        setStatus('denied');
        return null;
      }

      const detail = error.status === 404
        ? 'The Founder Lab backend route is not deployed yet. Railway needs the latest main build.'
        : error.status === 500
          ? 'The Founder Lab backend returned a server error. Check the latest Railway deployment log.'
          : error.message || 'Could not reach the Hakoware API.';

      setErrorDetail(detail);
      setStatus('error');
      if (!quiet) showToast?.(detail, 'ERROR');
      return null;
    }
  };

  useEffect(() => { load({ quiet: true }); }, []);
  useEffect(() => {
    getGrowthMetrics().then(setGrowth).catch((error) => {
      console.warn('Could not load growth metrics:', error.message);
    });
  }, []);

  useEffect(() => {
    if (!lab?.players?.length) return;
    setUser1Id((value) => value || idOf(lab.players[0]));
    setUser2Id((value) => value || idOf(lab.players[1] || lab.players[0]));
  }, [lab?.players]);

  const playersById = useMemo(
    () => new Map((lab?.players || []).map((player) => [idOf(player), player])),
    [lab?.players]
  );

  const run = async (key, action, successMessage) => {
    setBusy(key);
    try {
      await action();
      if (successMessage) showToast?.(successMessage, 'SUCCESS');
      await load({ quiet: true });
    } catch (error) {
      showToast?.(error.message || 'Founder Lab action failed', 'ERROR');
    } finally {
      setBusy('');
    }
  };

  const addPlayer = async () => {
    const displayName = name.trim();
    if (!displayName) return;
    await run('create-player', () => createTestPlayer(displayName), displayName + ' spawned');
    const next = Math.min((lab?.players?.length || 0) + 2, 26);
    setName('Test ' + String.fromCharCode(64 + next));
  };

  const addContract = async () => {
    if (!user1Id || !user2Id || user1Id === user2Id) {
      showToast?.('Choose two different test players', 'ERROR');
      return;
    }
    await run(
      'create-contract',
      () => createTestContract(user1Id, user2Id, templateId),
      'Test contract started'
    );
  };

  const enterPlayer = async (player) => {
    const key = 'enter-' + idOf(player);
    setBusy(key);
    try {
      const result = await enterTestPlayer(idOf(player));
      beginTestSession(result.token);
    } catch (error) {
      setBusy('');
      showToast?.(error.message || 'Could not enter test player', 'ERROR');
    }
  };

  const targetFor = (contract) => targets[idOf(contract)] || idOf(contract.user1);
  const chaosFor = (contract) => chaosTypes[idOf(contract)] || lab?.chaosEvents?.[0]?.type || 'VOICE_TAX';

  const changeState = async (contract, state) => {
    const targetId = targetFor(contract);
    const who = playersById.get(targetId)?.displayName || 'Player';
    await run(
      'state-' + idOf(contract) + '-' + state,
      () => setTestContractState(idOf(contract), targetId, state),
      who + ' → ' + state.toLowerCase()
    );
  };

  const fireChaos = async (contract) => {
    const type = chaosFor(contract);
    await run(
      'chaos-' + idOf(contract),
      () => triggerTestChaos(idOf(contract), targetFor(contract), type),
      type.replaceAll('_', ' ') + ' triggered'
    );
  };

  const reset = async () => {
    if (!window.confirm('Delete every Founder Lab player, contract, bounty, Grudge, notification and test voice note?')) return;
    await run('reset', resetFounderLab, 'Founder Lab reset');
    setUser1Id('');
    setUser2Id('');
  };

  const ThemeIcon = theme === 'dark' ? Sun : Moon;

  if (status === 'loading') {
    return (
      <div className="founder-route founder-route-centered">
        <div className="founder-route-loader">Opening Founder Lab…</div>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="founder-route founder-route-centered">
        <div className="founder-denied">
          <img src="/hakoware-mark-v2.png" alt="" />
          <span>404</span>
          <h1>Nothing here.</h1>
          <p>This route is private.</p>
          <Button variant="secondary" onClick={() => navigate('/')}>Back to Hakoware</Button>
        </div>
      </div>
    );
  }

  if (status === 'error' || !lab) {
    return (
      <div className="founder-route founder-route-centered">
        <div className="founder-denied">
          <img src="/hakoware-mark-v2.png" alt="" />
          <span>FOUNDER LAB</span>
          <h1>Founder Lab unavailable.</h1>
          <p>{errorDetail}</p>
          <Button variant="secondary" onClick={() => load()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="founder-route">
      <header className="founder-route-header">
        <button type="button" className="founder-route-back" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Hakoware
        </button>
        <div className="founder-route-brand">
          <img src="/hakoware-mark-v2.png" alt="" />
          <div><strong>Founder Lab</strong><span>Private simulation route</span></div>
        </div>
        <button
          type="button"
          className="founder-theme"
          onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          <ThemeIcon size={17} />
        </button>
      </header>

      <main className="founder-route-main">
        <section className="founder-hero">
          <div className="founder-hero-icon"><FlaskConical size={22} /></div>
          <div>
            <span>FOUNDER ONLY</span>
            <h1>Test the real game without waiting for real time.</h1>
            <p>Spawn disposable players, create actual Hakoware contracts, force debt states and Chaos events, then act as each player on your phone.</p>
          </div>
        </section>

        <section className="founder-flow">
          <strong>Full bounty loop</strong>
          <span>A posts on B → act as C → Hunt + pressure → act as B → credit the hunter or escape.</span>
        </section>

        {growth && (
          <section className="founder-growth">
            <div className="founder-growth-head">
              <div>
                <span>REAL PRODUCT SIGNALS</span>
                <h2>First 20 activated Duos</h2>
              </div>
              <div className="founder-growth-goal">
                <Target size={15} />
                <strong>{growth.duos.activated}/20</strong>
                <span>{growth.goals.activatedDuosProgress}%</span>
              </div>
            </div>

            <div className="founder-growth-track" aria-label={`${growth.goals.activatedDuosProgress}% of first 20 Duo goal`}>
              <i style={{ width: `${growth.goals.activatedDuosProgress}%` }} />
            </div>

            <div className="founder-growth-grid">
              <div><UsersRound size={15} /><span>Users</span><strong>{growth.users.total}</strong><small>+{growth.users.new7d} in 7d</small></div>
              <div><BarChart3 size={15} /><span>Activated Duos</span><strong>{growth.duos.activated}</strong><small>{growth.duos.activationRate}% of active</small></div>
              <div><Sparkles size={15} /><span>7d active Duos</span><strong>{growth.duos.active7d}</strong><small>{growth.duos.active} active total</small></div>
              <div><Repeat2 size={15} /><span>Run It Back</span><strong>{growth.seasons.runItBacks}</strong><small>{growth.seasons.runItBackRate}% of completions</small></div>
              <div><Share2 size={15} /><span>Shares</span><strong>{growth.sharing.total}</strong><small>{growth.sharing.bySource[0] ? `${growth.sharing.bySource[0].source.toLowerCase()} leads` : 'waiting for first share'}</small></div>
              <div><Crown size={15} /><span>Plus interest</span><strong>{growth.users.plusInterest}</strong><small>{growth.users.plusInterestRate}% of users</small></div>
            </div>

            <div className="founder-growth-foot">
              <span>{growth.duos.contractsCreated} contracts created · {growth.duos.pendingExternalInvites} external invites pending</span>
              <span>{growth.seasons.completed} seasons completed</span>
            </div>
          </section>
        )}

        <section className="founder-grid">
          <article className="founder-panel">
            <div className="founder-panel-head">
              <div><span>01</span><strong>Test players</strong></div>
              <small>{lab.players.length}/8</small>
            </div>

            <div className="founder-create-row">
              <input value={name} maxLength={32} onChange={(event) => setName(event.target.value)} placeholder="Test player name" />
              <Button size="sm" variant="secondary" icon={UserPlus} loading={busy === 'create-player'} onClick={addPlayer}>Spawn</Button>
            </div>

            <div className="founder-player-list">
              {lab.players.length === 0 ? (
                <p className="founder-empty">Spawn A, B and C to test the complete social loop.</p>
              ) : lab.players.map((player) => (
                <div className="founder-player" key={idOf(player)}>
                  <span className="founder-avatar">{player.displayName?.[0]?.toUpperCase()}</span>
                  <div className="founder-player-copy">
                    <strong>{player.displayName}</strong>
                    <small>{player.auraBalance} Aura</small>
                  </div>
                  <div className="founder-player-actions">
                    <button type="button" onClick={() => run('aura-' + idOf(player), () => setTestAura(idOf(player), 1000), player.displayName + ' now has 1000 Aura')}>
                      <Zap size={13} /> 1000
                    </button>
                    <button type="button" className="act-as" onClick={() => enterPlayer(player)} disabled={busy === 'enter-' + idOf(player)}>
                      <SwitchCamera size={13} /> Act as
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="founder-panel">
            <div className="founder-panel-head"><div><span>02</span><strong>Create test contract</strong></div></div>
            <div className="founder-contract-form">
              <select value={user1Id} onChange={(event) => setUser1Id(event.target.value)}>
                <option value="">Player A</option>
                {lab.players.map((player) => <option key={idOf(player)} value={idOf(player)}>{player.displayName}</option>)}
              </select>
              <span>×</span>
              <select value={user2Id} onChange={(event) => setUser2Id(event.target.value)}>
                <option value="">Player B</option>
                {lab.players.map((player) => <option key={idOf(player)} value={idOf(player)}>{player.displayName}</option>)}
              </select>
              <select className="founder-mode" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                {lab.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
              <Button variant="aura" size="sm" loading={busy === 'create-contract'} disabled={lab.players.length < 2} onClick={addContract}>Start contract</Button>
            </div>
          </article>
        </section>

        <section className="founder-contracts">
          <div className="founder-section-head">
            <div><span>03</span><h2>State controls</h2></div>
            <button type="button" onClick={reset} disabled={busy === 'reset'}><RotateCcw size={14} /> Reset lab</button>
          </div>

          {lab.contracts.length === 0 ? (
            <div className="founder-empty-contract"><Clock3 size={18} /><span>Create a contract above, then move time without waiting days.</span></div>
          ) : lab.contracts.map((contract) => {
            const id = idOf(contract);
            const target = targetFor(contract);
            const isChaos = contract.templateId === 'CHAOS';

            return (
              <article className="founder-contract-card" key={id}>
                <div className="founder-contract-top">
                  <div><span>{contract.templateId.replaceAll('_', ' ')}</span><strong>{nameOf(contract.user1)} × {nameOf(contract.user2)}</strong></div>
                  <small>S{contract.season?.number || 1} · {contract.season?.status || 'ACTIVE'}</small>
                </div>

                <div className="founder-target-row">
                  <label>Manipulate</label>
                  <select value={target} onChange={(event) => setTargets((current) => ({ ...current, [id]: event.target.value }))}>
                    {[contract.user1, contract.user2].map((player) => (
                      <option key={idOf(player)} value={idOf(player)}>{nameOf(player)}</option>
                    ))}
                  </select>
                </div>

                <div className="founder-state-buttons">
                  <button type="button" onClick={() => changeState(contract, 'CLEAR')}>Clear</button>
                  <button type="button" onClick={() => changeState(contract, 'READY')}><Clock3 size={13} /> Ready</button>
                  <button type="button" onClick={() => changeState(contract, 'OVERDUE')}>Overdue</button>
                  <button type="button" className="danger" onClick={() => changeState(contract, 'BANKRUPT')}><Skull size={13} /> Bankrupt</button>
                  <button type="button" onClick={() => run('season-' + id, () => completeTestSeason(id), 'Season completed')}>End season</button>
                </div>

                {isChaos && (
                  <div className="founder-chaos-row">
                    <select value={chaosFor(contract)} onChange={(event) => setChaosTypes((current) => ({ ...current, [id]: event.target.value }))}>
                      {lab.chaosEvents.map((event) => <option key={event.type} value={event.type}>{event.name}</option>)}
                    </select>
                    <Button size="sm" variant="secondary" icon={Sparkles} loading={busy === 'chaos-' + id} onClick={() => fireChaos(contract)}>Trigger anomaly</Button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
};
