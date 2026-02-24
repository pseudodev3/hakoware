import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { calculateDebt } from '../utils/gameLogic';

/**
 * Potclean - The Debt Collector Mascot
 * 
 * From Hunter x Hunter, Potclean is the rabbit-like mascot that follows
 * the debtor and displays their increasing debt in real-time.
 * 
 * Features:
 * - Floating animation that follows scroll
 * - Real-time debt counter (ticks up visually)
 * - Expression changes based on debt level
 * - Sassy comments when debt increases
 * - Celebrates when debt-free
 */
const Potclean = ({ friendships = [] }) => {
  const { user } = useAuth();
  const [totalDebt, setTotalDebt] = useState(0);
  const [displayDebt, setDisplayDebt] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [expression, setExpression] = useState('neutral');
  const [comment, setComment] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const prevDebtRef = useRef(0);
  const containerRef = useRef(null);

  // Calculate total debt across all friendships
  useEffect(() => {
    if (!Array.isArray(friendships) || friendships.length === 0) {
      setTotalDebt(0);
      return;
    }

    const debt = friendships.reduce((acc, f) => {
      const isUser1 = f.myPerspective === 'user1';
      const myData = isUser1 ? f.user1Perspective : f.user2Perspective;
      const stats = calculateDebt({
        baseDebt: myData.baseDebt,
        lastInteraction: myData.lastInteraction,
        bankruptcyLimit: myData.limit
      });
      return acc + stats.totalDebt;
    }, 0);

    setTotalDebt(debt);
  }, [friendships]);

  // Animate debt counter when it changes
  useEffect(() => {
    const prevDebt = prevDebtRef.current;
    const diff = totalDebt - prevDebt;
    
    if (diff !== 0) {
      // Determine expression based on debt change
      if (diff > 0) {
        setExpression('angry');
        setIsAnimating(true);
        showRandomComment('debt_increase');
        setTimeout(() => {
          setExpression('neutral');
          setIsAnimating(false);
        }, 2000);
      } else if (diff < 0) {
        setExpression('happy');
        setIsAnimating(true);
        showRandomComment('debt_decrease');
        setTimeout(() => {
          setExpression('neutral');
          setIsAnimating(false);
        }, 2000);
      }
      
      // Animate the counter
      const duration = 1000;
      const startTime = Date.now();
      const startValue = displayDebt;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        
        const currentValue = Math.round(startValue + (diff * easeProgress));
        setDisplayDebt(currentValue);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
      prevDebtRef.current = totalDebt;
    }
  }, [totalDebt]);

  // Set expression based on debt level
  useEffect(() => {
    if (totalDebt === 0) setExpression('celebrating');
    else if (totalDebt > 50) setExpression('furious');
    else if (totalDebt > 20) setExpression('angry');
    else if (totalDebt > 5) setExpression('worried');
    else setExpression('neutral');
  }, [totalDebt]);

  const showRandomComment = (type) => {
    const comments = {
      debt_increase: [
        "Your debt grows...",
        "Tick tock, interest clock!",
        "I'm getting hungry for more!",
        "That's +1 for me!",
        "Keep ghosting, I love it!",
        "Your friends are waiting...",
        "Interest never sleeps!",
        "I'm counting every APR!",
        "Debt: Delicious!",
        "You gonna pay that?"
      ],
      debt_decrease: [
        "Finally paying up?",
        "Good job... I guess.",
        "I'll get it back eventually!",
        "Temporary setback!",
        "Don't get too comfortable!"
      ]
    };
    
    const list = comments[type] || comments.debt_increase;
    const randomComment = list[Math.floor(Math.random() * list.length)];
    setComment(randomComment);
    
    setTimeout(() => setComment(''), 3000);
  };

  const getExpressionColor = () => {
    switch (expression) {
      case 'celebrating': return '#00e676';
      case 'furious': return '#ff0000';
      case 'angry': return '#ff4444';
      case 'worried': return '#ff8800';
      case 'happy': return '#33b5e5';
      default: return '#ffd700';
    }
  };

  const getEyeShape = () => {
    switch (expression) {
      case 'angry':
      case 'furious':
        return (
          <>
            {/* Angry slanted eyes */}
            <path d="M35 55 L45 60" stroke="#000" strokeWidth="3" strokeLinecap="round" />
            <path d="M45 55 L35 60" stroke="#000" strokeWidth="3" strokeLinecap="round" />
            <path d="M65 55 L75 60" stroke="#000" strokeWidth="3" strokeLinecap="round" />
            <path d="M75 55 L65 60" stroke="#000" strokeWidth="3" strokeLinecap="round" />
          </>
        );
      case 'worried':
        return (
          <>
            {/* Worried curved eyes */}
            <path d="M35 60 Q40 55 45 60" stroke="#000" strokeWidth="3" fill="none" />
            <path d="M65 60 Q70 55 75 60" stroke="#000" strokeWidth="3" fill="none" />
          </>
        );
      case 'happy':
      case 'celebrating':
        return (
          <>
            {/* Happy ^ eyes */}
            <path d="M35 60 L40 55 L45 60" stroke="#000" strokeWidth="3" fill="none" />
            <path d="M65 60 L70 55 L75 60" stroke="#000" strokeWidth="3" fill="none" />
          </>
        );
      default:
        return (
          <>
            {/* Neutral round eyes */}
            <circle cx="40" cy="58" r="5" fill="#000" />
            <circle cx="70" cy="58" r="5" fill="#000" />
          </>
        );
    }
  };

  const getMouthShape = () => {
    switch (expression) {
      case 'angry':
      case 'furious':
        return <path d="M45 75 Q55 70 65 75" stroke="#000" strokeWidth="3" fill="none" />;
      case 'worried':
        return <ellipse cx="55" cy="78" rx="5" ry="8" fill="#000" />;
      case 'happy':
      case 'celebrating':
        return <path d="M45 75 Q55 85 65 75" stroke="#000" strokeWidth="3" fill="none" />;
      default:
        return <path d="M50 78 L60 78" stroke="#000" strokeWidth="3" strokeLinecap="round" />;
    }
  };

  if (!isVisible) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        pointerEvents: 'none'
      }}
    >
      {/* Speech Bubble */}
      {comment && (
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #444',
          borderRadius: '12px',
          padding: '10px 15px',
          maxWidth: '200px',
          position: 'relative',
          marginBottom: '10px',
          animation: 'fadeInOut 3s ease'
        }}>
          <p style={{
            margin: 0,
            color: '#fff',
            fontSize: '0.8rem',
            textAlign: 'center'
          }}>
            {comment}
          </p>
          <div style={{
            position: 'absolute',
            bottom: '-8px',
            right: '40px',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid #444'
          }} />
        </div>
      )}

      {/* Debt Counter Display */}
      <div style={{
        background: 'linear-gradient(145deg, #1a1a1a, #0a0a0a)',
        border: `2px solid ${getExpressionColor()}`,
        borderRadius: '12px',
        padding: '8px 16px',
        boxShadow: `0 0 20px ${getExpressionColor()}40`,
        minWidth: '120px',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '0.65rem',
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '2px'
        }}>
          Total Debt
        </div>
        <div style={{
          fontSize: '1.3rem',
          fontWeight: 'bold',
          color: totalDebt > 0 ? '#ff4444' : '#00e676'
        }}>
          {displayDebt} <span style={{ fontSize: '0.7rem' }}>APR</span>
        </div>
      </div>

      {/* Potclean SVG */}
      <div style={{
        width: '110px',
        height: '110px',
        animation: isAnimating ? 'potcleanBounce 0.5s ease' : 'potcleanFloat 3s ease-in-out infinite',
        filter: `drop-shadow(0 0 15px ${getExpressionColor()}50)`,
        cursor: 'pointer',
        pointerEvents: 'auto'
      }} onClick={() => showRandomComment('debt_increase')}>
        <svg viewBox="0 0 110 110" width="100%" height="100%">
          {/* Glow Effect */}
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={getExpressionColor()} stopOpacity="0.3" />
              <stop offset="100%" stopColor={getExpressionColor()} stopOpacity="0" />
            </radialGradient>
          </defs>
          
          {/* Background Glow */}
          <circle cx="55" cy="55" r="50" fill="url(#glow)" />
          
          {/* Left Ear */}
          <ellipse cx="35" cy="25" rx="12" ry="20" fill="#f5f5f5" stroke="#ddd" strokeWidth="2" />
          <ellipse cx="35" cy="25" rx="6" ry="12" fill="#ffb6c1" />
          
          {/* Right Ear */}
          <ellipse cx="75" cy="25" rx="12" ry="20" fill="#f5f5f5" stroke="#ddd" strokeWidth="2" />
          <ellipse cx="75" cy="25" rx="6" ry="12" fill="#ffb6c1" />
          
          {/* Body (round) */}
          <circle cx="55" cy="65" r="35" fill="#f5f5f5" stroke="#ddd" strokeWidth="2" />
          
          {/* Belly */}
          <ellipse cx="55" cy="75" rx="20" ry="15" fill="#fff" />
          
          {/* Face */}
          {getEyeShape()}
          
          {/* Nose */}
          <ellipse cx="55" cy="68" rx="3" ry="2" fill="#ffb6c1" />
          
          {/* Mouth */}
          {getMouthShape()}
          
          {/* Whiskers */}
          <path d="M25 65 L40 68" stroke="#999" strokeWidth="1" />
          <path d="M25 72 L40 70" stroke="#999" strokeWidth="1" />
          <path d="M85 65 L70 68" stroke="#999" strokeWidth="1" />
          <path d="M85 72 L70 70" stroke="#999" strokeWidth="1" />
          
          {/* Little Arms */}
          <ellipse cx="25" cy="70" rx="8" ry="6" fill="#f5f5f5" stroke="#ddd" strokeWidth="1" />
          <ellipse cx="85" cy="70" rx="8" ry="6" fill="#f5f5f5" stroke="#ddd" strokeWidth="1" />
          
          {/* Little Feet */}
          <ellipse cx="40" cy="95" rx="8" ry="5" fill="#f5f5f5" stroke="#ddd" strokeWidth="1" />
          <ellipse cx="70" cy="95" rx="8" ry="5" fill="#f5f5f5" stroke="#ddd" strokeWidth="1" />
          
          {/* Tail */}
          <circle cx="90" cy="55" r="8" fill="#f5f5f5" stroke="#ddd" strokeWidth="1" />
          <circle cx="95" cy="50" r="5" fill="#ffb6c1" />
        </svg>
      </div>

      {/* Minimize Button */}
      <button
        onClick={() => setIsVisible(false)}
        style={{
          position: 'absolute',
          top: '-5px',
          right: '-5px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: '#333',
          border: '1px solid #555',
          color: '#888',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto'
        }}
      >
        ×
      </button>

      {/* CSS Animations */}
      <style>{`
        @keyframes potcleanFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes potcleanBounce {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.1) translateY(-5px); }
          50% { transform: scale(0.95) translateY(2px); }
          75% { transform: scale(1.05) translateY(-3px); }
        }
        
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(10px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

export default Potclean;
