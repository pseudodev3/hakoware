import React from 'react';
import './Input.css';

/**
 * Professional, accessible input component with aura styling.
 */
export const Input = ({ 
  label, 
  error, 
  icon: Icon, 
  className = '', 
  ...props 
}) => {
  return (
    <div className={`input-group ${className} ${error ? 'has-error' : ''}`}>
      {label && <label className="input-label">{label}</label>}
      <div className="input-wrapper">
        {Icon && <Icon className="input-icon" size={18} />}
        <input 
          className="input-field"
          {...props}
        />
      </div>
      {error && <p className="input-error-msg">{error}</p>}
    </div>
  );
};
