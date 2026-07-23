import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SkipForward } from 'lucide-react';
import GiantButton from '../../components/GiantButton';

interface ChoosingPhaseProps {
  renderErrorToast: () => React.ReactNode;
  t: (key: string, options?: any) => string;
  round: number;
  totalRounds: number;
  isDescriber: boolean;
  skipsUsed: number;
  MAX_SKIPS: number;
  card: any;
  handleSkip: () => void;
  handleConfirmCard: () => void;
  currentDescriber: string;
  scores: Record<string, unknown>;
  sortedScores: [string, unknown][];
}

export const ChoosingPhase: React.FC<ChoosingPhaseProps> = ({
  renderErrorToast,
  t,
  round,
  totalRounds,
  isDescriber,
  skipsUsed,
  MAX_SKIPS,
  card,
  handleSkip,
  handleConfirmCard,
  currentDescriber,
  scores,
  sortedScores,
}) => {
  const skipsLeft = MAX_SKIPS - skipsUsed;

  if (isDescriber) {
    return (
      <div className="flex-1 flex flex-col gap-4 py-4 px-2 bg-slate-950 text-slate-200">
        {renderErrorToast()}
        {/* Round info */}
        <div className="flex-between px-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            {t('taboo.round')} {round}/{totalRounds}
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg shadow-[0_0_10px_rgba(245,158,11,0.2)]">
            {t('taboo.youAreDescriber')}
          </span>
        </div>

        <div className="text-center mb-2 mt-4">
          <p className="text-[20px] font-black uppercase tracking-widest text-white drop-shadow-md">{t('taboo.chooseYourCard')}</p>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mt-2">{t('taboo.skipsLeft', { count: skipsLeft })}</p>
        </div>

        {/* Card preview */}
        <AnimatePresence mode="wait">
          {card && (
            <motion.div
              key={card.word}
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: -90, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="p-8 text-center bg-slate-900 border border-slate-700 rounded-3xl mx-2 shadow-[0_0_30px_rgba(0,0,0,0.5)]"
              style={{ perspective: 600 }}
            >
              {/* Secret word */}
              <p className="text-[10px] font-black text-slate-500 mb-4 uppercase tracking-widest">{t('taboo.secretWord')}</p>
              <p className="font-black text-[42px] text-white mb-6 uppercase tracking-widest drop-shadow-lg">
                {card.word}
              </p>

              {/* Taboo words */}
              <p className="text-[10px] font-black text-red-500/70 mb-3 uppercase tracking-wider">{t('taboo.tabooWords')}</p>
              <div className="flex flex-col gap-2 justify-center max-w-[200px] mx-auto">
                {(card.taboo || card.examples || []).map((w: string) => (
                  <span
                    key={w}
                    className="bg-red-500/10 border border-red-500/30 text-red-400 text-[14px] font-black uppercase tracking-widest px-4 py-2 rounded-xl"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex gap-3 mt-auto mb-4 mx-2">
          <button
            onClick={handleSkip}
            disabled={skipsLeft <= 0}
            className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:border-slate-500 disabled:opacity-30 disabled:grayscale"
          >
            <SkipForward size={16} />
            {t('taboo.skip')} ({skipsLeft})
          </button>
          <GiantButton
            color="emerald"
            onClick={handleConfirmCard}
            className="flex-[2]"
          >
            {t('taboo.startNow')}
          </GiantButton>
        </div>
      </div>
    );
  }

  // Non-describer waiting view
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-6 bg-slate-950 text-slate-200">
      {renderErrorToast()}
      <motion.div
        className="text-7xl drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]"
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      >
        🤔
      </motion.div>
      <div className="text-center px-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{t('taboo.round')} {round}/{totalRounds}</p>
        <p className="font-black text-[22px] uppercase tracking-widest text-white drop-shadow-md">
          {t('taboo.isChoosing', { name: currentDescriber })}
        </p>
      </div>

      {/* Mini scores */}
      {Object.keys(scores).length > 0 && (
        <div className="p-4 w-full max-w-xs mt-6 bg-slate-900/50 border border-slate-800 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 text-center">{t('taboo.currentScores')}</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {sortedScores.map(([name, score]) => (
              <div key={name} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 max-w-[70px] truncate">{name}</span>
                <span className="text-[12px] font-black text-emerald-400">{score as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
