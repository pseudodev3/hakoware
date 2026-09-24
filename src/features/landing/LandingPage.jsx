import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  AudioLines,
  BarChart3,
  CalendarDays,
  FileText,
  Flame,
  Gamepad2,
  Moon,
  Share2,
  ShieldAlert,
  Sparkles,
  Sun,
  Swords,
  Trophy,
  UsersRound,
  Zap
} from 'lucide-react';
import { Button } from '../../shared/components/Button';
import { applyTheme, getInitialTheme } from '../../lib/theme';
import { LANDING_DESKTOP_BG } from './landingDesktopBackground';
import './LandingPage.css';

const GAME_MODES = [
  {
    id: 'chaos',
    kicker: 'Unstable',
    title: 'Chaos Contract',
    copy: 'The rules mutate mid-season. Survive anomalies, or wear the consequence.',
    meta: '3-day base rule · 30-day season',
    icon: Flame,
    featured: true
  },
  {
    id: 'ghost',
    kicker: 'Classic',
    title: "Don't Ghost Me",
    copy: 'Three quiet days is all you get before debt starts following you around.',
    meta: '3-day rule · 30-day season',
    icon: UsersRound
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
];

const LOOP = [
  ['01', 'Choose the contract', 'Pick the kind of pressure you and your person can actually survive.'],
  ['02', 'Show up or owe', 'Check in before your window closes. Miss it and debt starts climbing.'],
  ['03', 'Build the Duo', 'Every clean check-in grows shared XP, levels and titles that belong to that relationship.'],
  ['04', 'Get the story', 'Seasons end with a recap of the wins, misses, Chaos and nonsense you created together.']
];

export const LandingPage = ({ onEnter }) => {
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');
  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const themeLabel = theme === 'dark' ? 'Use light mode' : 'Use dark mode';

  return (
    <div className="lp-root">
      <header className={`lp-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="lp-brand" aria-label="Hakoware">
          <img src="/hakoware-mark-v2.png" alt="" />
          <div><strong>Hakoware</strong><span>social game</span></div>
        </div>

        <div className="lp-nav-actions">
          <button className="lp-theme-toggle" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}>
            <ThemeIcon size={17} strokeWidth={1.8} />
          </button>
          <Button variant="ghost" size="sm" onClick={onEnter}>Log in</Button>
          <Button variant="aura" size="sm" onClick={onEnter}>Play</Button>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div
            className="lp-hero-grid"
            aria-hidden="true"
            style={{ '--lp-desktop-bg': `url("${LANDING_DESKTOP_BG}")` }}
          />
          <div className="lp-hero-shell">
            <div className="lp-hero-copy">
              <div className="lp-season-marker" aria-label="Season system live. Chaos included.">
                <span className="lp-season-rail" aria-hidden="true"><i /></span>
                <div className="lp-season-copy">
                  <span>SEASON SYSTEM</span>
                  <strong>Live now</strong>
                  <small>Chaos included</small>
                </div>
              </div>
              <h1>Turn staying in touch into a game worth surviving.</h1>
              <p>
                Make a contract with someone you care about. Check in, build Duo XP, earn Aura,
                survive weird rules, place bounties and let the season remember everything.
              </p>

              <div className="lp-hero-actions">
                <Button variant="aura" size="lg" icon={ArrowRight} onClick={onEnter}>Start a contract</Button>
                <Button variant="secondary" size="lg" onClick={() => document.getElementById('game-loop')?.scrollIntoView({ behavior: 'smooth' })}>See the loop</Button>
              </div>

              <div className="lp-proof-row" aria-label="Hakoware game systems">
                <div><Gamepad2 size={18} strokeWidth={1.7} /><span>8 game modes</span></div>
                <div><BarChart3 size={18} strokeWidth={1.7} /><span>Duo progression</span></div>
                <div><CalendarDays size={18} strokeWidth={1.7} /><span>30–45 day seasons</span></div>
                <div><FileText size={18} strokeWidth={1.7} /><span>Shareable recaps</span></div>
              </div>
            </div>

            <div className="lp-game-shell" aria-label="Preview of a Chaos Contract">
              <div className="lp-game-topbar">
                <div><span className="lp-status-dot" /><strong>Chaos Contract</strong></div>
                <span>Season 03</span>
              </div>

              <div className="lp-duo-block">
                <div className="lp-duo-avatars"><span>G</span><span>H</span></div>
                <div className="lp-duo-copy">
                  <small>ghostt × herman</small>
                  <strong>Lv. 12 · Certified Menaces</strong>
                </div>
                <span className="lp-duo-xp">1,284 XP</span>
              </div>

              <div className="lp-xp-track" aria-hidden="true"><span /></div>

              <div className="lp-anomaly-card">
                <div className="lp-anomaly-icon"><ShieldAlert size={18} strokeWidth={1.9} /></div>
                <div>
                  <span>ANOMALY DETECTED</span>
                  <strong>Voice Tax</strong>
                  <p>Your next check-in only counts if it is a voice note.</p>
                </div>
                <b>09:42</b>
              </div>

              <div className="lp-contract-status">
                <div><small>Your debt</small><strong>0</strong></div>
                <div><small>Grace</small><strong>3d</strong></div>
                <div><small>Chaos</small><strong>Lv. 4</strong></div>
              </div>

              <div className="lp-preview-actions">
                <button><span>Text check-in</span><small>blocked by anomaly</small></button>
                <button className="primary"><AudioLines size={17} /><span>Voice check-in</span></button>
              </div>

              <div className="lp-game-footer">
                <span><Zap size={13} /> 420 Aura</span>
                <span>12 days left</span>
                <span className="safe">Wanted: off</span>
              </div>
            </div>
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
            <h2>Pick your problem.</h2>
            <p>Different contracts create different kinds of pressure. Custom rules are there when none of these are irresponsible enough.</p>
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
                  {mode.featured && <div className="lp-chaos-stamp">RULES MAY CHANGE MID-SEASON</div>}
                </article>
              );
            })}
          </div>
        </section>

        <section className="lp-pressure-section">
          <div className="lp-pressure-copy">
            <span>PRESSURE + PAYOFF</span>
            <h2>The miss should be funny. The comeback should feel earned.</h2>
            <p>
              Arena turns bad behavior into social pressure. Weekly reports turn the whole mess into something worth remembering and sharing.
            </p>
          </div>

          <div className="lp-pressure-grid">
            <div className="lp-arena-preview">
              <div className="lp-panel-title"><Swords size={17} /><div><span>ARENA</span><strong>Open pressure</strong></div></div>
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
                <div><span>WEEK 04</span><strong>ghostt × herman</strong></div>
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
          <div><span>LIVE WORLD EVENT · SURVIVAL ARC</span><strong>Open Mic</strong><p>Voice check-ins earn bonus Duo XP this week.</p></div>
          <span className="lp-world-time">06D 14H</span>
        </section>

        <section className="lp-final-section">
          <div className="lp-final-mark"><img src="/hakoware-mark-v2.png" alt="" /></div>
          <span>START SMALL</span>
          <h2>Pick one person.<br />Make it interesting.</h2>
          <p>You only need one contract for Hakoware to start telling a story.</p>
          <Button variant="aura" size="lg" icon={ArrowRight} onClick={onEnter}>Enter Hakoware</Button>
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
