import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, update, get } from 'firebase/database';
import { db } from '@/firebase';
import { recordWin } from '@/components/features';
import { recordPersonalWin, recordPersonalGame } from '@/components/features';
import { useGameLeave } from '@/hooks';
import { useGame } from '@/contexts/GameContext';
import { useGameUpdate } from '@/hooks';
import { useGameTimer } from '@/hooks';
import { useTranslation } from 'react-i18next';
import { feedback } from '@/utils/feedback';
import { WaitingPhase } from './WaitingPhase';
import { SetupPhase } from './SetupPhase';
import { PlayingPhase } from './PlayingPhase';
import { ResultPhase } from './ResultPhase';

const TURN_TIME = 30;

const TargetNumber = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);
  
  const [selectedTarget, setSelectedTarget] = useState('');
  const personalRecordedRef = useRef(false);
  const advancingRef = useRef(false);
  const startGameRef = useRef(false);

  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');

  const handleTimeUp = useCallback(async () => {
    if (!isHost) return;
    feedback('timeUp');

    const gameData = roomData?.gameData || {};
    const gameStatus = gameData.gameStatus || 'waiting';
    const playerNames = Object.keys(roomData?.players || {});
    const players = roomData?.players || {};
    const targetChooser = gameData.targetChooser || null;
    const currentPlayerIndex = gameData.currentPlayerIndex ?? null;
    const currentPlayer = gameData.playerOrder?.[currentPlayerIndex] || null;

    if (gameStatus === 'choosing_target') {
      const randomTarget = Math.floor(Math.random() * 100) + 1;
      const allPlayers = [...playerNames].sort((a, b) => {
        const aTime = players[a]?.joinedAt || 0;
        const bTime = players[b]?.joinedAt || 0;
        return aTime - bTime;
      });
      const chooserIdx = allPlayers.indexOf(targetChooser);
      const firstPlayerIndex = (chooserIdx + 1) % allPlayers.length;

      await safeUpdate(`rooms/${roomId}/gameData`, {
        gameStatus: 'playing',
        targetNumber: randomTarget,
        range: {
          min: Math.max(1, randomTarget - 5),
          max: Math.min(100, randomTarget + 5)
        },
        currentCount: 0,
        currentPlayerIndex: firstPlayerIndex,
        playerOrder: allPlayers,
        loser: null,
        lastMove: null,
        timerEnd: Date.now() + (TURN_TIME * 1000)
      });
    } else if (gameStatus === 'playing') {
      const currentCount = gameData.currentCount || 0;
      const target = gameData.targetNumber;
      const playerOrder = gameData.playerOrder || [];
      const newCount = currentCount + 1;
      const loser = newCount === target ? currentPlayer : null;
      const nextPlayerIndex = loser ? currentPlayerIndex : (currentPlayerIndex + 1) % playerOrder.length;
      
      const updates: any = {
        currentCount: newCount,
        currentPlayerIndex: nextPlayerIndex,
        lastMove: {
          player: currentPlayer,
          numbers: [newCount],
          increment: 1
        },
        timerEnd: loser ? null : Date.now() + (TURN_TIME * 1000)
      };

      if (loser) {
        updates.loser = loser;
        updates.gameStatus = 'finished';
        const currentScores = gameData.scores || {};
        const newScores = { ...currentScores };
        playerOrder.forEach((name: string) => {
          if (name !== loser) newScores[name] = (newScores[name] || 0) + 1;
        });
        updates.scores = newScores;
      }

      await safeUpdate(`rooms/${roomId}/gameData`, updates);
    }
  }, [isHost, roomId, roomData]);

  const { timeLeft } = useGameTimer(roomData?.gameData?.timerEnd, isHost ? handleTimeUp : null);

  useEffect(() => {
    advancingRef.current = false;
  }, [roomData?.gameData?.roundNumber, roomData?.gameData?.gameStatus]);

  useEffect(() => {
    if (roomData?.gameData?.gameStatus === 'waiting' || roomData?.gameData?.gameStatus === 'playing') personalRecordedRef.current = false;
  }, [roomData?.gameData?.gameStatus]);

  useEffect(() => {
    if (roomData?.gameData?.gameStatus !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('target');
    const loser = roomData?.gameData?.loser;
    if (loser && loser !== userNickname) recordPersonalWin('target');
  }, [roomData?.gameData?.gameStatus, roomData?.gameData?.loser, userNickname]);

  useEffect(() => {
    if (!isHost || roomData?.gameData?.gameStatus !== 'playing') return;
    const playerOrder = roomData?.gameData?.playerOrder || [];
    const currentPlayerIndex = roomData?.gameData?.currentPlayerIndex ?? null;
    const current = playerOrder[currentPlayerIndex];
    if (current && !roomData?.players?.[current]) {
      const nextIndex = (currentPlayerIndex + 1) % playerOrder.length;
      setTimeout(() => {
        safeUpdate(`rooms/${roomId}/gameData`, { 
          currentPlayerIndex: nextIndex,
          timerEnd: Date.now() + (TURN_TIME * 1000)
        });
      }, 0);
    }
  }, [isHost, roomData?.gameData?.gameStatus, roomData?.gameData?.currentPlayerIndex, roomData?.gameData?.playerOrder, roomData?.players, roomId]);

  if (!roomData) return null;

  const gameData = roomData?.gameData || {};
  const players = roomData?.players || {};
  const playerNames = Object.keys(players);
  const gameStatus = gameData.gameStatus || 'waiting';
  const targetChooser = gameData.targetChooser || null;
  const isTargetChooser = targetChooser === userNickname;
  const currentPlayerIndex = gameData.currentPlayerIndex ?? null;
  const currentPlayer = gameData.playerOrder?.[currentPlayerIndex] || null;
  const isMyTurn = currentPlayer === userNickname;

  const startGame = async () => {
    if (!isHost) return;
    if (playerNames.length < 2) return;
    if (startGameRef.current) return;
    startGameRef.current = true;

    const chooserIndex = Math.floor(Math.random() * playerNames.length);

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        gameStatus: 'choosing_target',
        targetChooser: playerNames[chooserIndex],
        targetNumber: null,
        range: null,
        currentCount: 0,
        currentPlayerIndex: null,
        playerOrder: null,
        loser: null,
        lastMove: null,
        roundNumber: (gameData.roundNumber || 0) + 1,
        timerEnd: Date.now() + (TURN_TIME * 1000)
      });
    } finally {
      startGameRef.current = false;
    }
  };

  const handleSetTarget = async () => {
    const num = parseInt(selectedTarget, 10);
    if (isNaN(num) || num < 1 || num > 100) return;
    if (advancingRef.current) return;
    advancingRef.current = true;

    const allPlayers = [...playerNames].sort((a, b) => {
      const aTime = players[a]?.joinedAt || 0;
      const bTime = players[b]?.joinedAt || 0;
      return aTime - bTime;
    });

    const chooserIdx = allPlayers.indexOf(userNickname || '');
    const firstPlayerIndex = (chooserIdx + 1) % allPlayers.length;

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        gameStatus: 'playing',
        targetNumber: num,
        range: {
          min: Math.max(1, num - 5),
          max: Math.min(100, num + 5)
        },
        currentCount: 0,
        currentPlayerIndex: firstPlayerIndex,
        playerOrder: allPlayers,
        loser: null,
        lastMove: null,
        timerEnd: Date.now() + (TURN_TIME * 1000)
      });
    } finally {
      advancingRef.current = false;
    }

    setSelectedTarget('');
  };

  const handleMove = async (increment: number) => {
    if (!isMyTurn) return;
    if (gameStatus !== 'playing') return;
    if (advancingRef.current) return;
    advancingRef.current = true;

    const currentCount = gameData.currentCount || 0;
    const target = gameData.targetNumber;
    const playerOrder = gameData.playerOrder || [];

    const startNum = currentCount + 1;
    const numbersSaid = Array.from({ length: increment }, (_, i) => startNum + i);
    const newCount = currentCount + increment;

    let loser = null;
    if (numbersSaid.includes(target)) {
      loser = userNickname;
    }

    const nextPlayerIndex = loser
      ? currentPlayerIndex
      : (currentPlayerIndex + 1) % playerOrder.length;

    const updates: any = {
      currentCount: newCount,
      currentPlayerIndex: nextPlayerIndex,
      lastMove: {
        player: userNickname,
        numbers: numbersSaid,
        increment
      },
      timerEnd: loser ? null : Date.now() + (TURN_TIME * 1000)
    };

    if (loser) {
      updates.loser = loser;
      updates.gameStatus = 'finished';

      const currentScores = gameData.scores || {};
      const newScores = { ...currentScores };
      playerOrder.forEach((name: string) => {
        if (name !== loser) {
          newScores[name] = (newScores[name] || 0) + 1;
        }
      });
      updates.scores = newScores;
    }

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, updates);
      if (loser) {
        const newScores = (updates as any).scores;
        const topWinner = Object.entries(newScores).sort((a: any, b: any) => b[1] - a[1])[0];
        if (topWinner) await recordWin(roomId, topWinner[0], 'target');
      }
    } finally {
      advancingRef.current = false;
    }
  };

  const nextRound = () => {
    startGame();
  };

  if (gameStatus === 'waiting') {
    return (
      <WaitingPhase
        errorMsg={errorMsg}
        isHost={isHost}
        startGame={startGame}
      />
    );
  }

  if (gameStatus === 'choosing_target') {
    return (
      <SetupPhase
        errorMsg={errorMsg}
        isTargetChooser={isTargetChooser}
        targetChooser={targetChooser}
        timeLeft={timeLeft}
        selectedTarget={selectedTarget}
        setSelectedTarget={setSelectedTarget}
        handleSetTarget={handleSetTarget}
      />
    );
  }

  if (gameStatus === 'playing') {
    return (
      <PlayingPhase
        errorMsg={errorMsg}
        gameData={gameData}
        userNickname={userNickname || ''}
        isTargetChooser={isTargetChooser}
        isMyTurn={isMyTurn}
        timeLeft={timeLeft}
        currentPlayer={currentPlayer}
        currentPlayerIndex={currentPlayerIndex}
        handleMove={handleMove}
      />
    );
  }

  if (gameStatus === 'finished') {
    return (
      <ResultPhase
        errorMsg={errorMsg}
        gameData={gameData}
        userNickname={userNickname || ''}
        showConfirm={showConfirm}
        confirmLeave={confirmLeave}
        cancelLeave={cancelLeave}
        requestLeave={requestLeave}
        isHost={isHost}
        nextRound={nextRound}
      />
    );
  }

  return null;
};

export default TargetNumber;
