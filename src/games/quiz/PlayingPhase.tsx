import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NeonCard } from '@/components/ui';
import { GiantButton } from '@/components/ui';
import { TimerDisplay } from '@/components/game-ui';
import { CATEGORY_LABELS } from './quizData';

interface PlayingPhaseProps {
  question: any;
  currentQ: number;
  questionsCount: number;
  timeLeft: number;
  questionTime: number;
  selectedAnswer: number | null;
  answers: Record<string, Record<string, any>>;
  userNickname: string;
  showResult: boolean;
  setShowResult: React.Dispatch<React.SetStateAction<boolean>>;
  handleAnswer: (idx: number) => void;
  players: string[];
  isHost: boolean;
  handleNextQuestion: () => void;
  scores: Record<string, number>;
  renderErrorToast: () => React.ReactNode;
}

const PlayingPhase: React.FC<PlayingPhaseProps> = ({
  question,
  currentQ,
  questionsCount,
  timeLeft,
  questionTime,
  selectedAnswer,
  answers,
  userNickname,
  showResult,
  setShowResult,
  handleAnswer,
  players,
  isHost,
  handleNextQuestion,
  scores,
  renderErrorToast,
}) => {
  const { t } = useTranslation();

  // To handle showResult automatically if timeLeft <= 0
  useEffect(() => {
    if (timeLeft <= 0 && !showResult) {
      setShowResult(true);
    }
  }, [timeLeft, showResult, setShowResult]);

  if (!question) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        {renderErrorToast()}
        <p className="text-slate-400">{t('common.loading')}</p>
      </div>
    );
  }

  const myAnswer = answers?.[currentQ]?.[userNickname];
  const hasAnswered = selectedAnswer !== null || !!myAnswer;

  return (
    <div className="flex-1 flex flex-col gap-3 bg-slate-950 px-2 py-4 pb-24 h-full relative">
      {renderErrorToast()}
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          ข้อ {currentQ + 1}/{questionsCount}
        </span>
        {question.category && (
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
            {CATEGORY_LABELS[question.category] || question.category}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <TimerDisplay timeLeft={timeLeft} />
        </div>
      </div>

      {/* Timer Bar */}
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mx-2 shadow-inner">
        <motion.div
          className={`h-full rounded-full ${timeLeft > 10 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : timeLeft > 5 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`}
          initial={{ width: '100%' }}
          animate={{ width: `${(timeLeft / questionTime) * 100}%` }}
          transition={{ duration: 1, ease: 'linear' }}
        />
      </div>

      {/* Question */}
      <NeonCard color="slate" className="p-6 mt-2 mx-2 bg-slate-900 border-slate-700 min-h-[120px] flex items-center justify-center">
        <p className="font-black text-[18px] text-white leading-relaxed text-center drop-shadow-md">
          {question.q}
        </p>
      </NeonCard>

      {/* Choices */}
      <div className="space-y-3 mt-4 mx-2">
        {question.choices.map((choice: string, idx: number) => {
          const isSelected = selectedAnswer === idx || answers[currentQ]?.[userNickname]?.choice === idx;
          const isCorrectAnswer = idx === question.answer;
          const showCorrect = showResult && isCorrectAnswer;
          const showWrong = showResult && isSelected && !isCorrectAnswer;

          let bg = 'bg-slate-900 border border-slate-700 hover:border-slate-500';
          if (showCorrect) bg = 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] z-10';
          else if (showWrong) bg = 'bg-red-500/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] z-10';
          else if (isSelected) bg = 'bg-amber-500/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] z-10';

          return (
            <motion.button
              key={idx}
              whileTap={!hasAnswered && !showResult ? { scale: 0.97 } : {}}
              onClick={() => !showResult && handleAnswer(idx)}
              disabled={hasAnswered || showResult}
              className={`w-full p-4 rounded-2xl text-left flex items-center gap-4 transition-all relative ${bg} ${
                !hasAnswered && !showResult ? 'active:scale-[0.97]' : ''
              } ${hasAnswered && !showCorrect && !showWrong && !isSelected ? 'opacity-50 grayscale' : ''}`}
              style={!showResult && !hasAnswered ? {} : { cursor: 'default' }}
            >
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-black shrink-0 border ${
                showCorrect ? 'bg-emerald-500/30 text-emerald-400 border-emerald-400/50' :
                showWrong ? 'bg-red-500/30 text-red-400 border-red-400/50' :
                isSelected ? 'bg-amber-500/30 text-amber-400 border-amber-400/50' :
                'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {showCorrect ? <CheckCircle size={18} /> :
                 showWrong ? <XCircle size={18} /> :
                 String.fromCharCode(65 + idx)}
              </span>
              <span className={`font-black text-[15px] ${
                showCorrect ? 'text-emerald-400 drop-shadow-sm' :
                showWrong ? 'text-red-400 drop-shadow-sm' :
                isSelected ? 'text-amber-400 drop-shadow-sm' :
                'text-slate-300'
              }`}>
                {choice}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Answered Status / Next Button */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
        {showResult ? (
          <div className="space-y-4">
            {/* Who answered what */}
            <div className="flex flex-wrap gap-2 justify-center max-h-[80px] overflow-y-auto hide-scrollbar">
              {players.map((p) => {
                const pa = answers?.[currentQ]?.[p];
                return (
                  <div key={p} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                    pa?.correct ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' :
                    pa ? 'bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' :
                    'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    {pa?.correct ? <CheckCircle size={12} /> : pa ? <XCircle size={12} /> : <Clock size={12} />}
                    {p === userNickname ? t('quiz.you') : p}
                    {pa?.points ? <span className="ml-1 text-emerald-400 bg-emerald-900/50 px-1 rounded">+{pa.points}</span> : null}
                  </div>
                );
              })}
            </div>

            {isHost && (
              <GiantButton color="emerald" onClick={handleNextQuestion} className="w-full">
                {currentQ + 1 >= questionsCount ? t('quiz.viewResults') : t('quiz.nextQuestion')}
              </GiantButton>
            )}
            {!isHost && (
              <p className="text-center text-[11px] text-slate-500 font-black uppercase tracking-widest animate-pulse mt-2">{t('quiz.waitingNextQuestion')}</p>
            )}
          </div>
        ) : hasAnswered ? (
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="w-6 h-6 border-2 border-slate-700 border-t-amber-500 rounded-full animate-spin"></div>
            <span className="text-[12px] font-black text-amber-500 uppercase tracking-widest animate-pulse">{t('quiz.alreadyAnswered')}</span>
          </div>
        ) : (
           <div className="flex items-center justify-center gap-2 py-4 opacity-0 pointer-events-none">Placeholder</div>
        )}
      </div>

      {/* Live Scores (mini) */}
      <div className="flex items-center gap-2 px-2 pt-4 pb-24 overflow-x-auto hide-scrollbar mt-auto opacity-50">
        {Object.entries(scores)
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .slice(0, 5)
          .map(([name, score]) => (
            <div key={name} className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg shrink-0">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[60px]">{name}</span>
              <span className="text-[11px] font-black text-slate-300">{score as number}</span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default PlayingPhase;
