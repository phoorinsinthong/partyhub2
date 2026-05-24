import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, onValue, push, increment } from 'firebase/database';
import { db } from '../firebase';
import { Eraser, Palette, RotateCcw, Send, Trophy, Clock, Pencil, LogOut, Share2 } from 'lucide-react';
import { getWordChoicesFromDifficulty, getRandomWord } from './drawingData';
import { feedback } from '../utils/feedback';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import LeaveConfirmModal from '../components/LeaveConfirmModal';

const ROUND_TIME = { easy: 60, medium: 60, hard: 60, funny: 90, random: 75, custom: 60 };
const COLORS = ['#2f2a22', '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#ecf0f1'];
const BRUSH_SIZES = [3, 6, 12];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const Drawing = ({ roomId, roomData, userNickname }) => {
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const isHost = userNickname === roomData.host;
  const gameData = roomData.gameData || {};
  const players = Object.keys(roomData.players || {});
  const [errorMsg, setErrorMsg] = useState('');

  const safeUpdate = async (refPath, data) => {
    try {
      await update(ref(db, refPath), data);
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
      throw e;
    }
  };

  const phase = gameData.phase || 'waiting';
  const currentDrawer = gameData.currentDrawer || '';
  const currentWord = gameData.currentWord || '';
  const round = gameData.round || 0;
  const totalRounds = gameData.totalRounds || players.length;
  const scores = gameData.scores || {};
  const guesses = gameData.guesses || {};
  const drawingData = [];
  const roundStartedAt = gameData.roundStartedAt || 0;

  const isDrawer = userNickname === currentDrawer;
  const hasGuessedCorrectly = guesses[userNickname]?.correct;

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const personalRecordedRef = useRef(false);
  const nextRoundRef = useRef(false);
  const guessRef = useRef(false);
  const chooseWordRef = useRef(false);
  const endRoundRef = useRef(false);
  const allCorrectTimerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (phase === 'waiting' || phase === 'playing' || phase === 'choosing') personalRecordedRef.current = false;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('drawing');
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][0] === userNickname && sorted[0][1] > 0) {
      recordPersonalWin('drawing');
    }
  }, [phase]);
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [guess, setGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [localPaths, setLocalPaths] = useState([]);
  const [showWordChoices, setShowWordChoices] = useState(false);
  const [wordChoices, setWordChoices] = useState([]);
  const [pendingWord, setPendingWord] = useState('');
  const [hasRerolled, setHasRerolled] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [difficulty, setDifficulty] = useState('easy');
  const roundTime = ROUND_TIME[gameData.difficulty] || 60;
  const [customWordInput, setCustomWordInput] = useState('');
  const shareCanvasRef = useRef(null);
  const lastPointRef = useRef(null);

  const generateShareImage = async () => {
    const size = 600;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size + 120;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#faf9f6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw border
    ctx.strokeStyle = '#d4cfbe';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    // Draw paths
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

    // Bottom bar
    ctx.fillStyle = '#f0ede6';
    ctx.fillRect(0, size, canvas.width, 120);
    ctx.strokeStyle = '#d4cfbe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, size);
    ctx.lineTo(canvas.width, size);
    ctx.stroke();

    // Answer text
    ctx.fillStyle = '#2f2a22';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`คำตอบ: ${currentWord}`, size / 2, size + 45);

    // Drawer + branding
    ctx.fillStyle = '#8a8070';
    ctx.font = '16px sans-serif';
    ctx.fillText(`วาดโดย ${currentDrawer}`, size / 2, size + 75);
    ctx.fillStyle = '#b0a89a';
    ctx.font = '14px sans-serif';
    ctx.fillText('🎮 Party Hub — วาดรูปทายคำ', size / 2, size + 105);

    return canvas;
  };

  const handleShare = async () => {
    try {
      const canvas = await generateShareImage();
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'drawing.png', { type: 'image/png' })] })) {
          await navigator.share({
            title: `วาดรูปทายคำ — ${currentWord}`,
            files: [new File([blob], 'partyhub-drawing.png', { type: 'image/png' })],
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `partyhub-${currentWord}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (e) {}
  };

  // ─── Timer ───
  useEffect(() => {
    if (phase !== 'playing' || !roundStartedAt) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - roundStartedAt) / 1000);
      const remaining = Math.max(0, roundTime - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 5 && remaining > 0) {
        feedback('countdown');
      }
      if (remaining === 0) {
        feedback('timeUp');
        if (isHost) handleEndRound();
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [phase, roundStartedAt, isHost]);

  // ─── Sync drawing from Firebase ───
  useEffect(() => {
    if (phase !== 'playing') return;
    const unsub = onValue(ref(db, `rooms/${roomId}/drawingStrokes`), (snap) => {
      if (!snap.exists()) { setLocalPaths([]); return; }
      setLocalPaths(snap.val() || []);
    });
    return () => unsub();
  }, [roomId, phase, round]);

  // ─── Track container size via ResizeObserver ───
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

  // ─── Render canvas when paths or size change ───
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.w === 0 || canvasSize.h === 0) return;
    const dpr = window.devicePixelRatio || 2;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;
    const ctx = canvas.getContext('2d');
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

  // ─── Drawing handlers ───
  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  };

  const handleDrawStart = (e) => {
    if (!isDrawer) return;
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    lastPointRef.current = pos;
    const newPath = { color, size: brushSize, points: [pos] };
    setLocalPaths((prev) => [...prev, newPath]);
  };

  const handleDrawMove = (e) => {
    if (!isDrawer || !isDrawing) return;
    e.preventDefault();
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

  const handleDrawEnd = async (e) => {
    if (!isDrawer || !isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    lastPointRef.current = null;
    await safeUpdate(`rooms/${roomId}`, { drawingStrokes: localPaths });
  };

  // Register non-passive touch listeners for iOS Safari
  const drawHandlersRef = useRef({ handleDrawStart, handleDrawMove, handleDrawEnd });
  drawHandlersRef.current = { handleDrawStart, handleDrawMove, handleDrawEnd };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawer) return;
    const opts = { passive: false };
    const onStart = (e) => drawHandlersRef.current.handleDrawStart(e);
    const onMove = (e) => drawHandlersRef.current.handleDrawMove(e);
    const onEnd = (e) => drawHandlersRef.current.handleDrawEnd(e);
    canvas.addEventListener('touchstart', onStart, opts);
    canvas.addEventListener('touchmove', onMove, opts);
    canvas.addEventListener('touchend', onEnd, opts);
    return () => {
      canvas.removeEventListener('touchstart', onStart, opts);
      canvas.removeEventListener('touchmove', onMove, opts);
      canvas.removeEventListener('touchend', onEnd, opts);
    };
  }, [isDrawer]);

  const handleClear = async () => {
    if (!isDrawer) return;
    setLocalPaths([]);
    await safeUpdate(`rooms/${roomId}`, { drawingStrokes: [] });
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  // ─── Game flow ───
  const handleStartGame = async () => {
    if (!isHost) return;
    feedback('gameStart');
    const initScores = {};
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

  const handleChooseWord = async (word) => {
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
          [userNickname]: increment(points),
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
        const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        if (sortedScores.length > 0 && sortedScores[0][1] > 0) {
          await recordWin(roomId, sortedScores[0][0], 'drawing');
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

  // Skip round if current drawer left the room
  useEffect(() => {
    if (!isHost) return;
    if ((phase === 'choosing' || phase === 'playing') && currentDrawer && !players.includes(currentDrawer)) {
      handleEndRound();
    }
  }, [isHost, phase, currentDrawer, players]);

  // Auto-pick word for drawer or show input (custom)
  useEffect(() => {
    if (phase === 'choosing' && isDrawer) {
      if (gameData.difficulty === 'custom') {
        setPendingWord('');
        setShowWordChoices(true);
      } else {
        const wordObj = getRandomWord(gameData.difficulty || 'easy');
        setPendingWord(wordObj.word);
        setShowWordChoices(true);
      }
    } else {
      setShowWordChoices(false);
      setPendingWord('');
    }
  }, [phase, round, isDrawer]);

  // Render drawing preview in roundEnd
  useEffect(() => {
    if (phase !== 'roundEnd' && phase !== 'finished') return;
    const canvas = shareCanvasRef.current;
    if (!canvas) return;
    const size = 300;
    const dpr = window.devicePixelRatio || 2;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
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

  // Reset per-round guards when round or phase changes
  useEffect(() => {
    guessRef.current = false;
    chooseWordRef.current = false;
    nextRoundRef.current = false;
    setHasRerolled(false);
    if (allCorrectTimerRef.current) {
      clearTimeout(allCorrectTimerRef.current);
      allCorrectTimerRef.current = null;
    }
  }, [round, phase]);

  // Check if all non-drawers guessed correctly
  useEffect(() => {
    if (phase !== 'playing') return;
    const nonDrawers = players.filter((p) => p !== currentDrawer);
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
  }, [guesses, phase]);

  // ─── WAITING ───
  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
        <div className="text-6xl animate-bounce-soft">🎨</div>
        <div className="text-center">
          <h2 className="font-display font-bold text-[20px] text-olive-800 mb-1">วาดรูปทายคำ</h2>
          <p className="text-olive-400 text-[13px]">คนวาด วาดรูป — คนเดา ทายให้ถูก!</p>
        </div>
        <div className="card p-4 w-full max-w-xs text-center">
          <p className="text-[12px] font-bold text-olive-500">{players.length} ผู้เล่น • {players.length} รอบ</p>
          <p className="text-[11px] text-olive-400 mt-1">{ROUND_TIME[difficulty] || 60} วินาที/รอบ</p>
        </div>
        {isHost ? (
          <>
            <div className="text-center w-full max-w-xs">
              <p className="text-[12px] font-bold text-olive-500 mb-2">เลือกระดับความยาก</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'easy', label: 'ง่าย', icon: '🟢', bg: 'bg-green-50 border-green-200' },
                  { id: 'medium', label: 'กลาง', icon: '🟡', bg: 'bg-amber-50 border-amber-200' },
                  { id: 'hard', label: 'ยาก', icon: '🔴', bg: 'bg-red-50 border-red-200' },
                  { id: 'funny', label: 'ฮาๆ', icon: '🤪', bg: 'bg-pink-50 border-pink-200' },
                  { id: 'random', label: 'สุ่ม', icon: '🎲', bg: 'bg-blue-50 border-blue-200' },
                  { id: 'custom', label: 'กำหนดเอง', icon: '✏️', bg: 'bg-purple-50 border-purple-200' },
                ].map(d => (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={`p-3 rounded-2xl border-2 text-center transition-transform active:scale-95 ${
                      difficulty === d.id ? d.bg + ' shadow-sm' : 'bg-white border-transparent'
                    }`}
                  >
                    <span className="text-2xl block">{d.icon}</span>
                    <span className="font-bold text-[11px] text-olive-700">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {difficulty === 'custom' && (
              <div className="card p-3 w-full max-w-xs text-center">
                <p className="text-[11px] font-bold text-purple-600">
                  ✏️ คนวาดแต่ละรอบจะพิมพ์คำเอง
                </p>
              </div>
            )}

            <button
              onClick={handleStartGame}
              className="btn btn-primary py-3.5 px-8 text-[15px]"
              disabled={players.length < 2}
            >
              🎨 เริ่มเกม!
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 text-olive-400">
            <span className="w-2.5 h-2.5 bg-sage-400 rounded-full animate-pulse-soft"></span>
            <span className="text-[13px] font-semibold">รอ Host เริ่มเกม...</span>
          </div>
        )}
        {players.length < 2 && isHost && (
          <p className="text-center text-[11px] font-bold text-warm-500">ต้องมีอย่างน้อย 2 คน</p>
        )}
      </div>
    );
  }

  // ─── CHOOSING ───
  if (phase === 'choosing') {
    if (isDrawer && showWordChoices) {
      // Custom mode: drawer types their own word
      if (gameData.difficulty === 'custom') {
        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
            <div className="text-4xl">✏️</div>
            <h2 className="font-display font-bold text-[18px] text-olive-800">ถึงตาคุณวาด!</h2>
            <p className="text-olive-400 text-[13px]">พิมพ์คำที่คุณอยากวาดให้เพื่อนทาย</p>
            <div className="w-full max-w-xs space-y-3">
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
                className="input-field w-full text-center text-[16px] font-bold"
                enterKeyHint="go"
                autoFocus
              />
              <button
                onClick={() => {
                  if (customWordInput.trim()) {
                    handleChooseWord(customWordInput.trim());
                    setCustomWordInput('');
                  }
                }}
                disabled={!customWordInput.trim()}
                className="btn btn-primary w-full py-3.5 text-[15px]"
              >
                🎨 เริ่มวาด!
              </button>
            </div>
          </div>
        );
      }

      // Non-custom modes: show the word to drawer, let them click to start
      if (pendingWord) {
        const handleReroll = () => {
          if (hasRerolled) return;
          setHasRerolled(true);
          const wordObj = getRandomWord(gameData.difficulty || 'easy');
          setPendingWord(wordObj.word);
        };

        return (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 py-8 animate-fade-in">
            <div className="text-4xl">🎨</div>
            <h2 className="font-display font-bold text-[18px] text-olive-800">ถึงตาคุณวาด!</h2>
            <div className="card p-5 w-full max-w-xs text-center">
              <p className="text-[11px] font-bold text-olive-400 mb-2">คำที่ต้องวาดคือ</p>
              <p className="text-[28px] font-black text-sage-600">{pendingWord}</p>
            </div>
            <p className="text-olive-400 text-[12px]">⏱ มีเวลา {roundTime} วินาที</p>
            <div className="flex gap-3">
              <button
                onClick={handleReroll}
                disabled={hasRerolled}
                className={`btn btn-outline py-3 px-5 text-[13px] ${hasRerolled ? 'opacity-40' : ''}`}
              >
                🔄 สุ่มใหม่ {hasRerolled ? '(ใช้แล้ว)' : '(1 ครั้ง)'}
              </button>
              <button
                onClick={() => handleChooseWord(pendingWord)}
                className="btn btn-primary py-3 px-5 text-[15px]"
              >
                🎨 เริ่มวาด!
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
          <div className="w-7 h-7 border-[3px] border-sage-200 border-t-sage-500 rounded-full animate-spin"></div>
          <p className="font-bold text-[13px] text-olive-500">กำลังสุ่มคำ...</p>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
        <span className="text-4xl animate-bounce-soft">🎨</span>
        <p className="font-bold text-[15px] text-olive-700">{currentDrawer} กำลังเตรียมตัว...</p>
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 bg-sage-300 rounded-full animate-pulse-soft"></span>
          <span className="w-2.5 h-2.5 bg-sage-400 rounded-full animate-pulse-soft" style={{animationDelay:'0.3s'}}></span>
          <span className="w-2.5 h-2.5 bg-sage-300 rounded-full animate-pulse-soft" style={{animationDelay:'0.6s'}}></span>
        </div>
      </div>
    );
  }

  // ─── ROUND END (reveal) ───
  if (phase === 'roundEnd') {
    const correctGuessers = Object.entries(guesses).filter(([, g]) => g.correct).map(([name]) => name);
    const drawerOrder = gameData.drawerOrder || players;
    const isLastRound = (round + 1) >= drawerOrder.length;

    return (
      <div className="flex-1 flex flex-col gap-4 py-4 animate-fade-in">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <span className="text-4xl">{correctGuessers.length > 0 ? '🎉' : '⏰'}</span>
          <h3 className="font-display font-bold text-[18px] text-olive-800 mt-2">
            {correctGuessers.length > 0 ? 'ทายถูก!' : 'หมดเวลา!'}
          </h3>
        </motion.div>

        {/* Reveal word */}
        <div className="card p-4 text-center bg-gradient-to-br from-sage-50 to-emerald-50 border-2 border-sage-200">
          <p className="text-[10px] font-bold text-sage-500 uppercase tracking-widest mb-1">คำตอบคือ</p>
          <p className="font-display font-black text-[26px] text-olive-800">{currentWord}</p>
          <p className="text-[11px] text-olive-400 mt-1">วาดโดย {currentDrawer}</p>
        </div>

        {/* Mini canvas preview */}
        <div className="card p-2 overflow-hidden">
          <canvas
            ref={shareCanvasRef}
            width={300}
            height={300}
            className="w-full rounded-xl"
            style={{ aspectRatio: '1/1', background: '#fff' }}
          />
        </div>

        {/* Who guessed correctly */}
        {correctGuessers.length > 0 && (
          <div className="card p-3">
            <p className="text-[11px] font-bold text-olive-500 mb-1.5">ทายถูก:</p>
            <div className="flex flex-wrap gap-1.5">
              {correctGuessers.map(name => (
                <span key={name} className="text-[11px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-lg">
                  ✅ {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Share button */}
        <button onClick={handleShare} className="btn btn-outline w-full py-3 text-[13px]">
          <Share2 size={14} /> แชร์รูปวาด
        </button>

        {/* Next round / finish */}
        {isHost ? (
          <button onClick={handleNextRound} className="btn btn-primary w-full py-3.5 text-[15px]">
            {isLastRound ? '🏆 ดูผลลัพธ์' : '➡️ รอบถัดไป'}
          </button>
        ) : (
          <div className="flex-center gap-2 text-olive-400 py-2">
            <span className="w-2 h-2 bg-sage-400 rounded-full animate-pulse-soft" />
            <span className="text-[12px] font-semibold">รอ Host...</span>
          </div>
        )}
      </div>
    );
  }

  // ─── FINISHED ───
  if (phase === 'finished') {
    const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const winner = sortedScores[0];

    return (
      <div className="flex-1 flex flex-col gap-4 py-4 animate-fade-in">
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-center">
          <span className="text-5xl">🏆</span>
          <h2 className="font-display font-bold text-[20px] text-olive-800 mt-2">จบเกม!</h2>
        </div>
        {winner && (
          <div className="card p-5 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 text-center">
            <Trophy size={24} className="text-amber-500 mx-auto mb-2" />
            <p className="font-bold text-[16px] text-olive-800">{winner[0]}</p>
            <p className="text-[22px] font-black text-amber-600">{winner[1]} คะแนน</p>
          </div>
        )}
        <div className="card p-4">
          <h3 className="font-bold text-[13px] text-olive-600 mb-3">คะแนนรวม</h3>
          <div className="space-y-2">
            {sortedScores.map(([name, score], idx) => (
              <div key={name} className="flex items-center gap-3 p-2.5 rounded-xl bg-olive-50/60">
                <span className="w-7 h-7 rounded-full bg-sage-100 flex-center text-[12px] font-black text-sage-700">{idx + 1}</span>
                <span className="flex-1 font-bold text-[14px] text-olive-700">{name}</span>
                <span className="font-black text-[15px] text-sage-600">{score}</span>
              </div>
            ))}
          </div>
        </div>
        {isHost ? (
          <div className="space-y-2">
            <button onClick={handleStartGame} className="btn btn-primary w-full py-3.5 text-[15px]">
              <RotateCcw size={16} /> เล่นอีกรอบ
            </button>
            <button onClick={handleBackToLobby} className="btn btn-outline w-full py-3 text-[13px]">
              <LogOut size={14} /> กลับ Lobby
            </button>
          </div>
        ) : (
          <button
            className="btn btn-outline w-full py-3.5 text-[14px]"
            onClick={requestLeave}
          >
            <LogOut size={15} /> ออกจากห้อง
          </button>
        )}
      </div>
    );
  }

  // ─── PLAYING ───
  const timerPercent = (timeLeft / roundTime) * 100;
  const timerColor = timeLeft > 30 ? 'bg-sage-400' : timeLeft > 10 ? 'bg-amber-400' : 'bg-red-400';
  const hint = currentWord ? `${currentWord.charAt(0)}${'＿'.repeat(currentWord.length - 1)}` : '';

  return (
    <div className="fixed inset-0 z-40 bg-white dark:bg-olive-900 flex flex-col" style={{ height: '100dvh' }}>
      {errorMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-xl animate-fade-in">
          {errorMsg}
        </div>
      )}
      {/* Compact Header */}
      <div className="flex items-center justify-between px-2 h-9 bg-olive-50 dark:bg-olive-800 border-b border-olive-100 shrink-0" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-olive-400 bg-white dark:bg-olive-700 px-1.5 py-0.5 rounded-full">
            {round + 1}/{totalRounds}
          </span>
          <span className="text-[9px] font-bold text-pink-500 bg-pink-50 px-1.5 py-0.5 rounded-full">
            {{ easy: 'ง่าย', medium: 'กลาง', hard: 'ยาก', funny: 'ฮาๆ', random: 'สุ่ม', custom: 'กำหนดเอง' }[gameData.difficulty] || 'ง่าย'}
          </span>
          <Clock size={10} className={timeLeft <= 10 ? 'text-red-500' : 'text-olive-400'} />
          <span className={`font-black text-[12px] ${timeLeft <= 10 ? 'text-red-500' : 'text-olive-700'}`}>{timeLeft}s</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Pencil size={10} className="text-olive-400" />
          <span className="text-[11px] font-bold text-olive-500">
            {isDrawer ? 'คุณวาด' : currentDrawer}
          </span>
          {isDrawer ? (
            <span className="text-[10px] font-bold text-sage-600 bg-sage-100 px-1.5 py-0.5 rounded-full">
              {currentWord}
            </span>
          ) : (
            <span className="text-[22px] font-black text-olive-800 bg-olive-100 px-3 py-1 rounded-full tracking-wide">
              {hint}
            </span>
          )}
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-[3px] bg-olive-100 shrink-0">
        <motion.div
          className={`h-full ${timerColor}`}
          animate={{ width: `${timerPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Canvas - takes all remaining space */}
      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          style={{ cursor: isDrawer ? 'crosshair' : 'default' }}
          onMouseDown={handleDrawStart}
          onMouseMove={handleDrawMove}
          onMouseUp={handleDrawEnd}
          onMouseLeave={handleDrawEnd}
        />
        {/* Guesses overlay (bottom-left of canvas) */}
        {Object.keys(guesses).length > 0 && (
          <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-0.5 pointer-events-none max-h-[30px] overflow-hidden">
            {Object.entries(guesses).map(([name, g]) => (
              <span
                key={name}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm ${
                  g.correct ? 'bg-green-50/90 text-green-600 border border-green-200' : 'bg-white/80 text-olive-400 border border-olive-100'
                }`}
              >
                {name}: {g.correct ? '✅' : g.text}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Bottom controls - minimal height */}
      <div className="shrink-0 bg-white dark:bg-olive-900 border-t border-olive-100 px-2 py-1.5" style={{ paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))' }}>
        {/* Drawing tools (drawer only) */}
        {isDrawer && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 flex-1 overflow-x-auto">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full shrink-0 border-2 transition-transform ${
                    color === c ? 'border-sage-500 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-0.5">
              {BRUSH_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setBrushSize(s)}
                  className={`w-6 h-6 rounded-lg flex-center ${brushSize === s ? 'bg-sage-100 border-2 border-sage-300' : 'bg-olive-50'}`}
                >
                  <div className="rounded-full bg-olive-600" style={{ width: s + 1, height: s + 1 }} />
                </button>
              ))}
            </div>
            <button onClick={handleClear} className="w-6 h-6 rounded-lg bg-red-50 border-2 border-red-200 flex-center text-red-500 active:scale-90">
              <Eraser size={11} />
            </button>
          </div>
        )}

        {/* Guess input (non-drawer) */}
        {!isDrawer && (
          <div className="flex items-center gap-2">
            {hasGuessedCorrectly ? (
              <div className="flex-1 flex-center gap-2 py-1">
                <span className="text-[12px] font-bold text-green-600">✅ ทายถูกแล้ว!</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="input-field !min-h-[36px] !py-1.5 !px-3 !rounded-full !text-[13px] flex-1"
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
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-sage-400 to-sage-600 text-white flex-center shrink-0 active:scale-90 transition-transform disabled:opacity-40"
                >
                  <Send size={14} />
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
