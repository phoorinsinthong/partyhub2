import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { Play, Timer, Users, Trophy, RotateCcw, ChevronRight, Skull, Heart, LogOut } from 'lucide-react';
import { useGameLeave } from '../hooks/useGameLeave';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { getRandomStatement } from './neverData';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { feedback } from '../utils/feedback';

const TOTAL_ROUNDS = 15;
const VOTE_TIME = 20;
const STARTING_LIVES = 5;

const NeverHaveIEver = ({ roomId, roomData, userNickname }) => {
  const navigate = useNavigate();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const isHost = userNickname === roomData.host;
  const gameData = roomData.gameData || {};
  const players = Object.keys(roomData.players || {});

  const phase = gameData.phase || 'waiting';
  const currentRound = gameData.currentRound || 0;
  const totalRounds = gameData.totalRounds || TOTAL_ROUNDS;
  const statement = gameData.statement || '';
  const usedStatements = gameData.usedStatements || [];
  const votes = gameData.votes || {};
  const lives = gameData.lives || {};
  const votingStartedAt = gameData.votingStartedAt || 0;
  const history = gameData.history || [];

  const [timeLeft, setTimeLeft] = useState(VOTE_TIME);
  const [myVote, setMyVote] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef(null);
  const revealingRef = useRef(false);
  const lastCountdownRef = useRef(null);
  const handleRevealRef = useRef(null);
  const voteSubmittingRef = useRef(false);
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

  useEffect(() => {
    if (phase === 'waiting' || phase === 'voting') personalRecordedRef.current = false;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('neverhaveiever');
    const sorted = Object.entries(lives).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][0] === userNickname && sorted[0][1] > 0) {
      recordPersonalWin('neverhaveiever');
    }
  }, [phase]);

  const votedCount = Object.keys(votes).length;
  const totalPlayers = players.length;

  const isEliminated = (player) => (lives[player] ?? STARTING_LIVES) <= 0;

  useEffect(() => {
    if (votes[userNickname]) {
      setMyVote(votes[userNickname]);
    } else {
      setMyVote(null);
    }
    revealingRef.current = false;
    voteSubmittingRef.current = false;
    setShowResults(false);
  }, [currentRound, statement]);

  useEffect(() => {
    if (phase !== 'playing') return;
    if (!votingStartedAt) return;

    lastCountdownRef.current = null;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - votingStartedAt) / 1000);
      const remaining = Math.max(0, VOTE_TIME - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 5 && remaining > 0 && remaining !== lastCountdownRef.current) {
        lastCountdownRef.current = remaining;
        feedback('countdown');
      }

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        if (isHost) handleRevealRef.current?.();
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, votingStartedAt, currentRound]);

  useEffect(() => {
    if (phase !== 'playing') return;
    if (votedCount >= totalPlayers && totalPlayers > 0 && isHost) {
      clearInterval(timerRef.current);
      handleRevealRef.current?.();
    }
  }, [votedCount, totalPlayers, phase]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const startRef = useRef(false);
  const handleStart = async () => {
    if (!isHost || startRef.current) return;
    startRef.current = true;
    feedback('gameStart');

    const initLives = {};
    players.forEach((p) => { initLives[p] = STARTING_LIVES; });
    const firstStatement = getRandomStatement([]);

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        currentRound: 0,
        totalRounds: TOTAL_ROUNDS,
        statement: firstStatement,
        usedStatements: [firstStatement],
        votes: {},
        lives: initLives,
        votingStartedAt: Date.now(),
        history: [],
      });
    } finally {
      startRef.current = false;
    }
  };

  const handleVote = async (choice) => {
    if (myVote) return;
    if (phase !== 'playing') return;
    if (voteSubmittingRef.current) return;
    voteSubmittingRef.current = true;

    feedback('tap');
    setMyVote(choice);

    try {
      await safeUpdate(`rooms/${roomId}/gameData/votes`, {
        [userNickname]: choice,
      });
    } finally {
      voteSubmittingRef.current = false;
    }
  };

  const handleRevealResults = useCallback(async () => {
    if (revealingRef.current) return;
    revealingRef.current = true;

    const currentVotes = gameData.votes || votes;
    const everPlayers = Object.entries(currentVotes)
      .filter(([, v]) => v === 'ever')
      .map(([p]) => p);

    const newLives = { ...lives };
    players.forEach((p) => {
      if (newLives[p] === undefined) newLives[p] = STARTING_LIVES;
    });
    everPlayers.forEach((p) => {
      if (newLives[p] > 0) {
        newLives[p] = Math.max(0, newLives[p] - 1);
      }
    });

    const newHistory = [...history, { statement, everPlayers }];

    feedback('success');

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'results',
        lives: newLives,
        history: newHistory,
      });
    } finally {
      revealingRef.current = false;
    }
  }, [gameData.votes, votes, lives, players, history, statement, roomId]);

  handleRevealRef.current = handleRevealResults;

  const nextRoundRef = useRef(false);
  const handleNextRound = async () => {
    if (!isHost || nextRoundRef.current) return;
    nextRoundRef.current = true;

    const nextRound = currentRound + 1;

    try {
      if (nextRound >= totalRounds) {
        await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'finished' });
        const sortedByLives = Object.entries(lives).sort((a, b) => b[1] - a[1]);
        if (sortedByLives.length > 0) {
          await recordWin(roomId, sortedByLives[0][0], 'neverhaveiever');
        }
        feedback('victory');
      } else {
        const nextStatement = getRandomStatement(usedStatements);
        feedback('newRound');

        await safeUpdate(`rooms/${roomId}/gameData`, {
          phase: 'playing',
          currentRound: nextRound,
          statement: nextStatement,
          usedStatements: [...usedStatements, nextStatement],
          votes: {},
          votingStartedAt: Date.now(),
        });
      }
    } finally {
      nextRoundRef.current = false;
    }
  };

  const restartRef = useRef(false);
  const handleRestart = async () => {
    if (!isHost || restartRef.current) return;
    restartRef.current = true;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'waiting',
        currentRound: 0,
        totalRounds: TOTAL_ROUNDS,
        statement: '',
        usedStatements: [],
        votes: {},
        lives: {},
        votingStartedAt: 0,
        history: [],
      });
    } finally {
      restartRef.current = false;
    }
  };

  // ─── Sub-components ────────────────────────────────────────────────────────

  const LivesDisplay = ({ player, count }) => {
    const eliminated = count <= 0;
    return (
      <div className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border-2 ${
        eliminated
          ? 'border-red-200 bg-red-50'
          : count <= 2
            ? 'border-warm-200 bg-warm-50'
            : 'border-cream-200 bg-cream-50'
      }`}>
        <span className={`text-[11px] font-extrabold truncate max-w-[64px] ${
          eliminated ? 'text-red-500' : 'text-olive-700'
        }`}>
          {player === userNickname ? 'คุณ' : player}
        </span>
        <div className="flex flex-wrap justify-center gap-0.5">
          {eliminated ? (
            <Skull size={14} className="text-red-400" />
          ) : (
            Array.from({ length: STARTING_LIVES }).map((_, i) => (
              <span key={i} className={`text-[11px] leading-none ${i < count ? 'opacity-100' : 'opacity-20'}`}>
                <Heart size={11} className="inline text-red-400" />
              </span>
            ))
          )}
        </div>
        {!eliminated && (
          <span className={`text-[10px] font-bold ${count <= 2 ? 'text-warm-600' : 'text-olive-400'}`}>
            {count}/{STARTING_LIVES}
          </span>
        )}
      </div>
    );
  };

  const ErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
      {errorMsg}
    </div>
  ) : null;

  // ─── Render: Waiting ───────────────────────────────────────────────────────

  if (phase === 'waiting') {
    return (
      <div className="flex flex-col gap-4 pb-6 flex-1">
        <ErrorToast />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6 flex-1 justify-center"
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-6xl"
          >
          </motion.div>

          <div className="text-center">
            <h2 className="text-xl font-extrabold text-olive-800 mb-2">ไม่เคย...</h2>
            <p className="text-sm text-olive-500 font-medium">Never Have I Ever — ใครเคยทำเสียชีวิต!</p>
          </div>

          <div className="card p-4 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-olive-500" />
              <span className="text-sm font-bold text-olive-600">ผู้เล่น ({totalPlayers} คน)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <span
                  key={p}
                  className="px-3 py-1.5 bg-cream-100 border border-cream-200 rounded-full text-xs font-bold text-olive-600"
                >
                  {p === userNickname ? `${p} (คุณ)` : p}
                </span>
              ))}
            </div>
          </div>

          <div className="card p-4 w-full max-w-sm bg-sage-50 border-2 border-sage-200">
            <p className="text-xs font-bold text-sage-700 mb-2">กติกา:</p>
            <ul className="text-xs text-sage-600 space-y-1">
              <li>- แต่ละรอบจะมีข้อความ "ไม่เคย [X]"</li>
              <li>- กด <strong>"เคย"</strong> ถ้าคุณเคยทำ → เสีย 1 ชีวิต</li>
              <li>- กด <strong>"ไม่เคย"</strong> ถ้าไม่เคย → ปลอดภัย</li>
              <li>- มีเวลาโหวต {VOTE_TIME} วินาที ต่อรอบ</li>
              <li>- ทั้งหมด {TOTAL_ROUNDS} รอบ ชีวิตเริ่มที่ {STARTING_LIVES}</li>
              <li>- คนที่เหลือชีวิตมากที่สุด = ชนะ!</li>
            </ul>
          </div>

          {isHost ? (
            <>
              <button
                className="btn btn-primary w-full max-w-sm py-4 text-base min-h-[52px]"
                onClick={handleStart}
                disabled={players.length < 2}
              >
                <Play size={18} /> เริ่มเกม!
              </button>
              {players.length < 2 && (
                <p className="text-center text-[11px] font-bold text-warm-500 bg-warm-50 border-2 border-warm-100 p-2.5 rounded-xl">
                  ต้องมีอย่างน้อย 2 คน
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-olive-400 font-bold animate-pulse">รอโฮสต์เริ่มเกม...</p>
          )}
        </motion.div>
      </div>
    );
  }

  // ─── Render: Playing ───────────────────────────────────────────────────────

  if (phase === 'playing') {
    return (
      <div className="flex flex-col gap-4 pb-6 flex-1">
        <ErrorToast />
        {/* Top bar */}
        <div className="flex-between">
          <div className="inline-flex items-center gap-2 bg-cream-100 border-2 border-cream-200 rounded-full px-3.5 py-2">
            <span className="text-xs font-extrabold text-olive-600">
              รอบ {currentRound + 1}/{totalRounds}
            </span>
          </div>
          <div className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border-2 ${
            timeLeft <= 5 ? 'bg-red-50 border-red-200' : 'bg-cream-100 border-cream-200'
          }`}>
            <Timer size={13} className={timeLeft <= 5 ? 'text-red-500' : 'text-olive-500'} />
            <span className={`text-xs font-extrabold ${timeLeft <= 5 ? 'text-red-600' : 'text-olive-600'}`}>
              {timeLeft}s
            </span>
          </div>
        </div>

        {/* Lives row */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
          {players.map((p) => (
            <div key={p} className="shrink-0">
              <LivesDisplay player={p} count={lives[p] ?? STARTING_LIVES} />
            </div>
          ))}
        </div>

        {/* Statement card */}
        <div className="flex-1 flex flex-col justify-center gap-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={statement}
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="card p-6 border-2 border-sage-200 bg-gradient-to-b from-sage-50 to-white text-center"
            >
              <p className="text-[11px] font-bold text-sage-500 uppercase tracking-wider mb-3">ไม่เคย...</p>
              <p className="text-xl font-extrabold text-olive-800 leading-snug">{statement}</p>
            </motion.div>
          </AnimatePresence>

          {/* Vote count */}
          <p className="text-center text-xs text-olive-400 font-bold">
            โหวตแล้ว {votedCount}/{totalPlayers} คน
          </p>

          {/* Voting buttons */}
          {!myVote ? (
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => handleVote('ever')}
                className="card p-5 flex flex-col items-center gap-2 border-2 border-warm-200 bg-gradient-to-b from-warm-50 to-white active:scale-[0.97] transition-transform"
              >
                <span className="text-4xl"></span>
                <span className="font-extrabold text-warm-700 text-base">เคย</span>
                <span className="text-[10px] text-olive-400 font-semibold">-1 ชีวิต</span>
              </motion.button>

              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                onClick={() => handleVote('never')}
                className="card p-5 flex flex-col items-center gap-2 border-2 border-sage-200 bg-gradient-to-b from-sage-50 to-white active:scale-[0.97] transition-transform"
              >
                <span className="text-4xl"></span>
                <span className="font-extrabold text-sage-700 text-base">ไม่เคย</span>
                <span className="text-[10px] text-olive-400 font-semibold">ปลอดภัย</span>
              </motion.button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`card p-4 border-2 text-center ${
                myVote === 'ever'
                  ? 'border-warm-200 bg-warm-50'
                  : 'border-sage-200 bg-sage-50'
              }`}
            >
              <p className="text-2xl mb-1">{myVote === 'ever' ? '' : ''}</p>
              <p className={`text-sm font-extrabold ${myVote === 'ever' ? 'text-warm-700' : 'text-sage-700'}`}>
                คุณโหวต{myVote === 'ever' ? '"เคย"' : '"ไม่เคย"'}
              </p>
              <p className="text-xs text-olive-400 font-bold mt-1 animate-pulse">
                รอผู้เล่นคนอื่น...
              </p>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  // ─── Render: Results ───────────────────────────────────────────────────────

  if (phase === 'results') {
    const everPlayers = Object.entries(votes).filter(([, v]) => v === 'ever').map(([p]) => p);
    const neverPlayers = Object.entries(votes).filter(([, v]) => v === 'never').map(([p]) => p);
    const noVotePlayers = players.filter((p) => !votes[p]);

    return (
      <div className="flex flex-col gap-4 pb-6 flex-1">
        <ErrorToast />
        {/* Top bar */}
        <div className="flex-between">
          <div className="inline-flex items-center gap-2 bg-cream-100 border-2 border-cream-200 rounded-full px-3.5 py-2">
            <span className="text-xs font-extrabold text-olive-600">
              รอบ {currentRound + 1}/{totalRounds} — ผลโหวต
            </span>
          </div>
          {isHost && (
            <button className="btn btn-outline py-2 px-3 text-xs min-h-[40px]" onClick={handleRestart}>
              <RotateCcw size={13} /> เริ่มใหม่
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-center gap-4">
          {/* Statement recap */}
          <div className="card p-4 border-2 border-sage-200 bg-sage-50 text-center">
            <p className="text-[10px] font-bold text-sage-500 uppercase tracking-wider mb-1">ไม่เคย...</p>
            <p className="text-sm font-bold text-olive-800 leading-snug">{statement}</p>
          </div>

          {/* Voted "เคย" */}
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            className="card p-4 border-2 border-warm-200 bg-warm-50"
          >
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-base"></span>
              <p className="text-xs font-extrabold text-warm-700">เคย ({everPlayers.length} คน) — เสีย 1 ชีวิต</p>
            </div>
            {everPlayers.length === 0 ? (
              <p className="text-[11px] text-olive-400 font-semibold">ไม่มีใครโหวตเคย</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {everPlayers.map((p) => (
                  <span
                    key={p}
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-warm-100 text-warm-700 border border-warm-200"
                  >
                    {p === userNickname ? 'คุณ' : p}
                  </span>
                ))}
              </div>
            )}
          </motion.div>

          {/* Voted "ไม่เคย" */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-4 border-2 border-sage-200 bg-sage-50"
          >
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-base"></span>
              <p className="text-xs font-extrabold text-sage-700">ไม่เคย ({neverPlayers.length} คน) — ปลอดภัย</p>
            </div>
            {neverPlayers.length === 0 ? (
              <p className="text-[11px] text-olive-400 font-semibold">ไม่มีใครโหวตไม่เคย</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {neverPlayers.map((p) => (
                  <span
                    key={p}
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sage-100 text-sage-700 border border-sage-200"
                  >
                    {p === userNickname ? 'คุณ' : p}
                  </span>
                ))}
              </div>
            )}
          </motion.div>

          {/* Didn't vote */}
          {noVotePlayers.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="card p-3 border-2 border-cream-200"
            >
              <div className="flex flex-wrap gap-1.5">
                {noVotePlayers.map((p) => (
                  <span
                    key={p}
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-cream-100 text-olive-400 border border-cream-200"
                  >
                    {p === userNickname ? 'คุณ' : p} (หมดเวลา)
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Current lives */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card p-3 border-2 border-cream-200"
          >
            <p className="text-[10px] text-olive-400 font-bold uppercase tracking-wider mb-2.5">ชีวิตที่เหลือ</p>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
              {players
                .slice()
                .sort((a, b) => (lives[b] ?? STARTING_LIVES) - (lives[a] ?? STARTING_LIVES))
                .map((p) => (
                  <div key={p} className="shrink-0">
                    <LivesDisplay player={p} count={lives[p] ?? STARTING_LIVES} />
                  </div>
                ))}
            </div>
          </motion.div>

          {/* Next / Finish */}
          {isHost && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="btn btn-primary w-full py-4 text-base min-h-[52px]"
              onClick={handleNextRound}
            >
              {currentRound + 1 >= totalRounds ? (
                <><Trophy size={18} /> ดูผลลัพธ์สุดท้าย</>
              ) : (
                <><ChevronRight size={18} /> ข้อถัดไป</>
              )}
            </motion.button>
          )}

          {!isHost && (
            <p className="text-center text-xs text-olive-400 font-bold animate-pulse">
              รอโฮสต์กดข้อถัดไป...
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── Render: Finished ──────────────────────────────────────────────────────

  if (phase === 'finished') {
    const sorted = Object.entries(lives)
      .sort((a, b) => b[1] - a[1]);
    const winner = sorted[0];
    const survivors = sorted.filter(([, l]) => l > 0);
    const eliminated = sorted.filter(([, l]) => l <= 0);

    return (
      <div className="flex flex-col gap-4 pb-6 flex-1">
        <ErrorToast />
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-5 flex-1 justify-center"
        >
          <motion.div
            animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-6xl"
          >
          </motion.div>

          <div className="text-center">
            <h2 className="text-xl font-extrabold text-olive-800 mb-1">เกมจบแล้ว!</h2>
            <p className="text-sm text-olive-500 font-medium">
              คนที่เหลือชีวิตมากที่สุดคือ...
            </p>
          </div>

          {winner && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card p-5 w-full max-w-sm border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-white text-center"
            >
              <Trophy size={28} className="text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-extrabold text-olive-800 mb-1">
                {winner[0] === userNickname ? 'คุณ!' : winner[0]}
              </p>
              <div className="flex justify-center gap-0.5 my-1">
                {Array.from({ length: winner[1] }).map((_, i) => (
                  <span key={i} className="text-base"><Heart size={14} className="inline text-red-400" /></span>
                ))}
              </div>
              <p className="text-sm text-olive-500 font-bold">
                เหลือ {winner[1]}/{STARTING_LIVES} ชีวิต
              </p>
            </motion.div>
          )}

          {/* Full scoreboard */}
          <div className="card p-4 w-full max-w-sm border-2 border-cream-200">
            <p className="text-xs font-bold text-olive-500 mb-3 text-center">อันดับทั้งหมด</p>
            <div className="space-y-2">
              {sorted.map(([player, life], idx) => {
                const dead = life <= 0;
                return (
                  <motion.div
                    key={player}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + idx * 0.08 }}
                    className={`flex items-center justify-between p-2.5 rounded-xl ${
                      idx === 0 ? 'bg-amber-50 border border-amber-200'
                        : dead ? 'bg-red-50 border border-red-100'
                        : 'bg-cream-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">
                        {dead ? 'X' : idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `#${idx + 1}`}
                      </span>
                      <span className={`text-sm font-bold ${dead ? 'text-red-500' : 'text-olive-700'}`}>
                        {player === userNickname ? `${player} (คุณ)` : player}
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      {dead ? (
                        <Skull size={14} className="text-red-400" />
                      ) : (
                        Array.from({ length: STARTING_LIVES }).map((_, i) => (
                          <span key={i} className={`text-[11px] ${i < life ? 'opacity-100' : 'opacity-15'}`}><Heart size={11} className="inline text-red-400" /></span>
                        ))
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {survivors.length > 0 && (
              <p className="text-[10px] text-sage-600 font-bold text-center mt-3">
                รอดมา {survivors.length} คน · ตกรอบ {eliminated.length} คน
              </p>
            )}
          </div>

          {isHost ? (
            <button
              className="btn btn-primary w-full max-w-sm py-4 text-base min-h-[52px]"
              onClick={handleRestart}
            >
              <RotateCcw size={18} /> เล่นอีกครั้ง
            </button>
          ) : (
            <button
              className="btn btn-outline w-full max-w-sm py-3.5 text-[14px]"
              onClick={requestLeave}
            >
              <LogOut size={15} /> ออกจากห้อง
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  // ─── Fallback ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3">
      <ErrorToast />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 border-3 border-sage-200 border-t-sage-500 rounded-full"
      />
      <p className="text-sm text-olive-400 font-bold">กำลังโหลด...</p>
    </div>
  );
};

export default NeverHaveIEver;
