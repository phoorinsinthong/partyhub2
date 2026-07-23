// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, onValue, increment } from 'firebase/database';
import { db } from '../firebase';
import { Eraser, RotateCcw, Send, Trophy, Pencil, LogOut, Share2 } from 'lucide-react';
import { getRandomWord } from './logic/drawingLogic';
import { useTranslation } from 'react-i18next';
import { TimerDisplay } from '../components/game-ui/TimerDisplay';
import { feedback } from '../utils/feedback';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGameTimer } from '../hooks/useGameTimer';
import { useTurnNotification } from '../hooks/useTurnNotification';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { useGame } from '../contexts/GameContext';
import { useGameUpdate } from '../hooks/useGameUpdate';
import NeonCard from '../components/NeonCard';
import GiantButton from '../components/GiantButton';

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

  if (!roomData) return null;

  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 bg-slate-950 text-slate-200">
        {renderErrorToast()}
        <div className="text-6xl animate-bounce-soft drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">🎨</div>
        <div className="text-center">
          <h2 className="font-black text-[28px] uppercase tracking-widest text-slate-200 mb-1 drop-shadow-md">วาดรูป<span className="text-emerald-500">ทายคำ</span></h2>
          <p className="text-slate-400 text-xs font-bold">คนวาด วาดรูป — คนเดา ทายให้ถูก!</p>
        </div>
        <NeonCard color="emerald" className="p-4 w-full max-w-xs text-center border-emerald-500/30 bg-emerald-900/10">
          <p className="text-[12px] font-black text-emerald-400 uppercase tracking-widest">{players.length} ผู้เล่น • {players.length} รอบ</p>
          <p className="text-[11px] font-bold text-slate-400 mt-1">{ROUND_TIME[difficulty as keyof typeof ROUND_TIME] || 60} วินาที/รอบ</p>
        </NeonCard>
        {isHost ? (
          <>
            <div className="text-center w-full max-w-xs mt-4">
              <p className="text-[11px] font-black text-slate-500 mb-3 uppercase tracking-widest">เลือกระดับความยาก</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'easy', label: 'ง่าย', icon: '🟢', color: 'emerald' },
                  { id: 'medium', label: 'กลาง', icon: '🟡', color: 'amber' },
                  { id: 'hard', label: 'ยาก', icon: '🔴', color: 'red' },
                  { id: 'funny', label: 'ฮาๆ', icon: '🤪', color: 'fuchsia' },
                  { id: 'random', label: 'สุ่ม', icon: '🎲', color: 'blue' },
                  { id: 'custom', label: 'กำหนดเอง', icon: '✏️', color: 'purple' },
                ].map(d => {
                  const colorMap: Record<string, { active: string; text: string }> = {
                    emerald: { active: 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]', text: 'text-emerald-400' },
                    amber: { active: 'bg-amber-500/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]', text: 'text-amber-400' },
                    red: { active: 'bg-red-500/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]', text: 'text-red-400' },
                    fuchsia: { active: 'bg-fuchsia-500/20 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.3)]', text: 'text-fuchsia-400' },
                    blue: { active: 'bg-blue-500/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]', text: 'text-blue-400' },
                    purple: { active: 'bg-purple-500/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]', text: 'text-purple-400' },
                  };
                  const colors = colorMap[d.color] || colorMap.blue;
                  return (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={`p-3 rounded-2xl border transition-all active:scale-95 ${
                      difficulty === d.id ? colors.active : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <span className="text-2xl block mb-1 drop-shadow-sm">{d.icon}</span>
                    <span className={`font-black text-[10px] tracking-wide uppercase ${difficulty === d.id ? colors.text : 'text-slate-400'}`}>{d.label}</span>
                  </button>
                  );
                })}
              </div>
            </div>

            {difficulty === 'custom' && (
              <div className="p-3 w-full max-w-xs text-center border border-purple-500/30 rounded-2xl bg-purple-900/10 mt-2">
                <p className="text-[11px] font-black text-purple-400 uppercase tracking-widest">
                  ✏️ คนวาดแต่ละรอบจะพิมพ์คำเอง
                </p>
              </div>
            )}

            <GiantButton color="emerald" onClick={handleStartGame} disabled={players.length < 2} className="mt-6 px-10">
              🎨 เริ่มเกม!
            </GiantButton>
          </>
        ) : (
          <p className="text-slate-500 font-black uppercase tracking-widest text-xs mt-8 animate-pulse">รอ Host เริ่มเกม...</p>
        )}
        {players.length < 2 && isHost && (
          <p className="text-center text-[10px] font-black text-red-500 uppercase tracking-widest mt-2 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">ต้องมีอย่างน้อย 2 คน</p>
        )}
      </div>
    );
  }

  if (phase === 'choosing') {
    if (isDrawer && showWordChoices) {
      if (gameData.difficulty === 'custom') {
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 bg-slate-950 text-slate-200">
            {renderErrorToast()}
            <div className="text-6xl drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">✏️</div>
            <div className="text-center">
              <h2 className="font-black text-[22px] uppercase tracking-widest text-emerald-400 mb-1 drop-shadow-md">ถึงตาคุณวาด!</h2>
              <p className="text-slate-400 text-xs font-bold">พิมพ์คำที่คุณอยากวาดให้เพื่อนทาย</p>
            </div>
            <div className="w-full max-w-xs space-y-4 mt-4">
              <input
                type="text"
                value={customWordInput}
                onChange={(e) => setCustomWordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customWordInput.trim()) {
                    e.preventDefault();
                    handleChooseWord(customWordInput.trim());
                    setCustomWordInput('');
                  }
                }}
                placeholder="พิมพ์คำ..."
                className="w-full py-4 px-6 bg-slate-900 border border-slate-700 rounded-2xl text-center text-[20px] font-black text-emerald-400 tracking-widest focus:border-emerald-500 focus:outline-none focus:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all placeholder:text-slate-600"
                enterKeyHint="go"
                autoFocus
              />
              <GiantButton
                color="emerald"
                onClick={() => {
                  if (customWordInput.trim()) {
                    handleChooseWord(customWordInput.trim());
                    setCustomWordInput('');
                  }
                }}
                disabled={!customWordInput.trim()}
                className="w-full"
              >
                🎨 เริ่มวาด!
              </GiantButton>
            </div>
          </div>
        );
      }

      if (pendingWord) {
        const handleReroll = () => {
          if (hasRerolled) return;
          setHasRerolled(true);
          const wordObj = getRandomWord(gameData.difficulty || 'easy');
          setPendingWord(wordObj.word);
        };

        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in bg-slate-950 text-slate-200">
            {renderErrorToast()}
            <div className="text-6xl drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">🎨</div>
            <h2 className="font-black text-[22px] uppercase tracking-widest text-emerald-400 drop-shadow-md">ถึงตาคุณวาด!</h2>
            <NeonCard color="emerald" className="p-6 w-full max-w-xs text-center border-emerald-500/30 bg-emerald-900/10">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">คำที่ต้องวาดคือ</p>
              <p className="text-[32px] font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">{pendingWord}</p>
            </NeonCard>
            <p className="text-slate-400 text-xs font-bold bg-slate-900 px-4 py-2 rounded-full border border-slate-800">⏱ มีเวลา <span className="text-amber-500">{roundTime}</span> วินาที</p>
            <div className="flex gap-3 w-full max-w-xs mt-4">
              <button
                onClick={handleReroll}
                disabled={hasRerolled}
                className={`flex-1 py-4 text-[12px] font-black uppercase tracking-widest rounded-xl border border-slate-700 bg-slate-900 text-slate-300 active:scale-95 transition-all ${hasRerolled ? 'opacity-40 grayscale' : 'hover:border-slate-500'}`}
              >
                🔄 สุ่มใหม่ {hasRerolled ? '(ใช้แล้ว)' : '(1 ครั้ง)'}
              </button>
              <GiantButton
                color="emerald"
                onClick={() => handleChooseWord(pendingWord)}
                className="flex-1"
              >
                🎨 เริ่มวาด!
              </GiantButton>
            </div>
          </div>
        );
      }

      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8 bg-slate-950 text-slate-200">
          {renderErrorToast()}
          <div className="w-8 h-8 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
          <p className="font-black text-[12px] uppercase tracking-widest text-emerald-500 animate-pulse">กำลังสุ่มคำ...</p>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 bg-slate-950 text-slate-200">
        {renderErrorToast()}
        <span className="text-6xl animate-bounce-soft drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">🎨</span>
        <p className="font-black text-[16px] text-emerald-400 drop-shadow-md">
          <span className="text-white">{currentDrawer}</span> กำลังเตรียมตัว...
        </p>
        <div className="flex gap-2 mt-2">
          <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
          <span className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" style={{animationDelay:'0.3s'}}></span>
          <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" style={{animationDelay:'0.6s'}}></span>
        </div>
      </div>
    );
  }

  if (phase === 'roundEnd') {
    const correctGuessers = Object.entries(guesses).filter(([, g]: any) => g.correct).map(([name]) => name);
    const drawerOrder = gameData.drawerOrder || players;
    const isLastRound = (round + 1) >= drawerOrder.length;

    return (
      <div className="flex-1 flex flex-col gap-5 py-6 px-4 animate-fade-in bg-slate-950 text-slate-200">
        {renderErrorToast()}
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <span className="text-6xl drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">{correctGuessers.length > 0 ? '🎉' : '⏰'}</span>
          <h3 className="font-black text-[24px] uppercase tracking-widest text-slate-200 mt-3 drop-shadow-md">
            {correctGuessers.length > 0 ? 'ทายถูก!' : 'หมดเวลา!'}
          </h3>
        </motion.div>

        <NeonCard color="amber" className="p-6 text-center bg-amber-900/10 border-amber-500/30">
          <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest mb-2 drop-shadow-sm">คำตอบคือ</p>
          <p className="font-black text-[32px] text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">{currentWord}</p>
          <p className="text-[12px] font-bold text-slate-400 mt-2">วาดโดย <span className="text-slate-200">{currentDrawer}</span></p>
        </NeonCard>

        <div className="p-2 bg-slate-900 rounded-[28px] border border-slate-700 shadow-xl overflow-hidden mx-auto w-full max-w-[320px]">
          <canvas
            ref={shareCanvasRef}
            width={300}
            height={300}
            className="w-full rounded-[20px]"
            style={{ aspectRatio: '1/1', background: '#fff' }}
          />
        </div>

        {correctGuessers.length > 0 && (
          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
            <p className="text-[11px] font-black text-emerald-500 uppercase tracking-widest mb-3">ทายถูก:</p>
            <div className="flex flex-wrap gap-2">
              {correctGuessers.map(name => (
                <span key={name} className="text-[12px] font-bold bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                  ✅ {name}
                </span>
              ))}
            </div>
          </div>
        )}

        <button onClick={handleShare} className="py-4 text-[13px] font-black uppercase tracking-widest border border-slate-700 bg-slate-900 text-slate-300 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:border-slate-500">
          <Share2 size={16} /> แชร์รูปวาด
        </button>

        {isHost ? (
          <GiantButton color="emerald" onClick={handleNextRound} className="mt-2">
            {isLastRound ? '🏆 ดูผลลัพธ์' : '➡️ รอบถัดไป'}
          </GiantButton>
        ) : (
          <p className="text-slate-500 font-black uppercase tracking-widest text-xs mt-4 text-center animate-pulse">รอ Host...</p>
        )}
      </div>
    );
  }

  if (phase === 'finished') {
    const sortedScores = Object.entries(scores).sort((a: any, b: any) => b[1] - a[1]);
    const winner = sortedScores[0];

    return (
      <div className="flex-1 flex flex-col gap-5 py-6 px-4 animate-fade-in bg-slate-950 text-slate-200">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-center">
          <span className="text-6xl drop-shadow-[0_0_20px_rgba(245,158,11,0.6)]">🏆</span>
          <h2 className="font-black text-[28px] uppercase tracking-widest text-slate-200 mt-3 drop-shadow-md">จบเกม!</h2>
        </div>
        {winner && (
          <NeonCard color="amber" className="p-6 text-center bg-amber-900/20 border-amber-500/50">
            <Trophy size={32} className="text-amber-500 mx-auto mb-3 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
            <p className="font-black text-[22px] text-amber-400 drop-shadow-md">{winner[0]}</p>
            <p className="text-[28px] font-black text-white mt-1">{winner[1] as number} <span className="text-lg text-amber-500">คะแนน</span></p>
          </NeonCard>
        )}
        <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
          <h3 className="font-black text-[12px] text-slate-400 uppercase tracking-widest mb-4 text-center">คะแนนรวม</h3>
          <div className="space-y-3">
            {sortedScores.map(([name, score], idx) => (
              <div key={name} className="flex items-center gap-4 p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className={`w-8 h-8 rounded-full flex-center text-[14px] font-black ${idx === 0 ? 'bg-amber-500 text-slate-900 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-slate-800 text-slate-400'}`}>{idx + 1}</span>
                <span className={`flex-1 font-bold text-[16px] ${idx === 0 ? 'text-amber-400' : 'text-slate-300'}`}>{name}</span>
                <span className="font-black text-[18px] text-white">{score as number}</span>
              </div>
            ))}
          </div>
        </div>
        {isHost ? (
          <div className="space-y-3 mt-4">
            <GiantButton color="emerald" onClick={handleStartGame}>
              <RotateCcw size={20} className="mr-2 inline-block" /> เล่นอีกรอบ
            </GiantButton>
            <button onClick={handleBackToLobby} className="w-full py-4 text-[13px] font-black uppercase tracking-widest border border-slate-700 bg-slate-900 text-slate-400 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2">
              <LogOut size={16} /> กลับ Lobby
            </button>
          </div>
        ) : (
          <button
            className="w-full py-4 text-[13px] font-black uppercase tracking-widest border border-red-500/50 bg-red-500/10 text-red-500 rounded-2xl active:scale-95 transition-all mt-6 flex items-center justify-center gap-2"
            onClick={requestLeave}
          >
            <LogOut size={16} /> ออกจากห้อง
          </button>
        )}
      </div>
    );
  }

  const timerPercent = (timeLeft / roundTime) * 100;
  const timerColor = timeLeft > 30 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : timeLeft > 10 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]';
  const hint = currentWord ? `${currentWord.charAt(0)}${'＿'.repeat(currentWord.length - 1)}` : '';

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 flex flex-col" style={{ height: '100dvh' }}>
      {renderErrorToast()}
      <div className="flex items-center justify-between px-3 h-12 bg-slate-900 border-b border-slate-800 shrink-0" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg">
            {round + 1}/{totalRounds}
          </span>
          <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-lg mr-2 uppercase tracking-widest">
            {{ easy: 'ง่าย', medium: 'กลาง', hard: 'ยาก', funny: 'ฮาๆ', random: 'สุ่ม', custom: 'กำหนดเอง' }[gameData.difficulty as keyof typeof ROUND_TIME] || 'ง่าย'}
          </span>
          <TimerDisplay timeLeft={timeLeft} />
        </div>
        <div className="flex items-center gap-2">
          <Pencil size={12} className="text-slate-500" />
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            {isDrawer ? 'คุณวาด' : currentDrawer}
          </span>
          {isDrawer ? (
            <span className="text-[11px] font-black text-emerald-900 bg-emerald-400 px-3 py-1 rounded-xl shadow-[0_0_10px_rgba(52,211,153,0.5)] ml-1">
              {currentWord}
            </span>
          ) : (
            <span className="text-[18px] font-black text-slate-200 bg-slate-800 px-3 py-1 rounded-xl tracking-[0.2em] border border-slate-700 ml-1">
              {hint}
            </span>
          )}
        </div>
      </div>

      <div className="h-[3px] bg-slate-800 shrink-0 relative overflow-hidden">
        <motion.div
          className={`absolute top-0 left-0 bottom-0 ${timerColor}`}
          animate={{ width: `${timerPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden bg-slate-950">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          style={{ cursor: isDrawer ? 'crosshair' : 'default', backgroundColor: '#ffffff' }}
          onMouseDown={handleDrawStart}
          onMouseMove={handleDrawMove}
          onMouseUp={handleDrawEnd}
          onMouseLeave={handleDrawEnd}
        />
        {Object.keys(guesses).length > 0 && (
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 pointer-events-none max-h-[40px] overflow-hidden justify-end">
            {Object.entries(guesses).map(([name, g]: any) => (
              <span
                key={name}
                className={`text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-md shadow-md ${
                  g.correct ? 'bg-emerald-500/90 text-slate-900 font-black' : 'bg-slate-900/80 text-slate-300 border border-slate-700'
                }`}
              >
                {name}: {g.correct ? '✅' : g.text}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 bg-slate-900 border-t border-slate-800 p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-10 relative" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        {isDrawer && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 flex-1 overflow-x-auto hide-scrollbar pb-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full shrink-0 transition-all ${
                    color === c ? 'border-[3px] border-emerald-400 scale-110 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'border-2 border-slate-800 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1 bg-slate-800 p-1.5 rounded-2xl border border-slate-700">
              {BRUSH_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setBrushSize(s)}
                  className={`w-8 h-8 rounded-xl flex-center transition-colors ${brushSize === s ? 'bg-slate-700 border border-slate-600 shadow-inner' : 'hover:bg-slate-700/50'}`}
                >
                  <div className="rounded-full bg-slate-300" style={{ width: s + 2, height: s + 2 }} />
                </button>
              ))}
            </div>
            <button onClick={handleClear} className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/30 flex-center text-red-500 active:scale-90 transition-all hover:bg-red-500/20">
              <Eraser size={18} />
            </button>
          </div>
        )}

        {!isDrawer && (
          <div className="flex items-center gap-2">
            {hasGuessedCorrectly ? (
              <div className="flex-1 flex-center gap-2 py-2 bg-emerald-500/10 rounded-2xl border border-emerald-500/30">
                <span className="text-[14px] font-black text-emerald-400 tracking-widest drop-shadow-sm">✅ ทายถูกแล้ว!</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="w-full py-3 px-5 bg-slate-950 border border-slate-700 rounded-full text-[14px] font-bold text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                  placeholder="พิมพ์คำตอบ..."
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleGuess(); }}
                  enterKeyHint="send"
                  maxLength={50}
                />
                <button
                  onClick={handleGuess}
                  disabled={!guess.trim()}
                  className="w-12 h-12 rounded-full bg-emerald-500 text-slate-900 flex-center shrink-0 active:scale-90 transition-transform disabled:opacity-40 disabled:grayscale shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                >
                  <Send size={18} className="ml-1" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Drawing;
