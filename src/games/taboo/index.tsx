import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, update, increment } from 'firebase/database';
import { db } from '@/firebase';
import { useTranslation } from 'react-i18next';
import { useGame } from '@/contexts/GameContext';
import { useGameUpdate } from '@/hooks';
import { useGameTimer } from '@/hooks';
import { getRandomCards } from './tabooData';
import { recordWin } from '@/components/features';
import { recordPersonalWin, recordPersonalGame } from '@/components/features';
import { useGameLeave } from '@/hooks';
import { useTurnNotification } from '@/hooks';
import { feedback } from '@/utils/feedback';

import { WaitingPhase } from './WaitingPhase';
import { FinishedPhase } from './FinishedPhase';
import { ChoosingPhase } from './ChoosingPhase';
import { RoundEndPhase } from './RoundEndPhase';
import { PlayingPhase } from './PlayingPhase';

const ROUND_TIME = 60;
const MAX_SKIPS = 2;

function shuffle(arr: any[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const Taboo = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);
  
  const [showGuesserPicker, setShowGuesserPicker] = useState(false);
    const [cardMode, setCardMode] = useState('all');
  const lastCountdownRef = useRef<number | null>(null);
  const advancingRef = useRef(false);
  const skipRef = useRef(false);
  const confirmRef = useRef(false);
  const correctGuessRef = useRef(false);
  const personalRecordedRef = useRef(false);
  const startGameRef = useRef(false);

  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');

  const renderErrorToast = () => {
    if (!errorMsg) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
        {errorMsg}
      </div>
    );
  };

  
  const handleTimeUp = useCallback(async () => {
    if (!isHost) return;
    feedback('timeUp');

    await safeUpdate(`rooms/${roomId}/gameData`, {
      phase: 'roundEnd',
      roundResult: 'timeUp',
      roundEndedAt: Date.now(),
      timerEnd: null
    });
  }, [isHost, roomId, safeUpdate]);

  const { timeLeft } = useGameTimer(roomData?.gameData?.timerEnd, isHost ? handleTimeUp : null);

  const currentDescriber = roomData?.gameData?.describerOrder?.[roomData?.gameData?.currentDescriberIndex ?? 0] || '';
  const isDescriber = userNickname === currentDescriber;
  const phase = roomData?.gameData?.phase || 'waiting';

  useTurnNotification(isDescriber, phase);

  useEffect(() => {
    if (timeLeft <= 5 && timeLeft > 0 && timeLeft !== lastCountdownRef.current) {
      lastCountdownRef.current = timeLeft;
      feedback('countdown');
    }
  }, [timeLeft]);

  useEffect(() => {
    if (phase === 'waiting' || phase === 'playing' || phase === 'choosing') {
      personalRecordedRef.current = false;
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('taboo');
    const scores = roomData?.gameData?.scores || {};
    const sorted = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));
    if (sorted.length > 0 && sorted[0][0] === userNickname && (sorted[0][1] as number) > 0) {
      recordPersonalWin('taboo');
    }
  }, [phase, roomData?.gameData?.scores, userNickname]);

  useEffect(() => {
    advancingRef.current = false;
    skipRef.current = false;
    confirmRef.current = false;
    correctGuessRef.current = false;
    lastCountdownRef.current = null;
  }, [roomData?.gameData?.round, phase]);

  const handleNextRound = useCallback(async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;

    const gameData = roomData?.gameData || {};
    const currentDescriberIndex = gameData.currentDescriberIndex ?? 0;
    const describerOrder = gameData.describerOrder || [];
    const scores = gameData.scores || {};
    const currentCard = gameData.currentCard || null;
    const usedWords = gameData.usedWords || [];
    const round = gameData.round || 1;

    const nextIndex = currentDescriberIndex + 1;
    const newUsedWords = currentCard ? [...usedWords, currentCard.word] : usedWords;

    try {
      if (nextIndex >= describerOrder.length) {
        const sortedScores = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));
        await safeUpdate(`rooms/${roomId}/gameData`, {
          phase: 'finished',
          usedWords: newUsedWords,
          timerEnd: null
        });
        if (sortedScores.length > 0 && (sortedScores[0][1] as number) > 0) {
          await recordWin(roomId, sortedScores[0][0], 'taboo');
        }
      } else {
        feedback('newRound');
        const [nextCard] = getRandomCards(1, newUsedWords, gameData.cardMode || 'all');

        await safeUpdate(`rooms/${roomId}/gameData`, {
          phase: 'choosing',
          currentDescriberIndex: nextIndex,
          round: round + 1,
          currentCard: null,
          roundStartedAt: 0,
          timerEnd: null,
          skipsUsed: 0,
          usedWords: newUsedWords,
          previewCard: nextCard,
          roundResult: null,
          correctGuesser: null,
        });
      }
    } finally {
      advancingRef.current = false;
    }
  }, [isHost, roomId, safeUpdate, roomData?.gameData]);

  useEffect(() => {
    if (phase !== 'roundEnd' || !isHost) return;
    const t = setTimeout(handleNextRound, 3500);
    return () => clearTimeout(t);
  }, [phase, isHost, handleNextRound]);

  if (!roomData) return null;

  const gameData = roomData?.gameData || {};
  const players = Object.keys(roomData?.players || {});
  const currentDescriberIndex = gameData.currentDescriberIndex ?? 0;
  const describerOrder = gameData.describerOrder || [];
  const currentCard = gameData.currentCard || null;
  const scores = gameData.scores || {};
  const round = gameData.round || 1;
  const totalRounds = gameData.totalRounds || players.length;
  const usedWords = gameData.usedWords || [];
  const skipsUsed = gameData.skipsUsed || 0;

  // ─── Host: Start Game ───
  const handleStartGame = async () => {
    if (!isHost || startGameRef.current) return;
    startGameRef.current = true;
    feedback('gameStart');
    const order = shuffle(players);
    const initScores = {};
    players.forEach((p) => { initScores[p] = 0; });
    const [firstCard] = getRandomCards(1, [], cardMode);

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'choosing',
        describerOrder: order,
        currentDescriberIndex: 0,
        scores: initScores,
        round: 1,
        totalRounds: order.length,
        usedWords: [],
        currentCard: null,
        roundStartedAt: 0,
        timerEnd: null,
        skipsUsed: 0,
        previewCard: firstCard,
        correctGuesser: null,
        cardMode,
      });
    } finally {
      startGameRef.current = false;
    }
  };

  // ─── Describer: Skip card ───
  const handleSkip = async () => {
    if (!isDescriber || skipsUsed >= MAX_SKIPS || phase !== 'choosing') return;
    if (skipRef.current) return;
    skipRef.current = true;
    feedback('tap');
    try {
      const [newCard] = getRandomCards(1, usedWords, gameData.cardMode || 'all');
      await safeUpdate(`rooms/${roomId}/gameData`, {
        skipsUsed: skipsUsed + 1,
        previewCard: newCard,
      });
    } finally {
      skipRef.current = false;
    }
  };

  // ─── Describer: Confirm card, start round ───
  const handleConfirmCard = async () => {
    if (!isDescriber || phase !== 'choosing') return;
    if (confirmRef.current) return;
    confirmRef.current = true;
    feedback('gameStart');
    const card = gameData.previewCard;
    if (!card) { confirmRef.current = false; return; }

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        currentCard: card,
        timerEnd: Date.now() + (ROUND_TIME * 1000),
      });
    } finally {
      confirmRef.current = false;
    }
  };

  // ─── Describer: Handle correct guess ───
  const handleCorrectGuess = async (guesserName: string) => {
    if (!isDescriber || !currentCard) return;
    if (correctGuessRef.current) return;
    correctGuessRef.current = true;
    feedback('correctGuess');
    setShowGuesserPicker(false);

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        [`scores/${currentDescriber}`]: increment(3),
        [`scores/${guesserName}`]: increment(1),
        phase: 'roundEnd',
        roundResult: 'correct',
        roundEndedAt: Date.now(),
        correctGuesser: guesserName,
        timerEnd: null
      });
    } finally {
      correctGuessRef.current = false;
    }
  };

  // ─── Play Again ───
  const handlePlayAgain = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('gameStart');
    const order = shuffle(players);
    const initScores = {};
    players.forEach((p) => { initScores[p] = 0; });
    const [firstCard] = getRandomCards(1, [], cardMode);

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'choosing',
        describerOrder: order,
        currentDescriberIndex: 0,
        scores: initScores,
        round: 1,
        totalRounds: order.length,
        usedWords: [],
        currentCard: null,
        roundStartedAt: 0,
        timerEnd: null,
        skipsUsed: 0,
        previewCard: firstCard,
        roundResult: null,
        correctGuesser: null,
        cardMode,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  const sortedScores = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));
  const nonDescribers = players.filter((p) => p !== currentDescriber);

  if (phase === 'waiting') {
    return (
      <WaitingPhase
        renderErrorToast={renderErrorToast}
        t={t}
        players={players}
        ROUND_TIME={ROUND_TIME}
        MAX_SKIPS={MAX_SKIPS}
        isHost={isHost}
        cardMode={cardMode}
        setCardMode={setCardMode}
        handleStartGame={handleStartGame}
      />
    );
  }

  if (phase === 'finished') {
    return (
      <FinishedPhase
        renderErrorToast={renderErrorToast}
        t={t}
        showConfirm={showConfirm}
        confirmLeave={confirmLeave}
        cancelLeave={cancelLeave}
        sortedScores={sortedScores}
        userNickname={userNickname}
        isHost={isHost}
        handlePlayAgain={handlePlayAgain}
        handleBackToLobby={handleBackToLobby}
        requestLeave={requestLeave}
      />
    );
  }

  if (phase === 'choosing') {
    return (
      <ChoosingPhase
        renderErrorToast={renderErrorToast}
        t={t}
        round={round}
        totalRounds={totalRounds}
        isDescriber={isDescriber}
        skipsUsed={skipsUsed}
        MAX_SKIPS={MAX_SKIPS}
        card={gameData.previewCard}
        handleSkip={handleSkip}
        handleConfirmCard={handleConfirmCard}
        currentDescriber={currentDescriber}
        scores={scores}
        sortedScores={sortedScores}
      />
    );
  }

  if (phase === 'roundEnd') {
    return (
      <RoundEndPhase
        renderErrorToast={renderErrorToast}
        t={t}
        roundResult={gameData.roundResult}
        correctGuesser={gameData.correctGuesser}
        currentCard={currentCard}
        sortedScores={sortedScores}
        userNickname={userNickname}
        isHost={isHost}
        currentDescriberIndex={currentDescriberIndex}
        describerOrder={describerOrder}
        handleNextRound={handleNextRound}
      />
    );
  }

  if (phase === 'playing') {
    return (
      <PlayingPhase
        renderErrorToast={renderErrorToast}
        t={t}
        round={round}
        totalRounds={totalRounds}
        currentDescriber={currentDescriber}
        timeLeft={timeLeft}
        isDescriber={isDescriber}
        currentCard={currentCard}
        setShowGuesserPicker={setShowGuesserPicker}
        showGuesserPicker={showGuesserPicker}
        nonDescribers={nonDescribers}
        handleCorrectGuess={handleCorrectGuess}
        sortedScores={sortedScores}
      />
    );
  }

  return null;
};

export default Taboo;
