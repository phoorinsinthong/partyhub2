import React from 'react';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { NeonCard } from '@/components/ui';
import { GiantButton } from '@/components/ui';

interface WaitingPhaseProps {
  errorMsg: string | null;
  isHost: boolean;
  startGame: () => void;
}

export const WaitingPhase: React.FC<WaitingPhaseProps> = ({ errorMsg, isHost, startGame }) => {
  const { t } = useTranslation();

  const renderErrorToast = () => {
    if (!errorMsg) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border border-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-fade-in">
        {errorMsg}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full animate-fade-in bg-slate-950 text-slate-200 py-4 px-2">
      {renderErrorToast()}
      <div className="text-center">
        <motion.div
          className="text-8xl drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] mb-4 flex-center"
          animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          🎯
        </motion.div>
        <h2 className="font-black text-[32px] uppercase tracking-widest text-white mb-2 drop-shadow-md">{t('target.title')}</h2>
        <p className="text-slate-400 text-[12px] font-bold leading-relaxed max-w-xs mx-auto">
          {t('target.description')}
        </p>

        <NeonCard color="rose" className="mt-6 p-4 text-left border-rose-500/30 bg-rose-950/20 text-sm text-slate-300 mx-4">
          <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-3 text-center">{t('spyfall.timerTitle')}</h4>
          <div className="space-y-3 font-medium text-[11px] leading-relaxed">
            <p>🎯 {t('target.description').split(' ')[0] === 'ทาย' ? 'คนหนึ่งจะถูกสุ่มให้ตั้งตัวเลขลับ 1-100' : 'One player will be randomly selected to set a secret number 1-100'}</p>
            <p>💡 {t('target.description').split(' ')[0] === 'ทาย' ? 'ผู้เล่นอื่นจะเห็นช่วงใบ้ (±5 จากเป้า)' : 'Other players will see a hint range (±5 from target)'}</p>
            <p>🔢 {t('target.description').split(' ')[0] === 'ทาย' ? 'ผลัดกันนับ +1, +2, หรือ +3' : 'Take turns counting +1, +2, or +3'}</p>
            <p>💀 {t('target.description').split(' ')[0] === 'ทาย' ? 'ใครนับถึงตัวเลขเป้า...แพ้!' : 'Whoever counts to the target number... loses!'}</p>
          </div>
        </NeonCard>
      </div>

      {isHost ? (
        <div className="mt-6 px-4">
          <GiantButton color="rose" onClick={startGame} className="w-full">
            <Play size={20} fill="currentColor" className="mr-2 inline-block mb-1" />
            {t('target.startGame')}
          </GiantButton>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 mt-8">
          <div className="w-8 h-8 border-4 border-slate-800 border-t-rose-500 rounded-full animate-spin shadow-[0_0_15px_rgba(244,63,94,0.5)]" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 animate-pulse">{t('target.waitingHost')}</span>
        </div>
      )}
    </div>
  );
};
