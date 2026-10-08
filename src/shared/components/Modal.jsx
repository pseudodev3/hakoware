import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import './Modal.css';

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showClose = true,
  footer = null,
  manageFocus = true,
  initialFocusSelector
}) => {
  const shouldReduceMotion = useReducedMotion();

  const contentRef = useRef(null);
  const closeRef = useRef(onClose);
  const initialSelectorRef = useRef(initialFocusSelector);
  initialSelectorRef.current = initialFocusSelector;
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const content = contentRef.current;
    const opener = document.activeElement;
    const isTopDialog = () => [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
      .filter((element) => element.getBoundingClientRect().width && element.getBoundingClientRect().height).at(-1) === content;
    const backgrounds = manageFocus ? [...document.body.children]
      .filter((element) => element instanceof HTMLElement && element !== content?.closest('.modal-root'))
      .map((element) => ({ element, inert: element.inert })) : [];
    backgrounds.forEach(({ element }) => { element.inert = true; });
    const controls = () => [...(content?.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,a[href],[tabindex]:not([tabindex="-1"])') || [])]
      .filter((element) => element.getBoundingClientRect().width && element.getBoundingClientRect().height
        && getComputedStyle(element).visibility !== 'hidden'
        && !element.closest('[inert]')
        && (element.tagName === 'SUMMARY' || !element.closest('details:not([open])')));
    const focusFirst = () => (content?.querySelector(initialSelectorRef.current || '[autofocus]') || controls()[0] || content)?.focus({ preventScroll: true });
    const frame = manageFocus ? requestAnimationFrame(() => { if (isTopDialog()) focusFirst(); }) : null;
    const onKeyDown = (event) => {
      if (!isTopDialog()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current?.();
      } else if (manageFocus && event.key === 'Tab') {
        const list = controls();
        const first = list[0]; const last = list.at(-1);
        if (!first) { event.preventDefault(); content?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !content.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !content.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    };
    const keepFocus = (event) => {
      if (manageFocus && isTopDialog() && !content?.contains(event.target)) focusFirst();
    };
    document.addEventListener('keydown', onKeyDown);
    if (manageFocus) document.addEventListener('focusin', keepFocus);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', keepFocus);
      backgrounds.forEach(({ element, inert }) => { element.inert = inert; });
      if (manageFocus && opener?.isConnected && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
    };
  }, [isOpen, manageFocus]);

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

  const modal = (
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
            ref={contentRef}
            tabIndex={-1}
            className={`modal-content ${footer ? 'has-footer' : ''}`}
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
            {footer && <footer className="modal-footer">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document === 'undefined' ? modal : createPortal(modal, document.body);
};
