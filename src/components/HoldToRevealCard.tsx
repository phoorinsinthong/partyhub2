import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHaptics } from '../hooks/useHaptics';
import { Eye, EyeOff } from 'lucide-react';

interface HoldToRevealCardProps {
  children: React.ReactNode;
  placeholderText?: string;
  className?: string;
}

const HoldToRevealCard: React.FC<HoldToRevealCardProps> = ({ 
  children, 
  placeholderText = "กดค้างไว้เพื่อดูบทบาท",
  className = '' 
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [progress, setProgress] = useState(0);
  const { vibrateLight, vibrateMedium, vibrateHeavy } = useHaptics();
  
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const HOLD_DURATION = 800; // ms required to hold before reveal
  
  const clearTimers = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handlePointerDown = () => {
    clearTimers();
    vibrateLight();
    
    // Animate progress bar
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setProgress(p);
    }, 16); // ~60fps

    holdTimerRef.current = setTimeout(() => {
      clearTimers();
      setIsRevealed(true);
      vibrateMedium();
      setProgress(100);
    }, HOLD_DURATION);
  };

  const handlePointerUp = () => {
    clearTimers();
    setProgress(0);
    if (isRevealed) {
      setIsRevealed(false);
      vibrateHeavy(); // Haptic feedback when card closes
    }
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  return (
    <div 
      className={`relative w-full h-[300px] select-none rounded-2xl overflow-hidden ${className}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: 'none' }}
    >
      <AnimatePresence mode="wait">
        {isRevealed ? (
          <motion.div
            key="revealed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-slate-900 border-2 border-neon-blue shadow-neon-blue rounded-2xl p-6 flex flex-col items-center justify-center z-10"
          >
            {children}
            <div className="absolute top-4 right-4 text-neon-blue opacity-50 flex items-center gap-1 text-[10px] font-bold uppercase">
              <Eye size={14} /> แอบดูอยู่
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-800 border-2 border-slate-700 rounded-2xl flex flex-col items-center justify-center p-6 z-20 shadow-lg cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center mb-6 shadow-inner relative overflow-hidden group">
              <EyeOff size={24} className="text-slate-500 relative z-10" />
            </div>
            
            <h3 className="font-display font-black text-xl text-slate-300 uppercase tracking-widest text-center mb-2">Secret</h3>
            <p className="text-slate-500 font-bold text-[13px] text-center">{placeholderText}</p>

            {/* Progress Bar Container */}
            <div className="absolute bottom-0 left-0 w-full h-1.5 bg-slate-900">
              <div 
                className="h-full bg-neon-blue shadow-[0_0_10px_rgba(0,240,255,0.8)] transition-all duration-75 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HoldToRevealCard;
