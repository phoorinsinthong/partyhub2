import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, get } from 'firebase/database';
import { db } from '../firebase';
import { Crown, RotateCcw, LogOut } from 'lucide-react';
import { getRandomCategories } from './wordBombData';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { feedback } from '../utils/feedback';

const MAX_LIVES = 3;
const MAX_ROUNDS = 10;

function randomBombTime() {
  return Math.floor(Math.random() * 16) + 10; // 10–25
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getNextTurnIndex(currentIndex, turnOrder, eliminated) {
  const total = turnOrder.length;
  let next = (currentIndex + 1) % total;
  for (let i = 0; i < total; i++) {
    if (!eliminated.includes(turnOrder[next])) return next;
    next = (next + 1) % total;
  }
  return next;
}

// ─── Lives display ───────────────────────────────────────────────────────────
function LivesRow({ count, max = MAX_LIVES }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`text-[11px] ${i < count ? 'opacity-100' : 'opacity-20'}`}>
          ❤️
        </span>
      ))}
    </span>
  );
}

// ─── Animated Bomb ────────────────────────────────────────────────────────────
function BombDisplay({ timeLeft, bombTime, exploding }) {
  const urgency = bombTime > 0 ? Math.max(0, 1 - timeLeft / bombTime) : 0;
  // Shake frequency ramps from 0 → fast as urgency rises
  const shakeDuration = exploding ? 0.05 : Math.max(0.08, 0.45 - urgency * 0.37);
  const shakeAmount = exploding ? 10 : urgency * 7;
  const scale = exploding ? [1, 1.35, 0.1] : 1 + urgency * 0.08;

  return (
    <motion.div
      animate={
        exploding
          ? { scale, rotate: [0, -15, 15, 0], opacity: [1, 1, 0] }
          : {
              x: shakeAmount > 1
                ? [0, -shakeAmount, shakeAmount, -shakeAmount * 0.5, shakeAmount * 0.5, 0]
                : 0,
              scale,
            }
      }
      transition={
        exploding
          ? { duration: 0.4, ease: 'easeOut' }
          : {
              x: { duration: shakeDuration, repeat: Infinity, repeatType: 'loop', ease: 'easeInOut' },
              scale: { duration: 0.3 },
            }
      }
      className="select-none leading-none"
      style={{ fontSize: '64px', display: 'block', textAlign: 'center' }}
    >
      💣
    </motion.div>
  );
}

// ─── Timer Arc ────────────────────────────────────────────────────────────────
function TimerArc({ timeLeft, bombTime }) {
  const radius = 38;
  const circ = 2 * Math.PI * radius;
  const progress = bombTime > 0 ? Math.max(0, timeLeft / bombTime) : 1;
  const offset = circ * (1 - progress);

  const color =
    progress > 0.5 ? '#5f8252' :
    progress > 0.25 ? '#e48c3a' :
    '#d45b5b';

  return (
    <svg width="96" height="96" className="absolute inset-0 m-auto" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--border-outline)" strokeWidth="5" />
      <motion.circle
        cx="48" cy="48" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.25, ease: 'linear' }}
      />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const WordBomb = ({ roomId, roomData, userNickname }) => {
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const isHost = userNickname === roomData.host;
  const gameData = roomData.gameData || {};
  const players = Object.keys(roomData.players || {});

  const phase = gameData.phase || 'waiting';
  const category = gameData.category || '';
  const categoryExamples = gameData.categoryExamples || '';
  const currentTurnIndex = gameData.currentTurnIndex ?? 0;
  const turnOrder = gameData.turnOrder || [];
  const lives = gameData.lives || {};
  const bombTime = gameData.bombTime || 15;
  const turnStartedAt = gameData.turnStartedAt || Date.now();
  const eliminated = gameData.eliminated || [];
  const roundNumber = gameData.roundNumber || 1;

  const activePlayers = turnOrder.filter(p => !eliminated.includes(p));
  const activePlayer = turnOrder[currentTurnIndex] || '';
  const isMyTurn = activePlayer === userNickname;

  const [timeLeft, setTimeLeft] = useState(bombTime);
  const [exploding, setExploding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const countdownFiredRef = useRef(false);
  const explodedRef = useRef(false);
  const advancingRef = useRef(false);
  const personalRecordedRef = useRef(false);

  const safeUpdate = async (refPath, data) => {
    try {
      await update(ref(db, refPath), data);
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
      throw e;
    }
  };

  // ── Reset personal stats flag when new game starts ──────────────────────────
  useEffect(() => {
    if (phase === 'waiting' || phase === 'playing') {
      personalRecordedRef.current = false;
    }
  }, [phase]);

  useEffect(() => {
    advancingRef.current = false;
  }, [currentTurnIndex, phase]);

  // ── Record personal stats for non-host players ─────────────────────────────
  useEffect(() => {
    if (phase !== 'finished' || isHost || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('wordbomb');
    const survivors = turnOrder.filter(p => !eliminated.includes(p));
    if (survivors[0] === userNickname) recordPersonalWin('wordbomb');
  }, [phase]);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;

    setExploding(false);
    explodedRef.current = false;
    countdownFiredRef.current = false;

    const tick = setInterval(() => {
      const elapsed = (Date.now() - turnStartedAt) / 1000;
      const remaining = Math.max(0, bombTime - elapsed);
      setTimeLeft(remaining);

      // Last 5 seconds countdown sound (once per second)
      if (remaining <= 5 && remaining > 0) {
        const intRemaining = Math.ceil(remaining);
        if (!countdownFiredRef.current || countdownFiredRef._last !== intRemaining) {
          countdownFiredRef.current = true;
          countdownFiredRef._last = intRemaining;
          feedback('countdown');
        }
      }

      // Bomb explodes — only host writes to Firebase to avoid race conditions
      if (remaining <= 0 && !explodedRef.current) {
        explodedRef.current = true;
        setExploding(true);
        feedback('timeUp');

        if (isHost) {
          handleBombExplode();
        }
      }
    }, 100);

    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turnStartedAt, bombTime, isHost]);

  // ── Handle bomb explode (active player loses a life) — host only writes ───
  const handleBombExplode = useCallback(async () => {
    if (!isHost || phase !== 'playing') return;
    if (advancingRef.current) return;
    advancingRef.current = true;

    const currentPlayer = turnOrder[currentTurnIndex] || '';
    const currentLives = lives[currentPlayer] ?? MAX_LIVES;
    const newLives = Math.max(0, currentLives - 1);
    const newLivesMap = { ...lives, [currentPlayer]: newLives };

    let newEliminated = [...eliminated];
    let newPhase = 'playing';

    if (newLives <= 0 && !newEliminated.includes(currentPlayer)) {
      newEliminated.push(currentPlayer);
    }

    const survivors = turnOrder.filter(p => !newEliminated.includes(p));
    if (survivors.length <= 1) {
      newPhase = 'finished';
    }

    const nextTurnIndex = getNextTurnIndex(currentTurnIndex, turnOrder, newEliminated);
    const newBombTime = randomBombTime();

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        lives: newLivesMap,
        eliminated: newEliminated,
        phase: newPhase,
        currentTurnIndex: nextTurnIndex,
        bombTime: newBombTime,
        turnStartedAt: Date.now(),
      });
      if (newPhase === 'finished') {
        const winner = survivors[0] || null;
        if (winner) await recordWin(roomId, winner, 'wordbomb');
      }
    } finally {
      advancingRef.current = false;
    }
  }, [isHost, phase, lives, turnOrder, currentTurnIndex, eliminated, roomId, userNickname]);

  // ── Handle correct answer (host advances turn) ────────────────────────────
  const handleCorrectAnswer = async () => {
    if (!isHost) return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    const nextIdx = getNextTurnIndex(currentTurnIndex, turnOrder, eliminated);
    const newBombTime = randomBombTime();
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        currentTurnIndex: nextIdx,
        bombTime: newBombTime,
        turnStartedAt: Date.now(),
      });
    } finally {
      advancingRef.current = false;
    }
  };

  // ── Host: Start Game ───────────────────────────────────────────────────────
  const handleStartGame = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('gameStart');

    const nonHostPlayers = players.filter(p => p !== roomData.host);
    const shuffled = shuffle(nonHostPlayers);
    const livesMap = {};
    shuffled.forEach(p => { livesMap[p] = MAX_LIVES; });

    const catObj = getRandomCategories(1, [])[0];
    const newBombTime = randomBombTime();

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        category: catObj.category,
        categoryExamples: catObj.examples,
        currentTurnIndex: 0,
        turnOrder: shuffled,
        lives: livesMap,
        bombTime: newBombTime,
        turnStartedAt: Date.now(),
        usedCategories: [catObj.category],
        roundNumber: 1,
        eliminated: [],
      });
    } finally {
      advancingRef.current = false;
    }
  };

  // ── Host: Next Round / Category ────────────────────────────────────────────
  const handleNextCategory = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('newRound');

    const usedCats = gameData.usedCategories || [];
    const catObj = getRandomCategories(1, usedCats)[0];
    const survivors = turnOrder.filter(p => !eliminated.includes(p));
    const newBombTime = randomBombTime();

    const firstIdx = turnOrder.findIndex(p => survivors.includes(p));

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        category: catObj.category,
        categoryExamples: catObj.examples,
        currentTurnIndex: firstIdx >= 0 ? firstIdx : 0,
        bombTime: newBombTime,
        turnStartedAt: Date.now(),
        usedCategories: [...usedCats, catObj.category],
        roundNumber: (roundNumber || 1) + 1,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  // ── Host: Play Again ───────────────────────────────────────────────────────
  const handlePlayAgain = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('gameStart');

    const nonHostPlayers = players.filter(p => p !== roomData.host);
    const shuffled = shuffle(nonHostPlayers);
    const livesMap = {};
    shuffled.forEach(p => { livesMap[p] = MAX_LIVES; });
    const catObj = getRandomCategories(1, [])[0];
    const newBombTime = randomBombTime();

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        category: catObj.category,
        categoryExamples: catObj.examples,
        currentTurnIndex: 0,
        turnOrder: shuffled,
        lives: livesMap,
        bombTime: newBombTime,
        turnStartedAt: Date.now(),
        usedCategories: [catObj.category],
        roundNumber: 1,
        eliminated: [],
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const ErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
      {errorMsg}
    </div>
  ) : null;

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: WAITING
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in">
        <ErrorToast />
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-7xl select-none"
        >
          💣
        </motion.div>

        <div className="text-center">
          <h2 className="font-display font-bold text-[22px] text-olive-800 mb-1">บอมบ์คำ</h2>
          <p className="text-olive-400 text-[13px] leading-relaxed px-4">
            พูดคำตามหมวดก่อนบอมบ์ระเบิด! Host เป็นกรรมการตัดสิน
          </p>
        </div>

        <div className="card p-4 w-full max-w-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[12px] text-olive-500">
              <span>🎤</span>
              <span>ผู้เล่นพูดคำตอบดังๆ (ไม่ต้องพิมพ์)</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-olive-500">
              <span>👨‍⚖️</span>
              <span>Host เป็นกรรมการ ไม่ได้เล่น</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-olive-500">
              <span>💥</span>
              <span>บอมบ์ระเบิดเมื่อหมดเวลา → เสียชีวิต 1 ครั้ง</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-olive-500">
              <span>❤️</span>
              <span>เริ่มต้นด้วยชีวิต 3 ครั้ง</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-olive-500">
              <span>🏆</span>
              <span>อยู่รอดคนสุดท้าย = ผู้ชนะ</span>
            </div>
          </div>
        </div>

        <div className="card p-3 w-full max-w-xs">
          <p className="text-[11px] font-bold text-olive-500 mb-2">ผู้เล่น {players.length} คน</p>
          <div className="flex flex-wrap gap-1.5">
            {players.map(p => (
              <span key={p} className={`text-[12px] font-bold px-2.5 py-1 rounded-full ${
                p === roomData.host
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-sage-100 text-sage-700'
              }`}>
                {p === roomData.host ? '👨‍⚖️ ' : ''}{p}
              </span>
            ))}
          </div>
        </div>

        {isHost ? (
          <>
            <button
              onClick={handleStartGame}
              className="btn btn-primary py-3.5 px-8 text-[15px]"
              disabled={players.length < 3}
            >
              💣 เริ่มเกม!
            </button>
            {players.length < 3 && (
              <p className="text-center text-[11px] font-bold text-warm-500 bg-warm-50 border-2 border-warm-100 p-2.5 rounded-xl">
                ต้องมีอย่างน้อย 3 คน (Host + ผู้เล่น 2 คน)
              </p>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-olive-400">
            <span className="w-2.5 h-2.5 bg-sage-400 rounded-full animate-pulse-soft" />
            <span className="text-[13px] font-semibold">รอ Host เริ่มเกม...</span>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: FINISHED
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'finished') {
    const survivors = turnOrder.filter(p => !eliminated.includes(p));
    const winner = survivors[0] || null;
    const isWinner = winner === userNickname;

    return (
      <div className="flex-1 flex flex-col gap-4 py-4 animate-fade-in">
        <ErrorToast />
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className="text-5xl mb-2"
          >
            🏆
          </motion.div>
          <h2 className="font-display font-bold text-[22px] text-olive-800">จบเกม!</h2>
        </div>

        {winner && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="card p-5 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 text-center"
          >
            <Crown size={22} className="text-amber-500 mx-auto mb-2" />
            <p className="font-bold text-[14px] text-olive-600 mb-0.5">ผู้รอดชีวิต</p>
            <p className="font-display font-black text-[20px] text-olive-800">{winner}</p>
            {isWinner && (
              <span className="inline-block mt-2 text-[11px] font-extrabold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                🎉 นั่นคือคุณ!
              </span>
            )}
          </motion.div>
        )}

        {/* Final standings */}
        <div className="card p-4">
          <h3 className="font-bold text-[13px] text-olive-600 mb-3">💀 ลำดับการตกรอบ</h3>
          <div className="space-y-2">
            {[...turnOrder]
              .sort((a, b) => {
                const aElim = eliminated.indexOf(a);
                const bElim = eliminated.indexOf(b);
                if (aElim === -1 && bElim === -1) return 0;
                if (aElim === -1) return -1;
                if (bElim === -1) return 1;
                return aElim - bElim;
              })
              .map((name, idx) => {
                const isElim = eliminated.includes(name);
                const isThisWinner = name === winner;
                return (
                  <div
                    key={name}
                    className={`flex items-center gap-3 p-2.5 rounded-xl ${
                      isThisWinner
                        ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200'
                        : 'bg-olive-50/60'
                    }`}
                  >
                    <span className="text-xl w-7 text-center shrink-0">
                      {isThisWinner ? '🏆' : isElim ? '☠️' : '❤️'}
                    </span>
                    <span className="flex-1 font-bold text-[14px] text-olive-700">{name}</span>
                    <LivesRow count={lives[name] ?? 0} />
                    {name === userNickname && (
                      <span className="text-[9px] font-extrabold text-sage-600 bg-sage-100 px-1.5 py-0.5 rounded-md">คุณ</span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {isHost ? (
          <button onClick={handlePlayAgain} className="btn btn-primary w-full py-3.5 text-[15px]">
            <RotateCcw size={16} /> เล่นอีกรอบ
          </button>
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

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: ROUND END
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'roundEnd') {
    const survivors = turnOrder.filter(p => !eliminated.includes(p));
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 py-6 animate-fade-in">
        <ErrorToast />
        <div className="text-5xl">⏱️</div>
        <div className="text-center">
          <h2 className="font-display font-bold text-[20px] text-olive-800">จบรอบที่ {roundNumber}</h2>
          <p className="text-[13px] text-olive-400 mt-1">
            เหลือผู้เล่น {survivors.length} คน
          </p>
        </div>

        {/* Survivor chips */}
        <div className="flex flex-wrap gap-2 justify-center">
          {survivors.map(p => (
            <span key={p} className="flex items-center gap-1.5 bg-sage-100 text-sage-700 px-3 py-1.5 rounded-full text-[12px] font-bold">
              <span>❤️</span>{p}
            </span>
          ))}
        </div>

        {/* Eliminated */}
        {eliminated.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center">
            {eliminated.map(p => (
              <span key={p} className="flex items-center gap-1.5 bg-red-50 text-red-400 px-3 py-1.5 rounded-full text-[12px] font-bold border border-red-100">
                ☠️ {p}
              </span>
            ))}
          </div>
        )}

        {isHost ? (
          roundNumber >= MAX_ROUNDS || survivors.length <= 1 ? (
            <button
              onClick={async () => {
                if (advancingRef.current) return;
                advancingRef.current = true;
                try {
                  await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'finished' });
                  const winner = survivors[0] || null;
                  if (winner) await recordWin(roomId, winner, 'wordbomb');
                } finally {
                  advancingRef.current = false;
                }
              }}
              className="btn btn-primary py-3.5 px-8 text-[15px]"
            >
              🏆 ดูผลลัพธ์
            </button>
          ) : (
            <button onClick={handleNextCategory} className="btn btn-primary py-3.5 px-8 text-[15px]">
              🎲 หมวดถัดไป
            </button>
          )
        ) : (
          <div className="flex items-center gap-2 text-olive-400">
            <span className="w-2.5 h-2.5 bg-sage-400 rounded-full animate-pulse-soft" />
            <span className="text-[13px] font-semibold">รอ Host เลือกหมวดถัดไป...</span>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: PLAYING
  // ════════════════════════════════════════════════════════════════════════════
  const urgency = bombTime > 0 ? Math.max(0, 1 - timeLeft / bombTime) : 0;
  const timerPercent = bombTime > 0 ? Math.max(0, (timeLeft / bombTime) * 100) : 0;
  const timerColor =
    timerPercent > 50 ? 'bg-sage-400' :
    timerPercent > 25 ? 'bg-amber-400' :
    'bg-red-400';

  return (
    <div className="flex-1 flex flex-col gap-3">
      <ErrorToast />
      {/* ── Round badge + category ── */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-bold text-olive-400 bg-olive-50 px-2.5 py-1 rounded-full shrink-0">
          รอบ {roundNumber}/{MAX_ROUNDS}
        </span>
        <div className="flex-1 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={category}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <p className="font-display font-black text-[20px] text-olive-800 leading-tight">{category}</p>
              <p className="text-[11px] text-olive-400 mt-0.5">{categoryExamples}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <span className="text-[10px] font-bold text-sage-600 bg-sage-100 px-2.5 py-1 rounded-full shrink-0">
          {activePlayers.length} คน
        </span>
      </div>

      {/* ── Timer bar ── */}
      <div className="h-2 rounded-full bg-olive-100 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${timerColor} transition-colors duration-300`}
          animate={{ width: `${timerPercent}%` }}
          transition={{ duration: 0.15 }}
        />
      </div>

      {/* ── Bomb + timer number ── */}
      <div className="card p-4 flex flex-col items-center gap-3">
        <div className="relative w-24 h-24 flex-center">
          <TimerArc timeLeft={timeLeft} bombTime={bombTime} />
          <div className="relative z-10 flex flex-col items-center">
            <BombDisplay timeLeft={timeLeft} bombTime={bombTime} exploding={exploding} />
          </div>
        </div>
        <motion.span
          key={Math.ceil(timeLeft)}
          initial={{ scale: 1.3, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`font-display font-black text-[28px] leading-none tabular-nums ${
            timerPercent <= 25 ? 'text-red-500' :
            timerPercent <= 50 ? 'text-amber-500' :
            'text-olive-700'
          }`}
        >
          {Math.ceil(timeLeft)}
        </motion.span>
      </div>

      {/* ── Turn order chips ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {turnOrder.map((player, idx) => {
          const isActive = idx === currentTurnIndex && !eliminated.includes(player);
          const isEliminated = eliminated.includes(player);
          return (
            <motion.div
              key={player}
              layout
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold shrink-0 transition-all ${
                isEliminated
                  ? 'bg-red-50 text-red-300 border border-red-100 line-through'
                  : isActive
                  ? 'bg-sage-500 text-white shadow-md shadow-sage-200'
                  : 'bg-olive-50 text-olive-500'
              }`}
            >
              {isEliminated ? '☠️' : isActive ? '💣' : null}
              <span>{player}</span>
              {!isEliminated && (
                <span className="flex gap-0.5 ml-0.5">
                  {Array.from({ length: MAX_LIVES }).map((_, li) => (
                    <span key={li} className={`text-[8px] ${li < (lives[player] ?? MAX_LIVES) ? 'opacity-100' : 'opacity-20'}`}>
                      ❤️
                    </span>
                  ))}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── Host judge UI / Player UI ── */}
      <AnimatePresence mode="wait">
        {isHost ? (
          <motion.div
            key="host-judge"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="card p-4 border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50"
          >
            <p className="text-[12px] font-extrabold text-amber-700 mb-1 text-center">
              👨‍⚖️ คุณเป็นกรรมการ
            </p>
            <p className="text-[13px] text-olive-600 mb-3 text-center">
              ตาของ <span className="font-extrabold text-sage-600">{activePlayer}</span> — รอฟังคำตอบ
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={handleCorrectAnswer}
                className="btn flex-1 py-4 text-[15px] bg-green-500 text-white rounded-2xl font-bold active:scale-95"
              >
                ✅ ถูกต้อง
              </button>
              <button
                onClick={handleBombExplode}
                className="btn flex-1 py-4 text-[15px] bg-red-500 text-white rounded-2xl font-bold active:scale-95"
              >
                💥 ผิด/ซ้ำ
              </button>
            </div>
          </motion.div>
        ) : isMyTurn ? (
          <motion.div
            key="my-turn"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="card p-4 border-2 border-sage-300 bg-gradient-to-br from-sage-50 to-emerald-50"
          >
            <p className="text-[15px] font-extrabold text-sage-700 text-center mb-1">
              🎤 ตาคุณ! พูดคำที่อยู่ในหมวด "{category}" ให้เร็ว!
            </p>
            <p className="text-[12px] text-olive-500 text-center">
              พูดคำตอบดังๆ — Host จะเป็นคนตัดสิน
            </p>
          </motion.div>
        ) : (
          <motion.div
            key={`waiting-${activePlayer}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="card p-4 text-center"
          >
            <p className="text-[13px] text-olive-500">
              รอ <span className="font-extrabold text-sage-600">{activePlayer}</span> ตอบ...
            </p>
            <p className="text-[11px] text-olive-400 mt-1">พูดคำตอบดังๆ!</p>
            <div className="flex justify-center mt-2 gap-1">
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-sage-300"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Player lives summary (compact) ── */}
      <div className="card p-3">
        <p className="text-[10px] font-bold text-olive-400 mb-2">ชีวิตผู้เล่น</p>
        <div className="space-y-1.5">
          {turnOrder.map(player => {
            const isElim = eliminated.includes(player);
            const playerLives = lives[player] ?? MAX_LIVES;
            const isActive = player === activePlayer && !isElim;
            return (
              <div key={player} className={`flex items-center gap-2 ${isElim ? 'opacity-40' : ''}`}>
                <span className={`font-bold text-[12px] flex-1 truncate ${
                  isActive ? 'text-sage-600' : 'text-olive-600'
                }`}>
                  {isElim ? '☠️ ' : ''}{player}
                  {player === userNickname && (
                    <span className="ml-1 text-[9px] font-extrabold text-sage-600 bg-sage-100 px-1 py-0.5 rounded">คุณ</span>
                  )}
                </span>
                {isElim
                  ? <span className="text-[11px] text-red-300 font-bold">หมดชีวิต</span>
                  : <LivesRow count={playerLives} />
                }
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default WordBomb;
