// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getRandomCategories } from './wordBombData';
import { recordWin } from '../../components/features/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../../components/features/PersonalStats';
import { useGameLeave } from '../../hooks/useGameLeave';
import { useTurnNotification } from '../../hooks/useTurnNotification';
import { useGame } from '../../contexts/GameContext';
import { useGameUpdate } from '../../hooks/useGameUpdate';
import { useGameTimer } from '../../hooks/useGameTimer';
import { feedback } from '../../utils/feedback';
import { WaitingPhase } from './WaitingPhase';
import { PlayingPhase } from './PlayingPhase';
import { FinishedPhase } from './FinishedPhase';

const MAX_LIVES = 3;

function randomBombTime() {
  return Math.floor(Math.random() * 16) + 10; // 10–25
}

function shuffle(arr: any[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getNextTurnIndex(currentIndex: number, turnOrder: string[], eliminated: string[]) {
  const total = turnOrder.length;
  let next = (currentIndex + 1) % total;
  for (let i = 0; i < total; i++) {
    if (!eliminated.includes(turnOrder[next])) return next;
    next = (next + 1) % total;
  }
  return next;
}

const WordBomb: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg } = useGameUpdate(roomId);
  
  const gameData = roomData?.gameData || {};
  const players = Object.keys(roomData?.players || {});

  const phase = gameData.phase || 'waiting';
  const category = gameData.category || '';
  const categoryExamples = gameData.categoryExamples || '';
  const currentTurnIndex = gameData.currentTurnIndex ?? 0;
  const turnOrder = React.useMemo(() => gameData.turnOrder || [], [gameData.turnOrder]);
  const lives = gameData.lives || {};
  const bombTime = gameData.bombTime || 15;
  const eliminated = React.useMemo(() => gameData.eliminated || [], [gameData.eliminated]);
  const roundNumber = gameData.roundNumber || 1;

  const activePlayer = turnOrder[currentTurnIndex] || '';
  const isMyTurn = activePlayer === userNickname;

  const { confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');
  useTurnNotification(isMyTurn, phase);

  const [exploding, setExploding] = useState(false);
  const explodedRef = useRef(false);
  const advancingRef = useRef(false);
  const personalRecordedRef = useRef(false);

  useEffect(() => {
    if (phase === 'waiting' || phase === 'playing') {
      personalRecordedRef.current = false;
    }
  }, [phase]);

  useEffect(() => {
    advancingRef.current = false;
  }, [currentTurnIndex, phase]);

  useEffect(() => {
    if (phase !== 'finished' || isHost || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('wordbomb');
    const survivors = turnOrder.filter((p: string) => !eliminated.includes(p));
    if (survivors[0] === userNickname) recordPersonalWin('wordbomb');
  }, [phase, isHost, turnOrder, eliminated, userNickname]);

  const handleBombExplode = useCallback(async () => {
    if (!isHost || phase !== 'playing') return;
    if (advancingRef.current) return;
    advancingRef.current = true;

    const currentPlayer = turnOrder[currentTurnIndex] || '';
    const currentLives = lives[currentPlayer] ?? MAX_LIVES;
    const newLives = Math.max(0, currentLives - 1);
    const newLivesMap = { ...lives, [currentPlayer]: newLives };

    const newEliminated = [...eliminated];
    let newPhase = 'playing';

    if (newLives <= 0 && !newEliminated.includes(currentPlayer)) {
      newEliminated.push(currentPlayer);
    }

    const survivors = turnOrder.filter((p: string) => !newEliminated.includes(p));
    if (survivors.length <= 1) {
      newPhase = 'finished';
    }

    const nextTurnIndex = getNextTurnIndex(currentTurnIndex, turnOrder, newEliminated);
    const newDuration = randomBombTime();

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        lives: newLivesMap,
        eliminated: newEliminated,
        phase: newPhase,
        currentTurnIndex: nextTurnIndex,
        bombTime: newDuration,
        timerEnd: Date.now() + (newDuration * 1000),
      });
      if (newPhase === 'finished') {
        const winner = survivors[0] || null;
        if (winner) await recordWin(roomId || '', winner, 'wordbomb');
      }
    } finally {
      advancingRef.current = false;
    }
  }, [isHost, phase, lives, turnOrder, currentTurnIndex, eliminated, roomId, safeUpdate]);

  const { timeLeft } = useGameTimer(gameData.timerEnd, isHost ? handleBombExplode : null);

  useEffect(() => {
    if (phase !== 'playing') {
      if (exploding) setTimeout(() => setExploding(false), 0);
      explodedRef.current = false;
      return;
    }

    if (timeLeft <= 5 && timeLeft > 0) {
      feedback('countdown');
    }

    if (timeLeft === 0 && !explodedRef.current) {
      explodedRef.current = true;
      setExploding(true);
      feedback('timeUp');
    }
  }, [timeLeft, phase, exploding]);

  if (!roomData) return null;

  const handleCorrectAnswer = async () => {
    if (!isHost) return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    const nextIdx = getNextTurnIndex(currentTurnIndex, turnOrder, eliminated);
    const newDuration = randomBombTime();
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        currentTurnIndex: nextIdx,
        bombTime: newDuration,
        timerEnd: Date.now() + (newDuration * 1000),
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleStartGame = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('gameStart');

    const nonHostPlayers = players.filter(p => p !== roomData.host);
    const shuffled = shuffle(nonHostPlayers);
    const livesMap: Record<string, number> = {};
    shuffled.forEach(p => { livesMap[p] = MAX_LIVES; });

    const catObj = getRandomCategories(1, [])[0];
    const newDuration = randomBombTime();

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        category: catObj.category,
        categoryExamples: catObj.examples,
        currentTurnIndex: 0,
        turnOrder: shuffled,
        lives: livesMap,
        bombTime: newDuration,
        timerEnd: Date.now() + (newDuration * 1000),
        usedCategories: [catObj.category],
        roundNumber: 1,
        eliminated: [],
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleNextCategory = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('newRound');

    const usedCats = gameData.usedCategories || [];
    const catObj = getRandomCategories(1, usedCats)[0];
    const survivors = turnOrder.filter((p: string) => !eliminated.includes(p));
    const newDuration = randomBombTime();

    const firstIdx = turnOrder.findIndex((p: string) => survivors.includes(p));

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        category: catObj.category,
        categoryExamples: catObj.examples,
        currentTurnIndex: firstIdx >= 0 ? firstIdx : 0,
        bombTime: newDuration,
        timerEnd: Date.now() + (newDuration * 1000),
        usedCategories: [...usedCats, catObj.category],
        roundNumber: (roundNumber || 1) + 1,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  const renderErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl animate-fade-in">
      {errorMsg}
    </div>
  ) : null;

  return (
    <>
      {renderErrorToast()}
      {phase === 'waiting' && (
        <WaitingPhase
          isHost={isHost}
          showConfirm={showConfirm}
          confirmLeave={confirmLeave}
          cancelLeave={cancelLeave}
          handleStartGame={handleStartGame}
          t={t}
        />
      )}
      {phase === 'finished' && (
        <FinishedPhase
          isHost={isHost}
          winner={turnOrder.filter((p: string) => !eliminated.includes(p))[0] || '???'}
          handleStartGame={handleStartGame}
          handleBackToLobby={handleBackToLobby}
          t={t}
        />
      )}
      {phase === 'playing' && (
        <PlayingPhase
          isHost={isHost}
          showConfirm={showConfirm}
          confirmLeave={confirmLeave}
          cancelLeave={cancelLeave}
          roundNumber={roundNumber}
          category={category}
          timeLeft={timeLeft}
          bombTime={bombTime}
          exploding={exploding}
          isMyTurn={isMyTurn}
          activePlayer={activePlayer}
          categoryExamples={categoryExamples}
          handleCorrectAnswer={handleCorrectAnswer}
          handleNextCategory={handleNextCategory}
          turnOrder={turnOrder}
          eliminated={eliminated}
          userNickname={userNickname || ''}
          lives={lives}
          handleBackToLobby={handleBackToLobby}
          t={t}
        />
      )}
    </>
  );
};

export default WordBomb;
