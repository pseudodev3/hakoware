import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ShieldCheck, Zap, UserPlus, MessageSquare, Award } from 'lucide-react';
import { Button } from '../../../shared/components/Button';
import { useAuth } from '../../../contexts/AuthContext';

/**
 * Professional Hunter Exam Overlay.
 * Guides new users through the onboarding process.
 */
export const HunterExamOverlay = () => {
  const { user } = useAuth();
  
  if (!user || user.hunterLicense) return null;

  const tasks = [
    { 
      id: 'nen', 
      name: 'NEN AFFINITY', 
      desc: 'Discover your aura category.', 
      complete: user.examTasks?.nenTypeSet,
      icon: Zap
    },
    { 
      id: 'friend', 
      name: 'INITIATE CONTRACT', 
      desc: 'Add your first debtor.', 
      complete: user.examTasks?.friendAdded,
      icon: UserPlus
    },
    { 
      id: 'voice', 
      name: 'VOICE AUTHORIZATION', 
      desc: 'Send a voice check-in.', 
      complete: user.examTasks?.voiceNoteSent,
      icon: MessageSquare
    }
  ];

  const allComplete = tasks.every(t => t.complete);

  return (
    <motion.div 
      className="hunter-exam-overlay glass"
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
    >
      <div className="exam-header">
        <h2 className="exam-title">THE HUNTER EXAM</h2>
        <p className="exam-subtitle">COMPLETE THE TASKS TO AUTHORIZE YOUR LICENSE</p>
      </div>

      <div className="task-list">
        {tasks.map((task) => (
          <div key={task.id} className={`task-item ${task.complete ? 'complete' : ''}`}>
            <div className="task-check">
              {task.complete ? <Check size={12} strokeWidth={4} /> : <task.icon size={12} />}
            </div>
            <div className="task-info">
              <span className="task-name">{task.name}</span>
              <span className="task-desc">{task.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {allComplete ? (
        <Button 
          variant="aura" 
          size="lg" 
          className="license-ready-btn"
          icon={Award}
          onClick={() => window.location.reload()} // Refresh to fetch full license status
        >
          CLAIM HUNTER LICENSE
        </Button>
      ) : (
        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          * Full system color and market access remain locked until completion.
        </p>
      )}
    </motion.div>
  );
};
