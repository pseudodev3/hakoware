import React, { useId } from 'react';
import './Input.css';

export const Input = ({ 
  label, 
  error, 
  icon: Icon, 
  id,
  className = '', 
  ...props 
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const describedBy = [props['aria-describedby'], error && `${inputId}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`input-group ${className} ${error ? 'has-error' : ''}`}>
      {label && <label className="input-label" htmlFor={inputId}>{label}</label>}
      <div className="input-wrapper">
        {Icon && <Icon className="input-icon" size={18} aria-hidden="true" />}
        <input 
          className="input-field"
          {...props}
          id={inputId}
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={describedBy}
        />
      </div>
      {error && <p className="input-error-msg" id={`${inputId}-error`}>{error}</p>}
    </div>
  );
};
