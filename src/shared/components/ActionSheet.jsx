import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './ActionSheet.css';

export const ActionSheet = ({ title, onClose, children, footer }) => {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (dialog.current && !dialog.current.contains(document.activeElement)) {
      dialog.current.querySelector('button')?.focus();
    }
  });
  const trapFocus = (event) => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(
      dialog.current.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
      ),
    ).filter((element) => element.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="action-sheet"
      aria-label={title}
      onKeyDown={trapFocus}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          const bounds = dialog.current.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            close.current();
        }
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          autoFocus
        >
          <X size={20} />
        </button>
      </header>
      <div className="action-sheet-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </dialog>,
    document.body,
  );
};
