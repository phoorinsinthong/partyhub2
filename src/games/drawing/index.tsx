// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, onValue, increment } from 'firebase/database';
import { db } from '../../firebase';
import { Eraser, RotateCcw, Send, Trophy, Pencil, LogOut, Share2 } from 'lucide-react';
import { getRandomWord } from './drawingLogic';
import { useTranslation } from 'react-i18next';
import { TimerDisplay } from '../../components/game-ui/TimerDisplay';
import { feedback } from '../../utils/feedback';
import { recordWin } from '../../components/features/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../../components/features/PersonalStats';
import { useGameLeave } from '../../hooks/useGameLeave';
import { useGameTimer } from '../../hooks/useGameTimer';
import { useTurnNotification } from '../../hooks/useTurnNotification';
import LeaveConfirmModal from '../../components/ui/LeaveConfirmModal';
import { useGame } from '../../contexts/GameContext';
import { useGameUpdate } from '../../hooks/useGameUpdate';
import NeonCard from '../../components/ui/NeonCard';
import GiantButton from '../../components/ui/GiantButton';
import DrawingWaitingPhase from './DrawingWaitingPhase';
import DrawingGuessingPhase from './DrawingGuessingPhase';
import DrawingPlayingPhase from './DrawingPlayingPhase';
import DrawingResultPhase from './DrawingResultPhase';

const ROUND_TIME = { easy: 60, medium: 60, hard: 60, funny: 90, random: 75, custom: 60 };
const COLORS = ['#2f2a22', '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#ecf0f1'];
const BRUSH_SIZES = [3, 6, 12];

function shuffle(arr: any[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const Drawing: React.FC = () => {
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);
  const { t } = useTranslation();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const personalRecordedRef = useRef(false);
  const nextRoundRef = useRef(false);
  const guessRef = useRef(false);
  const chooseWordRef = useRef(false);
  const endRoundRef = useRef(false);
  const allCorrectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerFiredRef = useRef(false);
  const lastPointRef = useRef(null);
  const shareCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [guess, setGuess] = useState('');
  const [localPaths, setLocalPaths] = useState<any[]>([]);
  const [showWordChoices, setShowWordChoices] = useState(false);
  const [pendingWord, setPendingWord] = useState('');
  const [hasRerolled, setHasRerolled] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [difficulty, setDifficulty] = useState('easy');
  const [customWordInput, setCustomWordInput] = useState('');
  
  // Derived variables
  const gameData = roomData?.gameData || {};
  const players = Object.keys(roomData?.players || {});
  const phase = gameData.phase || 'waiting';
  const currentDrawer = gameData.currentDrawer || '';
  const currentWord = gameData.currentWord || '';
  const round = gameData.round || 0;
  const totalRounds = gameData.totalRounds || players.length;
  const scores = gameData.scores || {};
  const guesses = gameData.guesses || {};
  const roundStartedAt = gameData.roundStartedAt || 0;
  const roundTime = ROUND_TIME[gameData.difficulty as keyof typeof ROUND_TIME] || 60;
  const timerEnd = (phase === 'playing' && roundStartedAt > 0) ? roundStartedAt + (roundTime * 1000) : null;
  const isDrawer = userNickname === currentDrawer;
  const hasGuessedCorrectly = guesses[userNickname || '']?.correct;

  const { timeLeft } = useGameTimer(timerEnd);
  useTurnNotification(isDrawer, phase);

  const renderErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
      {errorMsg}
    </div>
  ) : null;

  
  const handleStartGame = async () => {
    if (!isHost) return;
    feedback('gameStart');
    const initScores: any = {};
    players.forEach((p) => { initScores[p] = 0; });
    const drawerOrder = shuffle(players);

    await safeUpdate(`rooms/${roomId}`, { drawingStrokes: [] });
    await safeUpdate(`rooms/${roomId}/gameData`, {
      phase: 'choosing',
      scores: initScores,
      round: 0,
      totalRounds: players.length,
      drawerOrder,
      currentDrawer: drawerOrder[0],
      currentWord: '',
      guesses: {},
      roundStartedAt: 0,
      difficulty,
    });
  };

  const handleChooseWord = async (word: string) => {
    if (chooseWordRef.current) return;
    chooseWordRef.current = true;
    setShowWordChoices(false);
    feedback('newRound');
    try {
      await safeUpdate(`rooms/${roomId}`, { drawingStrokes: [] });
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        currentWord: word,
        guesses: {},
        roundStartedAt: Date.now(),
      });
    } finally {
      chooseWordRef.current = false;
    }
  };

  const handleGuess = async () => {
    const text = guess.trim();
    if (!text || isDrawer || hasGuessedCorrectly) return;
    if (guessRef.current) return;
    guessRef.current = true;
    setGuess('');

    const isCorrect = text.toLowerCase() === currentWord.toLowerCase() ||
                      text === currentWord;

    try {
      if (isCorrect) {
        feedback('correctGuess');
        const timeBonus = Math.max(0, timeLeft);
        const points = 10 + timeBonus;
        const drawerPoints = 5;

        await safeUpdate(`rooms/${roomId}/gameData/guesses/${userNickname}`, {
          text, correct: true, points,
        });
        await safeUpdate(`rooms/${roomId}/gameData/scores`, {
          [userNickname!]: increment(points),
          [currentDrawer]: increment(drawerPoints),
        });
      } else {
        await safeUpdate(`rooms/${roomId}/gameData/guesses/${userNickname}`, {
          text, correct: false, points: 0,
        });
      }
    } finally {
      guessRef.current = false;
    }
  };

  const handleEndRound = async () => {
    if (endRoundRef.current) return;
    endRoundRef.current = true;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'roundEnd',
        roundEndedAt: Date.now(),
      });
    } finally {
      endRoundRef.current = false;
    }
  };

  const handleNextRound = async () => {
    if (!isHost || nextRoundRef.current) return;
    nextRoundRef.current = true;
    const drawerOrder = gameData.drawerOrder || players;
    const nextRound = round + 1;

    try {
      if (nextRound >= drawerOrder.length) {
        await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'finished' });
        feedback('victory');
        const sortedScores = Object.entries(scores).sort((a: any, b: any) => b[1] - a[1]);
        if (sortedScores.length > 0 && (sortedScores[0][1] as number) > 0) {
          await recordWin(roomId!, sortedScores[0][0], 'drawing');
        }
      } else {
        await safeUpdate(`rooms/${roomId}/gameData`, {
          phase: 'choosing',
          round: nextRound,
          currentDrawer: drawerOrder[nextRound],
          currentWord: '',
          drawing: [],
          guesses: {},
          roundStartedAt: 0,
        });
      }
    } finally {
      nextRoundRef.current = false;
    }
  };

  const handleClear = async () => {
    if (!isDrawer) return;
    setLocalPaths([]);
    await safeUpdate(`rooms/${roomId}`, { drawingStrokes: [] });
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  const getPos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  };

  const handleDrawStart = (e: any) => {
    if (!isDrawer) return;
    if (e.type === 'touchstart') e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    lastPointRef.current = pos;
    const newPath = { color, size: brushSize, points: [pos] };
    setLocalPaths((prev) => [...prev, newPath]);
  };

  const handleDrawMove = (e: any) => {
    if (!isDrawer || !isDrawing) return;
    if (e.type === 'touchmove') e.preventDefault();
    const pos = getPos(e);
    setLocalPaths((prev) => {
      const updated = [...prev];
      const last = { ...updated[updated.length - 1] };
      last.points = [...last.points, pos];
      updated[updated.length - 1] = last;
      return updated;
    });
    lastPointRef.current = pos;
  };

  const handleDrawEnd = async (e: any) => {
    if (!isDrawer || !isDrawing) return;
    if (e.type === 'touchend') e.preventDefault();
    setIsDrawing(false);
    lastPointRef.current = null;
    await safeUpdate(`rooms/${roomId}`, { drawingStrokes: localPaths });
  };

  const drawHandlersRef = useRef({ handleDrawStart, handleDrawMove, handleDrawEnd });
  useEffect(() => {
    drawHandlersRef.current = { handleDrawStart, handleDrawMove, handleDrawEnd };
  }, [handleDrawStart, handleDrawMove, handleDrawEnd]);

  useEffect(() => {
    if (phase === 'waiting' || phase === 'playing' || phase === 'choosing') personalRecordedRef.current = false;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('drawing');
    const sorted = Object.entries(scores).sort((a: any, b: any) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][0] === userNickname && (sorted[0][1] as number) > 0) {
      recordPersonalWin('drawing');
    }
  }, [phase, scores, userNickname]);

  useEffect(() => {
    if (phase !== 'playing' || !roundStartedAt) return;
    
    if (timeLeft <= 5 && timeLeft > 0) {
      feedback('countdown');
    }
    
    if (timeLeft === 0) {
      feedback('timeUp');
      if (isHost && !timerFiredRef.current) {
        timerFiredRef.current = true;
        handleEndRound();
      }
    }
  }, [phase, roundStartedAt, isHost, timeLeft]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const unsub = onValue(ref(db, `rooms/${roomId}/drawingStrokes`), (snap) => {
      if (!snap.exists()) { setLocalPaths([]); return; }
      setLocalPaths(snap.val() || []);
    });
    return () => unsub();
  }, [roomId, phase, round]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setCanvasSize({ w: width, h: height });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.w === 0 || canvasSize.h === 0) return;
    const dpr = window.devicePixelRatio || 2;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    localPaths.forEach((path) => {
      if (!path.points || path.points.length < 2) return;
      ctx.strokeStyle = path.color || '#000';
      ctx.lineWidth = path.size || 4;
      ctx.beginPath();
      ctx.moveTo(path.points[0].x * canvasSize.w, path.points[0].y * canvasSize.h);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x * canvasSize.w, path.points[i].y * canvasSize.h);
      }
      ctx.stroke();
    });
  }, [localPaths, canvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawer) return;
    const opts = { passive: false };
    const onStart = (e: any) => drawHandlersRef.current.handleDrawStart(e);
    const onMove = (e: any) => drawHandlersRef.current.handleDrawMove(e);
    const onEnd = (e: any) => drawHandlersRef.current.handleDrawEnd(e);
    canvas.addEventListener('touchstart', onStart, opts);
    canvas.addEventListener('touchmove', onMove, opts);
    canvas.addEventListener('touchend', onEnd, opts);
    return () => {
      canvas.removeEventListener('touchstart', onStart, opts);
      canvas.removeEventListener('touchmove', onMove, opts);
      canvas.removeEventListener('touchend', onEnd, opts);
    };
  }, [isDrawer]);

  useEffect(() => {
    if (!isHost) return;
    if ((phase === 'choosing' || phase === 'playing') && currentDrawer && !players.includes(currentDrawer)) {
      handleEndRound();
    }
  }, [isHost, phase, currentDrawer, players]);

  useEffect(() => {
    if (phase === 'choosing' && isDrawer) {
      if (gameData.difficulty === 'custom') {
        setTimeout(() => {
          setPendingWord('');
          setShowWordChoices(true);
        }, 0);
      } else {
        const wordObj = getRandomWord(gameData.difficulty || 'easy');
        setTimeout(() => {
          setPendingWord(wordObj.word);
          setShowWordChoices(true);
        }, 0);
      }
    } else {
      setTimeout(() => {
        setShowWordChoices(false);
        setPendingWord('');
      }, 0);
    }
  }, [phase, round, isDrawer, gameData.difficulty]);

  useEffect(() => {
    if (phase !== 'roundEnd' && phase !== 'finished') return;
    const canvas = shareCanvasRef.current;
    if (!canvas) return;
    const size = 300;
    const dpr = window.devicePixelRatio || 2;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    localPaths.forEach((path) => {
      if (!path.points || path.points.length < 2) return;
      ctx.strokeStyle = path.color || '#000';
      ctx.lineWidth = (path.size || 4) * (size / 300);
      ctx.beginPath();
      ctx.moveTo(path.points[0].x * size, path.points[0].y * size);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x * size, path.points[i].y * size);
      }
      ctx.stroke();
    });
  }, [phase, localPaths]);

  useEffect(() => {
    guessRef.current = false;
    chooseWordRef.current = false;
    nextRoundRef.current = false;
    setTimeout(() => setHasRerolled(false), 0);
    if (allCorrectTimerRef.current) {
      clearTimeout(allCorrectTimerRef.current);
      allCorrectTimerRef.current = null;
    }
  }, [round, phase]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const nonDrawers = players.filter(p => p !== currentDrawer);
    const allCorrect = nonDrawers.every((p) => guesses[p]?.correct);
    if (allCorrect && nonDrawers.length > 0 && isHost) {
      if (allCorrectTimerRef.current) clearTimeout(allCorrectTimerRef.current);
      allCorrectTimerRef.current = setTimeout(() => {
        allCorrectTimerRef.current = null;
        handleEndRound();
      }, 2000);
    }
    return () => {
      if (allCorrectTimerRef.current) {
        clearTimeout(allCorrectTimerRef.current);
        allCorrectTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guesses, phase, currentDrawer, isHost]);

  const handleReroll = () => {
    if (hasRerolled) return;
    setHasRerolled(true);
    const wordObj = getRandomWord(gameData.difficulty || 'easy');
    setPendingWord(wordObj.word);
  };

  const handleShare = async () => {
    const canvas = shareCanvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'drawing.png', { type: 'image/png' });
        if (navigator.share) {
          await navigator.share({
            title: 'Drawing',
            files: [file],
          });
        }
      });
    } catch (e) {
      console.log('Share failed', e);
    }
  };

  if (!roomData) return null;

  if (phase === 'waiting') {
    return <DrawingWaitingPhase renderErrorToast={renderErrorToast} players={players} ROUND_TIME={ROUND_TIME} difficulty={difficulty} isHost={isHost} setDifficulty={setDifficulty} handleStartGame={handleStartGame} />;
  }

  if (phase === 'choosing') {
    return <DrawingGuessingPhase isDrawer={isDrawer} showWordChoices={showWordChoices} gameData={gameData} renderErrorToast={renderErrorToast} customWordInput={customWordInput} setCustomWordInput={setCustomWordInput} handleChooseWord={handleChooseWord} pendingWord={pendingWord} hasRerolled={hasRerolled} handleReroll={handleReroll} roundTime={roundTime} currentDrawer={currentDrawer} />;
  }

  if (phase === 'roundEnd' || phase === 'finished') {
    return <DrawingResultPhase phase={phase} guesses={guesses} gameData={gameData} players={players} round={round} renderErrorToast={renderErrorToast} currentWord={currentWord} currentDrawer={currentDrawer} shareCanvasRef={shareCanvasRef} handleShare={handleShare} isHost={isHost} handleNextRound={handleNextRound} scores={scores} showConfirm={showConfirm} confirmLeave={confirmLeave} cancelLeave={cancelLeave} handleStartGame={handleStartGame} handleBackToLobby={handleBackToLobby} requestLeave={requestLeave} />;
  }

  return <DrawingPlayingPhase renderErrorToast={renderErrorToast} round={round} totalRounds={totalRounds} gameData={gameData} timeLeft={timeLeft} roundTime={roundTime} isDrawer={isDrawer} currentDrawer={currentDrawer} currentWord={currentWord} containerRef={containerRef} canvasRef={canvasRef} handleDrawStart={handleDrawStart} handleDrawMove={handleDrawMove} handleDrawEnd={handleDrawEnd} guesses={guesses} color={color} setColor={setColor} brushSize={brushSize} setBrushSize={setBrushSize} handleClear={handleClear} hasGuessedCorrectly={hasGuessedCorrectly} guess={guess} setGuess={setGuess} handleGuess={handleGuess} />;
};

export default Drawing;
