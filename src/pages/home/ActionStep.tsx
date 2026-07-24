import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, UserPlus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAvatarUrl } from '@/utils/avatars';
import { useHaptics } from '@/hooks';

interface ActionStepProps {
  nickname: string;
  error: string;
  setError: (error: string) => void;
  avatarSeed: string;
  avatarGradient: string;
  isSubmitting: boolean;
  handleCreateRoom: () => void;
  setStep: (step: 'setup' | 'action' | 'join') => void;
}

const ActionStep: React.FC<ActionStepProps> = ({
  nickname,
  error,
  setError,
  avatarSeed,
  avatarGradient,
  isSubmitting,
  handleCreateRoom,
  setStep,
}) => {
  const navigate = useNavigate();
  const { vibrateLight } = useHaptics();

  return (
    <motion.section
      key="step-action"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex flex-col justify-center gap-4 py-8"
    >
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="relative">
          <div 
            className="w-16 h-16 rounded-[20px] shadow-md border-2 border-white/20 flex items-center justify-center overflow-hidden"
            style={{ background: avatarGradient }}
          >
            <img src={getAvatarUrl(avatarSeed)} alt="Avatar" className="w-[120%] h-[120%] object-cover mt-[20%]" style={{ imageRendering: 'pixelated' }} />
          </div>
          <button
            onClick={() => { vibrateLight(); setStep('setup'); }}
            className="absolute -bottom-2 -right-2 bg-slate-800 text-white rounded-full p-1.5 shadow-lg border border-slate-600 hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft size={14} />
          </button>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">ยินดีต้อนรับ</p>
          <h2 className="font-display font-black text-2xl text-white truncate max-w-[150px]">{nickname}</h2>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-2xl flex items-center gap-3">
              <span className="text-lg shrink-0">⚠️</span>
              <p className="text-red-400 text-[13px] font-bold">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-panel p-6 flex flex-col gap-4 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/5 to-transparent pointer-events-none"></div>
        <h3 className="font-display font-black text-lg text-white tracking-widest uppercase text-center mb-2 relative z-10">Select Mode</h3>
        
        <button
          className="btn btn-primary py-5 text-[16px] shadow-neon-blue relative z-10"
          onClick={handleCreateRoom}
          disabled={isSubmitting}
        >
          <Plus size={20} strokeWidth={2.5} />
          {isSubmitting ? 'กำลังสร้าง...' : 'สร้างห้องใหม่ (Create)'}
        </button>

        <div className="flex items-center gap-3 my-2 relative z-10">
          <div className="h-[1px] flex-1 bg-slate-700"></div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">OR</span>
          <div className="h-[1px] flex-1 bg-slate-700"></div>
        </div>

        <button
          className="btn py-5 text-[16px] bg-slate-800 border-2 border-slate-600 text-white hover:border-neon-pink hover:bg-slate-700 transition-all shadow-lg active:scale-95 relative z-10 font-bold flex items-center justify-center gap-2"
          onClick={() => { vibrateLight(); setStep('join'); setError(''); }}
        >
          <UserPlus size={20} strokeWidth={2.5} />
          เข้าร่วมห้อง (Join)
        </button>
      </div>

      <button
        className="mt-6 py-4 px-4 rounded-2xl bg-purple-900/20 border border-purple-500/30 hover:bg-purple-900/40 hover:border-purple-500/60 text-purple-300 font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg"
        onClick={() => { vibrateLight(); navigate('/werewolf-moderator'); }}
      >
        <span className="text-base">🎭</span>
        ระบบผู้บรรยาย Werewolf (GM)
      </button>
    </motion.section>
  );
};

export default ActionStep;
