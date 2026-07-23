// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, update, increment } from 'firebase/database';
import { db } from '../../firebase';
import { getRandomWord } from './insiderData';
import { recordWin } from '../../components/features/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../../components/features/PersonalStats';
import { useGameLeave } from '../../hooks/useGameLeave';
import { useGame } from '../../contexts/GameContext';
import { useGameUpdate } from '../../hooks/useGameUpdate';
import { useGameTimer } from '../../hooks/useGameTimer';
import { useTranslation } from 'react-i18next';
import { feedback } from '../../utils/feedback';

import WaitingPhase from './WaitingPhase';
import RevealPhase from './RevealPhase';
import DiscussionPhase from './DiscussionPhase';
import VotingPhase from './VotingPhase';
import ResultPhase from './ResultPhase';
import FinishedPhase from './FinishedPhase';

const VOTE_TIME = 180;

const TwentyQuestions = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);
  
  const [votedFor, setVotedFor] = useState('');
  const [selectedTime, setSelectedTime] = useState(300);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showCategorySetting, setShowCategorySetting] = useState(true);
  const [confirmGuesser, setConfirmGuesser] = useState<string | null>(null);
  
  const personalRecordedRef = useRef(false);
  const advancingRef = useRef(false);
  const voteRef = useRef(false);
  const backToLobbyRef = useRef(false);

  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');

  const renderErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border border-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-fade-in">
      {errorMsg}
    </div>
  ) : null;

  const handleTimeUp = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'result',
        wordGuessed: false,
        caughtInsider: false,
        topVoted: null,
        timerEnd: null
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleVoteEnd = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;

    const gameData = roomData?.gameData || {};
    const currentVotes = gameData.votes || {};
    const insiderName = gameData.insider || '';
    const guesser = gameData.guesser || '';
    const players = Object.keys(roomData?.players || {});
    const nonHostPlayers = players.filter(p => p !== roomData?.host);

    const voteCounts: Record<string, number> = {};
    Object.values(currentVotes).forEach((target: any) => {
      voteCounts[target] = (voteCounts[target] || 0) + 1;
    });

    const sorted = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
    const topVoted = sorted.length > 0 ? sorted[0][0] : '';
    const caughtInsider = topVoted === insiderName;

    const scoreUpdates: Record<string, any> = {};
    if (caughtInsider) {
      nonHostPlayers.forEach(p => {
        if (p !== insiderName && p !== guesser) scoreUpdates[p] = increment(2);
      });
      if (guesser && guesser !== insiderName) scoreUpdates[guesser] = increment(3);
    } else {
      scoreUpdates[insiderName] = increment(3);
    }

    const flatScoreUpdates: Record<string, any> = {};
    Object.entries(scoreUpdates).forEach(([k, v]) => { flatScoreUpdates[`scores/${k}`] = v; });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        ...flatScoreUpdates,
        phase: 'result',
        caughtInsider,
        topVoted,
        timerEnd: null
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleTimeUpLocal = useCallback(async () => {
    if (!isHost) return;
    const phase = roomData?.gameData?.phase;
    if (phase === 'discussion') {
      await handleTimeUp();
    } else if (phase === 'voting') {
      await handleVoteEnd();
    }
  }, [isHost, roomData?.gameData?.phase]);

  const { timeLeft } = useGameTimer(roomData?.gameData?.timerEnd, isHost ? handleTimeUpLocal : null);

  useEffect(() => {
    const phase = roomData?.gameData?.phase;
    if (phase === 'waiting' || phase === 'reveal') {
      personalRecordedRef.current = false;
    }
    if (phase === 'voting') {
      feedback('newRound');
    } else {
      if (votedFor !== '') setTimeout(() => setVotedFor(''), 0);
    }
    if (phase === 'result') {
      feedback('spyReveal');
    }
    advancingRef.current = false;
  }, [roomData?.gameData?.phase]);

  useEffect(() => {
    const phase = roomData?.gameData?.phase;
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('twentyquestions');
    const scores = roomData?.gameData?.scores || {};
    const sorted = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));
    if (sorted.length > 0 && sorted[0][0] === userNickname && (sorted[0][1] as number) > 0) {
      recordPersonalWin('twentyquestions');
    }
  }, [roomData?.gameData?.phase, roomData?.gameData?.scores, userNickname]);

  useEffect(() => {
    const phase = roomData?.gameData?.phase;
    const players = Object.keys(roomData?.players || {});
    const nonHostPlayers = players.filter(p => p !== roomData?.host);
    if (phase !== 'voting' || !isHost || advancingRef.current) return;
    const currentVotes = roomData?.gameData?.votes || {};
    const totalVoted = Object.keys(currentVotes).length;
    if (totalVoted >= nonHostPlayers.length && totalVoted > 0) {
      handleVoteEnd();
    }
  }, [roomData?.gameData?.votes, roomData?.gameData?.phase, isHost, roomData?.players, roomData?.host]);

  if (!roomData) return null;

  const gameData = roomData?.gameData || {};
  const players = Object.keys(roomData?.players || {});
  const nonHostPlayers = players.filter(p => p !== roomData?.host);

  const phase = gameData.phase || 'waiting';
  const secretWord = gameData.secretWord || '';
  const category = gameData.category || '';
  const insiderName = gameData.insider || '';
  const isInsider = userNickname === insiderName;
  const isModerator = isHost;
  const roundNumber = gameData.roundNumber || 1;
  const scores = gameData.scores || {};
  const usedWords = gameData.usedWords || [];
  const wordGuessed = gameData.wordGuessed || false;
  const guesser = gameData.guesser || '';
  const votes = gameData.votes || {};

  const discussionTime = gameData.discussionTime || 300;
  const showCategory = gameData.showCategory !== false;

  const handleStartGame = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('gameStart');
    const initScores: Record<string, number> = {};
    players.forEach(p => { initScores[p] = 0; });
    const wordObj = getRandomWord([], selectedCategories.length > 0 ? selectedCategories : '');
    const insider = nonHostPlayers[Math.floor(Math.random() * nonHostPlayers.length)];

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'reveal',
        scores: initScores,
        roundNumber: 1,
        usedWords: [],
        secretWord: wordObj.word,
        category: wordObj.category,
        filterCategories: selectedCategories.length > 0 ? selectedCategories : null,
        showCategory: showCategorySetting,
        insider,
        wordGuessed: false,
        guesser: '',
        votes: {},
        timerEnd: 0,
        caughtInsider: null,
        topVoted: null,
        discussionTime: selectedTime,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleStartDiscussion = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('tap');
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'discussion',
        timerEnd: Date.now() + discussionTime * 1000,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleRerollWord = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('tap');
    const wordObj = getRandomWord([...usedWords, secretWord], gameData.filterCategories || '');
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        secretWord: wordObj.word,
        category: wordObj.category,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleVote = async (target: string) => {
    if (votedFor || isModerator) return;
    if (voteRef.current) return;
    voteRef.current = true;
    setVotedFor(target);
    feedback('success');
    try {
      await safeUpdate(`rooms/${roomId}/gameData/votes`, { [userNickname]: target });
    } finally {
      voteRef.current = false;
    }
  };

  const handleConfirmGuesser = async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    feedback('correctGuess');
    const p = confirmGuesser;
    setConfirmGuesser(null);
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        wordGuessed: true,
        guesser: p,
        phase: 'voting',
        timerEnd: Date.now() + VOTE_TIME * 1000,
        votes: {},
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleNextRound = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('newRound');

    const newUsedWords = [...usedWords, secretWord];

    try {
      if (roundNumber >= nonHostPlayers.length) {
        await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'finished', usedWords: newUsedWords, timerEnd: null });
        feedback('victory');
        const sortedScores = Object.entries(scores).sort((a: any, b: any) => b[1] - a[1]);
        if (sortedScores.length > 0 && sortedScores[0][1] > 0) {
          await recordWin(roomId, sortedScores[0][0], 'twentyquestions');
        }
      } else {
        const nextInsider = nonHostPlayers[Math.floor(Math.random() * nonHostPlayers.length)];
        const wordObj = getRandomWord(newUsedWords, gameData.filterCategories || '');
        await safeUpdate(`rooms/${roomId}/gameData`, {
          phase: 'reveal',
          roundNumber: roundNumber + 1,
          usedWords: newUsedWords,
          secretWord: wordObj.word,
          category: wordObj.category,
          insider: nextInsider,
          wordGuessed: false,
          guesser: '',
          votes: {},
          timerEnd: 0,
          caughtInsider: null,
          topVoted: null,
        });
      }
    } finally {
      advancingRef.current = false;
    }
  };

  const handlePlayAgain = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('gameStart');
    const initScores: Record<string, number> = {};
    players.forEach(p => { initScores[p] = 0; });
    const wordObj = getRandomWord([], selectedCategories.length > 0 ? selectedCategories : '');
    const insider = nonHostPlayers[Math.floor(Math.random() * nonHostPlayers.length)];

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'reveal',
        scores: initScores,
        roundNumber: 1,
        usedWords: [],
        secretWord: wordObj.word,
        category: wordObj.category,
        filterCategories: selectedCategories.length > 0 ? selectedCategories : null,
        showCategory: showCategorySetting,
        insider,
        wordGuessed: false,
        guesser: '',
        votes: {},
        timerEnd: 0,
        caughtInsider: null,
        topVoted: null,
        discussionTime: selectedTime,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost || backToLobbyRef.current) return;
    backToLobbyRef.current = true;
    try {
      await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
    } finally {
      backToLobbyRef.current = false;
    }
  };

  const sortedScores = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));

  // ════════════════════════════════════════════════════════════════
  // WAITING
  // ════════════════════════════════════════════════════════════════
  if (phase === 'waiting') {
    return (
      <WaitingPhase
        t={t}
        renderErrorToast={renderErrorToast}
        players={players}
        roomData={roomData}
        userNickname={userNickname}
        isHost={isHost}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        showCategorySetting={showCategorySetting}
        setShowCategorySetting={setShowCategorySetting}
        selectedTime={selectedTime}
        setSelectedTime={setSelectedTime}
        handleStartGame={handleStartGame}
        nonHostPlayers={nonHostPlayers}
      />
    );
  }

  // ════════════════════════════════════════════════════════════════
  // REVEAL
  // ════════════════════════════════════════════════════════════════
  if (phase === 'reveal') {
    return (
      <RevealPhase
        t={t}
        renderErrorToast={renderErrorToast}
        roundNumber={roundNumber}
        nonHostPlayers={nonHostPlayers}
        isModerator={isModerator}
        showCategory={showCategory}
        category={category}
        secretWord={secretWord}
        handleRerollWord={handleRerollWord}
        handleStartDiscussion={handleStartDiscussion}
        discussionTime={discussionTime}
        isInsider={isInsider}
      />
    );
  }

  // ════════════════════════════════════════════════════════════════
  // DISCUSSION
  // ════════════════════════════════════════════════════════════════
  if (phase === 'discussion') {
    return (
      <DiscussionPhase
        t={t}
        renderErrorToast={renderErrorToast}
        roundNumber={roundNumber}
        nonHostPlayers={nonHostPlayers}
        timeLeft={timeLeft}
        showCategory={showCategory}
        category={category}
        isModerator={isModerator}
        isInsider={isInsider}
        secretWord={secretWord}
        wordGuessed={wordGuessed}
        confirmGuesser={confirmGuesser}
        setConfirmGuesser={setConfirmGuesser}
        handleConfirmGuesser={handleConfirmGuesser}
      />
    );
  }

  // ════════════════════════════════════════════════════════════════
  // VOTING
  // ════════════════════════════════════════════════════════════════
  if (phase === 'voting') {
    return (
      <VotingPhase
        t={t}
        renderErrorToast={renderErrorToast}
        nonHostPlayers={nonHostPlayers}
        timeLeft={timeLeft}
        votes={votes}
        guesser={guesser}
        secretWord={secretWord}
        isModerator={isModerator}
        userNickname={userNickname}
        votedFor={votedFor}
        handleVote={handleVote}
        handleVoteEnd={handleVoteEnd}
      />
    );
  }

  // ════════════════════════════════════════════════════════════════
  // RESULT
  // ════════════════════════════════════════════════════════════════
  if (phase === 'result') {
    return (
      <ResultPhase
        t={t}
        renderErrorToast={renderErrorToast}
        caughtInsider={gameData.caughtInsider}
        wordGuessed={wordGuessed}
        insiderName={insiderName}
        topVoted={gameData.topVoted || ''}
        secretWord={secretWord}
        category={category}
        sortedScores={sortedScores}
        isHost={isHost}
        handleNextRound={handleNextRound}
        roundNumber={roundNumber}
        nonHostPlayers={nonHostPlayers}
      />
    );
  }

  // ════════════════════════════════════════════════════════════════
  // FINISHED
  // ════════════════════════════════════════════════════════════════
  if (phase === 'finished') {
    const topPlayer = sortedScores[0];
    return (
      <FinishedPhase
        t={t}
        renderErrorToast={renderErrorToast}
        showConfirm={showConfirm}
        confirmLeave={confirmLeave}
        cancelLeave={cancelLeave}
        topPlayer={topPlayer}
        sortedScores={sortedScores}
        isHost={isHost}
        handlePlayAgain={handlePlayAgain}
        handleBackToLobby={handleBackToLobby}
        requestLeave={requestLeave}
      />
    );
  }

  return (
    <div className="flex-center flex-1 flex-col gap-4 bg-slate-950">
      {renderErrorToast()}
      <div className="w-10 h-10 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
      <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest animate-pulse">{t('common.loading')}</p>
    </div>
  );
};

export default TwentyQuestions;
