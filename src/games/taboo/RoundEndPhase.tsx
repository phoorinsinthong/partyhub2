import React from 'react';
import { motion } from 'framer-motion';
import GiantButton from '../../components/ui/GiantButton';

interface RoundEndPhaseProps {
  renderErrorToast: () => React.ReactNode;
  t: (key: string, options?: any) => string;
  roundResult: string | null;
  correctGuesser: string | null;
  currentCard: any;
  sortedScores: [string, unknown][];
  userNickname: string;
  isHost: boolean;
  currentDescriberIndex: number;
  describerOrder: string[];
  handleNextRound: () => void;
}

export const RoundEndPhase: React.FC<RoundEndPhaseProps> = ({
  renderErrorToast,
  t,
  roundResult,
  correctGuesser,
  currentCard,
  sortedScores,
  userNickname,
  isHost,
  currentDescriberIndex,
  describerOrder,
  handleNextRound,
}) => {
  const correct = roundResult === 'correct';

  return (
    <div className="flex-1 flex flex-col gap-4 py-6 bg-slate-950 pb-24 text-slate-200">
      {renderErrorToast()}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center px-4"
      >
        <span className="text-7xl drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">{correct ? '🎉' : '⏰'}</span>
        <h3 className="font-black text-[28px] uppercase tracking-widest text-white mt-4 drop-shadow-md">
          {correct ? t('taboo.correct') : t('taboo.timeUp')}
        </h3>
        {correct && correctGuesser && (
          <p className="text-[12px] font-black uppercase tracking-widest text-slate-400 mt-2 bg-emerald-500/10 border border-emerald-500/30 inline-block px-4 py-2 rounded-xl">
            <span className="text-emerald-400">{correctGuesser}</span> {t('taboo.correct')}
          </p>
        )}
      </motion.div>

      {/* Reveal card */}
      {currentCard && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="p-6 text-center bg-slate-900 border border-slate-700 rounded-3xl mx-4 mt-4 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
        >
          <p className="text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest">{t('taboo.secretWordWas')}</p>
          <p className="font-black text-[36px] uppercase tracking-widest text-white mb-5 drop-shadow-lg">
            {currentCard.word}
          </p>
          <p className="text-[10px] font-black text-red-500/70 mb-3 uppercase tracking-wider">{t('taboo.tabooWords')}</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {(currentCard.taboo || currentCard.examples || []).map((w: string) => (
              <span key={w} className="bg-red-500/10 border border-red-500/30 text-red-400 text-[12px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl">
                {w}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Scores */}
      <div className="p-4 mx-4 bg-slate-900/50 border border-slate-800 rounded-3xl mt-4">
        <h3 className="font-black text-[12px] uppercase tracking-widest text-slate-500 mb-4 text-center">📊 {t('taboo.currentScores')}</h3>
        <div className="space-y-2">
          {sortedScores.map(([name, score], idx) => (
            <div key={name} className="flex items-center gap-4 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[11px] font-black text-slate-600 w-4 text-center">{idx + 1}</span>
              <span className="flex-1 font-black text-[12px] uppercase tracking-widest text-slate-300">{name}</span>
              <span className="font-black text-[14px] text-emerald-400">{score as number}</span>
              {name === userNickname && (
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-md">{t('taboo.you')}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50">
          <GiantButton color="emerald" onClick={handleNextRound} className="w-full">
            {currentDescriberIndex + 1 >= describerOrder.length ? t('taboo.viewResults') : t('taboo.nextRound')}
          </GiantButton>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50 flex justify-center">
          <div className="flex-center gap-3 text-slate-400">
            <span className="w-3 h-3 bg-amber-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            <span className="text-[11px] font-black uppercase tracking-widest">{t('taboo.waitNextRound')}</span>
          </div>
        </div>
      )}
    </div>
  );
};
