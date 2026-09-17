import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '../../../contexts/AuthContext';
import './Potclean.css';

const PotcleanMascot = ({ expression, isBankrupt, totalDebt, getExpressionColor }) => {
  const color = getExpressionColor();

  if (isBankrupt) {
    return (
      <svg viewBox="0 0 100 120" className="potclean-svg toritaten" aria-hidden="true">
        <defs>
          <radialGradient id="toritatenGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2a0000" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
          <filter id="auraGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <ellipse cx="50" cy="110" rx="30" ry="8" fill="rgba(0,0,0,0.4)" />
        <path d="M20 70 Q20 30 50 30 Q80 30 80 70 Q80 100 50 105 Q20 100 20 70" fill="url(#toritatenGradient)" stroke="var(--aura-red)" strokeWidth="1.5" />
        <path d="M30 35 L15 15 L35 32 Z" fill="#000" stroke="var(--aura-red)" strokeWidth="1" />
        <path d="M70 35 L85 15 L65 32 Z" fill="#000" stroke="var(--aura-red)" strokeWidth="1" />
        <g filter="url(#auraGlow)">
          <path d="M35 55 Q40 50 45 55" fill="none" stroke="var(--aura-red)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M55 55 Q60 50 65 55" fill="none" stroke="var(--aura-red)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="40" cy="62" r="3" fill="var(--aura-red)" />
          <circle cx="60" cy="62" r="3" fill="var(--aura-red)" />
        </g>
        <path d="M35 85 Q50 75 65 85" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        <rect x="35" y="40" width="30" height="10" rx="2" fill="#111" stroke="var(--aura-red)" strokeWidth="0.5" />
        <text x="50" y="47" textAnchor="middle" fontSize="6" fill="var(--aura-red)" fontWeight="bold">BANKRUPT</text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 120" className="potclean-svg" aria-hidden="true">
      <defs>
        <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f0f0f0" />
        </linearGradient>
        <radialGradient id="cheekGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb6c1" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ffb6c1" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="50" cy="112" rx="25" ry="6" fill="rgba(0,0,0,0.1)" />
      <g className="potclean-ears">
        <path d="M30 45 Q15 5 35 35 Z" fill="url(#bodyGradient)" stroke="#e0e0e0" strokeWidth="1" />
        <path d="M70 45 Q85 5 65 35 Z" fill="url(#bodyGradient)" stroke="#e0e0e0" strokeWidth="1" />
        <path d="M28 38 Q22 20 32 35 Z" fill="#ffdae0" opacity="0.5" />
        <path d="M72 38 Q78 20 68 35 Z" fill="#ffdae0" opacity="0.5" />
      </g>
      <circle cx="50" cy="75" r="35" fill="url(#bodyGradient)" stroke="#e0e0e0" strokeWidth="1" />
      <ellipse cx="50" cy="85" rx="20" ry="18" fill="white" />
      <circle cx="32" cy="78" r="8" fill="url(#cheekGradient)" />
      <circle cx="68" cy="78" r="8" fill="url(#cheekGradient)" />

      <g className="potclean-face">
        {totalDebt === 0 ? (
          <g opacity="0.4">
            <path d="M38 72 Q43 72 48 72" fill="none" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M52 72 Q57 72 62 72" fill="none" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M45 88 L55 88" stroke="#666" strokeWidth="1" />
          </g>
        ) : expression === 'angry' ? (
          <g>
            <path d="M35 68 L45 73" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M65 68 L55 73" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M40 90 Q50 82 60 90" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : expression === 'happy' ? (
          <g>
            <path d="M35 72 Q42 65 50 72" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M50 72 Q58 65 65 72" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M42 85 Q50 95 58 85" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <circle cx="42" cy="72" r="3.5" fill="black" />
            <circle cx="58" cy="72" r="3.5" fill="black" />
            <circle cx="43" cy="70.5" r="1" fill="white" />
            <circle cx="59" cy="70.5" r="1" fill="white" />
            <path d="M45 90 L55 90" stroke="black" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}
        <ellipse cx="50" cy="78" rx="2.5" ry="1.8" fill="#ffb6c1" />
      </g>

      <g opacity="0.8">
        <rect x="35" y="48" width="30" height="12" rx="6" fill="white" stroke={color} strokeWidth="1" />
        <text x="50" y="56" textAnchor="middle" fontSize="7" fill={color} fontWeight="bold" fontFamily="monospace">{totalDebt}</text>
      </g>
    </svg>
  );
};

export const Potclean = ({ friendships = [] }) => {
  const { user } = useAuth();
  const [totalDebt, setTotalDebt] = useState(0);
  const [isBankrupt, setIsBankrupt] = useState(false);
  const [displayDebt, setDisplayDebt] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [expression, setExpression] = useState('neutral');
  const [comment, setComment] = useState('');
  const shouldReduceMotion = useReducedMotion();
  const prevDebtRef = useRef(0);

  useEffect(() => {
    if (!Array.isArray(friendships) || friendships.length === 0) {
      setTotalDebt(0);
      setIsBankrupt(false);
      return;
    }

    let bankrupt = false;
    const debt = friendships.reduce((acc, friendship) => {
      const currentUserId = user?.uid || user?.id;
      const isUser1 = friendship.user1?._id === currentUserId || friendship.user1 === currentUserId;
      const perspective = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
      if (!perspective) return acc;

      const interactionDate = new Date(perspective.lastInteraction || 0);
      const daysMissed = Math.floor(Math.max(0, new Date() - interactionDate) / (1000 * 60 * 60 * 24));
      const limit = perspective.limit || 7;
      const currentDebt = (perspective.baseDebt || 0) + Math.max(0, daysMissed - limit);
      if (currentDebt >= limit * 2) bankrupt = true;
      return acc + currentDebt;
    }, 0);

    setTotalDebt(debt);
    setIsBankrupt(bankrupt);
  }, [friendships, user]);

  useEffect(() => {
    const diff = totalDebt - prevDebtRef.current;
    if (diff === 0) return undefined;

    if (diff > 0) {
      setExpression('angry');
      showRandomComment('increase');
    } else {
      setExpression('happy');
      showRandomComment('decrease');
    }

    if (shouldReduceMotion) {
      setDisplayDebt(totalDebt);
    } else {
      const start = displayDebt;
      const end = totalDebt;
      const duration = 500;
      let startTime = null;

      const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        setDisplayDebt(Math.round(progress * (end - start) + start));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    prevDebtRef.current = totalDebt;
    const expressionTimer = setTimeout(() => setExpression('neutral'), 2200);
    return () => clearTimeout(expressionTimer);
  }, [totalDebt, shouldReduceMotion]);

  const showRandomComment = (type) => {
    const increase = ['INTEREST NEVER SLEEPS!', 'TICK TOCK, HUNTER!', 'DEBT: DELICIOUS!', 'YOU GONNA PAY THAT?', 'KEEP GHOSTING, I LOVE IT!'];
    const decrease = ['TEMPORARY SETBACK!', "I'LL GET IT BACK LATER.", "FINE, BUT I'M WATCHING.", "YOU'RE NO FUN."];
    const list = type === 'increase' ? increase : decrease;
    setComment(list[Math.floor(Math.random() * list.length)]);
    setTimeout(() => setComment(''), 3200);
  };

  if (!isVisible) return null;

  const getExpressionColor = () => {
    if (isBankrupt) return 'var(--aura-red)';
    if (totalDebt === 0) return 'var(--text-muted)';
    if (totalDebt > 50) return 'var(--aura-red)';
    if (totalDebt > 20) return 'var(--aura-gold)';
    return 'var(--aura-blue)';
  };

  const speechMotion = shouldReduceMotion
    ? {
        initial: { opacity: 0, transform: 'translateY(0) scale(1)' },
        animate: { opacity: 1, transform: 'translateY(0) scale(1)' },
        exit: { opacity: 0, transform: 'translateY(0) scale(1)' }
      }
    : {
        initial: { opacity: 0, transform: 'translateY(6px) scale(.96)' },
        animate: { opacity: 1, transform: 'translateY(0) scale(1)' },
        exit: { opacity: 0, transform: 'translateY(2px) scale(.98)' }
      };

  return (
    <motion.div
      className={`potclean-root ${totalDebt === 0 ? 'dormant' : 'active'} ${isBankrupt ? 'toritaten-mode' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: .16, ease: [0.2, 0, 0, 1] }}
      drag
      dragMomentum={false}
      dragConstraints={{ left: -window.innerWidth + 150, right: 0, top: -window.innerHeight + 150, bottom: 0 }}
    >
      <AnimatePresence initial={false}>
        {comment && (
          <motion.div
            className="potclean-speech"
            {...speechMotion}
            transition={{ type: 'spring', duration: .3, bounce: 0 }}
          >
            {comment}
            <div className="speech-arrow" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="potclean-body-container">
        <div className="potclean-stats" style={{ '--potclean-color': getExpressionColor(), opacity: totalDebt === 0 ? .55 : 1 }}>
          <span className="label">{isBankrupt ? 'Bankrupt' : totalDebt === 0 ? 'System ready' : 'Accumulated'}</span>
          <span className="value">
            {totalDebt === 0 ? '0' : displayDebt} <span>APR</span>
          </span>
        </div>

        <div className="potclean-svg-wrapper">
          <PotcleanMascot
            expression={expression}
            isBankrupt={isBankrupt}
            totalDebt={totalDebt}
            getExpressionColor={getExpressionColor}
          />
          {(totalDebt > 0 || isBankrupt) && <div className="aura-glow" style={{ backgroundColor: getExpressionColor() }} />}
        </div>
      </div>

      <button className="potclean-close" onClick={() => setIsVisible(false)} aria-label="Hide Potclean">×</button>
    </motion.div>
  );
};
