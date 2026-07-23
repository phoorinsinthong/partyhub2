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
import { useGameUpdate } from '../hooks/useGameUpdate';
import { TimerDisplay } from '../components/game-ui/TimerDisplay';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import NeonCard from '../components/NeonCard';
import GiantButton from '../components/GiantButton';
import { WORD_CATEGORIES, ALL_WORDS, TURN_TIME_OPTIONS, ROUNDS_OPTIONS } from './fakeArtistData';
import { shuffle, getRandomWord } from './fakeArtistLogic';
import { WaitingPhase, RevealPhase, DrawingPhase, VotingPhase, FakeGuessPhase, FinishedPhase } from './phases';


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
  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);
  const { t } = useTranslation();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId || '', userNickname || '');
  
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
        <WaitingPhase
          players={players}
          selectedRounds={selectedRounds}
          selectedTurnTime={selectedTurnTime}
          isHost={isHost}
          wordMode={wordMode}
          setWordMode={setWordMode}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          customWord={customWord}
          setCustomWord={setCustomWord}
          setSelectedTurnTime={setSelectedTurnTime}
          setSelectedRounds={setSelectedRounds}
          handleStartGame={handleStartGame}
        />
      )}

      {phase === 'reveal' && (
        <RevealPhase
          iAmFakeArtist={iAmFakeArtist}
          secretSyllables={secretSyllables}
          secretWord={secretWord}
          colorMap={colorMap}
          userNickname={userNickname}
          isHost={isHost}
          handleStartDrawing={handleStartDrawing}
        />
      )}

      {phase === 'drawing' && (
        <DrawingPhase
          skippedPlayer={skippedPlayer}
          turnAnnounce={turnAnnounce}
          userNickname={userNickname}
          currentRound={currentRound}
          totalRounds={totalRounds}
          timeLeft={timeLeft}
          turnTime={turnTime}
          iAmFakeArtist={iAmFakeArtist}
          secretWord={secretWord}
          secretSyllables={secretSyllables}
          currentPlayer={currentPlayer}
          colorMap={colorMap}
          isMyTurn={isMyTurn}
          turnOrder={turnOrder}
          currentTurnIndex={currentTurnIndex}
          containerRef={containerRef}
          canvasRef={canvasRef}
          canvasSize={canvasSize}
          startDraw={startDraw}
          moveDraw={moveDraw}
          endDraw={endDraw}
        />
      )}

      {phase === 'voting' && (
        <VotingPhase
          players={players}
          votes={votes}
          userNickname={userNickname}
          colorMap={colorMap}
          voteTarget={voteTarget}
          setVoteTarget={setVoteTarget}
          containerRef={containerRef}
          canvasRef={canvasRef}
          canvasSize={canvasSize}
          setShowFullCanvas={setShowFullCanvas}
          handleVote={handleVote}
        />
      )}

      {phase === 'fake_guess' && (
        <FakeGuessPhase
          fakeArtist={fakeArtist}
          secretSyllables={secretSyllables}
          iAmFakeArtist={iAmFakeArtist}
          guessInput={guessInput}
          setGuessInput={setGuessInput}
          handleFakeGuess={handleFakeGuess}
        />
      )}

      {phase === 'finished' && (
        <FinishedPhase
          voteResult={voteResult}
          fakeArtist={fakeArtist}
          secretWord={secretWord}
          fakeGuess={fakeGuess}
          players={players}
          colorMap={colorMap}
          isHost={isHost}
          handlePlayAgain={handlePlayAgain}
          handleBackToLobby={handleBackToLobby}
          requestLeave={requestLeave}
          containerRef={containerRef}
          canvasRef={canvasRef}
          canvasSize={canvasSize}
          setShowFullCanvas={setShowFullCanvas}
        />
      )}
</div>
  );
};

export default FakeArtist;
