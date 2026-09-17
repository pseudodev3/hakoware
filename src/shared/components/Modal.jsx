import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOpen]);

  const sizes = {
    sm: { maxWidth: '400px' },
    md: { maxWidth: '540px' },
    lg: { maxWidth: '720px' },
    xl: { maxWidth: '1000px' }
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
            transition={{ duration: .18, ease: [0.2, 0, 0, 1] }}
            onClick={onClose}
          />

          <motion.div
            className="modal-content"
            style={sizes[size]}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : 'Dialog'}
            initial={{ opacity: 0, scale: .97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: .985, y: 6 }}
            transition={{ type: 'spring', duration: .3, bounce: 0 }}
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
