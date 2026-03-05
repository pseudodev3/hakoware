import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplets, Sparkles, Wind, Flame, Zap, BrainCircuit, Activity } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { useAuth } from '../../../contexts/AuthContext';
import './WaterDivinationModal.css';

const NEN_TYPES = [
  { id: 'ENHANCER', icon: Flame, color: '#ff4444', desc: 'Increases Aura generation rate.' },
  { id: 'TRANSMUTER', icon: Zap, color: '#ffd700', desc: 'Decreases daily interest (APR) accumulation.' },
  { id: 'CONJURER', icon: Droplets, color: '#00e676', desc: 'Can hide one contract from the Bounty Board.' },
  { id: 'EMITTER', icon: Wind, color: '#00e5ff', desc: 'Send voice notes without recent check-ins.' },
  { id: 'MANIPULATOR', icon: BrainCircuit, color: '#9d00ff', desc: 'Increases Grace Period of your contracts.' },
  { id: 'SPECIALIST', icon: Sparkles, color: '#ff00ff', desc: 'Randomly copies buffs from active contracts.' }
];

export const WaterDivinationModal = () => {
  const { user, setNenType } = useAuth();
  const [isTesting, setIsTesting] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [result, setResult] = useState(null);
  const [hasFinished, setHasFinished] = useState(false);
  
  if (!user || user.nenType || hasFinished) return null;

  const performTest = () => {
    setIsTesting(true);
    
    // Simulate the test duration
    setTimeout(() => {
      const randomType = NEN_TYPES[Math.floor(Math.random() * NEN_TYPES.length)];
      setResult(randomType);
      setIsTesting(false);
    }, 3000);
  };

  const acceptResult = async () => {
    if (result) {
      setIsAccepting(true);
      try {
        const success = await setNenType(result.id);
        if (success) {
          setHasFinished(true);
        }
      } catch (err) {
        console.error("Failed to set Nen type", err);
      } finally {
        setIsAccepting(false);
      }
    }
  };

  return (
    <div className="water-divination-overlay">
      <motion.div 
        className="water-divination-card glass"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        {!result && !isTesting && (
          <div className="test-intro">
            <Activity size={48} color="var(--aura-blue)" className="pulse-icon" />
            <h2>WATER DIVINATION TEST</h2>
            <p>Before you enter the Association, you must discover your Nen affinity. This will grant you unique passive abilities in the Hakoware system.</p>
            <Button variant="aura" size="lg" onClick={performTest}>
              BEGIN TEST
            </Button>
          </div>
        )}

        {isTesting && (
          <div className="test-active">
            <motion.div 
              className="water-glass"
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <Droplets size={64} color="var(--aura-blue)" />
            </motion.div>
            <h3>ANALYZING AURA...</h3>
            <p>Place your hands around the glass.</p>
          </div>
        )}

        {result && !isTesting && (
          <motion.div 
            className="test-result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="result-icon-wrapper" style={{ color: result.color, borderColor: result.color }}>
              <result.icon size={48} />
              <div className="result-glow" style={{ backgroundColor: result.color }} />
            </div>
            <h2 style={{ color: result.color }}>{result.id}</h2>
            <p className="result-desc">{result.desc}</p>
            <Button 
              variant="primary" 
              size="lg" 
              onClick={acceptResult}
              loading={isAccepting}
            >
              ACCEPT AFFINITY
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
