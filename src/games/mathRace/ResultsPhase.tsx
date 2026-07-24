import React from 'react';
import { motion } from 'framer-motion';
import { GiantButton } from '@/components/ui';
import { useTranslation } from 'react-i18next';

interface ResultsPhaseProps {
  currentQ: { question: string; answer: number } | undefined;
  players: string[];
  roundAnswers: any;
  sortedScores: [string, any][];
  isHost: boolean;
  currentQuestion: number;
  totalQuestions: number;
  advanceToNext: () => void;
}

export const ResultsPhase: React.FC<ResultsPhaseProps> = ({
  currentQ,
  players,
  roundAnswers,
  sortedScores,
  isHost,
  currentQuestion,
  totalQuestions,
  advanceToNext,
}) => {
  const { t } = useTranslation();

  if (!currentQ) return null;

  return (
    <>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 text-center bg-slate-900 border border-slate-700 rounded-3xl mx-2 shadow-[0_0_30px_rgba(0,0,0,0.5)] mt-4"
        >
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t('taboo.secretWordWas')}</p>
          <p className="font-black text-[56px] text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.6)] font-mono">{currentQ.answer}</p>
          <p className="text-[14px] font-black uppercase tracking-widest text-slate-400 mt-2 font-mono">{currentQ.question}</p>
        </motion.div>

        <div className="p-4 mx-2 bg-slate-900/50 border border-slate-800 rounded-3xl mt-2">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 text-center">{t('mathrace.results')}</h3>
          <div className="space-y-2">
            {players.map(p => {
              const pAnswer = roundAnswers[p];
              const isCorrect = pAnswer?.correct;
              const pts = pAnswer?.points || 0;
              return (
                <div
                  key={p}
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : pAnswer ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-black text-[12px] uppercase tracking-widest ${isCorrect ? 'text-emerald-400' : pAnswer ? 'text-red-400' : 'text-slate-400'}`}>{p}</span>
                    {pAnswer && (
                      <span className="text-[11px] font-black text-slate-500 font-mono bg-slate-900 px-2 py-1 rounded-md">({pAnswer.answer})</span>
                    )}
                  </div>
                  <span className={`font-black text-[14px] ${isCorrect ? 'text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'text-slate-500'}`}>
                    +{pts}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 mx-2 bg-slate-900/50 border border-slate-800 rounded-3xl mt-2">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">{t('taboo.currentScores')}</h3>
          <div className="flex flex-wrap justify-center gap-2">
            {sortedScores.map(([name, score], i) => (
              <span key={name} className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest border ${
                i === 0 ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}>
                {name}: {score as number}
              </span>
            ))}
          </div>
        </div>

        {isHost && (
          <div className="mt-auto mx-2 pb-4 pt-4">
            <GiantButton color="purple" className="w-full" onClick={advanceToNext}>
              {currentQuestion + 1 >= totalQuestions ? t('taboo.viewResults') : t('mathrace.nextQuestion')}
            </GiantButton>
          </div>
        )}
    </>
  );
};

export default ResultsPhase;
