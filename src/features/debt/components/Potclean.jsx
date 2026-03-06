import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../contexts/AuthContext';
import './Potclean.css';

/**
 * Professional, high-fidelity Potclean Mascot.
 * Tracks user debt visually with a premium HxH aesthetic.
 */
/**
 * Redesigned High-Fidelity Potclean Mascot
 */
const PotcleanMascot = ({ expression, isBankrupt, totalDebt, getExpressionColor }) => {
  const color = getExpressionColor();
  
  if (isBankrupt) {
    // Toritaten (Bankrupt Mode) - High Fidelity
    return (
      <svg viewBox="0 0 100 120" className="potclean-svg toritaten">
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
        
        {/* Shadow Pod */}
        <ellipse cx="50" cy="110" rx="30" ry="8" fill="rgba(0,0,0,0.4)" />
        
        {/* Main Body */}
        <path d="M20 70 Q20 30 50 30 Q80 30 80 70 Q80 100 50 105 Q20 100 20 70" fill="url(#toritatenGradient)" stroke="var(--aura-red)" strokeWidth="1.5" />
        
        {/* Horns/Ears */}
        <path d="M30 35 L15 15 L35 32 Z" fill="#000" stroke="var(--aura-red)" strokeWidth="1" />
        <path d="M70 35 L85 15 L65 32 Z" fill="#000" stroke="var(--aura-red)" strokeWidth="1" />
        
        {/* Menacing Eyes */}
        <g filter="url(#auraGlow)">
          <path d="M35 55 Q40 50 45 55" fill="none" stroke="var(--aura-red)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M55 55 Q60 50 65 55" fill="none" stroke="var(--aura-red)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="40" cy="62" r="3" fill="var(--aura-red)" className="eye-pulse" />
          <circle cx="60" cy="62" r="3" fill="var(--aura-red)" className="eye-pulse" />
        </g>
        
        {/* Sinister Mouth */}
        <path d="M35 85 Q50 75 65 85" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        
        {/* Debt Tag */}
        <rect x="35" y="40" width="30" height="10" rx="2" fill="#111" stroke="var(--aura-red)" strokeWidth="0.5" />
        <text x="50" y="47" textAnchor="middle" fontSize="6" fill="var(--aura-red)" fontWeight="bold">BANKRUPT</text>
      </svg>
    );
  }

  // Normal Potclean - High Fidelity
  return (
    <svg viewBox="0 0 100 120" className="potclean-svg">
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

      {/* Shadow */}
      <ellipse cx="50" cy="112" rx="25" ry="6" fill="rgba(0,0,0,0.1)" />

      {/* Ears */}
      <g className="potclean-ears">
        <path d="M30 45 Q15 5 35 35 Z" fill="url(#bodyGradient)" stroke="#e0e0e0" strokeWidth="1" />
        <path d="M70 45 Q85 5 65 35 Z" fill="url(#bodyGradient)" stroke="#e0e0e0" strokeWidth="1" />
        <path d="M28 38 Q22 20 32 35 Z" fill="#ffdae0" opacity="0.5" />
        <path d="M72 38 Q78 20 68 35 Z" fill="#ffdae0" opacity="0.5" />
      </g>

      {/* Main Body */}
      <circle cx="50" cy="75" r="35" fill="url(#bodyGradient)" stroke="#e0e0e0" strokeWidth="1" />
      
      {/* Belly */}
      <ellipse cx="50" cy="85" rx="20" ry="18" fill="white" />

      {/* Cheeks */}
      <circle cx="32" cy="78" r="8" fill="url(#cheekGradient)" />
      <circle cx="68" cy="78" r="8" fill="url(#cheekGradient)" />

      {/* Face Logic */}
      <g className="potclean-face">
        {totalDebt === 0 ? (
          // Sleeping/Dormant
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
        
        {/* Nose */}
        <ellipse cx="50" cy="78" rx="2.5" ry="1.8" fill="#ffb6c1" />
      </g>

      {/* Floating APR Display inside body */}
      <g opacity="0.8">
        <rect x="35" y="48" width="30" height="12" rx="6" fill="white" stroke={color} strokeWidth="1" />
        <text x="50" y="56" textAnchor="middle" fontSize="7" fill={color} fontWeight="bold" fontFamily="monospace">
          {totalDebt}
        </text>
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
  
  const prevDebtRef = useRef(0);

  // Calculate total debt across all friendships
  useEffect(() => {
    if (!Array.isArray(friendships) || friendships.length === 0) {
      setTotalDebt(0);
      setIsBankrupt(false);
      return;
    }

    let bankrupt = false;
    const debt = friendships.reduce((acc, f) => {
      const isUser1 = f.user1?._id === (user?.uid || user?.id) || f.user1 === (user?.uid || user?.id);
      const perspective = isUser1 ? f.user1Perspective : f.user2Perspective;
      if (!perspective) return acc;

      const interactionDate = new Date(perspective.lastInteraction || 0);
      const now = new Date();
      const daysMissed = Math.floor(Math.max(0, now - interactionDate) / (1000 * 60 * 60 * 24));
      const daysOverLimit = Math.max(0, daysMissed - (perspective.limit || 7));
      const currentDebt = (perspective.baseDebt || 0) + daysOverLimit;
      
      if (currentDebt >= (perspective.limit || 7) * 2) {
        bankrupt = true;
      }
      
      return acc + currentDebt;
    }, 0);

    setTotalDebt(debt);
    setIsBankrupt(bankrupt);
  }, [friendships, user]);

  // Handle debt changes and comments
  useEffect(() => {
    const diff = totalDebt - prevDebtRef.current;
    
    if (diff !== 0) {
      if (diff > 0) {
        setExpression('angry');
        showRandomComment('increase');
      } else {
        setExpression('happy');
        showRandomComment('decrease');
      }
      
      // Animate counter
      const start = displayDebt;
      const end = totalDebt;
      const duration = 1000;
      let startTime = null;

      const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        setDisplayDebt(current);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      
      prevDebtRef.current = totalDebt;
      setTimeout(() => setExpression('neutral'), 3000);
    }
  }, [totalDebt]);

  const showRandomComment = (type) => {
    const inc = ["INTEREST NEVER SLEEPS!", "TICK TOCK, HUNTER!", "DEBT: DELICIOUS!", "YOU GONNA PAY THAT?", "KEEP GHOSTING, I LOVE IT!"];
    const dec = ["TEMPORARY SETBACK!", "I'LL GET IT BACK LATER.", "FINE, BUT I'M WATCHING.", "YOU'RE NO FUN."];
    const list = type === 'increase' ? inc : dec;
    setComment(list[Math.floor(Math.random() * list.length)]);
    setTimeout(() => setComment(''), 4000);
  };

  if (!isVisible) return null;

  const getExpressionColor = () => {
    if (isBankrupt) return 'var(--aura-red)';
    if (totalDebt === 0) return 'var(--text-muted)';
    if (totalDebt > 50) return 'var(--aura-red)';
    if (totalDebt > 20) return 'var(--aura-gold)';
    return 'var(--aura-blue)';
  };

  return (
    <motion.div 
      className={`potclean-root ${totalDebt === 0 ? 'dormant' : 'active'} ${isBankrupt ? 'toritaten-mode' : ''}`}
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      drag
      dragConstraints={{ left: -window.innerWidth + 150, right: 0, top: -window.innerHeight + 150, bottom: 0 }}
    >
      <AnimatePresence>
        {comment && (
          <motion.div 
            className="potclean-speech"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            {comment}
            <div className="speech-arrow" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="potclean-body-container">
        <div className="potclean-stats glass" style={{ borderColor: getExpressionColor(), opacity: totalDebt === 0 ? 0.5 : 1 }}>
          <span className="label">{isBankrupt ? 'BANKRUPT' : totalDebt === 0 ? 'SYSTEM READY' : 'ACCUMULATED'}</span>
          <span className="value" style={{ color: getExpressionColor() }}>
            {totalDebt === 0 ? '0' : displayDebt} <span>APR</span>
          </span>
        </div>

        <motion.div 
          className="potclean-svg-wrapper"
          animate={{ 
            y: totalDebt === 0 ? 0 : [0, -10, 0],
            opacity: totalDebt === 0 ? 0.3 : 1,
            scale: isBankrupt ? 1.2 : 1
          }}
          transition={{ repeat: Infinity, duration: isBankrupt ? 1 : 3, ease: "easeInOut" }}
        >
          <PotcleanMascot 
            expression={expression}
            isBankrupt={isBankrupt}
            totalDebt={totalDebt}
            getExpressionColor={getExpressionColor}
          />
          {(totalDebt > 0 || isBankrupt) && <div className="aura-glow" style={{ backgroundColor: getExpressionColor() }} />}
        </motion.div>
      </div>

      <button className="potclean-close" onClick={() => setIsVisible(false)}>×</button>
    </motion.div>
  );
};
