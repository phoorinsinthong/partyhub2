import React from 'react';
import { motion } from 'framer-motion';
import { LeaveConfirmModal } from '@/components/ui';
import { GiantButton } from '@/components/ui';

interface WaitingPhaseProps {
  isHost: boolean;
  showConfirm: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
  handleStartGame: () => void;
  t: (key: string, options?: any) => string;
}

export const WaitingPhase: React.FC<WaitingPhaseProps> = ({
  isHost,
  showConfirm,
  confirmLeave,
  cancelLeave,
  handleStartGame,
  t,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in bg-slate-950">
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="text-8xl select-none drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]"
      >
        💣
      </motion.div>

      <div className="text-center px-4">
        <h2 className="font-black text-[32px] uppercase tracking-widest text-slate-200 mb-2 drop-shadow-md">{t('wordBomb.title') || 'บอมบ์คำ'}</h2>
        <p className="text-slate-400 text-[12px] font-bold leading-relaxed px-4 max-w-[280px] mx-auto">
          {t('wordBomb.description') || 'พูดคำตามหมวดก่อนบอมบ์ระเบิด! Host เป็นกรรมการตัดสิน'}
        </p>
      </div>

      {isHost ? (
        <GiantButton color="amber" onClick={handleStartGame} className="w-full max-w-xs mt-4">
          {t('wordBomb.startGame') || 'เริ่มเกมเลย!'}
        </GiantButton>
      ) : (
        <div className="flex flex-col items-center gap-4 mt-8">
          <div className="w-8 h-8 border-4 border-slate-800 border-t-amber-500 rounded-full animate-spin shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
          <p className="text-slate-500 font-black uppercase tracking-widest text-xs animate-pulse">{t('wordBomb.waitingHost') || 'รอ Host เริ่มเกม...'}</p>
        </div>
      )}
    </div>
  );
};
