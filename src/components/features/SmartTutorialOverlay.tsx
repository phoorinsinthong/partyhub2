import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { useHaptics } from '../../hooks/useHaptics';

export interface TutorialStep {
  title: string;
  description: string;
  icon: string;
}

interface SmartTutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  gameName: string;
  steps: TutorialStep[];
}

const SmartTutorialOverlay: React.FC<SmartTutorialOverlayProps> = ({ isOpen, onClose, gameName, steps }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { vibrateLight, vibrateMedium } = useHaptics();

  if (!isOpen) return null;

  const handleNext = () => {
    vibrateLight();
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    vibrateLight();
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleClose = () => {
    vibrateMedium();
    setTimeout(() => {
      setCurrentStep(0);
      onClose();
    }, 150);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="glass-panel w-full max-w-sm flex flex-col relative border-neon-blue shadow-neon-blue overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
            <div>
              <p className="text-[10px] font-bold text-neon-blue uppercase tracking-widest mb-1">How to play</p>
              <h3 className="font-display font-black text-lg text-white">{gameName}</h3>
            </div>
            <button 
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-slate-800 flex-center text-slate-400 hover:text-white border border-slate-700"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 flex flex-col items-center text-center min-h-[220px] justify-center relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center"
              >
                <div className="w-24 h-24 rounded-[32px] bg-slate-800 border-2 border-slate-700 shadow-lg flex-center text-5xl mb-6">
                  {steps[currentStep].icon}
                </div>
                <h4 className="font-display font-bold text-xl text-white mb-2">{steps[currentStep].title}</h4>
                <p className="text-slate-400 text-[14px] leading-relaxed">
                  {steps[currentStep].description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer Controls */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <div className="flex gap-1.5">
              {steps.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentStep ? 'w-6 bg-neon-blue' : 'w-2 bg-slate-700'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button 
                  onClick={handlePrev}
                  className="w-10 h-10 rounded-xl bg-slate-800 flex-center text-slate-300 border border-slate-700 active:scale-95"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <button 
                onClick={handleNext}
                className="h-10 px-4 rounded-xl bg-neon-blue text-slate-950 font-bold flex items-center gap-1 active:scale-95 shadow-[0_0_15px_rgba(0,240,255,0.4)]"
              >
                {currentStep < steps.length - 1 ? (
                  <>ถัดไป <ChevronRight size={18} /></>
                ) : (
                  <>เข้าใจแล้ว <Check size={18} /></>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SmartTutorialOverlay;
