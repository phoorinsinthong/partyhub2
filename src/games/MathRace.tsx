import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, increment } from 'firebase/database';
import { db } from '../firebase';
import { Trophy, RotateCcw, Crown, LogOut, Play, Send } from 'lucide-react';
import { generateRound } from './logic/mathRaceData';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGame } from '../contexts/GameContext';
import { useGameTimer } from '../hooks/useGameTimer';
import { TimerDisplay } from '../components/game-ui/TimerDisplay';
import { useTranslation } from 'react-i18next';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { feedback } from '../utils/feedback';
import NeonCard from '../components/NeonCard';
import GiantButton from '../components/GiantButton';

const QUESTION_TIME = 15;
const TOTAL_QUESTIONS = 10;

const MathRace = () => {
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { t } = useTranslation();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');
  
  const [selectedDifficulty, setSelectedDifficulty] = useState('easy');
  const [inputValue, setInputValue] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advancingRef = useRef(false);
  const answerSubmittingRef = useRef(false);
  const startRef = useRef(false);
  const replayRef = useRef(false);
  const lastCountdownRef = useRef<number | null>(null);
  const personalRecordedRef = useRef(false);

  const safeUpdate = useCallback(async (path: string, data: any) => {
    try {
      await update(ref(db, path), data);
    } catch {
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  }, [t]);

  const handleTimeUp = useCallback(async () => {
    if (!isHost) return;
    feedback('timeUp');
    await safeUpdate(`rooms/${roomId}/gameData`, { 
      phase: 'results',
      timerEnd: null
    });
  }, [isHost, roomId, safeUpdate]);

  const gameData = roomData?.gameData || {};
  const { timeLeft } = useGameTimer(gameData.timerEnd, isHost ? handleTimeUp : null);

  // Derived variables
  const players = Object.keys(roomData?.players || {});
  const phase = gameData.phase || 'waiting';
  const difficulty = gameData.difficulty || 'easy';
  const questions = gameData.questions || [];
  const currentQuestion = gameData.currentQuestion || 0;
  const answers = gameData.answers || {};
  const scores = gameData.scores || {};
  const myAnswer = answers[currentQuestion]?.[userNickname || ''];
  const alreadyAnswered = !!myAnswer;
  const currentQ = questions[currentQuestion];
  const answeredThisRound = Object.keys(answers[currentQuestion] || {});
  const answeredCount = answeredThisRound.length;
  const sortedScores = Object.entries(scores).sort((a: any, b: any) => b[1] - a[1]);

  const renderErrorToast = () => {
    if (!errorMsg) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in fade-in slide-in-from-top-4">
        <div className="bg-red-600 text-white px-4 py-3 rounded-2xl shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-500 flex items-center gap-3">
          <div className="p-1 bg-white/20 rounded-lg">
            <LogOut size={18} className="rotate-90" />
          </div>
          <p className="text-[14px] font-black uppercase tracking-widest">{errorMsg}</p>
        </div>
      </div>
    );
  };

  const handleStart = async () => {
    if (!isHost || players.length < 2 || startRef.current) return;
    startRef.current = true;
    feedback('gameStart');
    const roundQuestions = generateRound(selectedDifficulty, TOTAL_QUESTIONS);
    const initialScores: any = {};
    players.forEach(p => { initialScores[p] = 0; });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        difficulty: selectedDifficulty,
        questions: roundQuestions,
        currentQuestion: 0,
        timerEnd: Date.now() + (QUESTION_TIME * 1000),
        answers: {},
        scores: initialScores,
      });
    } finally {
      startRef.current = false;
    }
  };

  const advanceToNext = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    const nextQ = currentQuestion + 1;
    try {
      if (nextQ >= questions.length) {
        await safeUpdate(`rooms/${roomId}/gameData`, { 
          phase: 'finished',
          timerEnd: null
        });
        const sortedPlayers = Object.entries(scores).sort((a: any, b: any) => b[1] - a[1]);
        const winner = sortedPlayers[0];
        if (winner && (winner[1] as number) > 0) {
          await recordWin(roomId!, winner[0], 'mathrace');
        }
        feedback('victory');
      } else {
        feedback('newRound');
        await safeUpdate(`rooms/${roomId}/gameData`, {
          phase: 'playing',
          currentQuestion: nextQ,
          timerEnd: Date.now() + (QUESTION_TIME * 1000),
        });
      }
    } finally {
      advancingRef.current = false;
    }
  };

  const handleReplay = async () => {
    if (!isHost || replayRef.current) return;
    replayRef.current = true;
    const roundQuestions = generateRound(difficulty, TOTAL_QUESTIONS);
    const initialScores: any = {};
    players.forEach(p => { initialScores[p] = 0; });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        questions: roundQuestions,
        currentQuestion: 0,
        timerEnd: Date.now() + (QUESTION_TIME * 1000),
        answers: {},
        scores: initialScores,
      });
      feedback('gameStart');
    } finally {
      replayRef.current = false;
    }
  };

  const handleSubmitAnswer = async () => {
    if (hasAnswered || alreadyAnswered || phase !== 'playing') return;
    if (answerSubmittingRef.current) return;
    const numAnswer = parseInt(inputValue, 10);
    if (isNaN(numAnswer)) return;
    answerSubmittingRef.current = true;

    const timerEnd = gameData.timerEnd || 0;
    const timeLeftLocal = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
    const isCorrect = numAnswer === questions[currentQuestion]?.answer;
    const points = isCorrect ? Math.max(1, timeLeftLocal) : 0;

    if (isCorrect) feedback('correctGuess');

    try {
      setHasAnswered(true);

      await safeUpdate(`rooms/${roomId}/gameData/answers/${currentQuestion}/${userNickname}`, {
        answer: numAnswer,
        correct: isCorrect,
        points,
        answeredAt: Date.now(),
      });

      await safeUpdate(`rooms/${roomId}/gameData/scores`, { [userNickname!]: increment(points) });

      const existingAnswers = Object.keys(answers[currentQuestion] || {});
      const totalAnswered = existingAnswers.includes(userNickname!)
        ? existingAnswers.length
        : existingAnswers.length + 1;
      if (totalAnswered >= players.length && isHost) {
        await safeUpdate(`rooms/${roomId}/gameData`, { 
          phase: 'results',
          timerEnd: null
        });
      }
    } finally {
      answerSubmittingRef.current = false;
    }
  };

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  useEffect(() => {
    if (phase === 'waiting' || phase === 'playing') personalRecordedRef.current = false;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('mathrace');
    const sorted = Object.entries(scores).sort((a: any, b: any) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][0] === userNickname && (sorted[0][1] as number) > 0) {
      recordPersonalWin('mathrace');
    }
  }, [phase, scores, userNickname]);

  const prevQuestionRef = useRef<number>(currentQuestion);
  useEffect(() => {
    if (prevQuestionRef.current !== currentQuestion) {
      prevQuestionRef.current = currentQuestion;
      setInputValue('');
      setHasAnswered(alreadyAnswered);
    }
  }, [currentQuestion, alreadyAnswered]);

  useEffect(() => {
    if (timeLeft <= 5 && timeLeft > 0 && timeLeft !== lastCountdownRef.current) {
      lastCountdownRef.current = timeLeft;
      feedback('countdown');
    }
  }, [timeLeft]);

  useEffect(() => {
    advancingRef.current = false;
    answerSubmittingRef.current = false;
  }, [currentQuestion, phase]);

  if (!roomData) return null;

  if (phase === 'waiting') {
    return (
      <div className="flex flex-col flex-1 gap-4 bg-slate-950 text-slate-200">
        {renderErrorToast()}
        <div className="text-center py-6">
          <motion.div
            className="text-8xl drop-shadow-[0_0_20px_rgba(168,85,247,0.5)] mb-4"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🧮
          </motion.div>
          <h2 className="font-black text-[32px] uppercase tracking-widest text-white mb-2 drop-shadow-md">{t('mathrace.title')}</h2>
          <p className="text-slate-400 text-[12px] font-bold leading-relaxed max-w-xs mx-auto">{t('mathrace.description')}</p>
        </div>

        {isHost && (
          <NeonCard color="purple" className="p-4 mx-4 border-purple-500/30 bg-purple-900/10">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">{t('mathrace.difficulty')}</h3>
            <div className="flex gap-2">
              {[
                { key: 'easy', label: t('mathrace.difficultyEasy') },
                { key: 'medium', label: t('mathrace.difficultyMedium') },
                { key: 'hard', label: t('mathrace.difficultyHard') },
              ].map(d => (
                <button
                  key={d.key}
                  onClick={() => setSelectedDifficulty(d.key)}
                  className={`flex-1 rounded-2xl py-3 flex flex-col items-center gap-1 border transition-all active:scale-95 ${
                    selectedDifficulty === d.key
                      ? 'bg-purple-500/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                      : 'bg-slate-900 border-slate-700 opacity-60'
                  }`}
                >
                  <span className={`font-black text-[12px] uppercase tracking-widest ${selectedDifficulty === d.key ? 'text-purple-400' : 'text-slate-500'}`}>{d.label}</span>
                </button>
              ))}
            </div>
          </NeonCard>
        )}

        <div className="p-4 mx-4 bg-slate-900/50 border border-slate-800 rounded-3xl mt-2">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3 text-center">
            {t('taboo.players')} ({players.length})
          </h3>
          <div className="flex flex-wrap justify-center gap-2">
            {players.map(p => (
              <span key={p} className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-[11px] font-black uppercase tracking-widest text-slate-300">
                {p === roomData.host && <Crown size={12} className="inline mr-1 text-amber-500 mb-0.5" />}
                {p}
              </span>
            ))}
          </div>
        </div>

        {isHost ? (
          <div className="mt-auto px-4 pb-6 pt-2">
            <GiantButton
              color="purple"
              className="w-full"
              onClick={handleStart}
              disabled={players.length < 2}
            >
              <Play size={18} fill="currentColor" className="mr-2 inline-block mb-1" />
              {t('mathrace.startGame')}
            </GiantButton>
            {players.length < 2 && (
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-950/50 border border-red-500/30 p-2.5 rounded-xl mt-3">
                {t('taboo.minPlayers')}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 mt-8">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-purple-500 rounded-full animate-spin shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 animate-pulse">{t('mathrace.waitingHost')}</span>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'playing' && currentQ) {
    return (
      <div className="flex flex-col flex-1 gap-4 bg-slate-950 text-slate-200 px-2 py-4">
        {renderErrorToast()}
        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
          <motion.div
            className={`h-full rounded-full ${timeLeft > 10 ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]' : timeLeft > 5 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'}`}
            initial={{ width: '100%' }}
            animate={{ width: `${(timeLeft / QUESTION_TIME) * 100}%` }}
            transition={{ duration: 0.5, ease: 'linear' }}
          />
        </div>

        <div className="flex items-center justify-between px-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            {t('mathrace.questionNumber', { current: currentQuestion + 1, total: questions.length })}
          </span>
          <TimerDisplay timeLeft={timeLeft} size="sm" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            {t('quiz.alreadyAnswered').split('!')[0]} {answeredCount}/{players.length}
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
      </div>
    );
  }

  if (phase === 'results' && currentQ) {
    const roundAnswers: any = answers[currentQuestion] || {};
    return (
      <div className="flex flex-col flex-1 gap-4 bg-slate-950 text-slate-200 px-2 py-4">
        {renderErrorToast()}
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
              {currentQuestion + 1 >= questions.length ? t('taboo.viewResults') : t('mathrace.nextQuestion')}
            </GiantButton>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'finished') {
    const winner = sortedScores[0];
    return (
      <div className="flex flex-col flex-1 gap-4 bg-slate-950 text-slate-200 pb-24">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        
        <div className="text-center mt-6">
          <div className="text-7xl mb-2 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">🏆</div>
          <h2 className="font-black text-[28px] uppercase tracking-widest text-white mt-2 drop-shadow-md">{t('common.finished') || 'จบเกม!'}</h2>
        </div>

        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 text-center border-amber-500/50 bg-amber-900/20 mx-4 shadow-[0_0_30px_rgba(245,158,11,0.15)] rounded-3xl border"
          >
            <Crown size={32} className="text-amber-400 mx-auto mb-3 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
            <p className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest mb-1">{t('spyfall.citizenWin').split(' ')[0] === 'พลเมือง' ? 'ผู้ชนะ' : 'Winner'}</p>
            <p className="font-black text-[24px] uppercase tracking-widest text-amber-400 drop-shadow-md">{winner[0]}</p>
            <p className="text-[32px] font-black text-white drop-shadow-md mt-1">{winner[1] as number} <span className="text-[16px] text-slate-400">{t('taboo.pointsGuesser').split(' ')[1]}</span></p>
          </motion.div>
        )}

        <div className="p-4 mx-4 bg-slate-900/50 border border-slate-800 rounded-3xl backdrop-blur-sm mt-4">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 text-center">{t('taboo.totalScores')}</h3>
          <div className="space-y-3">
            {sortedScores.map(([name, score], i) => (
              <div
                key={name}
                className="flex items-center gap-4 p-3 rounded-2xl bg-slate-900 border border-slate-800"
              >
                <div className="flex items-center gap-4">
                  <span className={`w-8 h-8 rounded-xl flex-center text-[12px] font-black shrink-0 ${i === 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : i === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/50' : i === 2 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/50' : 'bg-slate-800 text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <span className={`font-black text-[14px] uppercase tracking-widest ${i === 0 ? 'text-amber-400' : 'text-slate-300'}`}>{name}</span>
                  {name === roomData.host && <Crown size={12} className="text-amber-500" />}
                </div>
                <span className={`font-black text-[16px] ml-auto ${i === 0 ? 'text-white' : 'text-slate-400'}`}>{score as number}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50 flex gap-3">
          {isHost ? (
            <>
              <GiantButton color="purple" className="flex-1" onClick={handleReplay}>
                <RotateCcw size={18} className="mr-2 inline-block mb-0.5" />
                {t('taboo.playAgain')}
              </GiantButton>
              <button className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all hover:border-slate-500" onClick={requestLeave}>
                <LogOut size={16} className="mr-2 inline-block mb-0.5" />
                {t('taboo.leaveRoom')}
              </button>
            </>
          ) : (
            <button className="w-full py-4 text-[12px] font-black uppercase tracking-widest border border-red-500/50 bg-red-500/10 text-red-500 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-500/20" onClick={requestLeave}>
              <LogOut size={16} />
              {t('taboo.leaveRoom')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-center flex-1 flex-col gap-4 bg-slate-950">
      {renderErrorToast()}
      <div className="w-10 h-10 border-[4px] border-slate-800 border-t-purple-500 rounded-full animate-spin shadow-[0_0_15px_rgba(168,85,247,0.5)]"></div>
      <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest animate-pulse">{t('common.loading')}</p>
    </div>
  );
};

export default MathRace;
