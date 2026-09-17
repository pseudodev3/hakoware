import React from 'react';
import './Button.css';

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  className = '',
  type = 'button'
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || loading}
    className={`btn btn-${variant} btn-${size} ${className} ${loading ? 'loading' : ''}`}
  >
    {loading ? (
      <span className="btn-spinner" aria-hidden="true" />
    ) : Icon ? (
      <Icon size={size === 'sm' ? 15 : 18} strokeWidth={1.8} aria-hidden="true" />
    ) : null}
    <span>{children}</span>
  </button>
);
