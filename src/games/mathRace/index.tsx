// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, increment } from 'firebase/database';
import { db } from '../../firebase';
import { generateRound } from './mathRaceData';
import { recordWin } from '../../components/features/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../../components/features/PersonalStats';
import { useGameLeave } from '../../hooks/useGameLeave';
import { useGame } from '../../contexts/GameContext';
import { useGameUpdate } from '../../hooks/useGameUpdate';
import { useGameTimer } from '../../hooks/useGameTimer';
import { useTranslation } from 'react-i18next';
import { feedback } from '../../utils/feedback';
import { LogOut } from 'lucide-react';
import WaitingPhase from './WaitingPhase';
import PlayingPhase from './PlayingPhase';
import ResultsPhase from './ResultsPhase';
import FinishedPhase from './FinishedPhase';

const QUESTION_TIME = 15;
const TOTAL_QUESTIONS = 10;

const MathRace = () => {
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);
  const { t } = useTranslation();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');
  
  const [selectedDifficulty, setSelectedDifficulty] = useState('easy');
  const [inputValue, setInputValue] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
    
  const inputRef = useRef<HTMLInputElement>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advancingRef = useRef(false);
  const answerSubmittingRef = useRef(false);
  const startRef = useRef(false);
  const replayRef = useRef(false);
  const lastCountdownRef = useRef<number | null>(null);
  const personalRecordedRef = useRef(false);

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
        <WaitingPhase
          isHost={isHost}
          players={players}
          host={roomData.host}
          selectedDifficulty={selectedDifficulty}
          setSelectedDifficulty={setSelectedDifficulty}
          handleStart={handleStart}
        />
      </div>
    );
  }

  if (phase === 'playing' && currentQ) {
    return (
      <div className="flex flex-col flex-1 gap-4 bg-slate-950 text-slate-200 px-2 py-4">
        <PlayingPhase
          timeLeft={timeLeft}
          questionTime={QUESTION_TIME}
          currentQuestion={currentQuestion}
          totalQuestions={questions.length}
          answeredCount={answeredCount}
          totalPlayers={players.length}
          difficulty={difficulty}
          currentQ={currentQ}
          hasAnswered={hasAnswered}
          alreadyAnswered={alreadyAnswered}
          inputValue={inputValue}
          setInputValue={setInputValue}
          handleKeyDown={handleKeyDown}
          handleSubmitAnswer={handleSubmitAnswer}
          myAnswer={myAnswer}
          inputRef={inputRef}
          errorMsg={errorMsg}
        />
      </div>
    );
  }

  if (phase === 'results' && currentQ) {
    const roundAnswers: any = answers[currentQuestion] || {};
    return (
      <div className="flex flex-col flex-1 gap-4 bg-slate-950 text-slate-200 px-2 py-4">
        {renderErrorToast()}
        <ResultsPhase
          currentQ={currentQ}
          players={players}
          roundAnswers={roundAnswers}
          sortedScores={sortedScores}
          isHost={isHost}
          currentQuestion={currentQuestion}
          totalQuestions={questions.length}
          advanceToNext={advanceToNext}
        />
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="flex flex-col flex-1 gap-4 bg-slate-950 text-slate-200 pb-24">
        {renderErrorToast()}
        <FinishedPhase
          sortedScores={sortedScores}
          showConfirm={showConfirm}
          confirmLeave={confirmLeave}
          cancelLeave={cancelLeave}
          host={roomData.host}
          isHost={isHost}
          handleReplay={handleReplay}
          requestLeave={requestLeave}
        />
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
