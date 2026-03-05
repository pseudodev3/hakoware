import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  ShieldAlert, 
  Trophy, 
  Target, 
  ArrowRight, 
  Ghost,
  ShieldCheck,
  Activity,
  ChevronDown
} from 'lucide-react';
import { Button } from '../../shared/components/Button';
import './LandingPage.css';

/**
 * Professional, high-fidelity Landing Page.
 * Implements the "Hunter x Hunter" debt theme with premium animations.
 */
export const LandingPage = ({ onEnter }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      title: "HAKOWARE PROTOCOL",
      desc: "Automatic interest accrual for every day of silence. +1 APR compounds daily.",
      icon: <Zap size={24} color="var(--aura-gold)" />
    },
    {
      title: "BANKRUPTCY LIMIT",
      desc: "Cross the threshold and face the consequences. Beg for mercy or face the void.",
      icon: <ShieldAlert size={24} color="var(--aura-red)" />
    },
    {
      title: "BOUNTY BOARD",
      desc: "Place bounties on ghosting friends. Use Aura to hunt down debt-dodgers.",
      icon: <Target size={24} color="var(--aura-blue)" />
    },
    {
      title: "HUNTER MEDALS",
      desc: "Unlock prestigious achievements for your financial disasters and victories.",
      icon: <Trophy size={24} color="var(--aura-gold)" />
    }
  ];

  return (
    <div className="landing-root">
      {/* Navigation Header */}
      <nav className={`landing-nav-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="landing-logo">
          <div className="logo-box">H</div>
          <span>HAKOWARE</span>
        </div>
        <div className="nav-actions">
           <Button variant="ghost" size="sm" onClick={onEnter}>LOG IN</Button>
           <Button variant="aura" size="sm" onClick={onEnter}>GET STARTED</Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg">
          <div className="glow-1" />
          <div className="glow-2" />
        </div>
        
        <motion.div 
          className="hero-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="hero-badge">CHAPTER 7: BANKRUPTCY</div>
          <h1 className="hero-title">
            THE WORLD'S FIRST <br />
            <span>ACCOUNTABILITY</span> ENGINE
          </h1>
          <p className="hero-subtitle">
            Bind your friends to the Hakoware interest protocol. <br />
            No more ghosting. No more silence. Only debt.
          </p>
          
          <div className="hero-btns">
            <Button variant="aura" size="lg" icon={ArrowRight} onClick={onEnter}>
              INITIATE PROTOCOL
            </Button>
            <Button variant="secondary" size="lg" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
              LEARN THE RULES
            </Button>
          </div>
          
          <motion.div 
            className="scroll-hint"
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <ChevronDown size={24} color="var(--text-muted)" />
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="stats-strip glass">
        <div className="stat-box">
          <span className="stat-val">+1</span>
          <span className="stat-lbl">DAILY APR</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-box">
          <span className="stat-val">7</span>
          <span className="stat-lbl">DAY GRACE PERIOD</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-box">
          <span className="stat-val">∞</span>
          <span className="stat-lbl">POTENTIAL SHAME</span>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="features-section">
        <div className="section-header-centered">
          <h2 className="section-title">SYSTEM MODULES</h2>
          <p>TOOLS DESIGNED FOR MAXIMUM COMPLIANCE</p>
        </div>

        <div className="features-grid-landing">
          {features.map((f, i) => (
            <motion.div 
              key={i}
              className="feature-landing-card glass"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-card aura-pulse glass">
          <h2>READY TO ENTER THE VOID?</h2>
          <p>The debt collectors are waiting for your first contract.</p>
          <Button variant="aura" size="lg" icon={ArrowRight} onClick={onEnter}>
            BEGIN YOUR JOURNEY
          </Button>
        </div>
      </section>

      {/* Footer Ticker */}
      <footer className="landing-footer-strip">
        <div className="ticker-wrap">
          <div className="ticker-move">
            <span>BANKRUPTCY IS FOREVER • INTEREST COMPOUNDS DAILY • THE HUNTER ASSOCIATION IS WATCHING • CHECK IN OR CHECK OUT • </span>
            <span>BANKRUPTCY IS FOREVER • INTEREST COMPOUNDS DAILY • THE HUNTER ASSOCIATION IS WATCHING • CHECK IN OR CHECK OUT • </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
