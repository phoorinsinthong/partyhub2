import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, increment } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { Trophy, Clock, RotateCcw, Crown, LogOut, Play, Send } from 'lucide-react';
import { generateRound } from './mathRaceData';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { feedback } from '../utils/feedback';

const QUESTION_TIME = 15;
const TOTAL_QUESTIONS = 10;
const AUTO_ADVANCE_DELAY = 3000;

const MathRace = ({ roomId, roomData, userNickname }) => {
  const navigate = useNavigate();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const isHost = userNickname === roomData.host;
  const gameData = roomData.gameData || {};
  const players = Object.keys(roomData.players || {});

  const phase = gameData.phase || 'waiting';
  const difficulty = gameData.difficulty || 'easy';
  const questions = gameData.questions || [];
  const currentQuestion = gameData.currentQuestion || 0;
  const questionStartedAt = gameData.questionStartedAt || 0;
  const answers = gameData.answers || {};
  const scores = gameData.scores || {};

  const [selectedDifficulty, setSelectedDifficulty] = useState('easy');
  const [inputValue, setInputValue] = useState('');
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);
  const autoAdvanceRef = useRef(null);
  const advancingRef = useRef(false);
  const answerSubmittingRef = useRef(false);
  const startRef = useRef(false);
  const replayRef = useRef(false);
  const lastCountdownRef = useRef(null);
  const personalRecordedRef = useRef(false);

  useEffect(() => {
    if (phase === 'waiting' || phase === 'playing') personalRecordedRef.current = false;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('mathrace');
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][0] === userNickname && sorted[0][1] > 0) {
      recordPersonalWin('mathrace');
    }
  }, [phase]);

  // Check if current user already answered this question
  const myAnswer = answers[currentQuestion]?.[userNickname];
  const alreadyAnswered = !!myAnswer;

  // Reset input when question changes
  useEffect(() => {
    setInputValue('');
    setHasAnswered(alreadyAnswered);
  }, [currentQuestion, alreadyAnswered]);

  // Timer
  useEffect(() => {
    if (phase !== 'playing' || !questionStartedAt) return;
    lastCountdownRef.current = null;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - questionStartedAt) / 1000);
      const remaining = Math.max(0, QUESTION_TIME - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 5 && remaining > 0 && remaining !== lastCountdownRef.current) {
        lastCountdownRef.current = remaining;
        feedback('countdown');
      }
      if (remaining === 0) {
        feedback('timeUp');
        clearInterval(interval);
        if (isHost) handleTimeUp();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [phase, questionStartedAt, currentQuestion]);

  // Reset guards when question/phase changes
  useEffect(() => {
    advancingRef.current = false;
    answerSubmittingRef.current = false;
  }, [currentQuestion, phase]);

  // Auto-advance from results phase
  useEffect(() => {
    if (phase !== 'results') return;
    autoAdvanceRef.current = setTimeout(() => {
      if (isHost) advanceToNext();
    }, AUTO_ADVANCE_DELAY);
    return () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); };
  }, [phase, currentQuestion]);

  // Focus input when playing
  useEffect(() => {
    if (phase === 'playing' && !hasAnswered && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [phase, currentQuestion, hasAnswered]);

  const safeUpdate = async (path, data) => {
    try {
      await update(ref(db, path), data);
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
      throw e;
    }
  };

  // ─── Host Actions ───

  const handleStart = async () => {
    if (!isHost || players.length < 2 || startRef.current) return;
    startRef.current = true;
    feedback('gameStart');
    const roundQuestions = generateRound(selectedDifficulty, TOTAL_QUESTIONS);
    const initialScores = {};
    players.forEach(p => { initialScores[p] = 0; });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        difficulty: selectedDifficulty,
        questions: roundQuestions,
        currentQuestion: 0,
        questionStartedAt: Date.now(),
        answers: {},
        scores: initialScores,
      });
    } finally {
      startRef.current = false;
    }
  };

  const handleTimeUp = async () => {
    await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'results' });
  };

  const advanceToNext = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    const nextQ = currentQuestion + 1;
    try {
      if (nextQ >= questions.length) {
        await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'finished' });
        const sortedPlayers = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const winner = sortedPlayers[0];
        if (winner && winner[1] > 0) {
          await recordWin(roomId, winner[0], 'mathrace');
        }
        feedback('victory');
      } else {
        feedback('newRound');
        await safeUpdate(`rooms/${roomId}/gameData`, {
          phase: 'playing',
          currentQuestion: nextQ,
          questionStartedAt: Date.now(),
        });
      }
    } finally {
      advancingRef.current = false;
    }
  };

  const handleReplay = async () => {
    if (!isHost || replayRef.current) return;
    replayRef.current = true;
    const roundQuestions = generateRound(difficulty, TOTAL_QUESTIONS);
    const initialScores = {};
    players.forEach(p => { initialScores[p] = 0; });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        questions: roundQuestions,
        currentQuestion: 0,
        questionStartedAt: Date.now(),
        answers: {},
        scores: initialScores,
      });
      feedback('gameStart');
    } finally {
      replayRef.current = false;
    }
  };

  // ─── Player Actions ───

  const handleSubmitAnswer = async () => {
    if (hasAnswered || alreadyAnswered || phase !== 'playing') return;
    if (answerSubmittingRef.current) return;
    const numAnswer = parseInt(inputValue, 10);
    if (isNaN(numAnswer)) return;
    answerSubmittingRef.current = true;

    const elapsed = Math.floor((Date.now() - questionStartedAt) / 1000);
    const timeTaken = Math.min(elapsed, QUESTION_TIME);
    const correctAnswer = questions[currentQuestion]?.answer;
    const isCorrect = numAnswer === correctAnswer;
    const points = isCorrect ? Math.max(1, QUESTION_TIME - timeTaken) : 0;

    if (isCorrect) feedback('correctGuess');

    try {
      setHasAnswered(true);

      await safeUpdate(`rooms/${roomId}/gameData/answers/${currentQuestion}/${userNickname}`, {
        answer: numAnswer,
        correct: isCorrect,
        points,
        answeredAt: Date.now(),
      });

      await safeUpdate(`rooms/${roomId}/gameData/scores`, { [userNickname]: increment(points) });

      const existingAnswers = Object.keys(answers[currentQuestion] || {});
      const totalAnswered = existingAnswers.includes(userNickname)
        ? existingAnswers.length
        : existingAnswers.length + 1;
      if (totalAnswered >= players.length && isHost) {
        await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'results' });
      }
    } finally {
      answerSubmittingRef.current = false;
    }
  };

  const handleLeave = () => {
    requestLeave();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  // ─── Computed Values ───
  const currentQ = questions[currentQuestion];
  const answeredThisRound = Object.keys(answers[currentQuestion] || {});
  const answeredCount = answeredThisRound.length;
  const timerPercent = (timeLeft / QUESTION_TIME) * 100;
  const timerColor = timeLeft > 10 ? 'bg-sage-400' : timeLeft > 5 ? 'bg-amber-400' : 'bg-red-400';

  // Sort scores for display
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  // ─── Waiting Phase ───
  if (phase === 'waiting') {
    return (
      <div className="flex flex-col flex-1 gap-4">
        <div className="card p-5 text-center">
          <span className="text-4xl mb-2 block"></span>
          <h2 className="font-display font-bold text-[17px] text-olive-800 mb-1">คำนวณเร็ว</h2>
          <p className="text-olive-400 text-[13px]">ตอบโจทย์คณิตให้เร็วที่สุด!</p>
        </div>

        {/* Difficulty Selector */}
        {isHost && (
          <div className="card p-4">
            <h3 className="text-[11px] font-bold text-olive-400 uppercase tracking-wider mb-3">ระดับความยาก</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'easy', label: 'ง่าย', emoji: '' },
                { key: 'medium', label: 'กลาง', emoji: '' },
                { key: 'hard', label: 'ยาก', emoji: '' },
              ].map(d => (
                <button
                  key={d.key}
                  onClick={() => setSelectedDifficulty(d.key)}
                  className={`rounded-2xl p-3 flex flex-col items-center gap-1 border-2 transition-all active:scale-95 ${
                    selectedDifficulty === d.key
                      ? 'bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200 shadow-sm'
                      : 'bg-white border-transparent'
                  }`}
                >
                  <span className="text-2xl">{d.emoji}</span>
                  <span className="font-bold text-[12px] text-olive-700">{d.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Player List */}
        <div className="card p-4">
          <h3 className="text-[11px] font-bold text-olive-400 uppercase tracking-wider mb-2">
            ผู้เล่น ({players.length} คน)
          </h3>
          <div className="flex flex-wrap gap-2">
            {players.map(p => (
              <span key={p} className="px-3 py-1.5 rounded-xl bg-sage-50 border border-sage-100 text-[12px] font-bold text-olive-700">
                {p === roomData.host && <Crown size={10} className="inline mr-1 text-amber-500" />}
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Start Button (Host) */}
        {isHost ? (
          <div className="mt-auto pt-2">
            <button
              className="btn btn-primary w-full py-4 text-[16px]"
              onClick={handleStart}
              disabled={players.length < 2}
            >
              <Play size={18} fill="currentColor" />
              เริ่มเกม!
            </button>
            {players.length < 2 && (
              <p className="text-center text-[11px] font-bold text-warm-500 bg-warm-50 border-2 border-warm-100 p-2.5 rounded-xl mt-2.5">
                ต้องมีอย่างน้อย 2 คน
              </p>
            )}
          </div>
        ) : (
          <div className="card flex-center flex-col gap-3 p-6">
            <span className="text-3xl animate-bounce-soft"></span>
            <p className="text-olive-400 text-[13px] font-semibold">รอ Host เริ่มเกม...</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Playing Phase ───
  if (phase === 'playing' && currentQ) {
    return (
      <div className="flex flex-col flex-1 gap-4">
        {/* Timer Bar */}
        <div className="w-full h-2 bg-olive-100 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${timerColor}`}
            initial={{ width: '100%' }}
            animate={{ width: `${timerPercent}%` }}
            transition={{ duration: 0.5, ease: 'linear' }}
          />
        </div>

        {/* Header: Question number + timer + answered count */}
        <div className="flex-between">
          <span className="text-[12px] font-bold text-olive-500">
            ข้อ {currentQuestion + 1}/{questions.length}
          </span>
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-olive-500">
            <Clock size={13} />
            <span className={timeLeft <= 5 ? 'text-red-500' : ''}>{timeLeft}s</span>
          </div>
          <span className="text-[11px] font-bold text-sage-500 bg-sage-50 px-2 py-1 rounded-lg">
            ตอบแล้ว {answeredCount}/{players.length}
          </span>
        </div>

        {/* Question Card */}
        <motion.div
          key={currentQuestion}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-6 flex-center flex-col"
        >
          <p className="text-[11px] font-bold text-olive-400 uppercase tracking-wider mb-2">
            {difficulty === 'easy' ? 'ง่าย' : difficulty === 'medium' ? 'กลาง' : 'ยาก'}
          </p>
          <p className="font-display font-black text-[28px] text-olive-800 text-center leading-tight">
            {currentQ.question}
          </p>
        </motion.div>

        {/* Answer Input */}
        {!hasAnswered && !alreadyAnswered ? (
          <div className="card p-4">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                enterKeyHint="done"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="พิมพ์คำตอบ..."
                className="input-field flex-1 text-center text-[22px] font-bold"
                disabled={hasAnswered}
              />
              <button
                className="btn btn-primary px-5"
                onClick={handleSubmitAnswer}
                disabled={!inputValue.trim()}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="card p-4 flex-center flex-col gap-2">
            <span className="text-2xl">{myAnswer?.correct ? '' : alreadyAnswered ? (myAnswer?.correct ? '' : '') : ''}</span>
            <p className="text-[13px] font-bold text-olive-600">
              {alreadyAnswered ? `ตอบแล้ว: ${myAnswer?.answer}` : 'ส่งคำตอบแล้ว รอคนอื่น...'}
            </p>
          </div>
        )}

        {errorMsg && (
          <p className="text-center text-[11px] font-bold text-red-500 bg-red-50 p-2 rounded-xl">{errorMsg}</p>
        )}
      </div>
    );
  }

  // ─── Results Phase ───
  if (phase === 'results' && currentQ) {
    const roundAnswers = answers[currentQuestion] || {};
    return (
      <div className="flex flex-col flex-1 gap-4">
        {/* Correct Answer */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-5 text-center"
        >
          <p className="text-[11px] font-bold text-olive-400 uppercase tracking-wider mb-1">คำตอบที่ถูกต้อง</p>
          <p className="font-display font-black text-[32px] text-sage-600">{currentQ.answer}</p>
          <p className="text-[13px] text-olive-500 mt-1">{currentQ.question}</p>
        </motion.div>

        {/* Player Results */}
        <div className="card p-4">
          <h3 className="text-[11px] font-bold text-olive-400 uppercase tracking-wider mb-3">ผลลัพธ์</h3>
          <div className="space-y-2">
            {players.map(p => {
              const pAnswer = roundAnswers[p];
              const isCorrect = pAnswer?.correct;
              const pts = pAnswer?.points || 0;
              return (
                <div
                  key={p}
                  className={`flex-between p-3 rounded-xl border-2 ${
                    isCorrect ? 'bg-green-50 border-green-200' : pAnswer ? 'bg-red-50 border-red-200' : 'bg-olive-50 border-olive-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{isCorrect ? '' : pAnswer ? '' : ''}</span>
                    <span className="font-bold text-[13px] text-olive-700">{p}</span>
                    {pAnswer && (
                      <span className="text-[11px] text-olive-400">({pAnswer.answer})</span>
                    )}
                  </div>
                  <span className={`font-bold text-[13px] ${isCorrect ? 'text-green-600' : 'text-olive-400'}`}>
                    +{pts} คะแนน
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Scores */}
        <div className="card p-4">
          <h3 className="text-[11px] font-bold text-olive-400 uppercase tracking-wider mb-2">คะแนนรวม</h3>
          <div className="flex flex-wrap gap-2">
            {sortedScores.map(([name, score], i) => (
              <span key={name} className={`px-3 py-1.5 rounded-xl text-[12px] font-bold ${
                i === 0 ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-olive-50 border border-olive-100 text-olive-600'
              }`}>
                {name}: {score}
              </span>
            ))}
          </div>
        </div>

        {/* Host advance button */}
        {isHost && (
          <button className="btn btn-outline w-full py-3" onClick={advanceToNext}>
            {currentQuestion + 1 >= questions.length ? 'ดูผลลัพธ์สุดท้าย' : 'ข้อถัดไป →'}
          </button>
        )}
      </div>
    );
  }

  // ─── Finished Phase ───
  if (phase === 'finished') {
    const winner = sortedScores[0];
    return (
      <div className="flex flex-col flex-1 gap-4">
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        {/* Winner Card */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-6 text-center bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200"
          >
            <Trophy size={36} className="text-amber-500 mx-auto mb-2" />
            <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1">ผู้ชนะ</p>
            <p className="font-display font-black text-[22px] text-olive-800">{winner[0]}</p>
            <p className="text-[15px] font-bold text-amber-600 mt-1">{winner[1]} คะแนน</p>
          </motion.div>
        )}

        {/* Full Scoreboard */}
        <div className="card p-4">
          <h3 className="text-[11px] font-bold text-olive-400 uppercase tracking-wider mb-3">อันดับ</h3>
          <div className="space-y-2">
            {sortedScores.map(([name, score], i) => (
              <div
                key={name}
                className={`flex-between p-3 rounded-xl border-2 ${
                  i === 0 ? 'bg-amber-50 border-amber-200' : 'bg-olive-50 border-olive-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg flex-center text-[13px] font-black bg-white border border-olive-100">
                    {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : i + 1}
                  </span>
                  <span className="font-bold text-[14px] text-olive-700">{name}</span>
                  {name === roomData.host && <Crown size={12} className="text-amber-500" />}
                </div>
                <span className="font-bold text-[14px] text-sage-600">{score} คะแนน</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto pt-2 space-y-2">
          {isHost ? (
            <button className="btn btn-primary w-full py-4 text-[16px]" onClick={handleReplay}>
              <RotateCcw size={18} />
              เล่นอีกครั้ง
            </button>
          ) : (
            <button className="btn btn-outline w-full py-3.5 text-[14px]" onClick={handleLeave}>
              <LogOut size={16} />
              ออกจากเกม
            </button>
          )}
        </div>
      </div>
    );
  }

  // Fallback loading
  return (
    <div className="flex-center flex-1 flex-col gap-3">
      <div className="w-7 h-7 border-[3px] border-sage-200 border-t-sage-500 rounded-full animate-spin"></div>
      <p className="text-olive-400 text-[13px] font-semibold">กำลังโหลด...</p>
    </div>
  );
};

export default MathRace;
