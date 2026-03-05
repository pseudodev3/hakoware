import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  const baseStyles = "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-all focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200 focus:ring-zinc-400",
    secondary: "bg-zinc-800 text-white border border-zinc-700 hover:bg-zinc-700 focus:ring-zinc-600",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    ghost: "bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-800 focus:ring-zinc-700",
    aura: "bg-zinc-900 text-yellow-500 border border-yellow-500/30 hover:bg-yellow-500/10 focus:ring-yellow-500/50 shadow-[0_0_15px_rgba(255,215,0,0.1)]"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  // Note: Using standard CSS classes for Tailwind-like behavior (I will map these in a shared utility or use clsx)
  // For this "No Tailwind" project, I'll use raw CSS objects or class names that I'll define in a button.css
  
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
