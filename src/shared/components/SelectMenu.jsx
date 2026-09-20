import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import './SelectMenu.css';

export const SelectMenu = ({
  value,
  options = [],
  onChange,
  placeholder = 'Choose',
  ariaLabel = 'Choose option',
  disabled = false,
  placement = 'bottom'
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();
  const selected = options.find((option) => String(option.value) === String(value));

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  const choose = (nextValue) => {
    onChange?.(nextValue);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div
      ref={rootRef}
      className={`select-menu ${open ? 'is-open' : ''} select-menu--${placement}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="select-menu__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!disabled) setOpen(true);
          }
        }}
      >
        <span className={`select-menu__value ${selected ? '' : 'is-placeholder'}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className="select-menu__chevron" size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>

      {open && (
        <div id={menuId} className="select-menu__popover" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const active = String(option.value) === String(value);
            return (
              <button
                key={String(option.value)}
                type="button"
                className={`select-menu__option ${active ? 'is-selected' : ''}`}
                role="option"
                aria-selected={active}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {active && <Check size={15} strokeWidth={2} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
