import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WaitingPhase } from './WaitingPhase';
import { PlayingPhase } from './PlayingPhase';
import { VotingPhase } from './VotingPhase';
import { FinishedPhase } from './FinishedPhase';
import { ref, update } from 'firebase/database';
import { db } from '@/firebase';
import { useTranslation } from 'react-i18next';
import { generateInitialState, checkVoteResult } from './spyfallLogic';
import { TimerDisplay } from '@/components/game-ui';
import { CAT_META } from './logic/spyfallCats';
import {
  MapPin, User, Timer, AlertCircle, CheckCircle2, XCircle,
  Search, Info, ChevronDown, Vote, Eye,
  Users, Shield, Clock, LogOut, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TIMER_PRESETS } from '@/hooks';
import { feedback } from '@/utils/feedback';
import { recordWin } from '@/components/features';
import { recordPersonalWin, recordPersonalGame } from '@/components/features';
import { useGameLeave } from '@/hooks';
import { useGame } from '@/contexts/GameContext';
import { useGameUpdate } from '@/hooks';
import { LeaveConfirmModal } from '@/components/ui';
import { EpicPopup } from '@/components/ui';
import { GiantButton } from '@/components/ui';
import { NeonCard } from '@/components/ui';
import { HoldToRevealCard } from '@/components/ui';
import { useHaptics } from '@/hooks';

// ─── Main Component ──────────────────────────────────────────────────────────

const Spyfall: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);
  const { vibrateLight, vibrateMedium, vibrateSuccess, vibrateHeavy } = useHaptics();
  
  const nickname = userNickname || '';
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, nickname);
  const players = roomData?.players || {};
  const gameData = roomData?.gameData || {};
  const isHostActually = isHost;

  const myGameData = (gameData.players && gameData.players[nickname]) || {};

  // State
  const [timeLeft, setTimeLeft] = useState(0);
  const [showLocations, setShowLocations] = useState(false);
  const [showGuessModal, setShowGuessModal] = useState(false);
  const [selectedGuess, setSelectedGuess] = useState('');
  const [selectedCats, setSelectedCats] = useState(['food', 'travel', 'health', 'funny']);
  const [useDefaultPack, setUseDefaultPack] = useState(false);
  const [useNonStandardPack, setUseNonStandardPack] = useState(false);
  const [enableAccomplice, setEnableAccomplice] = useState(true);
  const [voteTarget, setVoteTarget] = useState('');
  const [timerMinutes, setTimerMinutes] = useState(8);

    const personalRecordedRef = useRef(false);
  const advancingRef = useRef(false);
  const guessRef = useRef(false);
  const submitVoteRef = useRef(false);
  const voteResultRef = useRef(false);

  const playerList = Object.keys(players);
  const playerCount = playerList.length;
  const gamePlayerList = Object.keys(gameData.players || {});
  const gamePlayerCount = gamePlayerList.length;

  useEffect(() => {
    if (roomData?.status === 'waiting' || gameData.status === 'waiting') {
      personalRecordedRef.current = false;
      advancingRef.current = false;
      guessRef.current = false;
      submitVoteRef.current = false;
      voteResultRef.current = false;
    }
  }, [roomData?.status, gameData.status]);

  useEffect(() => {
    const isFinished = roomData?.status === 'finished' || gameData.status === 'finished';
    if (!isFinished || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    const gamePlayers = gameData.players || {};
    const myData = gamePlayers[nickname] || {};
    const iSpy = myData.isSpy || myData.isAccomplice;
    const iWon = (gameData.winner === 'Spy' && iSpy) || (gameData.winner === 'Civilians' && !iSpy);
    recordPersonalGame('spyfall');
    if (iWon) recordPersonalWin('spyfall');
  }, [roomData?.status, gameData.status, nickname, gameData.players, gameData.winner]);

  // ─── Timer ───────────────────────────────────────────────────────────────────

  
  // ─── Check vote request threshold ───────────────────────────────────────────

  useEffect(() => {
    if (!isHostActually || gameData.status !== 'playing') return;

    const gamePlayers = gameData.players || {};
    const wantsCount = gamePlayerList.filter(p => gamePlayers[p]?.wantsToVote).length;
    const threshold = Math.ceil(gamePlayerCount * 2 / 3);

    if (wantsCount >= threshold && gamePlayerCount > 0) {
      setTimeout(() => {
        safeUpdate(`rooms/${roomId}/gameData`, {
          status: 'voting',
          timerEnd: null
        });
      }, 0);
    }
  }, [gameData.players, gameData.status, isHostActually, gamePlayerCount, gamePlayerList, roomId, safeUpdate]);

  const renderErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border border-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-fade-in">
      {errorMsg}
    </div>
  ) : null;

  if (!roomData) return null;

  // ─── Game Actions ────────────────────────────────────────────────────────────

  const startGame = async () => {
    if (!isHostActually) return;
    if (playerCount < 3) return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    vibrateSuccess();

    const { CATS, DEFAULT_LOCATIONS, NON_STANDARD_LOCATIONS } = await import('./spyfallData');

    let pool = [];

    selectedCats.forEach(catId => {
      const cat = CATS.find(c => c.id === catId);
      if (cat) pool.push(...cat.places.map(p => ({ n: p.n, r: p.r })));
    });

    if (useDefaultPack) {
      Object.entries(DEFAULT_LOCATIONS).forEach(([name, roles]) => {
        pool.push({ n: name, r: roles });
      });
    }

    if (useNonStandardPack) {
      Object.entries(NON_STANDARD_LOCATIONS).forEach(([name, roles]) => {
        pool.push({ n: name, r: roles });
      });
    }

    if (pool.length === 0) pool = CATS[0].places.map(p => ({ n: p.n, r: p.r }));

    let placeCategory = '';
    const targetIdx = Math.floor(Math.random() * pool.length);
    const targetPlace = pool[targetIdx];
    for (const cat of CATS) {
      if (cat.places.some(p => p.n === targetPlace.n)) {
        placeCategory = cat.name;
        break;
      }
    }
    if (!placeCategory) {
      if (Object.keys(DEFAULT_LOCATIONS).includes(targetPlace.n)) placeCategory = 'ทั่วไป';
      else if (Object.keys(NON_STANDARD_LOCATIONS).includes(targetPlace.n)) placeCategory = 'พิเศษ';
    }

    const newGameData = generateInitialState(
      playerList,
      pool,
      placeCategory,
      timerMinutes,
      enableAccomplice
    );

    try {
      await safeUpdate(`rooms/${roomId}`, {
        status: 'playing',
        gameData: newGameData
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleReveal = () => {
    if (!myGameData.isSpy) return;
    vibrateLight();
    setShowGuessModal(true);
  };

  const handleCancelReveal = () => {
    if (gameData.spyForced) return;
    vibrateLight();
    setShowGuessModal(false);
    setSelectedGuess('');
  };

  const handleGuess = async () => {
    if (!selectedGuess) return;
    if (guessRef.current) return;
    guessRef.current = true;
    vibrateMedium();

    const isCorrect = selectedGuess === gameData.targetPlace;
    const gamePlayers = gameData.players || {};
    const winnerName = isCorrect
      ? nickname
      : (gamePlayerList.find(p => !gamePlayers[p]?.isSpy) || roomData.host);
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        spyRevealing: nickname,
        winner: isCorrect ? 'Spy' : 'Civilians',
        status: 'finished',
        guess: selectedGuess
      });
      await safeUpdate(`rooms/${roomId}`, { status: 'finished' });
      await recordWin(roomId || '', winnerName, 'spyfall');
      setShowGuessModal(false);
    } finally {
      guessRef.current = false;
    }
  };

  const requestVote = async () => {
    vibrateLight();
    await safeUpdate(`rooms/${roomId}/gameData/players/${nickname}`, { wantsToVote: true });
  };

  const cancelVoteRequest = async () => {
    vibrateLight();
    await safeUpdate(`rooms/${roomId}/gameData/players/${nickname}`, { wantsToVote: false });
  };

  const submitVote = async () => {
    if (!voteTarget) return;
    if (submitVoteRef.current) return;
    submitVoteRef.current = true;
    vibrateMedium();
    try {
      await safeUpdate(`rooms/${roomId}/gameData/players/${nickname}`, { votedFor: voteTarget });
    } finally {
      submitVoteRef.current = false;
    }
  };

  const toggleCategory = (id: string) => {
    vibrateLight();
    if (selectedCats.includes(id)) {
      if (selectedCats.length > 1 || useDefaultPack || useNonStandardPack) {
        setSelectedCats(selectedCats.filter(c => c !== id));
      }
    } else {
      setSelectedCats([...selectedCats, id]);
    }
  };

  const resetToLobby = () => {
    vibrateMedium();
    personalRecordedRef.current = false;
    safeUpdate(`rooms/${roomId}`, { status: 'waiting', gameData: null });
  };

  const handlePlayAgain = async () => {
    if (!isHostActually || advancingRef.current) return;
    advancingRef.current = true;
    vibrateMedium();
    personalRecordedRef.current = false;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, { status: 'waiting' });
    } finally {
      advancingRef.current = false;
    }
  };

  const getVoteRequestInfo = () => {
    const gamePlayers = gameData.players || {};
    const wantsCount = gamePlayerList.filter(p => gamePlayers[p]?.wantsToVote).length;
    const threshold = Math.ceil(gamePlayerCount * 2 / 3);
    return { wantsCount, threshold };
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: WAITING / LOBBY
  // ═══════════════════════════════════════════════════════════════════════════════

  if (roomData.status === 'waiting' || gameData.status === 'waiting') {
    return (
      <WaitingPhase
        renderErrorToast={renderErrorToast}
        requestLeave={requestLeave}
        selectedCats={selectedCats}
        isHostActually={isHostActually}
        toggleCategory={toggleCategory}
        timerMinutes={timerMinutes}
        setTimerMinutes={setTimerMinutes}
        enableAccomplice={enableAccomplice}
        setEnableAccomplice={setEnableAccomplice}
        startGame={startGame}
        playerCount={playerCount}
        vibrateLight={vibrateLight}
      />
    );
  }
  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: PLAYING
  // ═══════════════════════════════════════════════════════════════════════════════

  if (roomData.status === 'playing' && gameData.status === 'playing') {
    return (
      <PlayingPhase
        renderErrorToast={renderErrorToast}
        gameData={gameData}
        myGameData={myGameData}
        nickname={nickname}
        timeLeft={timeLeft}
        showLocations={showLocations}
        setShowLocations={setShowLocations}
        showGuessModal={showGuessModal}
        setShowGuessModal={setShowGuessModal}
        selectedGuess={selectedGuess}
        setSelectedGuess={setSelectedGuess}
        handleReveal={handleReveal}
        handleCancelReveal={handleCancelReveal}
        handleGuess={handleGuess}
        getVoteRequestInfo={getVoteRequestInfo}
        requestVote={requestVote}
        cancelVoteRequest={cancelVoteRequest}
      />
    );
  }
  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: VOTING
  // ═══════════════════════════════════════════════════════════════════════════════

  if (roomData.status === 'playing' && gameData.status === 'voting') {
    const gamePlayers = gameData.players || {};
    const myVote = gamePlayers[nickname]?.votedFor;
    const votedCount = gamePlayerList.filter(p => gamePlayers[p]?.votedFor).length;

    return (
      <VotingPhase
        renderErrorToast={renderErrorToast}
        gameData={gameData}
        myGameData={myGameData}
        nickname={nickname}
        gamePlayerList={gamePlayerList}
        gamePlayerCount={gamePlayerCount}
        myVote={myVote}
        votedCount={votedCount}
        voteTarget={voteTarget}
        setVoteTarget={setVoteTarget}
        submitVote={submitVote}
        showGuessModal={showGuessModal}
        selectedGuess={selectedGuess}
        setSelectedGuess={setSelectedGuess}
        handleGuess={handleGuess}
        vibrateLight={vibrateLight}
      />
    );
  }
  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: FINISHED
  // ═══════════════════════════════════════════════════════════════════════════════

  if (roomData.status === 'finished' || gameData.status === 'finished') {
    return (
      <FinishedPhase
        renderErrorToast={renderErrorToast}
        gameData={gameData}
        gamePlayerList={gamePlayerList}
        isHostActually={isHostActually}
        handlePlayAgain={handlePlayAgain}
        resetToLobby={resetToLobby}
        requestLeave={requestLeave}
      />
    );
  }
  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: FALLBACK
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="w-full flex-center flex-1">
      {renderErrorToast()}
      <div className="w-8 h-8 border-[3px] border-neon-blue/30 border-t-neon-blue rounded-full animate-spin"></div>
    </div>
  );
};

export default Spyfall;
