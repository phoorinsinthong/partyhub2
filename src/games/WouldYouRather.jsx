import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, onValue } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { Play, Timer, Users, Trophy, RotateCcw, ChevronRight, Crown, LogOut } from 'lucide-react';
import { getShuffledWyrQuestions } from './wyrData';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { feedback } from '../utils/feedback';

const TOTAL_ROUNDS = 10;
const VOTE_TIME = 15;

const WouldYouRather = ({ roomId, roomData, userNickname }) => {
  const navigate = useNavigate();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const isHost = userNickname === roomData.host;
  const gameData = roomData.gameData || {};
  const players = Object.keys(roomData.players || {});

  const phase = gameData.phase || 'waiting'; // waiting | playing | results | finished
  const currentRound = gameData.currentRound || 0;
  const questions = gameData.questions || [];
  const votes = gameData.votes || {};
  const roundVotes = votes[currentRound] || {};
  const majorityScores = gameData.majorityScores || {};
  const questionStartedAt = gameData.questionStartedAt || 0;

  const [timeLeft, setTimeLeft] = useState(VOTE_TIME);
  const [myVote, setMyVote] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef(null);
  const revealingRef = useRef(false);
  const handleRevealRef = useRef(null);
  const lastCountdownRef = useRef(null);
  const personalRecordedRef = useRef(false);
  const voteRef = useRef(false);
  const nextRoundRef = useRef(false);
  const startRef = useRef(false);

  useEffect(() => {
    if (phase === 'waiting' || phase === 'playing') personalRecordedRef.current = false;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('wouldyourather');
    const sorted = Object.entries(majorityScores).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][0] === userNickname && sorted[0][1] > 0) {
      recordPersonalWin('wouldyourather');
    }
  }, [phase]);

  const question = questions[currentRound];

  // Reset action guards on round/phase change
  useEffect(() => {
    voteRef.current = false;
    nextRoundRef.current = false;
  }, [currentRound, phase]);

  // Sync local vote state with Firebase
  useEffect(() => {
    if (roundVotes[userNickname]) {
      setMyVote(roundVotes[userNickname]);
    } else {
      setMyVote(null);
    }
    revealingRef.current = false;
  }, [currentRound, roundVotes, userNickname]);

  // Timer countdown
  useEffect(() => {
    if (phase !== 'playing') return;
    if (!questionStartedAt) return;

    lastCountdownRef.current = null;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - questionStartedAt) / 1000);
      const remaining = Math.max(0, VOTE_TIME - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 5 && remaining > 0 && remaining !== lastCountdownRef.current) {
        lastCountdownRef.current = remaining;
        feedback('countdown');
      }

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        if (isHost) {
          handleRevealRef.current?.();
        }
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, questionStartedAt, currentRound]);

  // Check if all players voted
  useEffect(() => {
    if (phase !== 'playing') return;
    const votedCount = Object.keys(roundVotes).length;
    if (votedCount >= players.length && players.length > 0 && isHost) {
      clearInterval(timerRef.current);
      handleRevealRef.current?.();
    }
  }, [roundVotes, players.length, phase]);

  const safeUpdate = async (refPath, data) => {
    try {
      await update(ref(db, refPath), data);
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
      throw e;
    }
  };

  const ErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
      {errorMsg}
    </div>
  ) : null;

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!isHost) return;
    if (startRef.current) return;
    startRef.current = true;
    feedback('gameStart');

    const qs = getShuffledWyrQuestions(TOTAL_ROUNDS);
    const initScores = {};
    players.forEach((p) => { initScores[p] = 0; });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        questions: qs,
        currentRound: 0,
        votes: {},
        majorityScores: initScores,
        questionStartedAt: Date.now(),
      });
    } finally {
      startRef.current = false;
    }
  };

  const handleVote = async (choice) => {
    if (myVote) return;
    if (phase !== 'playing') return;
    if (voteRef.current) return;
    voteRef.current = true;

    feedback('tap');
    setMyVote(choice);

    try {
      await safeUpdate(`rooms/${roomId}/gameData/votes/${currentRound}`, {
        [userNickname]: choice,
      });
    } finally {
      voteRef.current = false;
    }
  };

  const handleRevealResults = useCallback(async () => {
    if (phase === 'results' || revealingRef.current) return;
    revealingRef.current = true;

    const currentVotes = votes[currentRound] || roundVotes;
    const voteCounts = { A: 0, B: 0 };
    Object.values(currentVotes).forEach((v) => {
      if (v === 'A') voteCounts.A++;
      else if (v === 'B') voteCounts.B++;
    });

    const majority = voteCounts.A >= voteCounts.B ? 'A' : 'B';
    const newScores = { ...majorityScores };

    Object.entries(currentVotes).forEach(([player, vote]) => {
      if (vote === majority) {
        newScores[player] = (newScores[player] || 0) + 1;
      }
    });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'results',
        majorityScores: newScores,
      });
      feedback('newRound');
    } finally {
      revealingRef.current = false;
    }
  }, [phase, currentRound, votes, roundVotes, majorityScores, roomId]);

  handleRevealRef.current = handleRevealResults;

  const handleNextRound = async () => {
    if (!isHost) return;
    if (nextRoundRef.current) return;
    nextRoundRef.current = true;

    try {
      if (currentRound + 1 >= TOTAL_ROUNDS) {
        await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'finished' });
        feedback('victory');
        const sortedScores = Object.entries(majorityScores).sort((a, b) => b[1] - a[1]);
        if (sortedScores.length > 0 && sortedScores[0][1] > 0) {
          await recordWin(roomId, sortedScores[0][0], 'wouldyourather');
        }
      } else {
        feedback('newRound');
        await safeUpdate(`rooms/${roomId}/gameData`, {
          phase: 'playing',
          currentRound: currentRound + 1,
          questionStartedAt: Date.now(),
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
        questions: [],
        currentRound: 0,
        votes: {},
        majorityScores: {},
        questionStartedAt: 0,
      });
    } finally {
      restartRef.current = false;
    }
  };

  // ─── Computed Values ───────────────────────────────────────────────────────

  const votedCount = Object.keys(roundVotes).length;
  const totalPlayers = players.length;

  const getVoteCounts = () => {
    const counts = { A: 0, B: 0 };
    Object.values(roundVotes).forEach((v) => {
      if (v === 'A') counts.A++;
      else if (v === 'B') counts.B++;
    });
    return counts;
  };

  const getPercentage = (count) => {
    if (votedCount === 0) return 0;
    return Math.round((count / votedCount) * 100);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  // Waiting phase
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
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-6xl"
          >
          </motion.div>

          <div className="text-center">
            <h2 className="text-xl font-extrabold text-olive-800 mb-2">
              เลือกข้าง
            </h2>
            <p className="text-sm text-olive-500 font-medium">
              Would You Rather? - เลือกสิ่งที่คุณอยากทำมากกว่า!
            </p>
          </div>

          <div className="card p-4 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-olive-500" />
              <span className="text-sm font-bold text-olive-600">
                ผู้เล่น ({totalPlayers} คน)
              </span>
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
              <li>- แต่ละรอบจะมีคำถาม "คุณจะเลือกอะไร?" 2 ตัวเลือก</li>
              <li>- มีเวลาโหวต 15 วินาทีต่อรอบ</li>
              <li>- ทั้งหมด {TOTAL_ROUNDS} รอบ</li>
              <li>- คนที่โหวตตรงกับเสียงส่วนใหญ่มากที่สุด = ชนะ!</li>
            </ul>
          </div>

          {isHost ? (
            <button
              className="btn btn-primary w-full max-w-sm py-4 text-base min-h-[52px]"
              onClick={handleStart}
            >
              <Play size={18} /> เริ่มเกม!
            </button>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-olive-400 font-bold animate-pulse">
                รอโฮสต์เริ่มเกม...
              </p>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Playing phase
  if (phase === 'playing' && question) {
    return (
      <div className="flex flex-col gap-4 pb-6 flex-1">
        <ErrorToast />
        {/* Top bar */}
        <div className="flex-between">
          <div className="inline-flex items-center gap-2 bg-cream-100 border-2 border-cream-200 rounded-full px-3.5 py-2">
            <span className="text-xs font-extrabold text-olive-600">
              รอบ {currentRound + 1}/{TOTAL_ROUNDS}
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

        {/* Category badge */}
        <div className="flex justify-center">
          <span className="px-3 py-1 bg-sage-100 border border-sage-200 rounded-full text-[11px] font-bold text-sage-700">
            {question.category}
          </span>
        </div>

        {/* Vote count */}
        <div className="text-center">
          <p className="text-xs text-olive-400 font-bold">
            โหวตแล้ว {votedCount}/{totalPlayers} คน
          </p>
        </div>

        {/* Question & Choices */}
        <div className="flex-1 flex flex-col justify-center gap-4">
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-lg font-extrabold text-olive-800 mb-2"
          >
            คุณจะเลือกอะไร?
          </motion.p>

          {/* Option A */}
          <motion.button
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => handleVote('A')}
            disabled={!!myVote}
            className={`w-full card p-5 border-2 text-left transition-all min-h-[80px] ${
              myVote === 'A'
                ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                : myVote
                  ? 'border-cream-200 bg-cream-50 opacity-60'
                  : 'border-blue-200 bg-gradient-to-r from-blue-50 to-white active:scale-[0.98] hover:border-blue-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-sm ${
                myVote === 'A' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'
              }`}>
                A
              </span>
              <p className="text-sm font-bold text-olive-800 leading-relaxed pt-1">
                {question.optionA}
              </p>
            </div>
          </motion.button>

          {/* VS divider */}
          <div className="flex items-center gap-3 px-4">
            <div className="flex-1 h-px bg-cream-200" />
            <span className="text-xs font-extrabold text-olive-400">หรือ</span>
            <div className="flex-1 h-px bg-cream-200" />
          </div>

          {/* Option B */}
          <motion.button
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => handleVote('B')}
            disabled={!!myVote}
            className={`w-full card p-5 border-2 text-left transition-all min-h-[80px] ${
              myVote === 'B'
                ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200'
                : myVote
                  ? 'border-cream-200 bg-cream-50 opacity-60'
                  : 'border-orange-200 bg-gradient-to-r from-orange-50 to-white active:scale-[0.98] hover:border-orange-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-sm ${
                myVote === 'B' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'
              }`}>
                B
              </span>
              <p className="text-sm font-bold text-olive-800 leading-relaxed pt-1">
                {question.optionB}
              </p>
            </div>
          </motion.button>

          {/* Voted confirmation */}
          {myVote && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-xs font-bold text-sage-600 mt-2"
            >
              โหวตแล้ว! รอผู้เล่นคนอื่น...
            </motion.p>
          )}
        </div>
      </div>
    );
  }

  // Results phase
  if (phase === 'results' && question) {
    const counts = getVoteCounts();
    const percentA = getPercentage(counts.A);
    const percentB = getPercentage(counts.B);
    const majority = counts.A >= counts.B ? 'A' : 'B';

    return (
      <div className="flex flex-col gap-4 pb-6 flex-1">
        <ErrorToast />
        {/* Top bar */}
        <div className="flex-between">
          <div className="inline-flex items-center gap-2 bg-cream-100 border-2 border-cream-200 rounded-full px-3.5 py-2">
            <span className="text-xs font-extrabold text-olive-600">
              รอบ {currentRound + 1}/{TOTAL_ROUNDS} - ผลโหวต
            </span>
          </div>
          {isHost && (
            <button className="btn btn-outline py-2 px-3 text-xs min-h-[40px]" onClick={handleRestart}>
              <RotateCcw size={13} /> เริ่มใหม่
            </button>
          )}
        </div>

        {/* Results content */}
        <div className="flex-1 flex flex-col justify-center gap-5">
          {/* Option A result */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`card p-4 border-2 ${majority === 'A' ? 'border-blue-300 bg-blue-50' : 'border-cream-200'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-extrabold">A</span>
                <span className="text-xs font-bold text-olive-700 line-clamp-1">{question.optionA}</span>
              </div>
              <div className="flex items-center gap-1">
                {majority === 'A' && <Crown size={12} className="text-amber-500" />}
                <span className="text-sm font-extrabold text-blue-600">{percentA}%</span>
              </div>
            </div>
            {/* Bar */}
            <div className="h-3 bg-cream-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentA}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full"
              />
            </div>
            <p className="text-[10px] text-olive-400 font-bold mt-1.5">
              {counts.A} คนเลือก
            </p>
          </motion.div>

          {/* Option B result */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className={`card p-4 border-2 ${majority === 'B' ? 'border-orange-300 bg-orange-50' : 'border-cream-200'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-extrabold">B</span>
                <span className="text-xs font-bold text-olive-700 line-clamp-1">{question.optionB}</span>
              </div>
              <div className="flex items-center gap-1">
                {majority === 'B' && <Crown size={12} className="text-amber-500" />}
                <span className="text-sm font-extrabold text-orange-600">{percentB}%</span>
              </div>
            </div>
            {/* Bar */}
            <div className="h-3 bg-cream-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentB}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full"
              />
            </div>
            <p className="text-[10px] text-olive-400 font-bold mt-1.5">
              {counts.B} คนเลือก
            </p>
          </motion.div>

          {/* Who voted what */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card p-3 border-2 border-cream-200"
          >
            <p className="text-[10px] text-olive-400 font-bold uppercase tracking-wider mb-2">ใครเลือกอะไร</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(roundVotes).map(([player, vote]) => (
                <span
                  key={player}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    vote === 'A'
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-orange-100 text-orange-700 border border-orange-200'
                  }`}
                >
                  {player === userNickname ? 'คุณ' : player} → {vote}
                </span>
              ))}
              {/* Show players who didn't vote */}
              {players.filter(p => !roundVotes[p]).map((player) => (
                <span
                  key={player}
                  className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-cream-100 text-olive-400 border border-cream-200"
                >
                  {player === userNickname ? 'คุณ' : player} (ไม่โหวต)
                </span>
              ))}
            </div>
          </motion.div>

          {/* Majority scores */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="card p-3 border-2 border-sage-200 bg-sage-50"
          >
            <p className="text-[10px] text-sage-700 font-bold uppercase tracking-wider mb-2">คะแนนเสียงข้างมาก</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(majorityScores)
                .sort((a, b) => b[1] - a[1])
                .map(([player, score], idx) => (
                  <div key={player} className="flex items-center gap-1.5">
                    {idx === 0 && <Crown size={11} className="text-amber-500" />}
                    <span className="text-xs font-bold text-olive-700">
                      {player === userNickname ? 'คุณ' : player}
                    </span>
                    <span className="text-xs font-extrabold text-sage-700 bg-sage-200 px-1.5 py-0.5 rounded">
                      {score}
                    </span>
                  </div>
                ))}
            </div>
          </motion.div>

          {/* Next button (host) */}
          {isHost && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="btn btn-primary w-full py-4 text-base min-h-[52px]"
              onClick={handleNextRound}
            >
              {currentRound + 1 >= TOTAL_ROUNDS ? (
                <>
                  <Trophy size={18} /> ดูผลลัพธ์สุดท้าย
                </>
              ) : (
                <>
                  <ChevronRight size={18} /> คำถามถัดไป
                </>
              )}
            </motion.button>
          )}

          {!isHost && (
            <p className="text-center text-xs text-olive-400 font-bold animate-pulse">
              รอโฮสต์กดคำถามถัดไป...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Finished phase
  if (phase === 'finished') {
    const sortedScores = Object.entries(majorityScores).sort((a, b) => b[1] - a[1]);
    const winner = sortedScores[0];

    return (
      <div className="flex flex-col gap-4 pb-6 flex-1">
        <ErrorToast />
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-5 flex-1 justify-center"
        >
          {/* Trophy animation */}
          <motion.div
            animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-6xl"
          >
          </motion.div>

          <div className="text-center">
            <h2 className="text-xl font-extrabold text-olive-800 mb-1">เกมจบแล้ว!</h2>
            <p className="text-sm text-olive-500 font-medium">
              คนที่โหวตตรงกับเสียงข้างมากมากที่สุดคือ...
            </p>
          </div>

          {/* Winner card */}
          {winner && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card p-5 w-full max-w-sm border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-white text-center"
            >
              <Crown size={28} className="text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-extrabold text-olive-800 mb-1">
                {winner[0] === userNickname ? 'คุณ!' : winner[0]}
              </p>
              <p className="text-sm text-olive-500 font-bold">
                เลือกตรงเสียงข้างมาก {winner[1]}/{TOTAL_ROUNDS} รอบ
              </p>
            </motion.div>
          )}

          {/* All scores */}
          <div className="card p-4 w-full max-w-sm border-2 border-cream-200">
            <p className="text-xs font-bold text-olive-500 mb-3 text-center">อันดับทั้งหมด</p>
            <div className="space-y-2">
              {sortedScores.map(([player, score], idx) => (
                <motion.div
                  key={player}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + idx * 0.1 }}
                  className={`flex items-center justify-between p-2.5 rounded-xl ${
                    idx === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-cream-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">
                      {idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : `#${idx + 1}`}
                    </span>
                    <span className="text-sm font-bold text-olive-700">
                      {player === userNickname ? `${player} (คุณ)` : player}
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-sage-700 bg-sage-100 px-2 py-1 rounded-lg">
                    {score}/{TOTAL_ROUNDS}
                  </span>
                </motion.div>
              ))}
            </div>
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

  // Fallback loading
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

export default WouldYouRather;
