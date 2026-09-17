import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, ArrowRight, Mic, Sparkles, Target, Zap } from 'lucide-react';
import { Button } from '../../shared/components/Button';
import './LandingPage.css';

const features = [
  {
    title: 'Debt engine',
    desc: 'Miss the agreed check-in window and your social debt starts climbing automatically.',
    icon: Activity,
  },
  {
    title: 'Voice check-ins',
    desc: 'Close the loop with a real voice note instead of another dry “wyd”.',
    icon: Mic,
  },
  {
    title: 'Bounty board',
    desc: 'Turn ghosting into a game with stakes, targets and a little public pressure.',
    icon: Target,
  },
  {
    title: 'Aura economy',
    desc: 'Earn Aura for showing up, then spend it across the systems that make Hakoware fun.',
    icon: Sparkles,
  },
];

export const LandingPage = ({ onEnter }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 28);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="landing-root">
      <nav className={`landing-nav-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="landing-logo">
          <img src="/hakoware-mark.svg" alt="" />
          <span>Hakoware</span>
        </div>
        <div className="nav-actions">
          <Button variant="ghost" size="sm" onClick={onEnter}>Log in</Button>
          <Button variant="aura" size="sm" onClick={onEnter}>Get started</Button>
        </div>
      </nav>

      <main>
        <section className="hero-section">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-glow" aria-hidden="true" />

          <div className="hero-shell">
            <motion.div
              className="hero-copy"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', duration: .55, bounce: 0 }}
            >
              <div className="hero-badge"><span /> Social accountability, with teeth</div>
              <h1>Stay close.<br /><span>Make the gaps count.</span></h1>
              <p className="hero-subtitle">
                Hakoware turns missed check-ins into playful debt, Aura, bounties and bragging rights—so staying in touch actually feels like a game.
              </p>
              <div className="hero-btns">
                <Button variant="aura" size="lg" icon={ArrowRight} onClick={onEnter}>Start a contract</Button>
                <Button variant="secondary" size="lg" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>See how it works</Button>
              </div>
              <p className="hero-footnote">Built for friendships, not productivity theater.</p>
            </motion.div>

            <motion.div
              className="protocol-preview"
              initial={{ opacity: 0, y: 18, scale: .98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', duration: .6, bounce: 0, delay: .08 }}
            >
              <div className="preview-topline">
                <div className="preview-live"><span /> Live contract</div>
                <span className="preview-id">HKW / 004</span>
              </div>

              <div className="preview-person">
                <div className="preview-avatar">M</div>
                <div>
                  <h3>Maya ↔ You</h3>
                  <p>Last check-in · 5 days ago</p>
                </div>
              </div>

              <div className="preview-debt">
                <div>
                  <span className="preview-label">Current debt</span>
                  <strong>03</strong>
                </div>
                <div className="preview-state">
                  <Zap size={15} /> accumulating
                </div>
              </div>

              <div className="preview-meter" aria-hidden="true"><span /></div>

              <div className="preview-grid-cards">
                <div><span>Grace window</span><strong>7 days</strong></div>
                <div><span>Aura stake</span><strong>120</strong></div>
              </div>

              <div className="preview-action">
                <div>
                  <span>Suggested move</span>
                  <strong>Send a voice check-in</strong>
                </div>
                <ArrowRight size={18} />
              </div>
            </motion.div>
          </div>
        </section>

        <section className="value-strip" aria-label="Hakoware highlights">
          <div><strong>+1</strong><span>debt after the window</span></div>
          <div><strong>Voice</strong><span>check-ins that feel personal</span></div>
          <div><strong>Aura</strong><span>earned for showing up</span></div>
        </section>

        <section id="features" className="features-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">The loop</span>
              <h2>Enough structure to make it stick.<br />Enough chaos to keep it fun.</h2>
            </div>
            <p>Hakoware borrows the energy of game systems without turning your friendships into a spreadsheet.</p>
          </div>

          <div className="features-grid-landing">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.article
                  key={feature.title}
                  className="feature-landing-card"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ type: 'spring', duration: .45, bounce: 0, delay: index * .05 }}
                >
                  <div className="feature-icon"><Icon size={19} strokeWidth={1.8} /></div>
                  <h3>{feature.title}</h3>
                  <p>{feature.desc}</p>
                  <span className="feature-index">0{index + 1}</span>
                </motion.article>
              );
            })}
          </div>
        </section>

        <section className="cta-section">
          <div className="cta-card">
            <div className="cta-mark"><img src="/hakoware-mark.svg" alt="" /></div>
            <div>
              <span className="section-kicker">Hakoware</span>
              <h2>Keep the loop alive.</h2>
              <p>Start with one friend, one check-in window and one contract.</p>
            </div>
            <Button variant="aura" size="lg" icon={ArrowRight} onClick={onEnter}>Enter Hakoware</Button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-logo"><img src="/hakoware-mark.svg" alt="" /><span>Hakoware</span></div>
        <p>Inspired by game-system energy. Built as its own world.</p>
      </footer>
    </div>
  );
};
