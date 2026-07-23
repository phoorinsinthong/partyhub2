import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHaptics } from '../hooks/useHaptics';

interface EpicPopupProps {
  isOpen: boolean;
  onClose?: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  autoCloseMs?: number;
  type?: 'success' | 'warning' | 'danger' | 'info';
  children?: React.ReactNode;
}

const EpicPopup: React.FC<EpicPopupProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  subtitle, 
  icon, 
  autoCloseMs,
  type = 'info',
  children
}) => {
  const { vibrateHeavy, vibrateSuccess } = useHaptics();

  useEffect(() => {
    if (isOpen) {
      if (type === 'danger' || type === 'warning') {
        vibrateHeavy();
      } else {
        vibrateSuccess();
      }

      if (autoCloseMs && onClose) {
        const timer = setTimeout(onClose, autoCloseMs);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, autoCloseMs, onClose, type, vibrateHeavy, vibrateSuccess]);

  if (!isOpen) return null;

  let borderColor = 'border-neon-blue';
  let shadowColor = 'shadow-neon-blue';
  let titleColor = 'text-neon-blue';

  if (type === 'danger') {
    borderColor = 'border-red-500';
    shadowColor = 'shadow-[0_0_30px_rgba(239,68,68,0.5)]';
    titleColor = 'text-red-500';
  } else if (type === 'warning') {
    borderColor = 'border-amber-500';
    shadowColor = 'shadow-[0_0_30px_rgba(245,158,11,0.5)]';
    titleColor = 'text-amber-500';
  } else if (type === 'success') {
    borderColor = 'border-neon-green';
    shadowColor = 'shadow-neon-green';
    titleColor = 'text-neon-green';
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.5, rotate: -5, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 1.1, opacity: 0 }}
          transition={{ type: 'spring', damping: 15, stiffness: 300 }}
          className={`glass-panel p-8 w-full max-w-sm flex flex-col items-center text-center border-4 ${borderColor} ${shadowColor} relative overflow-hidden`}
          onClick={e => e.stopPropagation()}
        >
          {/* Background FX */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent pointer-events-none" />
          
          {icon && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="text-6xl mb-4 relative z-10 drop-shadow-2xl"
            >
              {icon}
            </motion.div>
          )}
          
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className={`font-display font-black text-3xl uppercase tracking-widest ${titleColor} mb-2 relative z-10 drop-shadow-md`}
          >
            {title}
          </motion.h2>

          {subtitle && (
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white font-medium text-[15px] relative z-10 leading-relaxed"
            >
              {subtitle}
            </motion.p>
          )}

          {children && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-6 w-full relative z-10"
            >
              {children}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EpicPopup;
