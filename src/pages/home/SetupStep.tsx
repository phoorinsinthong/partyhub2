import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import AvatarPicker from '../../components/ui/AvatarPicker';

interface SetupStepProps {
  nickname: string;
  setNickname: (name: string) => void;
  error: string;
  setError: (error: string) => void;
  avatarSeed: string;
  avatarGradient: string;
  handleAvatarSelect: (seed: string, gradient: string) => void;
  proceedToAction: () => void;
}

const SetupStep: React.FC<SetupStepProps> = ({
  nickname,
  setNickname,
  error,
  setError,
  avatarSeed,
  avatarGradient,
  handleAvatarSelect,
  proceedToAction,
}) => {
  return (
    <motion.section
      key="step-setup"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex flex-col pb-4"
    >
      <div className="glass-panel p-5 mb-4 flex-1 flex flex-col">
        <div className="text-center mb-6">
          <h2 className="font-display font-black text-2xl text-white tracking-widest uppercase mb-1">Create Profile</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">ออกแบบตัวละครของคุณ</p>
        </div>

        <div className="mb-6 flex flex-col items-center">
          <div className="w-full max-w-[240px]">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block text-center">
              1. ชื่อเล่น (Nickname)
            </label>
            <input
              type="text"
              className="input-field text-center text-xl font-bold bg-slate-900 border-2 border-slate-700 h-14 focus:border-neon-pink focus:shadow-neon-pink transition-all"
              placeholder="ใส่ชื่อ..."
              value={nickname}
              onChange={(e) => { setNickname(e.target.value); setError(''); }}
              enterKeyHint="done"
              autoComplete="nickname"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block text-center">
            2. ปรับแต่ง Pixel Avatar
          </label>
          <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-700/50 shadow-inner">
            <AvatarPicker
              onSelect={handleAvatarSelect}
              currentSeed={avatarSeed}
              currentGradient={avatarGradient}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-2xl flex items-center justify-center gap-3">
              <span className="text-lg shrink-0">⚠️</span>
              <p className="text-red-400 text-[13px] font-bold text-center">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        className="btn btn-primary py-4 text-[16px] shadow-neon-blue mt-auto"
        onClick={proceedToAction}
      >
        เข้าสู่ระบบ <ArrowRight size={18} />
      </button>
    </motion.section>
  );
};

export default SetupStep;
