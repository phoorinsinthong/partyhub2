import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { Crown, RotateCcw, LogOut } from 'lucide-react';
import { getRandomCategories } from './logic/wordBombData';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useTurnNotification } from '../hooks/useTurnNotification';
import { useGame } from '../contexts/GameContext';
import { useTranslation } from 'react-i18next';
import { useGameTimer } from '../hooks/useGameTimer';
import { TimerDisplay } from '../components/game-ui/TimerDisplay';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { feedback } from '../utils/feedback';

const MAX_LIVES = 3;

function randomBombTime() {
  return Math.floor(Math.random() * 16) + 10; // 10–25
}

function shuffle(arr: any[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getNextTurnIndex(currentIndex: number, turnOrder: string[], eliminated: string[]) {
  const total = turnOrder.length;
  let next = (currentIndex + 1) % total;
  for (let i = 0; i < total; i++) {
    if (!eliminated.includes(turnOrder[next])) return next;
    next = (next + 1) % total;
  }
  return next;
}

// ─── Lives display ───────────────────────────────────────────────────────────
function LivesRow({ count, max = MAX_LIVES }: { count: number, max?: number }) {
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
function BombDisplay({ timeLeft, bombTime, exploding }: { timeLeft: number, bombTime: number, exploding: boolean }) {
  const urgency = bombTime > 0 ? Math.max(0, 1 - timeLeft / bombTime) : 0;
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
function TimerArc({ timeLeft, bombTime }: { timeLeft: number, bombTime: number }) {
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
const WordBomb: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  
  if (!roomData) return null;
  const gameData = roomData.gameData || {};
  const players = Object.keys(roomData.players || {});

  const phase = gameData.phase || 'waiting';
  const category = gameData.category || '';
  const categoryExamples = gameData.categoryExamples || '';
  const currentTurnIndex = gameData.currentTurnIndex ?? 0;
  const turnOrder = gameData.turnOrder || [];
  const lives = gameData.lives || {};
  const bombTime = gameData.bombTime || 15;
  const eliminated = gameData.eliminated || [];
  const roundNumber = gameData.roundNumber || 1;

  const activePlayer = turnOrder[currentTurnIndex] || '';
  const isMyTurn = activePlayer === userNickname;

  useTurnNotification(isMyTurn, phase);

  const [exploding, setExploding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const explodedRef = useRef(false);
  const advancingRef = useRef(false);
  const personalRecordedRef = useRef(false);

  const safeUpdate = async (refPath: string, data: any) => {
    try {
      await update(ref(db, refPath), data);
    } catch {
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
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
  }, [phase, isHost, turnOrder, eliminated, userNickname]);

  // ── Handle bomb explode (active player loses a life) — host only writes ───
  const handleBombExplode = useCallback(async () => {
    if (!isHost || phase !== 'playing') return;
    if (advancingRef.current) return;
    advancingRef.current = true;

    const currentPlayer = turnOrder[currentTurnIndex] || '';
    const currentLives = lives[currentPlayer] ?? MAX_LIVES;
    const newLives = Math.max(0, currentLives - 1);
    const newLivesMap = { ...lives, [currentPlayer]: newLives };

    const newEliminated = [...eliminated];
    let newPhase = 'playing';

    if (newLives <= 0 && !newEliminated.includes(currentPlayer)) {
      newEliminated.push(currentPlayer);
    }

    const survivors = turnOrder.filter(p => !newEliminated.includes(p));
    if (survivors.length <= 1) {
      newPhase = 'finished';
    }

    const nextTurnIndex = getNextTurnIndex(currentTurnIndex, turnOrder, newEliminated);
    const newDuration = randomBombTime();

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        lives: newLivesMap,
        eliminated: newEliminated,
        phase: newPhase,
        currentTurnIndex: nextTurnIndex,
        bombTime: newDuration,
        timerEnd: Date.now() + (newDuration * 1000),
      });
      if (newPhase === 'finished') {
        const winner = survivors[0] || null;
        if (winner) await recordWin(roomId, winner, 'wordbomb');
      }
    } finally {
      advancingRef.current = false;
    }
  }, [isHost, phase, lives, turnOrder, currentTurnIndex, eliminated, roomId]);

  // ── Timer Hook ─────────────────────────────────────────────────────────────
  const { timeLeft } = useGameTimer(gameData.timerEnd, isHost ? handleBombExplode : null);

  useEffect(() => {
    if (phase !== 'playing') {
      setExploding(false);
      explodedRef.current = false;
      return;
    }

    if (timeLeft <= 5 && timeLeft > 0) {
      feedback('countdown');
    }

    if (timeLeft === 0 && !explodedRef.current) {
      explodedRef.current = true;
      setExploding(true);
      feedback('timeUp');
    }
  }, [timeLeft, phase]);

  // ── Handle correct answer (host advances turn) ────────────────────────────
  const handleCorrectAnswer = async () => {
    if (!isHost) return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    const nextIdx = getNextTurnIndex(currentTurnIndex, turnOrder, eliminated);
    const newDuration = randomBombTime();
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        currentTurnIndex: nextIdx,
        bombTime: newDuration,
        timerEnd: Date.now() + (newDuration * 1000),
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
    const livesMap: Record<string, number> = {};
    shuffled.forEach(p => { livesMap[p] = MAX_LIVES; });

    const catObj = getRandomCategories(1, [])[0];
    const newDuration = randomBombTime();

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        category: catObj.category,
        categoryExamples: catObj.examples,
        currentTurnIndex: 0,
        turnOrder: shuffled,
        lives: livesMap,
        bombTime: newDuration,
        timerEnd: Date.now() + (newDuration * 1000),
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
    const newDuration = randomBombTime();

    const firstIdx = turnOrder.findIndex(p => survivors.includes(p));

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        category: catObj.category,
        categoryExamples: catObj.examples,
        currentTurnIndex: firstIdx >= 0 ? firstIdx : 0,
        bombTime: newDuration,
        timerEnd: Date.now() + (newDuration * 1000),
        usedCategories: [...usedCats, catObj.category],
        roundNumber: (roundNumber || 1) + 1,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  const renderErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl animate-fade-in">
      {errorMsg}
    </div>
  ) : null;

  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in">
        <ErrorToast />
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-7xl select-none"
        >
          💣
        </motion.div>

        <div className="text-center">
          <h2 className="font-display font-bold text-[22px] text-olive-800 mb-1">{t('wordBomb.title') || 'บอมบ์คำ'}</h2>
          <p className="text-olive-400 text-[13px] leading-relaxed px-4">
            {t('wordBomb.description') || 'พูดคำตามหมวดก่อนบอมบ์ระเบิด! Host เป็นกรรมการตัดสิน'}
          </p>
        </div>

        {isHost ? (
          <button onClick={handleStartGame} className="btn btn-primary px-10 py-4 rounded-3xl text-lg shadow-lg">
            {t('wordBomb.startGame') || 'เริ่มเกมเลย!'}
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-sage-200 border-t-sage-500 rounded-full animate-spin" />
            <p className="text-olive-400 font-bold animate-pulse">{t('wordBomb.waitingHost') || 'รอ Host เริ่มเกม...'}</p>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'finished') {
    const survivors = turnOrder.filter(p => !eliminated.includes(p));
    const winner = survivors[0] || '???';

    return (
      <div className="flex-1 flex flex-center flex-col gap-6 animate-fade-in">
        <div className="text-7xl">🏆</div>
        <div className="text-center">
          <h2 className="font-display font-bold text-2xl text-olive-800">{t('common.finished') || 'จบเกม!'}</h2>
          <p className="text-olive-500 font-bold mt-1">{t('wordBomb.winnerIs', { name: winner }) || `ผู้ชนะคือ ${winner}`}</p>
        </div>
        {isHost && (
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={handleStartGame} className="btn btn-primary py-4 rounded-2xl">
              <RotateCcw size={18} /> {t('common.playAgain') || 'เล่นอีกรอบ'}
            </button>
            <button onClick={handleBackToLobby} className="btn btn-outline py-4 rounded-2xl">
              <LogOut size={18} /> {t('common.backToLobby') || 'กลับ Lobby'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col py-2 animate-fade-in">
      <ErrorToast />
      {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
      
      <div className="flex-between mb-4 px-1">
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-olive-300 uppercase tracking-widest leading-none mb-1">
            ROUND {roundNumber}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-olive-700">{category}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <TimerDisplay timeLeft={timeLeft} />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 py-4 relative">
        <div className="relative w-full flex-center perspective-1000">
          <TimerArc timeLeft={timeLeft} bombTime={bombTime} />
          <BombDisplay timeLeft={timeLeft} bombTime={bombTime} exploding={exploding} />
        </div>

        <div className="text-center px-6">
          <p className="text-[11px] font-bold text-olive-400 uppercase tracking-widest mb-1">{t('wordBomb.activePlayer') || 'ตาของ'}</p>
          <h3 className={`text-2xl font-black ${isMyTurn ? 'text-red-500 animate-pulse' : 'text-olive-800'}`}>
            {isMyTurn ? t('common.you') || 'คุณเอง!' : activePlayer}
          </h3>
          <p className="text-[12px] text-olive-400 mt-2 font-semibold">
            {t('wordBomb.examples') || 'เช่น'}: {categoryExamples}
          </p>
        </div>

        {isHost && (
          <div className="flex flex-col gap-3 w-full max-w-sm px-4">
            <button
              onClick={handleCorrectAnswer}
              className="btn btn-primary w-full py-4 rounded-3xl text-lg shadow-lg bg-green-500 border-green-500 active:bg-green-600"
            >
              ✅ {t('wordBomb.correct') || 'ตอบถูก! (เปลี่ยนคน)'}
            </button>
            <button
              onClick={handleNextCategory}
              className="btn btn-outline w-full py-3 rounded-2xl text-[13px] font-bold"
            >
              🔄 {t('wordBomb.changeCategory') || 'เปลี่ยนหมวดใหม่'}
            </button>
          </div>
        )}
      </div>

      <div className="mt-auto card p-4 bg-white/50 backdrop-blur-sm border-olive-50">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
          {turnOrder.map((p) => (
            <div key={p} className={`flex items-center justify-between gap-2 ${eliminated.includes(p) ? 'opacity-30 grayscale' : ''}`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${activePlayer === p ? 'bg-red-500 animate-pulse' : 'bg-olive-200'}`} />
                <span className="text-[12px] font-bold text-olive-700 truncate">{p === userNickname ? t('common.you') || 'คุณ' : p}</span>
              </div>
              <LivesRow count={lives[p] ?? MAX_LIVES} />
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <div className="mt-4 flex-center">
          <button onClick={handleBackToLobby} className="flex items-center gap-2 text-[12px] font-bold text-olive-300 hover:text-olive-500 transition-colors">
            <RotateCcw size={14} /> {t('common.backToLobby') || 'กลับ Lobby'}
          </button>
        </div>
      )}
    </div>
  );
};

export default WordBomb;
