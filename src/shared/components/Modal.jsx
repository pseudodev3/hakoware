import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import './Modal.css';

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showClose = true
}) => {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const sizes = {
    sm: { maxWidth: '400px' },
    md: { maxWidth: '540px' },
    lg: { maxWidth: '720px' },
    xl: { maxWidth: '1000px' }
  };

  const contentMotion = shouldReduceMotion
    ? {
        initial: { opacity: 0, transform: 'translateY(0) scale(1)' },
        animate: { opacity: 1, transform: 'translateY(0) scale(1)' },
        exit: { opacity: 0, transform: 'translateY(0) scale(1)' },
        transition: { duration: .14, ease: [0.2, 0, 0, 1] }
      }
    : {
        initial: { opacity: 0, transform: 'translateY(10px) scale(.97)' },
        animate: { opacity: 1, transform: 'translateY(0) scale(1)' },
        exit: { opacity: 0, transform: 'translateY(6px) scale(.985)' },
        transition: { type: 'spring', duration: .3, bounce: 0 }
      };

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <div className="modal-root" role="presentation">
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: .16, ease: [0.2, 0, 0, 1] }}
            onClick={onClose}
          />

          <motion.div
            className="modal-content"
            style={sizes[size]}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : 'Dialog'}
            {...contentMotion}
          >
            <header className="modal-header">
              <div className="modal-title">{typeof title === 'string' ? <h3>{title}</h3> : title}</div>
              {showClose && (
                <button className="modal-close" onClick={onClose} aria-label="Close dialog">
                  <X size={19} strokeWidth={1.8} />
                </button>
              )}
            </header>
            <div className="modal-body">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
