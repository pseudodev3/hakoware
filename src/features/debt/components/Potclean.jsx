import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../contexts/AuthContext';
import './Potclean.css';

/**
 * Professional, high-fidelity Potclean Mascot.
 * Tracks user debt visually with a premium HxH aesthetic.
 */
export const Potclean = ({ friendships = [] }) => {
  const { user } = useAuth();
  const [totalDebt, setTotalDebt] = useState(0);
  const [displayDebt, setDisplayDebt] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [expression, setExpression] = useState('neutral');
  const [comment, setComment] = useState('');
  
  const prevDebtRef = useRef(0);

  // Calculate total debt across all friendships
  useEffect(() => {
    if (!Array.isArray(friendships) || friendships.length === 0) {
      setTotalDebt(0);
      return;
    }

    const debt = friendships.reduce((acc, f) => {
      const isUser1 = f.user1._id === (user?.uid || user?.id) || f.user1 === (user?.uid || user?.id);
      const perspective = isUser1 ? f.user1Perspective : f.user2Perspective;
      if (!perspective) return acc;

      const interactionDate = new Date(perspective.lastInteraction || 0);
      const now = new Date();
      const daysMissed = Math.floor(Math.max(0, now - interactionDate) / (1000 * 60 * 60 * 24));
      const daysOverLimit = Math.max(0, daysMissed - (perspective.limit || 7));
      return acc + (perspective.baseDebt || 0) + daysOverLimit;
    }, 0);

    setTotalDebt(debt);
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

  if (!isVisible || totalDebt === 0) return null;

  const getExpressionColor = () => {
    if (totalDebt > 50) return 'var(--aura-red)';
    if (totalDebt > 20) return 'var(--aura-gold)';
    return 'var(--aura-blue)';
  };

  return (
    <motion.div 
      className="potclean-root"
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
        <div className="potclean-stats glass" style={{ borderColor: getExpressionColor() }}>
          <span className="label">ACCUMULATED</span>
          <span className="value" style={{ color: getExpressionColor() }}>{displayDebt} <span>APR</span></span>
        </div>

        <motion.div 
          className="potclean-svg-wrapper"
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        >
          <svg viewBox="0 0 100 100" className="potclean-svg">
            <circle cx="50" cy="65" r="30" fill="white" stroke="#ddd" strokeWidth="2" />
            <ellipse cx="50" cy="75" rx="15" ry="10" fill="#f0f0f0" />
            
            {/* Ears */}
            <ellipse cx="35" cy="30" rx="8" ry="15" fill="white" stroke="#ddd" strokeWidth="2" transform="rotate(-15, 35, 30)" />
            <ellipse cx="65" cy="30" rx="8" ry="15" fill="white" stroke="#ddd" strokeWidth="2" transform="rotate(15, 65, 30)" />
            
            {/* Face */}
            {expression === 'angry' ? (
              <g>
                <path d="M40 55 L45 60" stroke="black" strokeWidth="2" />
                <path d="M60 55 L55 60" stroke="black" strokeWidth="2" />
                <path d="M42 75 Q50 70 58 75" fill="none" stroke="black" strokeWidth="2" />
              </g>
            ) : expression === 'happy' ? (
              <g>
                <path d="M40 58 Q45 53 50 58" fill="none" stroke="black" strokeWidth="2" />
                <path d="M50 58 Q55 53 60 58" fill="none" stroke="black" strokeWidth="2" />
                <path d="M42 72 Q50 80 58 72" fill="none" stroke="black" strokeWidth="2" />
              </g>
            ) : (
              <g>
                <circle cx="43" cy="58" r="3" fill="black" />
                <circle cx="57" cy="58" r="3" fill="black" />
                <line x1="45" y1="75" x2="55" y2="75" stroke="black" strokeWidth="2" strokeLinecap="round" />
              </g>
            )}
            
            <circle cx="50" cy="65" r="2" fill="#ffb6c1" />
          </svg>
          <div className="aura-glow" style={{ backgroundColor: getExpressionColor() }} />
        </motion.div>
      </div>

      <button className="potclean-close" onClick={() => setIsVisible(false)}>×</button>
    </motion.div>
  );
};
