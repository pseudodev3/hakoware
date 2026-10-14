import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  AudioLines,
  Check,
  Flame,
  Layers,
  MessageCircle,
  Share2,
  Sparkles,
  Swords,
  Trophy,
  UsersRound
} from 'lucide-react';
import { Button } from '../../shared/components/Button';
import { applyTheme, getInitialTheme } from '../../lib/theme';
import { CardArtwork } from '../cards/CardArtwork';
import { DuoIdentity } from '../../shared/components/DuoIdentity';
import './LandingPage.css';
import './LandingHero.css';

const GAME_MODES = [
  {
    id: 'chaos',
    kicker: 'Unstable',
    title: 'Chaos Contract',
    copy: 'The rules mutate mid-season. Survive anomalies, or wear the consequence.',
    meta: '3-day base rule · 30-day season',
    icon: Flame,
    featured: false
  },
  {
    id: 'ghost',
    kicker: 'Classic',
    title: "Don't Ghost Me",
    copy: 'Three quiet days is all you get before debt starts following you around.',
    meta: '3-day rule · 30-day season',
    icon: UsersRound,
    featured: true
  },
  {
    id: 'distance',
    kicker: 'Voice-first',
    title: 'Long Distance',
    copy: 'More breathing room, more Duo XP for showing up with your actual voice.',
    meta: '4-day rule · 45-day season',
    icon: AudioLines
  },
  {
    id: 'lockin',
    kicker: 'Hard mode',
    title: '30-Day Lock-In',
    copy: 'Daily pressure for people who said they were serious and now have to prove it.',
    meta: '1-day rule · 30-day season',
    icon: Trophy
  }
].sort((a, b) => Number(b.id === 'ghost') - Number(a.id === 'ghost'));

const MODE_IDS = { ghost: 'DONT_GHOST', distance: 'LONG_DISTANCE', lockin: 'LOCK_IN', chaos: 'CHAOS' };

const LOOP = [
  ['01', 'Bring your person', 'Invite a friend by @username or email. Your season starts when they accept.'],
  ['02', 'Make a little time', 'Send a message or a voice note. An eligible check-in grows your shared Duo XP.'],
  ['03', 'Build a story together', 'Return for their reply, shared moments and a season recap. Your Duo grows across seasons.']
];

const QUESTIONS = [
  ['Do we both need an account?', 'Yes. Invite someone by @username if they already play, or by email if they are new. You can share the invite link with them. The contract begins after they accept.'],
  ['Do I have to check in every day?', 'You choose the pace together. The classic contract gives you a three-day window; Long Distance gives you four. Daily modes are there if you want a tighter rhythm.'],
  ['What happens if I miss a check-in?', 'In-game debt builds when you miss your agreed window. A check-in helps you recover. Aura and debt have no cash value. Public bankruptcy visibility is controlled in your privacy settings.'],
  ['Can we just talk?', 'Yes. Your friend space supports text and voice messages. An eligible message can also count as a check-in, so staying in touch is the point.']
];

const LandingAction = ({ children, onClick, secondary = false, compact = false }) => {
  return <button type="button" className={`lp-action ${secondary ? 'lp-action-secondary' : 'lp-action-primary'} ${compact ? 'lp-action-compact' : ''}`} onClick={onClick}>
    {children}
  </button>;
};

const DEMO_DUO = {
  user1: { _id: 'demo-you', displayName: 'You' },
  user2: { _id: 'demo-friend', displayName: 'Friend' },
  identity: { name: 'The usual trouble.', palette: 'citron', cover: 'rays' },
  duoLevel: 1,
  season: { number: 1 }
};

export const LandingPage = ({ onEnter }) => {
  const [scrolled, setScrolled] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const reduceMotion = useReducedMotion();
  const start = () => onEnter('signup');

  useEffect(() => {
    applyTheme(getInitialTheme());
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="lp-root">
      <header className={`lp-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <nav className="lp-nav-inner" aria-label="Main navigation">
          <div className="lp-brand" aria-label="Hakoware">
            <img src="/hakoware-mark-v2.png" alt="" />
            <div><strong>Hakoware</strong><span>social game</span></div>
          </div>

          <div className="lp-nav-actions">
            <Button variant="ghost" size="sm" onClick={() => onEnter('login')}>Log in</Button>
            <LandingAction compact onClick={start}>Get started</LandingAction>
          </div>
        </nav>
      </header>

      <main>
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-hero-atmosphere" aria-hidden="true" />
          <div className="lp-hero-shell">
            <div className="lp-hero-copy">
              <p className="lp-hero-eyebrow">A social game for your kind of people</p>
              <h1 id="lp-hero-title"><span>Good company.</span><span>A little <em>chaos.</em></span></h1>
              <p className="lp-hero-description">Keep a friend close. Meet someone over a card game. Turn a little time together into a story that’s yours.</p>
              <div className="lp-hero-actions">
                <LandingAction onClick={start}>Start playing</LandingAction>
                <LandingAction secondary onClick={() => document.getElementById('contract-demo')?.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'center' })}>Try the demo</LandingAction>
              </div>
              <p className="lp-start-note">Free to play. A little better together.</p>
              <div className="lp-hero-features" aria-label="Ways to play"><span><MessageCircle size={16} />Private chats</span><span><Swords size={16} />Free card duels</span><span><UsersRound size={16} />Shared Duos</span></div>
            </div>

            <div className="lp-hero-stage">
              <div className="lp-hero-hand" aria-hidden="true"><CardArtwork cardId="WATCHER" finishId="porcelain" size={76} /><CardArtwork cardId="ORBIT" size={76} /><CardArtwork cardId="SIGNAL_FLARE" finishId="nocturne" size={76} /></div>
              <div id="contract-demo" className="lp-contract-demo" role="region" aria-label="Interactive example Duo">
                <header className="lp-demo-heading"><span>A Duo in the making</span><span>Interactive example</span></header>
                <DuoIdentity friendship={DEMO_DUO} userId="demo-you" variant="card">
                  <p className="lp-demo-duo-pace">Don’t Ghost Me · Every 3 days</p>
                  <div className="lp-demo-progress-label"><span>New Contract</span><strong>{demoStep * 10} Duo XP</strong></div>
                  <div className="lp-xp-track" role="progressbar" aria-label="Example Duo XP toward level 2" aria-valuemin={0} aria-valuemax={50} aria-valuenow={demoStep * 10}><span style={{ width: `${demoStep * 20}%` }} /></div>
                </DuoIdentity>
                <div className="lp-demo-conversation" aria-live="polite" aria-atomic="true">
                  <div className={`lp-demo-message own ${demoStep === 0 ? 'is-draft' : ''}`}><small>{demoStep === 0 ? 'YOUR FIRST HELLO' : 'YOU'}</small><p>Made it through Monday. How’s your day going?</p><span>{demoStep === 0 ? 'A little message. A good place to start.' : <><Check size={12} />Checked in · +10 Duo XP</>}</span></div>
                  {demoStep === 2 && <div className="lp-demo-message"><small>YOUR FRIEND</small><p>Survived. Coffee later this week?</p><span><Check size={12} />Checked in · +10 Duo XP</span></div>}
                  {demoStep < 2 && <p className="lp-demo-nudge">{demoStep === 0 ? 'Try sending the first check-in.' : 'Your side of the story. Now theirs.'}</p>}
                </div>
                <button type="button" className="lp-demo-play" onClick={() => demoStep < 2 ? setDemoStep(step => step + 1) : start()}>{demoStep === 0 ? 'Try a check-in' : demoStep === 1 ? 'See your friend’s reply' : 'Start your own Duo'}</button>
                <footer className="lp-demo-footer"><span>{demoStep}/2 checked in · 30-day season</span>{demoStep > 0 ? <button type="button" onClick={() => setDemoStep(0)}>Replay demo</button> : <span>No account needed</span>}</footer>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-hangout-section" aria-label="Things to do in Hakoware">
          <div className="lp-section-intro compact"><span>MORE THAN A CHECK-IN</span><h2>Something worth coming back for.</h2><p>Private friend spaces, useful cards, and a good first round with someone new.</p></div>
          <div className="lp-hangout-grid">
            <article className="lp-hangout-card"><MessageCircle size={22} /><h3>Your friend space.</h3><p>Text, send a voice note, and keep your shared story in one place. An eligible message counts as your check-in.</p><span className="lp-hangout-tag">Between you and your friend</span></article>
            <article className="lp-hangout-card is-cards"><Layers size={22} /><h3>A few good tricks.</h3><div className="lp-card-shelf" aria-label="Examples of collectible cards"><CardArtwork cardId="SIGNAL_FLARE" size={48} /><CardArtwork cardId="PURIFY" size={48} /><CardArtwork cardId="CHAOS_TICKET" size={48} /></div><p>Spend earned Aura on useful tools. Trade a spare with an accepted friend.</p><span className="lp-hangout-tag">Pick the card you actually want</span></article>
            <article className="lp-hangout-card is-room"><Swords size={22} /><h3>A new face at the table.</h3><p>A free deck. A few clever moves. Play someone new, then connect if you both want to keep talking.</p><span className="lp-hangout-tag">Meet through play</span></article>
          </div>
        </section>

        <section id="game-loop" className="lp-loop-section">
          <div className="lp-section-intro">
            <span>THE LOOP</span>
            <h2>One relationship. One season. A lot can happen.</h2>
            <p>The mechanics are simple enough to understand in a minute, but they leave behind a history that makes each Duo feel different.</p>
          </div>

          <div className="lp-loop-list">
            {LOOP.map(([number, title, copy]) => (
              <article key={number} className="lp-loop-row">
                <span className="lp-loop-number">{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
                <ArrowRight size={18} strokeWidth={1.7} />
              </article>
            ))}
          </div>
        </section>

        <section className="lp-modes-section">
          <div className="lp-section-intro compact">
            <span>GAME MODES</span>
            <h2>Find your kind of together.</h2>
            <p>Start with the classic, stay close from a distance, or turn up the challenge. You choose the rhythm.</p>
          </div>

          <div className="lp-mode-grid">
            {GAME_MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <article className={`lp-mode-card ${mode.featured ? 'featured' : ''}`} key={mode.id}>
                  <div className="lp-mode-card-top">
                    <div className="lp-mode-icon"><Icon size={19} strokeWidth={1.8} /></div>
                    <span>{mode.kicker}</span>
                  </div>
                  <h3>{mode.title}</h3>
                  <p>{mode.copy}</p>
                  <div className="lp-mode-meta">{mode.meta}</div>
                  <button type="button" className="lp-mode-start" onClick={() => onEnter('signup', MODE_IDS[mode.id])}>Choose {mode.title}</button>
                  {mode.id === 'chaos' && <div className="lp-chaos-stamp">RULES MAY CHANGE MID-SEASON</div>}
                </article>
              );
            })}
          </div>
        </section>

        <section className="lp-pressure-section">
          <div className="lp-pressure-copy">
            <span>PRESSURE + PAYOFF</span>
            <h2>A little chaos.<br />A story worth keeping.</h2>
            <p>
              For Duos who like a challenge, Arena adds playful stakes. Your season recap keeps the wins, misses and comebacks in one shared story.
            </p>
          </div>

          <div className="lp-pressure-grid">
            <div className="lp-arena-preview">
              <div className="lp-panel-title"><Swords size={17} /><div><span>ARENA EXAMPLE</span><strong>Open pressure</strong></div></div>
              <div className="lp-bounty-row">
                <span className="lp-mini-avatar">H</span>
                <div><strong>herman</strong><small>Communication Criminal</small></div>
                <b>80 Aura</b>
              </div>
              <div className="lp-bounty-row">
                <span className="lp-mini-avatar wanted">M</span>
                <div><strong>maya</strong><small>Wanted · 31h remaining</small></div>
                <b>120 Aura</b>
              </div>
              <div className="lp-arena-foot"><Flame size={14} /> The board remembers.</div>
            </div>

            <div className="lp-recap-preview">
              <div className="lp-recap-head">
                <div><span>SEASON RECAP EXAMPLE</span><strong>ghostt × herman</strong></div>
                <Share2 size={18} strokeWidth={1.8} />
              </div>
              <div className="lp-recap-grade"><span>DUO LV. 12</span><strong>A</strong></div>
              <div className="lp-recap-stats">
                <div><strong>11</strong><span>check-ins</span></div>
                <div><strong>4</strong><span>voice</span></div>
                <div><strong>2</strong><span>chaos survived</span></div>
                <div><strong>+135</strong><span>XP</span></div>
              </div>
              <blockquote>“Disturbingly consistent.”</blockquote>
              <div className="lp-recap-brand"><img src="/hakoware-mark-v2.png" alt="" /><span>HAKOWARE · SEASON 03</span></div>
            </div>
          </div>
        </section>

        <section className="lp-world-strip">
          <div className="lp-world-icon"><Sparkles size={20} strokeWidth={1.8} /></div>
          <div><span>WORLD EVENT EXAMPLE</span><strong>Open Mic</strong><p>Some weeks, a world event gives voice check-ins bonus Duo XP.</p></div>
          <span className="lp-world-time">A little change of pace</span>
        </section>

        <section className="lp-final-section">
          <div className="lp-final-mark"><img src="/hakoware-mark-v2.png" alt="" /></div>
          <span>START SMALL</span>
          <h2>Pick one person.<br />Make it interesting.</h2>
          <p>You only need one contract for Hakoware to start telling a story.</p>
          <Button variant="aura" size="lg" onClick={start}>Create your account</Button>
        </section>
        <section className="lp-faq" aria-labelledby="lp-faq-heading">
          <div className="lp-section-intro compact"><span>BEFORE YOU START</span><h2 id="lp-faq-heading">A few things to know.</h2></div>
          <div>{QUESTIONS.map(([question, answer]) => <details key={question}><summary>{question}<PlusIcon /></summary><p>{answer}</p></details>)}</div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer-main">
          <div className="lp-brand"><img src="/hakoware-mark-v2.png" alt="" /><div><strong>Hakoware</strong><span>built as its own world</span></div></div>
          <p>Social pressure. Duo progression. Mild consequences.</p>
        </div>
        <nav className="lp-footer-links" aria-label="Legal and support">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/community">Community</Link>
          <Link to="/contact">Contact</Link>
        </nav>
      </footer>
    </div>
  );
};

const PlusIcon = () => <span className="lp-faq-plus" aria-hidden="true">+</span>;
