import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Sparkles, X } from 'lucide-react';
import './Toast.css';

const Toast = ({ message, type = 'SUCCESS', onClose }) => {
  const shouldReduceMotion = useReducedMotion();
  const tone = String(type || 'SUCCESS').toUpperCase();

  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const Icon = tone === 'ERROR' ? AlertCircle : tone === 'MERCY' ? Sparkles : CheckCircle2;

  return (
    <motion.div
      className={`toast-root ${tone.toLowerCase()}`}
      role={tone === 'ERROR' ? 'alert' : 'status'}
      aria-live={tone === 'ERROR' ? 'assertive' : 'polite'}
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: .985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: shouldReduceMotion ? .12 : .18, ease: [0.2, 0, 0, 1] }}
    >
      <span className="toast-icon" aria-hidden="true">
        <Icon size={18} strokeWidth={1.9} />
      </span>
      <p className="toast-message">{message}</p>
      <button className="toast-close" type="button" onClick={onClose} aria-label="Dismiss notification">
        <X size={16} strokeWidth={1.8} />
      </button>
    </motion.div>
  );
};

export default Toast;
