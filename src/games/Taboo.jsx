import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, increment } from 'firebase/database';
import { db } from '../firebase';
import { Clock, Crown, SkipForward, EyeOff, LogOut, RotateCcw } from 'lucide-react';
import { getRandomCards } from './tabooData';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { feedback } from '../utils/feedback';

const ROUND_TIME = 60;
const MAX_SKIPS = 2;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const Taboo = ({ roomId, roomData, userNickname }) => {
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const isHost = userNickname === roomData.host;
  const gameData = roomData.gameData || {};
  const players = Object.keys(roomData.players || {});

  const phase = gameData.phase || 'waiting';
  const currentDescriberIndex = gameData.currentDescriberIndex ?? 0;
  const describerOrder = gameData.describerOrder || [];
  const currentCard = gameData.currentCard || null;
  const scores = gameData.scores || {};
  const roundStartedAt = gameData.roundStartedAt || 0;
  const round = gameData.round || 1;
  const totalRounds = gameData.totalRounds || players.length;
  const usedWords = gameData.usedWords || [];
  const skipsUsed = gameData.skipsUsed || 0;

  const currentDescriber = describerOrder[currentDescriberIndex] || '';
  const isDescriber = userNickname === currentDescriber;

  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [showGuesserPicker, setShowGuesserPicker] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cardMode, setCardMode] = useState('all');
  const timerRef = useRef(null);
  const lastCountdownRef = useRef(null);
  const advancingRef = useRef(false);
  const skipRef = useRef(false);
  const confirmRef = useRef(false);
  const correctGuessRef = useRef(false);
  const personalRecordedRef = useRef(false);
  const startGameRef = useRef(false);
  const playAgainRef2 = useRef(false);

  // Reset personal record on new game
  useEffect(() => {
    if (phase === 'waiting' || phase === 'choosing') {
      personalRecordedRef.current = false;
    }
  }, [phase]);

  // Record personal stats for all players when finished
  useEffect(() => {
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('taboo');
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][0] === userNickname && sorted[0][1] > 0) {
      recordPersonalWin('taboo');
    }
  }, [phase]);

  // ─── Timer ───
  useEffect(() => {
    if (phase !== 'playing' || !roundStartedAt) return;

    if (timerRef.current) clearInterval(timerRef.current);
    lastCountdownRef.current = null;

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - roundStartedAt) / 1000);
      const remaining = Math.max(0, ROUND_TIME - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 5 && remaining > 0 && remaining !== lastCountdownRef.current) {
        lastCountdownRef.current = remaining;
        feedback('countdown');
      }

      if (remaining === 0) {
        clearInterval(timerRef.current);
        if (isHost) handleTimeUp();
      }
    }, 500);

    return () => clearInterval(timerRef.current);
  }, [phase, roundStartedAt, isHost]);

  // Reset timer display and all guards when round/phase changes
  useEffect(() => {
    if (phase === 'playing') setTimeLeft(ROUND_TIME);
    advancingRef.current = false;
    skipRef.current = false;
    confirmRef.current = false;
    correctGuessRef.current = false;
    lastCountdownRef.current = null;
  }, [round, phase]);

  const ErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
      {errorMsg}
    </div>
  ) : null;

  // ─── Helpers ───
  const safeUpdate = async (path, data) => {
    try {
      await update(ref(db, path), data);
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
      throw e;
    }
  };

  // ─── Host: Start Game ───
  const handleStartGame = async () => {
    if (!isHost || startGameRef.current) return;
    startGameRef.current = true;
    feedback('gameStart');
    const order = shuffle(players);
    const initScores = {};
    players.forEach((p) => { initScores[p] = 0; });
    const [firstCard] = getRandomCards(1, [], cardMode);

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'choosing',
        describerOrder: order,
        currentDescriberIndex: 0,
        scores: initScores,
        round: 1,
        totalRounds: order.length,
        usedWords: [],
        currentCard: null,
        roundStartedAt: 0,
        skipsUsed: 0,
        previewCard: firstCard,
        correctGuesser: null,
        cardMode,
      });
    } finally {
      startGameRef.current = false;
    }
  };

  // ─── Describer: Skip card ───
  const handleSkip = async () => {
    if (!isDescriber || skipsUsed >= MAX_SKIPS || phase !== 'choosing') return;
    if (skipRef.current) return;
    skipRef.current = true;
    feedback('tap');
    try {
      const [newCard] = getRandomCards(1, usedWords, gameData.cardMode || 'all');
      await safeUpdate(`rooms/${roomId}/gameData`, {
        skipsUsed: skipsUsed + 1,
        previewCard: newCard,
      });
    } finally {
      skipRef.current = false;
    }
  };

  // ─── Describer: Confirm card, start round ───
  const handleConfirmCard = async () => {
    if (!isDescriber || phase !== 'choosing') return;
    if (confirmRef.current) return;
    confirmRef.current = true;
    feedback('gameStart');
    const card = gameData.previewCard;
    if (!card) { confirmRef.current = false; return; }

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        currentCard: card,
        roundStartedAt: Date.now(),
      });
    } finally {
      confirmRef.current = false;
    }
  };

  // ─── Describer: Handle correct guess ───
  const handleCorrectGuess = async (guesserName) => {
    if (!isDescriber || !currentCard) return;
    if (correctGuessRef.current) return;
    correctGuessRef.current = true;
    feedback('correctGuess');
    setShowGuesserPicker(false);

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        [`scores/${currentDescriber}`]: increment(3),
        [`scores/${guesserName}`]: increment(1),
        phase: 'roundEnd',
        roundResult: 'correct',
        roundEndedAt: Date.now(),
        correctGuesser: guesserName,
      });
    } finally {
      correctGuessRef.current = false;
    }
  };

  // ─── Host: Time up ───
  const handleTimeUp = async () => {
    if (!isHost) return;
    feedback('timeUp');

    await safeUpdate(`rooms/${roomId}/gameData`, {
      phase: 'roundEnd',
      roundResult: 'timeUp',
      roundEndedAt: Date.now(),
    });
  };

  // ─── Host: Advance to next round or finish ───
  const handleNextRound = useCallback(async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;

    const nextIndex = currentDescriberIndex + 1;
    const newUsedWords = currentCard ? [...usedWords, currentCard.word] : usedWords;

    try {
      if (nextIndex >= describerOrder.length) {
        const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        await safeUpdate(`rooms/${roomId}/gameData`, {
          phase: 'finished',
          usedWords: newUsedWords,
        });
        if (sortedScores.length > 0 && sortedScores[0][1] > 0) {
          await recordWin(roomId, sortedScores[0][0], 'taboo');
        }
      } else {
        feedback('newRound');
        const [nextCard] = getRandomCards(1, newUsedWords, gameData.cardMode || 'all');

        await safeUpdate(`rooms/${roomId}/gameData`, {
          phase: 'choosing',
          currentDescriberIndex: nextIndex,
          round: round + 1,
          currentCard: null,
          roundStartedAt: 0,
          skipsUsed: 0,
          usedWords: newUsedWords,
          previewCard: nextCard,
          roundResult: null,
          correctGuesser: null,
        });
      }
    } finally {
      advancingRef.current = false;
    }
  }, [isHost, currentDescriberIndex, describerOrder.length, scores, currentCard, usedWords, round, roomId]);

  // ─── Auto-advance after roundEnd (3s) ───
  useEffect(() => {
    if (phase !== 'roundEnd' || !isHost) return;
    const t = setTimeout(handleNextRound, 3500);
    return () => clearTimeout(t);
  }, [phase, isHost, handleNextRound]);

  // ─── Play Again ───
  const handlePlayAgain = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('gameStart');
    const order = shuffle(players);
    const initScores = {};
    players.forEach((p) => { initScores[p] = 0; });
    const [firstCard] = getRandomCards(1, [], cardMode);

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'choosing',
        describerOrder: order,
        currentDescriberIndex: 0,
        scores: initScores,
        round: 1,
        totalRounds: order.length,
        usedWords: [],
        currentCard: null,
        roundStartedAt: 0,
        skipsUsed: 0,
        previewCard: firstCard,
        roundResult: null,
        correctGuesser: null,
        cardMode,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  const timerPercent = (timeLeft / ROUND_TIME) * 100;
  const timerColor =
    timeLeft > 20 ? 'bg-sage-400' : timeLeft > 10 ? 'bg-amber-400' : 'bg-red-400';

  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  // ──────────────────────────────────────────────
  // PHASE: waiting
  // ──────────────────────────────────────────────
  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
        <ErrorToast />
        <motion.div
          className="text-6xl"
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
        >
          🤫
        </motion.div>
        <div className="text-center">
          <h2 className="font-display font-bold text-[22px] text-olive-800 mb-1">ใบ้คำ (Taboo)</h2>
          <p className="text-olive-400 text-[13px] max-w-xs leading-relaxed">
            อธิบายคำลับโดยห้ามพูดคำต้องห้าม ให้คนอื่นทาย!
          </p>
        </div>

        <div className="card p-4 w-full max-w-xs space-y-2">
          <div className="flex justify-between text-[12px]">
            <span className="text-olive-400 font-semibold">ผู้เล่น</span>
            <span className="font-bold text-olive-700">{players.length} คน</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-olive-400 font-semibold">เวลาต่อรอบ</span>
            <span className="font-bold text-olive-700">{ROUND_TIME} วินาที</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-olive-400 font-semibold">ข้ามการ์ดได้</span>
            <span className="font-bold text-olive-700">{MAX_SKIPS} ครั้ง/รอบ</span>
          </div>
          <hr className="border-olive-100" />
          <div className="text-[11px] text-olive-400 space-y-0.5">
            <p>🎯 ผู้อธิบาย +3 คะแนน (ทายถูก)</p>
            <p>✅ ผู้ทาย +1 คะแนน (ทายถูก)</p>
          </div>
        </div>

        {isHost ? (
          <>
            <div className="w-full max-w-xs">
              <p className="text-[11px] font-bold text-olive-500 mb-2 text-center">ชุดคำศัพท์</p>
              <div className="flex gap-2">
                {[
                  { id: 'all', label: '🎲 ทุกคำ' },
                  { id: 'normal', label: '📝 ปกติ' },
                  { id: 'funny', label: '🤪 ปั่นๆ ฮาๆ' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setCardMode(opt.id)}
                    className={`flex-1 py-2.5 rounded-2xl text-[12px] font-bold border-2 transition-colors ${
                      cardMode === opt.id
                        ? 'bg-sage-500 border-sage-500 text-white'
                        : 'bg-white border-olive-100 text-olive-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleStartGame}
              className="btn btn-primary py-3.5 px-8 text-[15px]"
              disabled={players.length < 2}
            >
              🚀 เริ่มเกม!
            </button>
            {players.length < 2 && (
              <p className="text-center text-[11px] font-bold text-warm-500 bg-warm-50 border-2 border-warm-100 p-2.5 rounded-xl">
                ต้องมีอย่างน้อย 2 คน
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

  // ──────────────────────────────────────────────
  // PHASE: finished
  // ──────────────────────────────────────────────
  if (phase === 'finished') {
    const winner = sortedScores[0];
    return (
      <div className="flex-1 flex flex-col gap-4 py-4">
        <ErrorToast />
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-center">
          <span className="text-5xl">🏆</span>
          <h2 className="font-display font-bold text-[20px] text-olive-800 mt-2">จบเกม!</h2>
        </div>

        {winner && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="card p-5 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 text-center"
          >
            <Crown size={26} className="text-amber-500 mx-auto mb-2" />
            <p className="font-bold text-[17px] text-olive-800">{winner[0]}</p>
            <p className="text-[24px] font-black text-amber-600">{winner[1]} คะแนน</p>
          </motion.div>
        )}

        <div className="card p-4">
          <h3 className="font-bold text-[13px] text-olive-600 mb-3">📊 คะแนนรวม</h3>
          <div className="space-y-2">
            {sortedScores.map(([name, score], idx) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.07 }}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-olive-50/60"
              >
                <span className="w-7 h-7 rounded-full bg-sage-100 flex-center text-[12px] font-black text-sage-700">
                  {idx + 1}
                </span>
                <span className="flex-1 font-bold text-[14px] text-olive-700">{name}</span>
                <span className="font-black text-[15px] text-sage-600">{score}</span>
                {name === userNickname && (
                  <span className="text-[9px] font-extrabold text-sage-600 bg-sage-100 px-1.5 py-0.5 rounded-md">คุณ</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {isHost ? (
          <div className="space-y-2">
            <button onClick={handlePlayAgain} className="btn btn-primary w-full py-3.5 text-[15px]">
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

  // ──────────────────────────────────────────────
  // PHASE: choosing — describer picks a card
  // ──────────────────────────────────────────────
  if (phase === 'choosing') {
    const card = gameData.previewCard;
    const skipsLeft = MAX_SKIPS - skipsUsed;

    if (isDescriber) {
      return (
        <div className="flex-1 flex flex-col gap-4 py-2">
          <ErrorToast />
          {/* Round info */}
          <div className="flex-between">
            <span className="text-[11px] font-bold text-olive-400 bg-olive-50 px-3 py-1.5 rounded-full">
              รอบ {round}/{totalRounds}
            </span>
            <span className="text-[11px] font-bold text-sage-600 bg-sage-100 px-3 py-1.5 rounded-full">
              คุณคืออธิบาย!
            </span>
          </div>

          <div className="text-center mb-1">
            <p className="text-[14px] text-olive-500 font-semibold">เลือกการ์ดของคุณ</p>
            <p className="text-[11px] text-olive-400 mt-0.5">ข้ามได้อีก {skipsLeft} ครั้ง</p>
          </div>

          {/* Card preview */}
          <AnimatePresence mode="wait">
            {card && (
              <motion.div
                key={card.word}
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -90, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="card p-6 text-center"
                style={{ perspective: 600 }}
              >
                {/* Secret word */}
                <p className="text-[11px] font-bold text-olive-400 mb-3 uppercase tracking-widest">คำลับ</p>
                <p className="font-display font-black text-[36px] text-olive-800 mb-5">
                  {card.word}
                </p>

                {/* Taboo words */}
                <p className="text-[10px] font-bold text-red-400 mb-2.5 uppercase tracking-wider">ห้ามพูด</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {(card.taboo || card.examples || []).map((w) => (
                    <span
                      key={w}
                      className="bg-red-50 border border-red-200 text-red-600 text-[12px] font-bold px-3 py-1.5 rounded-full"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-3 mt-auto">
            <button
              onClick={handleSkip}
              disabled={skipsLeft <= 0}
              className="btn btn-outline flex-1 py-3 text-[14px] flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <SkipForward size={16} />
              ข้าม ({skipsLeft})
            </button>
            <button
              onClick={handleConfirmCard}
              className="btn btn-primary flex-[2] py-3 text-[14px]"
            >
              เริ่มเลย!
            </button>
          </div>
        </div>
      );
    }

    // Non-describer waiting view
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 py-6">
        <ErrorToast />
        <motion.div
          className="text-5xl"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          🤔
        </motion.div>
        <div className="text-center">
          <p className="text-[13px] text-olive-400 font-semibold mb-1">รอบ {round}/{totalRounds}</p>
          <p className="font-bold text-[17px] text-olive-800">
            <span className="text-sage-600">{currentDescriber}</span> กำลังเลือกการ์ด...
          </p>
        </div>

        {/* Mini scores */}
        {Object.keys(scores).length > 0 && (
          <div className="card p-3 w-full max-w-xs">
            <p className="text-[10px] font-bold text-olive-400 mb-2 text-center">คะแนนปัจจุบัน</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {sortedScores.map(([name, score]) => (
                <div key={name} className="flex items-center gap-1.5 bg-olive-50 px-2.5 py-1 rounded-lg">
                  <span className="text-[11px] font-bold text-olive-600 max-w-[70px] truncate">{name}</span>
                  <span className="text-[12px] font-black text-sage-600">{score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // PHASE: roundEnd
  // ──────────────────────────────────────────────
  if (phase === 'roundEnd') {
    const correct = gameData.roundResult === 'correct';
    const correctGuesser = gameData.correctGuesser || null;

    return (
      <div className="flex-1 flex flex-col gap-4 py-4">
        <ErrorToast />
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <span className="text-5xl">{correct ? '🎉' : '⏰'}</span>
          <h3 className="font-display font-bold text-[18px] text-olive-800 mt-2">
            {correct ? 'ทายถูก!' : 'หมดเวลา!'}
          </h3>
          {correct && correctGuesser && (
            <p className="text-[13px] text-olive-500 mt-1">
              <span className="font-bold text-sage-600">{correctGuesser}</span> ทายถูก
            </p>
          )}
        </motion.div>

        {/* Reveal card */}
        {currentCard && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="card p-5 text-center"
          >
            <p className="text-[11px] font-bold text-olive-400 mb-2 uppercase tracking-widest">คำลับคือ</p>
            <p className="font-display font-black text-[32px] text-olive-800 mb-4">
              {currentCard.word}
            </p>
            <p className="text-[10px] font-bold text-red-400 mb-2 uppercase tracking-wider">คำต้องห้าม</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {(currentCard.taboo || currentCard.examples || []).map((w) => (
                <span key={w} className="bg-red-50 border border-red-200 text-red-600 text-[12px] font-bold px-3 py-1 rounded-full">
                  {w}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Scores */}
        <div className="card p-4">
          <h3 className="font-bold text-[12px] text-olive-600 mb-2.5">📊 คะแนนสะสม</h3>
          <div className="space-y-1.5">
            {sortedScores.map(([name, score], idx) => (
              <div key={name} className="flex items-center gap-2.5 p-2 rounded-xl bg-olive-50/60">
                <span className="text-[11px] font-black text-olive-400 w-4">{idx + 1}</span>
                <span className="flex-1 font-bold text-[13px] text-olive-700">{name}</span>
                <span className="font-black text-[14px] text-sage-600">{score}</span>
                {name === userNickname && (
                  <span className="text-[9px] font-bold text-sage-600 bg-sage-100 px-1.5 py-0.5 rounded">คุณ</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button onClick={handleNextRound} className="btn btn-primary w-full py-3 text-[14px]">
            {currentDescriberIndex + 1 >= describerOrder.length ? '🏆 ดูผลลัพธ์' : '➡️ รอบถัดไป'}
          </button>
        ) : (
          <div className="flex-center gap-2 text-olive-400 py-2">
            <span className="w-2 h-2 bg-sage-400 rounded-full animate-pulse-soft" />
            <span className="text-[12px] font-semibold">รอรอบถัดไป...</span>
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // PHASE: playing
  // ──────────────────────────────────────────────
  const nonDescribers = players.filter((p) => p !== currentDescriber);

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      <ErrorToast />
      {/* Round header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-olive-400 bg-olive-50 px-3 py-1.5 rounded-full">
          รอบ {round}/{totalRounds}
        </span>
        <span className="text-[12px] font-bold text-olive-600 text-center">
          <span className="text-sage-600">{currentDescriber}</span> กำลังอธิบาย
        </span>
        {/* Timer display */}
        <div className="flex items-center gap-1">
          <Clock size={13} className={timeLeft <= 10 ? 'text-red-500' : 'text-olive-400'} />
          <span className={`font-black text-[15px] ${timeLeft <= 10 ? 'text-red-500' : 'text-olive-700'}`}>
            {timeLeft}
          </span>
        </div>
      </div>

      {/* Timer bar */}
      <div className="h-2 rounded-full bg-olive-100 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${timerColor} transition-colors duration-500`}
          initial={{ width: '100%' }}
          animate={{ width: `${timerPercent}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* ─── Describer view ─── */}
      {isDescriber ? (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* The secret card */}
          <div className="card p-5 text-center">
            <p className="text-[10px] font-bold text-olive-400 mb-2 uppercase tracking-widest">คำลับของคุณ</p>
            <p className="font-display font-black text-[40px] text-olive-800 leading-none mb-5">
              {currentCard?.word}
            </p>
            <p className="text-[10px] font-bold text-red-400 mb-2.5 uppercase tracking-wider">ห้ามพูด</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {(currentCard?.taboo || currentCard?.examples || []).map((w) => (
                <span key={w} className="bg-red-50 border border-red-200 text-red-600 text-[12px] font-bold px-3 py-1.5 rounded-full">
                  {w}
                </span>
              ))}
            </div>
          </div>

          <div className="card p-3 bg-amber-50/60 border border-amber-100">
            <p className="text-[11px] text-amber-700 font-semibold text-center">
              💬 อธิบายให้เพื่อนทาย โดยห้ามพูดคำต้องห้าม!
            </p>
          </div>

          {/* Correct guess button */}
          <button
            onClick={() => setShowGuesserPicker(true)}
            className="btn btn-primary w-full py-4 text-[16px] mt-auto bg-emerald-500 hover:bg-emerald-600 border-emerald-600"
          >
            ✅ มีคนทายถูก!
          </button>

          {/* Guesser picker overlay */}
          <AnimatePresence>
            {showGuesserPicker && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
                onClick={() => setShowGuesserPicker(false)}
              >
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="card p-5 w-full max-w-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="font-display font-bold text-[16px] text-olive-800 text-center mb-1">ใครทายถูก?</p>
                  <p className="text-[12px] text-olive-400 text-center mb-4">เลือกคนที่ทายคำได้ถูกต้อง</p>
                  <div className="space-y-2.5">
                    {nonDescribers.map((name) => (
                      <button
                        key={name}
                        onClick={() => handleCorrectGuess(name)}
                        className="btn btn-outline w-full py-3 text-[14px] font-bold"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowGuesserPicker(false)}
                    className="w-full mt-4 text-[12px] font-semibold text-olive-400 py-2"
                  >
                    ยกเลิก
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* ─── Non-describer view ─── */
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          {/* Hidden word card */}
          <div className="card p-6 text-center w-full">
            <p className="text-[10px] font-bold text-olive-400 mb-3 uppercase tracking-widest">คำลับ</p>
            <p className="font-display font-black text-[52px] text-olive-200 leading-none select-none mb-4">
              ???
            </p>
            <p className="text-[10px] font-bold text-olive-300 mb-1 uppercase tracking-wider">คำต้องห้าม</p>
            <div className="flex items-center justify-center gap-1 text-olive-300">
              <EyeOff size={12} />
              <span className="text-[11px] font-semibold">เปิดเผยหลังรอบจบ</span>
            </div>
          </div>

          {/* Listening prompt */}
          <div className="card p-4 text-center w-full bg-sage-50/60 border border-sage-100">
            <p className="text-[28px] mb-2">👂</p>
            <p className="font-bold text-[14px] text-olive-700">ฟังคำอธิบาย แล้วตอบดังๆ!</p>
            <p className="text-[11px] text-olive-400 mt-1">ตะโกนคำตอบเมื่อคิดออก</p>
          </div>
        </div>
      )}

      {/* Mini score strip */}
      <div className="flex items-center gap-2 px-0.5 overflow-x-auto pb-0.5">
        {sortedScores.map(([name, score]) => (
          <div
            key={name}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg shrink-0 ${
              name === currentDescriber ? 'bg-sage-100 border border-sage-200' : 'bg-olive-50'
            }`}
          >
            {name === currentDescriber && <span className="text-[9px]">🎤</span>}
            <span className="text-[10px] font-bold text-olive-600 max-w-[64px] truncate">{name}</span>
            <span className="text-[11px] font-black text-sage-600">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Taboo;
