// @ts-nocheck
import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { useHaptics } from '../hooks/useHaptics';

interface GiantButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  color?: 'blue' | 'pink' | 'green' | 'amber' | 'slate';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

const GiantButton: React.FC<GiantButtonProps> = ({ 
  children, 
  color = 'blue', 
  onClick, 
  disabled = false,
  className = '', 
  ...props 
}) => {
  const { vibrateMedium } = useHaptics();

  let bgClass = 'bg-neon-blue text-slate-950';
  let shadowClass = 'shadow-[0_0_20px_rgba(0,240,255,0.4)]';
  
  if (disabled) {
    bgClass = 'bg-slate-800 text-slate-500 border border-slate-700';
    shadowClass = 'shadow-none';
  } else {
    switch (color) {
      case 'pink':
        bgClass = 'bg-neon-pink text-white';
        shadowClass = 'shadow-[0_0_20px_rgba(255,20,147,0.4)]';
        break;
      case 'green':
        bgClass = 'bg-neon-green text-slate-950';
        shadowClass = 'shadow-[0_0_20px_rgba(57,255,20,0.4)]';
        break;
      case 'amber':
        bgClass = 'bg-amber-400 text-slate-950';
        shadowClass = 'shadow-[0_0_20px_rgba(251,191,36,0.4)]';
        break;
      case 'slate':
        bgClass = 'bg-slate-800 text-white border border-slate-600';
        shadowClass = 'shadow-lg';
        break;
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    vibrateMedium();
    if (onClick) onClick(e);
  };

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={handleClick}
      disabled={disabled}
      className={`w-full py-5 rounded-2xl font-display font-black text-xl tracking-widest uppercase transition-colors relative overflow-hidden group ${bgClass} ${shadowClass} ${className}`}
      {...props}
    >
      {!disabled && (
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
      )}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
};

export default GiantButton;
