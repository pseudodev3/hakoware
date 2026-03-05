import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import './Button.css';

/**
 * Professional, accessible button with motion feedback.
 * SVGs (icons) are supported as props.
 */
export const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'ghost' | 'aura'
  size = 'md',        // 'sm' | 'md' | 'lg'
  icon: Icon, 
  loading = false, 
  disabled = false,
  className = '',
  type = 'button'
}) => {
  return (
    <motion.button
      type={type}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled || loading}
      className={`btn btn-${variant} btn-${size} ${className} ${loading ? 'loading' : ''}`}
    >
      {loading ? (
        <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
      ) : Icon && (
        <Icon size={size === 'sm' ? 14 : 18} />
      )}
      {children}
    </motion.button>
  );
};
