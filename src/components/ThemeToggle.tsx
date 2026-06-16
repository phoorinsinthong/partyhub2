import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';

const ThemeToggle = ({ className = '' }) => {
  const { isDark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
      className={`relative w-11 h-11 rounded-2xl flex-center active:scale-95 transition-all border-2 ${
        isDark
          ? 'bg-[#2a2d22] border-[#3a3d32] text-yellow-300'
          : 'bg-white border-sage-100 text-olive-400'
      } ${className}`}
      style={{ boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 1px 4px rgba(50,60,30,0.08)' }}
    >
      <motion.div
        key={isDark ? 'moon' : 'sun'}
        initial={{ scale: 0.5, rotate: -90, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        exit={{ scale: 0.5, rotate: 90, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {isDark ? (
          <span className="text-[18px]">{'\u{1F319}'}</span>
        ) : (
          <span className="text-[18px]">{'\u{2600}\u{FE0F}'}</span>
        )}
      </motion.div>
    </button>
  );
};

export default ThemeToggle;
