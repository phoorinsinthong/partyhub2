import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeOff } from 'lucide-react';
import { TimerDisplay } from '../../components/game-ui/TimerDisplay';
import GiantButton from '../../components/GiantButton';

interface PlayingPhaseProps {
  renderErrorToast: () => React.ReactNode;
  t: (key: string, options?: any) => string;
  round: number;
  totalRounds: number;
  currentDescriber: string;
  timeLeft: number;
  isDescriber: boolean;
  currentCard: any;
  setShowGuesserPicker: (show: boolean) => void;
  showGuesserPicker: boolean;
  nonDescribers: string[];
  handleCorrectGuess: (guesserName: string) => void;
  sortedScores: [string, unknown][];
}

export const PlayingPhase: React.FC<PlayingPhaseProps> = ({
  renderErrorToast,
  t,
  round,
  totalRounds,
  currentDescriber,
  timeLeft,
  isDescriber,
  currentCard,
  setShowGuesserPicker,
  showGuesserPicker,
  nonDescribers,
  handleCorrectGuess,
  sortedScores,
}) => {
  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0 bg-slate-950 px-2 py-4">
      {renderErrorToast()}
      {/* Round header */}
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          {t('taboo.round')} {round}/{totalRounds}
        </span>
        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 text-center">
          {t('taboo.isExplaining', { name: currentDescriber })}
        </span>
        {/* Timer display */}
        <TimerDisplay timeLeft={timeLeft} size="sm" />
      </div>

      {/* ─── Describer view ─── */}
      {isDescriber ? (
        <div className="flex-1 flex flex-col gap-4 min-h-0 relative">
          {/* The secret card */}
          <div className="p-8 text-center bg-slate-900 border border-slate-700 rounded-3xl mx-2 flex flex-col justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <p className="text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest">{t('taboo.secretWord')}</p>
            <p className="font-black text-[42px] uppercase tracking-widest text-white leading-none mb-6 drop-shadow-lg">
              {currentCard?.word}
            </p>
            <p className="text-[10px] font-black text-red-500/70 mb-3 uppercase tracking-wider">{t('taboo.tabooWords')}</p>
            <div className="flex flex-col gap-2 justify-center max-w-[200px] mx-auto">
              {(currentCard?.taboo || currentCard?.examples || []).map((w: string) => (
                <span key={w} className="bg-red-500/10 border border-red-500/30 text-red-400 text-[14px] font-black uppercase tracking-widest px-4 py-2 rounded-xl">
                  {w}
                </span>
              ))}
            </div>
          </div>

          <div className="mx-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl mt-auto">
            <p className="text-[11px] text-amber-400 font-black uppercase tracking-widest text-center">
               {t('taboo.description')}
            </p>
          </div>

          {/* Correct guess button */}
          <div className="mx-2 mt-2">
            <GiantButton
              color="emerald"
              onClick={() => setShowGuesserPicker(true)}
              className="w-full"
            >
              {t('taboo.someoneCorrect')}
            </GiantButton>
          </div>

          {/* Guesser picker overlay */}
          <AnimatePresence>
            {showGuesserPicker && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-6 backdrop-blur-sm"
                onClick={() => setShowGuesserPicker(false)}
              >
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-sm shadow-[0_0_40px_rgba(0,0,0,1)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="font-black text-[20px] uppercase tracking-widest text-white text-center mb-2 drop-shadow-md">{t('taboo.whoCorrect')}</p>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 text-center mb-6">{t('taboo.selectWhoCorrect')}</p>
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 hide-scrollbar">
                    {nonDescribers.map((name) => (
                      <button
                        key={name}
                        onClick={() => handleCorrectGuess(name)}
                        className="w-full py-4 rounded-2xl text-[14px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-200 active:scale-95 transition-all hover:border-emerald-500 hover:text-emerald-400"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowGuesserPicker(false)}
                    className="w-full mt-6 text-[12px] font-black uppercase tracking-widest text-slate-500 py-3 border border-transparent hover:bg-slate-800 hover:border-slate-700 rounded-xl transition-all"
                  >
                    {t('taboo.cancel')}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* ─── Non-describer view ─── */
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {/* Hidden word card */}
          <div className="p-8 text-center w-full max-w-[280px] bg-slate-900 border border-slate-700 rounded-3xl mx-auto shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <p className="text-[10px] font-black text-slate-500 mb-4 uppercase tracking-widest">{t('taboo.secretWord')}</p>
            <p className="font-black text-[64px] text-slate-800 leading-none select-none mb-6 drop-shadow-md">
              ???
            </p>
            <p className="text-[10px] font-black text-slate-600 mb-2 uppercase tracking-wider">{t('taboo.tabooWords')}</p>
            <div className="flex items-center justify-center gap-2 text-slate-500 mt-4 bg-slate-950 p-2 rounded-xl">
              <EyeOff size={14} />
              <span className="text-[9px] font-black uppercase tracking-widest">{t('common.revealAfterRound') || 'เปิดเผยหลังรอบจบ'}</span>
            </div>
          </div>

          {/* Listening prompt */}
          <div className="p-6 text-center w-full max-w-[280px] mx-auto bg-emerald-500/10 border border-emerald-500/30 rounded-3xl">
            <p className="text-[40px] mb-4 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">👂</p>
            <p className="font-black text-[16px] uppercase tracking-widest text-emerald-400 mb-2">{t('taboo.listenAndAnswer')}</p>
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500/70">{t('taboo.shoutAnswer')}</p>
          </div>
        </div>
      )}

      {/* Mini score strip */}
      <div className="flex items-center gap-2 px-2 overflow-x-auto pb-2 mt-4 hide-scrollbar opacity-70">
        {sortedScores.map(([name, score]) => (
          <div
            key={name}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0 border ${
              name === currentDescriber ? 'bg-amber-500/20 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-slate-900 border-slate-800'
            }`}
          >
            {name === currentDescriber && <span className="text-[10px]">🎤</span>}
            <span className={`text-[10px] font-black uppercase tracking-widest max-w-[64px] truncate ${name === currentDescriber ? 'text-amber-400' : 'text-slate-500'}`}>{name}</span>
            <span className={`text-[11px] font-black ${name === currentDescriber ? 'text-white' : 'text-slate-300'}`}>{score as number}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
