import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';
import './Toast.css';

/**
 * High-fidelity Toast Notification.
 * Professional HxH aesthetic with motion feedback.
 */
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const getIcon = () => {
    switch (type) {
      case 'ERROR': return <AlertCircle size={18} color="var(--aura-red)" />;
      case 'MERCY': return <Sparkles size={18} color="var(--aura-gold)" />;
      default: return <CheckCircle2 size={18} color="var(--aura-green)" />;
    }
  };

  return (
    <motion.div 
      className={`toast-root glass ${type?.toLowerCase() || 'success'}`}
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
    >
      <div className="toast-content">
        <div className="toast-icon">
          {getIcon()}
        </div>
        <div className="toast-body">
          <span className="toast-message">{message}</span>
        </div>
        <button className="toast-close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <div className="toast-progress-bar" />
    </motion.div>
  );
};

export default Toast;
