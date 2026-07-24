import React, { RefObject } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { GiantButton } from '@/components/ui';
import { TimerDisplay } from '@/components/game-ui';
import { useTranslation } from 'react-i18next';

interface PlayingPhaseProps {
  timeLeft: number;
  questionTime: number;
  currentQuestion: number;
  totalQuestions: number;
  answeredCount: number;
  totalPlayers: number;
  difficulty: string;
  currentQ: { question: string; answer: number } | undefined;
  hasAnswered: boolean;
  alreadyAnswered: boolean;
  inputValue: string;
  setInputValue: (val: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleSubmitAnswer: () => void;
  myAnswer: any;
  inputRef: RefObject<HTMLInputElement>;
  errorMsg: string | null;
}

export const PlayingPhase: React.FC<PlayingPhaseProps> = ({
  timeLeft,
  questionTime,
  currentQuestion,
  totalQuestions,
  answeredCount,
  totalPlayers,
  difficulty,
  currentQ,
  hasAnswered,
  alreadyAnswered,
  inputValue,
  setInputValue,
  handleKeyDown,
  handleSubmitAnswer,
  myAnswer,
  inputRef,
  errorMsg,
}) => {
  const { t } = useTranslation();

  if (!currentQ) return null;

  return (
    <>
        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
          <motion.div
            className={`h-full rounded-full ${timeLeft > 10 ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]' : timeLeft > 5 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`}
            initial={{ width: '100%' }}
            animate={{ width: `${(timeLeft / questionTime) * 100}%` }}
            transition={{ duration: 0.5, ease: 'linear' }}
          />
        </div>

        <div className="flex items-center justify-between px-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            {t('mathrace.questionNumber', { current: currentQuestion + 1, total: totalQuestions })}
          </span>
          <TimerDisplay timeLeft={timeLeft} size="sm" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            {t('quiz.alreadyAnswered').split('!')[0]} {answeredCount}/{totalPlayers}
          </span>
        </div>

        <motion.div
          key={currentQuestion}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 text-center bg-slate-900 border border-slate-700 rounded-3xl mx-2 shadow-[0_0_30px_rgba(0,0,0,0.5)] mt-4"
        >
          <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-4">
            {difficulty === 'easy' ? t('mathrace.difficultyEasy') : difficulty === 'medium' ? t('mathrace.difficultyMedium') : t('mathrace.difficultyHard')}
          </p>
          <p className="font-black text-[56px] text-white leading-tight drop-shadow-lg font-mono tracking-tighter">
            {currentQ.question}
          </p>
        </motion.div>

        {!hasAnswered && !alreadyAnswered ? (
          <div className="mx-2 mt-auto pb-4">
            <div className="flex gap-2 p-2 bg-slate-900 border border-slate-700 rounded-2xl">
              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                enterKeyHint="done"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('mathrace.yourAnswer')}
                className="flex-1 bg-transparent text-center text-[28px] font-black text-white focus:outline-none placeholder-slate-600 h-16 font-mono"
                disabled={hasAnswered}
              />
              <GiantButton
                color="purple"
                className="w-16 h-16 flex-center !p-0 shrink-0"
                onClick={handleSubmitAnswer}
                disabled={!inputValue.trim()}
              >
                <Send size={24} />
              </GiantButton>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center w-full mx-auto bg-purple-500/10 border border-purple-500/30 rounded-3xl mt-auto mb-4">
            <p className="text-[12px] font-black uppercase tracking-widest text-purple-400">
              {alreadyAnswered ? `${t('quiz.alreadyAnswered')}: ${myAnswer?.answer}` : t('quiz.alreadyAnswered')}
            </p>
          </div>
        )}

        {errorMsg && (
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-950/50 border border-red-500/30 p-2.5 rounded-xl mx-2">{errorMsg}</p>
        )}
    </>
  );
};

export default PlayingPhase;
