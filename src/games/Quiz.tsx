// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, onValue, increment } from 'firebase/database';
import { db } from '../firebase';
import { useTranslation } from 'react-i18next';
import { useGame } from '../contexts/GameContext';
import { useGameTimer } from '../hooks/useGameTimer';
import { TimerDisplay } from '../components/game-ui/TimerDisplay';
import { Trophy, Clock, CheckCircle, XCircle, Crown, RotateCcw, LogOut } from 'lucide-react';
import { getShuffledQuestions, CATEGORY_LABELS } from './logic/quizData';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { feedback } from '../utils/feedback';
import NeonCard from '../components/NeonCard';
import GiantButton from '../components/GiantButton';

const QUESTION_TIME = 15;
const TOTAL_QUESTIONS = 10;

const Quiz: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');
  
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const personalRecordedRef = useRef(false);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerSubmittingRef = useRef(false);
  const advancingRef = useRef(false);
  const startQuizRef = useRef(false);
  const playAgainRef = useRef(false);
  const timerFiredRef = useRef(false);

  const gameData = roomData?.gameData || {};
  const { timeLeft } = useGameTimer(gameData.timerEnd);

  const renderErrorToast = () => {
    if (!errorMsg) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in fade-in slide-in-from-top-4">
        <div className="bg-red-500 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3">
          <div className="p-1 bg-white/20 rounded-lg">
            <LogOut size={18} className="rotate-90" />
          </div>
          <p className="text-[14px] font-bold">{errorMsg}</p>
        </div>
      </div>
    );
  };

  if (!roomData) return null;

  // Derived variables
  const players = Object.keys(roomData?.players || {});
  const currentQ = gameData.currentQuestion || 0;
  const questions = gameData.questions || [];
  const scores = gameData.scores || {};
  const answers = gameData.answers || {};
  const phase = gameData.phase || 'waiting';
  const question = questions[currentQ];
  const usedQuestionIds = gameData.usedQuestionIds || [];

  const safeUpdate = async (refPath: string, data: any) => {
    try {
      await update(ref(db, refPath), data);
    } catch {
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  const handleStartQuiz = async () => {
    if (!isHost || startQuizRef.current) return;
    startQuizRef.current = true;
    feedback('gameStart');
    const qs = getShuffledQuestions(TOTAL_QUESTIONS, usedQuestionIds);
    const newUsedIds = [...usedQuestionIds, ...qs.map(q => q._idx).filter(i => i !== undefined)];
    const initScores = {};
    players.forEach((p) => { initScores[p] = 0; });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        questions: qs,
        currentQuestion: 0,
        scores: initScores,
        answers: {},
        timerEnd: Date.now() + (QUESTION_TIME * 1000),
        usedQuestionIds: newUsedIds,
      });
    } finally {
      startQuizRef.current = false;
    }
  };

  const handleAnswer = async (choiceIdx) => {
    if (selectedAnswer !== null) return;
    if (phase !== 'playing') return;
    if (answerSubmittingRef.current) return;
    answerSubmittingRef.current = true;

    setSelectedAnswer(choiceIdx);
    const isCorrect = choiceIdx === question.answer;
    if (isCorrect) feedback('success');
    else feedback('error');
    
    const points = isCorrect ? 10 + timeLeft : 0;

    try {
      await safeUpdate(`rooms/${roomId}/gameData/answers/${currentQ}`, {
        [userNickname]: { choice: choiceIdx, correct: isCorrect, points },
      });
      if (isCorrect) {
        await safeUpdate(`rooms/${roomId}/gameData/scores`, {
          [userNickname]: increment(points),
        });
      }
    } finally {
      answerSubmittingRef.current = false;
    }
  };

  const handleNextQuestion = async () => {
    if (!isHost) return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
      if (currentQ + 1 >= questions.length) {
        await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'finished', timerEnd: null });
        const sortedScores = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));
        if (sortedScores.length > 0 && (sortedScores[0][1] as number) > 0) {
          await recordWin(roomId, sortedScores[0][0], 'quiz');
        }
      } else {
        await safeUpdate(`rooms/${roomId}/gameData`, {
          currentQuestion: currentQ + 1,
          timerEnd: Date.now() + (QUESTION_TIME * 1000),
          [`answers/${currentQ + 1}`]: null,
        });
      }
    } finally {
      advancingRef.current = false;
    }
  };

  const handlePlayAgain = async () => {
    if (!isHost || playAgainRef.current) return;
    playAgainRef.current = true;
    const qs = getShuffledQuestions(TOTAL_QUESTIONS, usedQuestionIds);
    const newUsedIds = [...usedQuestionIds, ...qs.map(q => q._idx).filter(i => i !== undefined)];
    const initScores = {};
    players.forEach((p) => { initScores[p] = 0; });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        questions: qs,
        currentQuestion: 0,
        scores: initScores,
        answers: {},
        timerEnd: Date.now() + (QUESTION_TIME * 1000),
        usedQuestionIds: newUsedIds,
      });
    } finally {
      playAgainRef.current = false;
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  // ─── Waiting Phase ───
  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 bg-slate-950 text-slate-200">
        {renderErrorToast()}
        <div className="text-8xl animate-bounce-soft drop-shadow-[0_0_20px_rgba(245,158,11,0.5)] text-amber-500">?</div>
        <div className="text-center px-4">
          <h2 className="font-black text-[32px] uppercase tracking-widest text-slate-200 mb-2 drop-shadow-md">Quiz Trivia</h2>
          <p className="text-slate-400 text-[12px] font-bold leading-relaxed max-w-[280px] mx-auto">ตอบคำถามให้เร็วที่สุด ยิ่งเร็วยิ่งได้คะแนนเยอะ!</p>
        </div>
        <NeonCard color="amber" className="p-4 w-full max-w-xs border-amber-500/30 bg-amber-900/10">
          <div className="text-center space-y-1">
            <p className="text-[12px] font-black uppercase tracking-widest text-amber-500">{TOTAL_QUESTIONS} คำถาม • {QUESTION_TIME} วินาที/ข้อ</p>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{players.length} ผู้เล่น</p>
          </div>
        </NeonCard>
        {isHost ? (
          <GiantButton color="amber" onClick={handleStartQuiz} className="w-full max-w-xs mt-4">
            เริ่มเกม!
          </GiantButton>
        ) : (
          <div className="flex flex-col items-center gap-4 mt-8">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-amber-500 rounded-full animate-spin shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 animate-pulse">รอ Host เริ่มเกม...</span>
          </div>
        )}
      </div>
    );
  }

  // ─── Finished Phase ───
  if (phase === 'finished') {
    const sortedScores = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));
    const winner = sortedScores[0];

    return (
      <div className="flex-1 flex flex-col gap-4 py-4 bg-slate-950 pb-24">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-center">
          <div className="text-7xl mb-2 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">🏆</div>
          <h2 className="font-black text-[28px] uppercase tracking-widest text-slate-200 mt-2 drop-shadow-md">จบเกม!</h2>
        </div>

        {/* Winner */}
        {winner && (
          <NeonCard color="amber" className="p-6 text-center border-amber-500/50 bg-amber-900/20 mx-4 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
            <Crown size={32} className="text-amber-400 mx-auto mb-3 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
            <p className="font-black text-[18px] uppercase tracking-widest text-amber-500">{winner[0]}</p>
            <p className="text-[32px] font-black text-white drop-shadow-md">{winner[1]} คะแนน</p>
          </NeonCard>
        )}

        {/* Scoreboard */}
        <div className="p-4 mx-4 bg-slate-900/50 border border-slate-800 rounded-3xl backdrop-blur-sm">
          <h3 className="font-black text-[12px] uppercase tracking-widest text-slate-400 mb-4 text-center">คะแนนรวม</h3>
          <div className="space-y-3">
            {sortedScores.map(([name, score], idx) => (
              <div key={name} className="flex items-center gap-4 p-3 rounded-2xl bg-slate-900 border border-slate-800">
                <span className={`w-8 h-8 rounded-xl flex-center text-[12px] font-black shrink-0 ${idx === 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/50' : idx === 2 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/50' : 'bg-slate-800 text-slate-500'}`}>
                  {idx + 1}
                </span>
                <span className={`flex-1 font-black text-[14px] uppercase tracking-widest ${idx === 0 ? 'text-amber-400' : 'text-slate-300'}`}>{name}</span>
                <span className={`font-black text-[16px] ${idx === 0 ? 'text-white' : 'text-slate-400'}`}>{score as number}</span>
                {name === userNickname && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-md">คุณ</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50 flex gap-3">
            <GiantButton color="emerald" onClick={handlePlayAgain} className="flex-1">
              <RotateCcw size={16} className="mr-2 inline-block" /> เล่นอีกรอบ
            </GiantButton>
            <button onClick={handleBackToLobby} className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:border-slate-500">
              <LogOut size={14} /> กลับ Lobby
            </button>
          </div>
        ) : (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50">
            <button
              className="w-full py-4 text-[12px] font-black uppercase tracking-widest border border-red-500/50 bg-red-500/10 text-red-500 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-500/20"
              onClick={requestLeave}
            >
              <LogOut size={15} /> ออกจากห้อง
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Playing Phase ───
  if (!question) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        {renderErrorToast()}
        <p className="text-slate-400">{t('common.loading')}</p>
      </div>
    );
  }

  const myAnswer = answers?.[currentQ]?.[userNickname];
  const hasAnswered = selectedAnswer !== null || myAnswer;

  return (
    <div className="flex-1 flex flex-col gap-3 bg-slate-950 px-2 py-4 pb-24 h-full relative">
      {renderErrorToast()}
      {/* Header */}
      <div className="flex-between px-2">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          ข้อ {currentQ + 1}/{questions.length}
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
          animate={{ width: `${(timeLeft / QUESTION_TIME) * 100}%` }}
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
        {question.choices.map((choice, idx) => {
          const isSelected = selectedAnswer === idx || answers[currentQ]?.[userNickname]?.choice === idx;
          const isCorrectAnswer = idx === question.answer;
          const showCorrect = showResult && isCorrectAnswer;
          const showWrong = showResult && isSelected && !isCorrectAnswer;
          const hasAnswered = selectedAnswer !== null || !!answers[currentQ]?.[userNickname];

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
              <span className={`w-10 h-10 rounded-xl flex-center text-[14px] font-black shrink-0 border ${
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
                {currentQ + 1 >= questions.length ? t('quiz.viewResults') : t('quiz.nextQuestion')}
              </GiantButton>
            )}
            {!isHost && (
              <p className="text-center text-[11px] text-slate-500 font-black uppercase tracking-widest animate-pulse mt-2">{t('quiz.waitingNextQuestion')}</p>
            )}
          </div>
        ) : (selectedAnswer !== null || !!answers[currentQ]?.[userNickname]) ? (
          <div className="flex-center gap-2 py-4">
            <div className="w-6 h-6 border-2 border-slate-700 border-t-amber-500 rounded-full animate-spin"></div>
            <span className="text-[12px] font-black text-amber-500 uppercase tracking-widest animate-pulse">{t('quiz.alreadyAnswered')}</span>
          </div>
        ) : (
           <div className="flex-center gap-2 py-4 opacity-0 pointer-events-none">Placeholder</div>
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

export default Quiz;
