// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { RotateCcw, LogOut, Pencil, Maximize2, X } from 'lucide-react';
import { feedback } from '../utils/feedback';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useTurnNotification } from '../hooks/useTurnNotification';
import { useGameTimer } from '../hooks/useGameTimer';
import { useTranslation } from 'react-i18next';
import { useGame } from '../contexts/GameContext';
import { TimerDisplay } from '../components/game-ui/TimerDisplay';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import NeonCard from '../components/NeonCard';
import GiantButton from '../components/GiantButton';
import { WORD_CATEGORIES, ALL_WORDS, TURN_TIME_OPTIONS, ROUNDS_OPTIONS } from './logic/fakeArtistData';
import { shuffle, getRandomWord } from './logic/fakeArtistLogic';

const PLAYER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#e91e63', '#00bcd4', '#8bc34a',
];

const countSyllables = (text: string) => {
  if (!text) return 0;
  const words = text.split(/[\s-]+/).filter(Boolean);
  let total = 0;
  for (const w of words) {
    // Handle English words
    if (/^[a-zA-Z]+$/.test(w)) {
      const engVowels = w.match(/[aeiouyAEIOUY]+/g);
      total += engVowels ? engVowels.length : 1;
      continue;
    }

    let temp = w;
    // 1. Group Thai vowel clusters that count as 1 syllable
    temp = temp.replace(/เ[ก-ฮ]{1,2}ีย/g, 'A'); // เ-ีย
    temp = temp.replace(/เ[ก-ฮ]{1,2}ือ/g, 'A'); // เ-ือ
    temp = temp.replace(/เ[ก-ฮ]{1,2}า/g, 'A');  // เ-า
    temp = temp.replace(/[ก-ฮ]{1,2}ัว/g, 'A');   // -ัว (เช่น กลัว)
    
    // 2. Count visible Thai vowels + ฤ
    const vowels = temp.match(/(?:\u0E30|\u0E31|\u0E32|\u0E33|\u0E34|\u0E35|\u0E36|\u0E37|\u0E38|\u0E39|\u0E40|\u0E41|\u0E42|\u0E43|\u0E44|\u0E45|\u0E47|\u0E4D|\u0E24)/g) || [];
    let count = vowels.length;

    // 3. Handle implicit vowels (no visible vowels)
    if (count === 0 && w.length > 0) {
      // Remove characters with garan (e.g. ์) as they don't add syllables
      const clean = w.replace(/[ก-ฮ]์/g, '').replace(/[\u0E01-\u0E2E](?:\u0E30|\u0E31|\u0E32|\u0E33|\u0E34|\u0E35|\u0E36|\u0E37|\u0E38|\u0E39|\u0E40|\u0E41|\u0E42|\u0E43|\u0E44|\u0E47|\u0E4D)์/g, '');
      // Heuristic: 2 consonants (นก) = 1, 3 consonants (กนก) = 2
      count = Math.max(1, clean.length - 1);
    }
    total += count;
  }
  return total;
};

const FakeArtist: React.FC = () => {
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { t } = useTranslation();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId || '', userNickname || '');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [voteTarget, setVoteTarget] = useState<string | null>(null);
  const [guessInput, setGuessInput] = useState('');
  const [customWord, setCustomWord] = useState('');
  const [wordMode, setWordMode] = useState('random');
  const [selectedCategory, setSelectedCategory] = useState('animals');
  const [selectedTurnTime, setSelectedTurnTime] = useState(15);
  const [selectedRounds, setSelectedRounds] = useState(2);
  const [turnAnnounce, setTurnAnnounce] = useState('');
  const [skippedPlayer, setSkippedPlayer] = useState<string | null>(null);
  const [showFullCanvas, setShowFullCanvas] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [localPaths, setLocalPaths] = useState<any[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const personalRecordedRef = useRef(false);
  const advancingRef = useRef(false);
  const autoSkipRef = useRef(false);
  const voteProcessedRef = useRef(false);
  const lastPointRef = useRef(null);
  const timerExpiredRef = useRef(false);
  const drawHandlersRef = useRef({ startDraw: (e:any) => {}, moveDraw: (e:any) => {}, endDraw: (e:any) => {} });

  // Derived variables
  const gameData = roomData?.gameData || {};
  const players = Object.keys(roomData?.players || {});
  const phase = gameData.phase || 'waiting';
  const secretWord = gameData.secretWord || '';
  const fakeArtist = gameData.fakeArtist || '';
  const turnOrder = gameData.turnOrder || [];
  const currentTurnIndex = gameData.currentTurnIndex ?? 0;
  const currentRound = gameData.currentRound ?? 1;
  const turnsPlayed = gameData.turnsPlayed ?? 0;
  const paths = gameData.paths || [];
  const votes = gameData.votes || null;
  const colorMap = gameData.colorMap || {};
  const fakeGuess = gameData.fakeGuess || '';
  const voteResult = gameData.voteResult || null;
  const turnTime = gameData.turnTime || 15;
  const totalRounds = gameData.totalRounds || 2;
  const usedWords = gameData.usedWords || [];
  const turnStartedAt = gameData.turnStartedAt || 0;
  const timerEnd = (phase === 'drawing' && turnStartedAt > 0) ? turnStartedAt + (turnTime * 1000) : null;
  const totalTurnsNeeded = turnOrder.length * totalRounds;
  const currentPlayer = turnOrder[currentTurnIndex] || '';
  const isMyTurn = currentPlayer === userNickname;
  const iAmFakeArtist = fakeArtist === userNickname;
  const secretSyllables = countSyllables(secretWord);

  const { timeLeft } = useGameTimer(timerEnd);
  useTurnNotification(isMyTurn, phase === 'drawing' ? 'playing' : phase);

  useEffect(() => {
    if (phase === 'drawing' && currentPlayer) {
      setTimeout(() => setTurnAnnounce(currentPlayer), 0);
      const t = setTimeout(() => setTurnAnnounce(''), 2000);
      return () => clearTimeout(t);
    }
  }, [phase, currentTurnIndex, currentPlayer]);

  useEffect(() => {
    if (phase === 'waiting') personalRecordedRef.current = false;
    if (phase === 'voting') voteProcessedRef.current = false;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('fakeartist');
    if (voteResult === 'artists_win' && !iAmFakeArtist) {
      recordPersonalWin('fakeartist');
    } else if ((voteResult === 'fake_wins' || voteResult === 'fake_guessed') && iAmFakeArtist) {
      recordPersonalWin('fakeartist');
    }
  }, [phase, voteResult, iAmFakeArtist]);

  useEffect(() => {
    const resizeCanvas = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = Math.min(w, 400);
      if (w > 0) setCanvasSize({ w, h });
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'drawing') {
      timerExpiredRef.current = false;
      autoSkipRef.current = false;
      return;
    }

    if (timeLeft <= 6 && timeLeft > 0) feedback('countdown');
    
    if (timeLeft === 0 && !timerExpiredRef.current) {
      timerExpiredRef.current = true;
      feedback('timeUp');
      if (isHost && !autoSkipRef.current) {
        autoSkipRef.current = true;
        setSkippedPlayer(currentPlayer);
        setTimeout(() => setSkippedPlayer(null), 2000);
        const newTurnsPlayed = turnsPlayed + 1;
        const nextIndex = (currentTurnIndex + 1) % turnOrder.length;
        const nextRound = currentRound + (currentTurnIndex + 1 >= turnOrder.length ? 1 : 0);
        const nextPhase = newTurnsPlayed >= totalTurnsNeeded ? 'voting' : 'drawing';
        update(ref(db, `rooms/${roomId}/gameData`), {
          currentTurnIndex: nextIndex,
          currentRound: nextRound,
          turnsPlayed: newTurnsPlayed,
          phase: nextPhase,
          turnStartedAt: Date.now(),
        });
      }
    }
  }, [timeLeft, phase, isHost, currentTurnIndex, currentPlayer, currentRound, roomId, totalTurnsNeeded, turnOrder.length, turnsPlayed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.w === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const allPaths = [...paths, ...localPaths];
    allPaths.forEach((path) => {
      if (!path.points || path.points.length < 2) return;
      ctx.strokeStyle = path.color || '#000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(path.points[0].x * canvas.width, path.points[0].y * canvas.height);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x * canvas.width, path.points[i].y * canvas.height);
      }
      ctx.stroke();
    });
  }, [paths, localPaths, canvasSize, phase, showFullCanvas]);

  useEffect(() => {
    const canvas = fullCanvasRef.current;
    if (!canvas || !showFullCanvas || canvasSize.w === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    paths.forEach((path) => {
      if (!path.points || path.points.length < 2) return;
      ctx.strokeStyle = path.color || '#000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(path.points[0].x * canvas.width, path.points[0].y * canvas.height);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x * canvas.width, path.points[i].y * canvas.height);
      }
      ctx.stroke();
    });
  }, [paths, canvasSize, showFullCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || phase !== 'drawing') return;
    const opts = { passive: false };
    const onStart = (e: any) => drawHandlersRef.current.startDraw(e);
    const onMove = (e: any) => drawHandlersRef.current.moveDraw(e);
    const onEnd = (e: any) => drawHandlersRef.current.endDraw(e);
    canvas.addEventListener('touchstart', onStart, opts);
    canvas.addEventListener('touchmove', onMove, opts);
    canvas.addEventListener('touchend', onEnd, opts);
    return () => {
      canvas.removeEventListener('touchstart', onStart, opts);
      canvas.removeEventListener('touchmove', onMove, opts);
      canvas.removeEventListener('touchend', onEnd, opts);
    };
  }, [phase, canvasSize]);

  useEffect(() => {
    if (phase !== 'voting' || !isHost || !votes || voteProcessedRef.current) return;
    const totalVoted = Object.keys(votes).length;
    if (totalVoted < players.length) return;

    voteProcessedRef.current = true;
    const tally: Record<string, number> = {};
    Object.values(votes).forEach((v: any) => { tally[v] = (tally[v] || 0) + 1; });
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const mostVoted = sorted[0][0];

    if (mostVoted === fakeArtist) {
      update(ref(db, `rooms/${roomId}/gameData`), { phase: 'fake_guess', voteResult: 'caught' });
    } else {
      update(ref(db, `rooms/${roomId}/gameData`), { phase: 'finished', voteResult: 'fake_wins' });
      recordWin(roomId || '', fakeArtist, 'fakeartist');
    }
  }, [votes, phase, players.length, isHost, fakeArtist, roomId]);

  const renderErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
      {errorMsg}
    </div>
  ) : null;

  const safeUpdate = async (refPath: string, data: any) => {
    try {
      await update(ref(db, refPath), data);
    } catch {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  const getPos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const startDraw = (e: any) => {
    if (!isMyTurn || phase !== 'drawing') return;
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    setIsDrawing(true);
    lastPointRef.current = pos;
    setLocalPaths([{ color: colorMap[userNickname || ''] || '#000', points: [pos] }]);
  };

  const moveDraw = (e: any) => {
    if (!isDrawing || !isMyTurn) return;
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    setLocalPaths((prev) => {
      const current = prev[0];
      if (!current) return prev;
      return [{ ...current, points: [...current.points, pos] }];
    });
    lastPointRef.current = pos;
  };

  const endDraw = async (e?: any) => {
    if (!isDrawing || !isMyTurn) return;
    e?.preventDefault();
    setIsDrawing(false);
    const myPath = localPaths[0];
    if (!myPath || myPath.points.length < 2) {
      setLocalPaths([]);
      return;
    }

    const newPaths = [...paths, myPath];
    const newTurnsPlayed = turnsPlayed + 1;
    const nextIndex = (currentTurnIndex + 1) % turnOrder.length;
    const nextRound = currentRound + (currentTurnIndex + 1 >= turnOrder.length ? 1 : 0);
    const nextPhase = newTurnsPlayed >= totalTurnsNeeded ? 'voting' : 'drawing';

    await safeUpdate(`rooms/${roomId}/gameData`, {
      paths: newPaths,
      currentTurnIndex: nextIndex,
      currentRound: nextRound,
      turnsPlayed: newTurnsPlayed,
      phase: nextPhase,
      turnStartedAt: Date.now(),
    });
    setLocalPaths([]);
  };

  useEffect(() => {
    drawHandlersRef.current = { startDraw, moveDraw, endDraw };
  }, [startDraw, moveDraw, endDraw]);

  const handleStartGame = async () => {
    if (!isHost || advancingRef.current) return;
    if (wordMode === 'custom' && !customWord.trim()) return;
    advancingRef.current = true;
    feedback('gameStart');

    let word;
    if (wordMode === 'custom' && customWord.trim()) {
      word = customWord.trim();
    } else if (wordMode === 'category') {
      const catWords = WORD_CATEGORIES[selectedCategory as keyof typeof WORD_CATEGORIES]?.words || ALL_WORDS;
      const available = catWords.filter(w => !usedWords.includes(w));
      const pool = available.length > 0 ? available : catWords;
      word = pool[Math.floor(Math.random() * pool.length)];
    } else {
      const available = ALL_WORDS.filter(w => !usedWords.includes(w));
      const pool = available.length > 0 ? available : ALL_WORDS;
      word = pool[Math.floor(Math.random() * pool.length)];
    }
    const fake = players[Math.floor(Math.random() * players.length)];
    const order = shuffle(players);
    const startIndex = Math.floor(Math.random() * order.length);
    const colors: Record<string, string> = {};
    players.forEach((p, i) => { colors[p] = PLAYER_COLORS[i % PLAYER_COLORS.length]; });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'reveal',
        secretWord: word,
        fakeArtist: fake,
        turnOrder: order,
        currentTurnIndex: startIndex,
        currentRound: 1,
        turnsPlayed: 0,
        turnTime: selectedTurnTime,
        totalRounds: selectedRounds,
        usedWords: [...usedWords, word],
        paths: [],
        votes: null,
        colorMap: colors,
        voteResult: null,
        fakeGuess: null,
        turnStartedAt: Date.now(),
        startTime: Date.now(),
      });
      setCustomWord('');
    } finally {
      advancingRef.current = false;
    }
  };

  const handleStartDrawing = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'drawing', turnStartedAt: Date.now() });
  };

  const handleVote = async () => {
    if (!voteTarget || (votes && votes[userNickname || ''])) return;
    await safeUpdate(`rooms/${roomId}/gameData/votes`, { [userNickname || '']: voteTarget });
  };

  const handleFakeGuess = async () => {
    if (!iAmFakeArtist || !guessInput.trim()) return;
    const correct = guessInput.trim().toLowerCase() === secretWord.toLowerCase();
    const result = correct ? 'fake_guessed' : 'artists_win';
    await safeUpdate(`rooms/${roomId}/gameData`, {
      phase: 'finished',
      fakeGuess: guessInput.trim(),
      voteResult: result,
    });
    if (correct) {
      recordWin(roomId || '', fakeArtist, 'fakeartist');
    }
  };

  const handlePlayAgain = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'waiting',
        secretWord: null,
        fakeArtist: null,
        turnOrder: null,
        currentTurnIndex: 0,
        currentRound: 1,
        turnsPlayed: 0,
        usedWords: usedWords,
        paths: null,
        votes: null,
        colorMap: null,
        voteResult: null,
        fakeGuess: null,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  if (!roomData) return null;

  return (
    <div className="flex flex-col flex-1 gap-4 select-none relative">
      {renderErrorToast()}
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}

      <AnimatePresence>
        {showFullCanvas && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-950 flex flex-col"
          >
            <div className="flex-between p-4 border-b border-slate-800 bg-slate-900">
              <span className="text-[14px] font-black uppercase tracking-widest text-slate-300">ดูรูปเต็มจอ</span>
              <button className="w-10 h-10 rounded-2xl bg-slate-800 flex-center border border-slate-700 active:scale-95 transition-all" onClick={() => setShowFullCanvas(false)}>
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-[500px]">
                <canvas
                  ref={fullCanvasRef}
                  width={canvasSize.w}
                  height={canvasSize.h}
                  className="w-full bg-slate-900 border border-slate-700 rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                  style={{ height: `${canvasSize.h}px`, backgroundColor: '#ffffff' }}
                />
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-6">
                {players.map((p) => (
                  <div key={p} className="flex items-center gap-2 text-[12px] font-bold text-slate-400 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
                    <div className="w-4 h-4 rounded-full border border-slate-700" style={{ backgroundColor: colorMap[p] }} />
                    <span className={p === fakeArtist && phase === 'finished' ? 'font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' : ''}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'waiting' && (
        <div className="flex flex-col gap-4 flex-1 items-center justify-center py-6 bg-slate-950">
          <div className="text-center">
            <div className="text-6xl mb-4 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-bounce-soft">🎨</div>
            <h2 className="font-black text-[28px] uppercase tracking-widest text-slate-200 mb-2 drop-shadow-md">ศิลปิน<span className="text-amber-500">ปลอม</span></h2>
            <p className="text-slate-400 text-xs font-bold leading-relaxed px-4">
              ทุกคนวาดรูปตามคำ แต่มี 1 คนที่ไม่รู้คำ!<br />
              หาให้เจอว่าใครคือศิลปินปลอม
            </p>
          </div>
          
          <NeonCard color="amber" className="p-4 w-full max-w-xs text-center border-amber-500/30 bg-amber-900/10 mt-4">
            <div className="text-[12px] font-black text-amber-500 uppercase tracking-widest">
              ผู้เล่น {players.length} คน • วาด {selectedRounds} รอบ • {selectedTurnTime} วิ/ตา
            </div>
          </NeonCard>

          <div className="w-full max-w-xs px-2">
            {isHost ? (
              <div className="space-y-6 mt-4">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {['random', 'category', 'custom'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setWordMode(mode)}
                      className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${
                        wordMode === mode ? 'border-amber-500 bg-amber-500/20 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {{ random: 'สุ่มคำ', category: 'เลือกหมวด', custom: 'ตั้งคำเอง' }[mode as 'random'|'category'|'custom']}
                    </button>
                  ))}
                </div>
                {wordMode === 'category' && (
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(WORD_CATEGORIES).map(([key, cat]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedCategory(key)}
                        className={`px-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                          selectedCategory === key ? 'border-amber-500 bg-amber-500/20 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                )}
                {wordMode === 'custom' && (
                  <input
                    type="text"
                    value={customWord}
                    onChange={(e) => setCustomWord(e.target.value)}
                    placeholder="พิมพ์คำที่ต้องการ..."
                    className="w-full px-4 py-3 rounded-2xl border border-slate-700 bg-slate-900 text-center font-black text-[14px] text-white focus:border-amber-500 outline-none transition-colors placeholder:text-slate-600"
                  />
                )}
                <div className="flex gap-4">
                   <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 text-center">เวลาวาดต่อตา</p>
                    <div className="flex flex-col gap-2">
                      {TURN_TIME_OPTIONS.map(opt => (
                        <button
                          key={opt.seconds}
                          onClick={() => setSelectedTurnTime(opt.seconds)}
                          className={`w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-colors ${
                            selectedTurnTime === opt.seconds
                              ? 'bg-amber-500 border-amber-500 text-slate-900 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 text-center">จำนวนรอบวาด</p>
                    <div className="flex flex-col gap-2">
                      {ROUNDS_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setSelectedRounds(opt.value)}
                          className={`w-full py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-colors ${
                            selectedRounds === opt.value
                              ? 'bg-amber-500 border-amber-500 text-slate-900 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <GiantButton
                  color="amber"
                  onClick={handleStartGame}
                  disabled={wordMode === 'custom' && !customWord.trim()}
                  className="w-full mt-4"
                >
                  <Pencil size={18} className="mr-2 inline-block" /> เริ่มเกม
                </GiantButton>
              </div>
            ) : (
              <p className="text-slate-500 font-black uppercase tracking-widest text-xs mt-8 text-center animate-pulse">รอ Host เริ่มเกม...</p>
            )}
          </div>
        </div>
      )}

      {phase === 'reveal' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-200 animate-fade-in">
          <h2 className="font-black text-[22px] uppercase tracking-widest text-slate-300 mb-6 drop-shadow-md">บทบาทของคุณ</h2>
          {iAmFakeArtist ? (
            <NeonCard color="red" className="w-full max-w-sm p-8 text-center bg-red-900/20 border-red-500/50">
              <div className="text-6xl mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]">🎭</div>
              <p className="font-black text-red-500 text-[24px] uppercase tracking-widest drop-shadow-md">คุณคือศิลปินปลอม!</p>
              <p className="text-red-400 text-sm font-bold mt-3 leading-relaxed">คุณไม่รู้คำ — วาดตามคนอื่นไป อย่าให้ใครจับได้!</p>
              <p className="text-[12px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 inline-block px-4 py-2 rounded-xl mt-6 uppercase tracking-widest shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                💡 ใบ้: {secretSyllables} พยางค์
              </p>
            </NeonCard>
          ) : (
            <NeonCard color="emerald" className="w-full max-w-sm p-8 text-center bg-emerald-900/20 border-emerald-500/50">
              <div className="text-6xl mb-4 drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]">🎨</div>
              <p className="font-black text-emerald-400 text-[20px] uppercase tracking-widest drop-shadow-md">คุณคือศิลปินตัวจริง</p>
              <p className="text-emerald-500/70 text-[12px] font-black uppercase tracking-widest mt-6">คำที่ต้องวาด:</p>
              <p className="font-black text-[36px] text-white mt-1 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">{secretWord}</p>
            </NeonCard>
          )}
          <div className="flex items-center gap-3 justify-center mt-8 p-3 bg-slate-900 rounded-2xl border border-slate-800">
            <div className="w-6 h-6 rounded-full border-2 border-slate-300 shadow-[0_0_10px_rgba(255,255,255,0.2)]" style={{ backgroundColor: colorMap[userNickname || ''] }} />
            <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">สีของคุณ</span>
          </div>
          {isHost ? (
            <GiantButton color="amber" onClick={handleStartDrawing} className="w-full max-w-xs mt-8">
              เริ่มวาด!
            </GiantButton>
          ) : (
            <p className="text-slate-500 font-black uppercase tracking-widest text-xs mt-8 animate-pulse">รอ Host กดเริ่มวาด...</p>
          )}
        </div>
      )}

      {phase === 'drawing' && (
        <div className="flex flex-col gap-3 flex-1 bg-slate-950 p-2">
          <AnimatePresence>
            {skippedPlayer && (
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-900 px-5 py-3 rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.5)]"
              >
                {skippedPlayer} หมดเวลา! ข้ามตา
              </motion.div>
            )}
            {turnAnnounce && !skippedPlayer && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-900 px-6 py-3 rounded-2xl font-black text-[14px] uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center gap-2"
              >
                <Pencil size={16} />
                {turnAnnounce === userNickname ? 'ถึงตาคุณวาด!' : `ถึงตา ${turnAnnounce} วาด`}
              </motion.div>
            )}
          </AnimatePresence>

          <NeonCard color="slate" className="p-3 bg-slate-900/50 border-slate-800 rounded-3xl mx-1">
            <div className="flex-between mb-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800 px-2 py-1 rounded-lg">รอบ {currentRound}/{totalRounds}</span>
              <div className="flex items-center gap-1.5">
                <TimerDisplay timeLeft={timeLeft} />
              </div>
              {!iAmFakeArtist && (
                <span className="text-[11px] font-black text-slate-400">คำ: <span className="text-emerald-400 ml-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">{secretWord}</span></span>
              )}
              {iAmFakeArtist && (
                <span className="text-[11px] font-black text-red-500">คำ: ??? <span className="text-amber-500 ml-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">{secretSyllables} พยางค์</span></span>
              )}
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full mb-3 overflow-hidden shadow-inner">
              <motion.div
                className={`h-full rounded-full ${timeLeft <= 5 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : timeLeft <= 10 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'}`}
                animate={{ width: `${(timeLeft / turnTime) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex items-center gap-2 px-1">
              <div className="w-5 h-5 rounded-full border-2 border-slate-300 shadow-[0_0_10px_rgba(255,255,255,0.2)]" style={{ backgroundColor: colorMap[currentPlayer] }} />
              <span className={`text-[12px] font-black uppercase tracking-widest ${isMyTurn ? 'text-emerald-400 animate-pulse' : 'text-slate-300'}`}>
                {isMyTurn ? 'ถึงตาคุณวาด!' : `${currentPlayer} กำลังวาด...`}
              </span>
            </div>
          </NeonCard>

          <div className="flex gap-2 overflow-x-auto px-2 pb-2 hide-scrollbar">
            {turnOrder.map((p: string, i: number) => (
              <div
                key={p}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                  i === currentTurnIndex ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)] scale-105' : 'bg-slate-900 border border-slate-800 text-slate-500'
                }`}
              >
                <div className="w-3 h-3 rounded-full border border-slate-700" style={{ backgroundColor: colorMap[p] }} />
                {p === userNickname ? 'คุณ' : p}
              </div>
            ))}
          </div>

          <div ref={containerRef} className="flex-1 min-h-[300px] relative rounded-3xl overflow-hidden border-2 border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.5)] mx-1">
            <canvas
              ref={canvasRef}
              width={canvasSize.w}
              height={canvasSize.h}
              className={`absolute inset-0 w-full h-full bg-slate-900 ${isMyTurn ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
              style={{ touchAction: 'none', backgroundColor: '#ffffff' }}
              onMouseDown={startDraw}
              onMouseMove={moveDraw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
            />
          </div>

          {isMyTurn && (
            <p className="text-center text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 mx-1 mt-1 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              วาดเส้นเดียว แล้วยกนิ้วเพื่อจบตา
            </p>
          )}
        </div>
      )}

      {phase === 'voting' && (
        <div className="flex-1 flex flex-col p-4 bg-slate-950 text-slate-200 animate-fade-in">
          <h2 className="font-black text-[22px] uppercase tracking-widest text-amber-500 mb-1 text-center drop-shadow-md">โหวตหาศิลปินปลอม!</h2>
          <p className="text-slate-500 font-bold text-[11px] uppercase tracking-widest text-center mb-4">โหวตแล้ว {Object.keys(votes || {}).length}/{players.length}</p>

          <div ref={containerRef} className="relative rounded-3xl overflow-hidden mb-6 border-2 border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <canvas
              ref={canvasRef}
              width={canvasSize.w}
              height={canvasSize.h}
              className="w-full bg-white"
              style={{ height: `${Math.min(canvasSize.w * 0.6, 240)}px` }}
            />
            <button
              onClick={() => setShowFullCanvas(true)}
              className="absolute top-3 right-3 w-10 h-10 rounded-2xl bg-slate-900/80 backdrop-blur-md flex-center border border-slate-700 text-white active:scale-95 transition-all shadow-lg hover:bg-slate-800"
            >
              <Maximize2 size={16} />
            </button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto hide-scrollbar pb-24">
            {players.map((p) => (
              <button
                key={p}
                disabled={!!(votes && votes[userNickname || '']) || p === userNickname}
                onClick={() => setVoteTarget(p)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  voteTarget === p || (votes && votes[userNickname || ''] === p) ? 'border-amber-500 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-[1.02]' : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                } ${p === userNickname ? 'opacity-40 grayscale' : ''}`}
              >
                <div className="w-6 h-6 rounded-full border border-slate-700 shadow-sm" style={{ backgroundColor: colorMap[p] }} />
                <span className={`font-black text-[14px] uppercase tracking-widest ${voteTarget === p ? 'text-amber-400' : 'text-slate-300'}`}>{p}</span>
                {p === userNickname && <span className="text-[10px] font-bold text-slate-500 ml-auto uppercase tracking-widest bg-slate-800 px-2 py-1 rounded-md">(คุณ)</span>}
              </button>
            ))}
          </div>

          <div className="absolute bottom-4 left-4 right-4 z-10">
            {!(votes && votes[userNickname || '']) && voteTarget && (
              <GiantButton color="amber" onClick={handleVote} className="w-full shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
                ยืนยันโหวต
              </GiantButton>
            )}
            {(votes && votes[userNickname || '']) && (
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.8)] text-center">
                 <p className="text-amber-500 font-black text-[12px] uppercase tracking-widest animate-pulse">โหวตแล้ว — รอคนอื่น...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {phase === 'fake_guess' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-200 animate-fade-in">
          <div className="text-6xl mb-4 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">🎯</div>
          <h2 className="font-black text-[24px] uppercase tracking-widest text-slate-200 mb-2 drop-shadow-md">จับศิลปินปลอมได้!</h2>
          <NeonCard color="red" className="p-6 w-full max-w-sm text-center bg-red-900/10 border-red-500/30">
            <p className="text-slate-300 text-[13px] font-bold leading-relaxed mb-4">
              <span className="font-black text-[18px] text-red-500 block mb-1">{fakeArtist}</span> คือศิลปินปลอม!<br />
              <span className="text-slate-400">แต่ถ้าเดาคำถูก ก็ยังชนะได้...</span>
            </p>
            <p className="text-[12px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 inline-block px-4 py-2 rounded-xl uppercase tracking-widest shadow-[0_0_10px_rgba(245,158,11,0.2)]">
              💡 ใบ้: {secretSyllables} พยางค์
            </p>
          </NeonCard>

          <div className="w-full max-w-sm mt-8">
            {iAmFakeArtist ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  placeholder="พิมพ์คำที่คิดว่าถูก..."
                  className="w-full px-6 py-4 rounded-2xl border border-slate-700 bg-slate-900 text-center font-black text-[16px] text-white focus:border-red-500 outline-none transition-colors placeholder:text-slate-600 shadow-inner"
                />
                <GiantButton
                  color="red"
                  onClick={handleFakeGuess}
                  disabled={!guessInput.trim()}
                  className="w-full"
                >
                  ยืนยันคำตอบ
                </GiantButton>
              </div>
            ) : (
              <p className="text-slate-500 text-xs font-black uppercase tracking-widest text-center animate-pulse mt-4">รอศิลปินปลอมเดาคำ...</p>
            )}
          </div>
        </div>
      )}

      {phase === 'finished' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-950 text-slate-200 animate-fade-in pb-24">
          <div className={`text-7xl mb-4 drop-shadow-[0_0_20px_rgba(${voteResult === 'artists_win' ? '16,185,129' : '239,68,68'},0.5)]`}>
             {voteResult === 'artists_win' ? '🎨' : '🎭'}
          </div>
          <h2 className={`font-black text-[28px] uppercase tracking-widest mb-6 drop-shadow-md ${voteResult === 'artists_win' ? 'text-emerald-400' : 'text-red-500'}`}>
            {voteResult === 'artists_win' ? 'ศิลปินตัวจริงชนะ!' : 'ศิลปินปลอมชนะ!'}
          </h2>

          <NeonCard color={voteResult === 'artists_win' ? 'emerald' : 'red'} className={`w-full max-w-sm p-6 mb-6 text-center ${voteResult === 'artists_win' ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
            <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-1">ศิลปินปลอม</p>
            <p className="font-black text-[20px] text-red-400 mb-4">{fakeArtist}</p>
            
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1">คำที่ต้องวาด</p>
            <p className="font-black text-[24px] text-white mb-4 drop-shadow-md">{secretWord}</p>
            
            {fakeGuess && (
              <div className="mt-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">ศิลปินปลอมเดา</p>
                <p className={`font-black text-[18px] ${fakeGuess.toLowerCase() === secretWord.toLowerCase() ? 'text-emerald-400' : 'text-red-500'}`}>{fakeGuess}</p>
              </div>
            )}
            
            {voteResult === 'fake_wins' && (
              <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest mt-4 bg-amber-500/10 px-3 py-1.5 rounded-lg inline-block border border-amber-500/30">โหวตผิดคน — ศิลปินปลอมรอดไป!</p>
            )}
            {voteResult === 'fake_guessed' && (
              <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest mt-4 bg-amber-500/10 px-3 py-1.5 rounded-lg inline-block border border-amber-500/30">โดนจับได้แต่เดาคำถูก!</p>
            )}
          </NeonCard>

          <div ref={containerRef} className="relative w-full max-w-[280px] rounded-3xl overflow-hidden mb-6 border-2 border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <canvas
              ref={canvasRef}
              width={canvasSize.w}
              height={canvasSize.h}
              className="w-full bg-white"
              style={{ height: `${Math.min(canvasSize.w * 0.6, 240)}px` }}
            />
            <button
              onClick={() => setShowFullCanvas(true)}
              className="absolute top-3 right-3 w-10 h-10 rounded-2xl bg-slate-900/80 backdrop-blur-md flex-center border border-slate-700 text-white active:scale-95 transition-all shadow-lg hover:bg-slate-800"
            >
              <Maximize2 size={16} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 justify-center mb-6 max-w-sm">
            {players.map((p) => (
              <div key={p} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                <div className="w-3.5 h-3.5 rounded-full border border-slate-700" style={{ backgroundColor: colorMap[p] }} />
                <span className={p === fakeArtist ? 'text-red-400' : ''}>{p}</span>
              </div>
            ))}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50">
            {isHost ? (
              <div className="flex gap-3 max-w-sm mx-auto">
                <GiantButton color="emerald" onClick={handlePlayAgain} className="flex-1">
                   เล่นอีกรอบ
                </GiantButton>
                <button onClick={handleBackToLobby} className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:border-slate-500">
                  กลับ Lobby
                </button>
              </div>
            ) : (
              <button onClick={requestLeave} className="w-full max-w-sm mx-auto py-4 text-[12px] font-black uppercase tracking-widest border border-red-500/50 bg-red-500/10 text-red-500 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-500/20">
                <LogOut size={16} /> ออกจากห้อง
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FakeArtist;
