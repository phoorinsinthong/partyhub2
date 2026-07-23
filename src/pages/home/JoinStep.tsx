import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, ArrowLeft } from 'lucide-react';
import OtpInput from '../../components/ui/OtpInput';
import { useHaptics } from '../../hooks/useHaptics';

interface JoinStepProps {
  error: string;
  setError: (error: string) => void;
  isSubmitting: boolean;
  handleJoinRoom: (roomCode: string) => void;
  setStep: (step: 'setup' | 'action' | 'join') => void;
}

const JoinStep: React.FC<JoinStepProps> = ({
  error,
  setError,
  isSubmitting,
  handleJoinRoom,
  setStep,
}) => {
  const { vibrateLight } = useHaptics();

  return (
    <motion.section
      key="step-join"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex flex-col pt-12"
    >
      <button
        onClick={() => { vibrateLight(); setStep('action'); setError(''); }}
        className="flex items-center gap-2 text-slate-400 font-bold text-[13px] hover:text-white transition-colors mb-8 w-fit"
      >
        <ArrowLeft size={16} /> ย้อนกลับ
      </button>

      <div className="glass-panel p-8 text-center border-neon-pink/30 shadow-neon-pink relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-neon-pink/10 to-transparent pointer-events-none"></div>
        
        <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-neon-pink flex-center mx-auto mb-6 shadow-neon-pink">
          <UserPlus size={28} className="text-neon-pink" />
        </div>
        
        <h2 className="font-display font-black text-2xl text-white tracking-widest uppercase mb-2">Join Room</h2>
        <p className="text-slate-400 text-sm font-medium mb-8">กรอกรหัสห้อง 4 หลักจากหน้าจอโฮสต์</p>

        <OtpInput 
          length={4} 
          onComplete={handleJoinRoom} 
          disabled={isSubmitting} 
        />

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mt-6 overflow-hidden"
            >
              <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-2xl flex items-center justify-center gap-3">
                <span className="text-lg shrink-0">⚠️</span>
                <p className="text-red-400 text-[13px] font-bold">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {isSubmitting && (
          <div className="mt-6 text-neon-pink text-sm font-bold animate-pulse">
            กำลังเข้าร่วมห้อง...
          </div>
        )}
      </div>
    </motion.section>
  );
};

export default JoinStep;
