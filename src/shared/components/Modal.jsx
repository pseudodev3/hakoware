import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import './Modal.css';

/**
 * Premium Modal with backdrop and smooth animations.
 */
export const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  showClose = true
}) => {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOpen]);

  const sizes = {
    sm: { maxWidth: '400px' },
    md: { maxWidth: '540px' },
    lg: { maxWidth: '720px' },
    xl: { maxWidth: '1000px' }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-root">
          <motion.div 
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          <motion.div 
            className="modal-content glass"
            style={sizes[size]}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <header className="modal-header">
              <div className="modal-title">
                {typeof title === 'string' ? (
                  <h3>{title.toUpperCase()}</h3>
                ) : title}
              </div>
              {showClose && (
                <button className="modal-close" onClick={onClose}>
                  <X size={20} />
                </button>
              )}
            </header>
            
            <div className="modal-body">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
