import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { TimerDisplay } from '@/components/game-ui';
import { GiantButton } from '@/components/ui';

interface SetupPhaseProps {
  errorMsg: string | null;
  isTargetChooser: boolean;
  targetChooser: string | null;
  timeLeft: number | null;
  selectedTarget: string;
  setSelectedTarget: (val: string) => void;
  handleSetTarget: () => void;
}

export const SetupPhase: React.FC<SetupPhaseProps> = ({
  errorMsg,
  isTargetChooser,
  targetChooser,
  timeLeft,
  selectedTarget,
  setSelectedTarget,
  handleSetTarget
}) => {
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
    <div className="flex flex-col gap-4 w-full animate-fade-in bg-slate-950 text-slate-200 py-4 px-2 h-full">
      {renderErrorToast()}
      <div className="text-center h-full flex flex-col justify-center">
        <div className="flex-center mb-6">
          <div className="text-7xl drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">🎯</div>
        </div>

        {isTargetChooser ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col gap-6"
          >
            <div>
              <h2 className="text-[28px] font-black mb-2 uppercase tracking-widest text-amber-500 drop-shadow-md">{t('target.setTarget')}</h2>
              <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest leading-relaxed max-w-[280px] mx-auto">{t('target.description').split(' ')[0] === 'ทาย' ? 'เลือกตัวเลขระหว่าง 1 ถึง 100 ผู้เล่นอื่นจะเห็นช่วง ±5 เท่านั้น' : 'Choose a number between 1 and 100. Others will only see ±5 range.'}</p>
            </div>

            <div className="flex flex-col gap-6 items-center">
              <TimerDisplay timeLeft={timeLeft} />
              <input
                type="number"
                min="1"
                max="100"
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                placeholder="1-100"
                className="bg-slate-900 border-2 border-amber-500/50 text-white rounded-3xl py-4 text-center text-4xl font-black w-48 focus:outline-none focus:border-amber-400 focus:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all font-mono placeholder:text-slate-700"
              />
              <GiantButton
                color="amber"
                className="px-8 w-48"
                onClick={handleSetTarget}
                disabled={!selectedTarget || parseInt(selectedTarget) < 1 || parseInt(selectedTarget) > 100}
              >
                {t('target.confirmTarget')}
              </GiantButton>
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <h2 className="text-[24px] font-black uppercase tracking-widest text-slate-300">{t('target.choosingTarget')}</h2>
            <TimerDisplay timeLeft={timeLeft} />
            <p className="text-amber-400 font-black text-[12px] uppercase tracking-widest bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-xl">
              {t('target.waitChooser', { name: targetChooser })}
            </p>
            <div className="text-6xl animate-bounce mt-4 drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]">🎲</div>
          </div>
        )}
      </div>
    </div>
  );
};
