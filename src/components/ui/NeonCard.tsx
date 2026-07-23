// @ts-nocheck
import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface NeonCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  color?: 'blue' | 'pink' | 'green' | 'amber' | 'slate';
  glow?: boolean;
}

const NeonCard: React.FC<NeonCardProps> = ({ 
  children, 
  color = 'blue', 
  glow = true, 
  className = '', 
  ...props 
}) => {
  let borderColor = 'border-neon-blue';
  let shadowClass = 'shadow-neon-blue';
  
  switch (color) {
    case 'pink':
      borderColor = 'border-neon-pink';
      shadowClass = 'shadow-neon-pink';
      break;
    case 'green':
      borderColor = 'border-neon-green';
      shadowClass = 'shadow-neon-green';
      break;
    case 'amber':
      borderColor = 'border-amber-400';
      shadowClass = 'shadow-[0_0_15px_rgba(251,191,36,0.3)]';
      break;
    case 'slate':
      borderColor = 'border-slate-700';
      shadowClass = 'shadow-none';
      break;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`glass-panel border-2 ${borderColor} ${glow ? shadowClass : ''} p-6 relative overflow-hidden ${className}`}
      {...props}
    >
      <div className={`absolute inset-0 bg-gradient-to-b from-transparent to-${color === 'slate' ? 'slate-900/50' : 'transparent'} pointer-events-none`} />
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};

export default NeonCard;
