// @ts-nocheck
import React, { useState, useRef } from 'react';
import { increment } from 'firebase/database';
import { useTranslation } from 'react-i18next';
import { useGame } from '../../contexts/GameContext';
import { useGameUpdate } from '../../hooks/useGameUpdate';
import { useGameTimer } from '../../hooks/useGameTimer';
import { getShuffledQuestions } from './quizData';
import { recordWin } from '../../components/features/Scoreboard';
import { useGameLeave } from '../../hooks/useGameLeave';
import { feedback } from '../../utils/feedback';
import { LogOut } from 'lucide-react';

import WaitingPhase from './WaitingPhase';
import PlayingPhase from './PlayingPhase';
import FinishedPhase from './FinishedPhase';

const QUESTION_TIME = 15;
const TOTAL_QUESTIONS = 10;

const Quiz: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg } = useGameUpdate(roomId);
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');
  
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  
  const answerSubmittingRef = useRef(false);
  const advancingRef = useRef(false);
  const startQuizRef = useRef(false);
  const playAgainRef = useRef(false);

  const gameData = roomData?.gameData || {};
  const { timeLeft } = useGameTimer(gameData.timerEnd);

  // Derived variables
  const players = Object.keys(roomData?.players || {});
  const currentQ = gameData.currentQuestion || 0;
  const questions = gameData.questions || [];
  const scores = gameData.scores || {};
  const answers = gameData.answers || {};
  const phase = gameData.phase || 'waiting';
  const question = questions[currentQ];
  const usedQuestionIds = gameData.usedQuestionIds || [];

  const [prevQ, setPrevQ] = useState(currentQ);
  if (currentQ !== prevQ) {
    setPrevQ(currentQ);
    setSelectedAnswer(null);
    setShowResult(false);
  }

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

  const handleAnswer = async (choiceIdx: number) => {
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

  if (phase === 'waiting') {
    return (
      <WaitingPhase
        players={players}
        isHost={isHost}
        totalQuestions={TOTAL_QUESTIONS}
        questionTime={QUESTION_TIME}
        handleStartQuiz={handleStartQuiz}
        renderErrorToast={renderErrorToast}
      />
    );
  }

  if (phase === 'finished') {
    return (
      <FinishedPhase
        scores={scores}
        showConfirm={showConfirm}
        confirmLeave={confirmLeave}
        cancelLeave={cancelLeave}
        userNickname={userNickname}
        isHost={isHost}
        handlePlayAgain={handlePlayAgain}
        handleBackToLobby={handleBackToLobby}
        requestLeave={requestLeave}
        renderErrorToast={renderErrorToast}
      />
    );
  }

  return (
    <PlayingPhase
      question={question}
      currentQ={currentQ}
      questionsCount={questions.length}
      timeLeft={timeLeft}
      questionTime={QUESTION_TIME}
      selectedAnswer={selectedAnswer}
      answers={answers}
      userNickname={userNickname}
      showResult={showResult}
      setShowResult={setShowResult}
      handleAnswer={handleAnswer}
      players={players}
      isHost={isHost}
      handleNextQuestion={handleNextQuestion}
      scores={scores}
      renderErrorToast={renderErrorToast}
    />
  );
};

export default Quiz;
