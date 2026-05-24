import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, onValue, increment } from 'firebase/database';
import { db } from '../firebase';
import { Trophy, Clock, CheckCircle, XCircle, Crown, RotateCcw, LogOut } from 'lucide-react';
import { getShuffledQuestions, CATEGORY_LABELS } from './quizData';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { feedback } from '../utils/feedback';

const QUESTION_TIME = 15;
const TOTAL_QUESTIONS = 10;

const Quiz = ({ roomId, roomData, userNickname }) => {
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const isHost = userNickname === roomData.host;
  const gameData = roomData.gameData || {};
  const players = Object.keys(roomData.players || {});

  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const personalRecordedRef = useRef(false);
  const autoAdvanceRef = useRef(null);
  const answerSubmittingRef = useRef(false);
  const advancingRef = useRef(false);

  const safeUpdate = async (refPath, data) => {
    try {
      await update(ref(db, refPath), data);
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
      throw e;
    }
  };

  const currentQ = gameData.currentQuestion || 0;
  const questions = gameData.questions || [];
  const scores = gameData.scores || {};
  const answers = gameData.answers || {};
  const phase = gameData.phase || 'waiting';
  const question = questions[currentQ];

  useEffect(() => {
    if (phase === 'waiting' || phase === 'playing') personalRecordedRef.current = false;
  }, [phase]);

  useEffect(() => {
    answerSubmittingRef.current = false;
    advancingRef.current = false;
  }, [currentQ, phase]);

  useEffect(() => {
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('quiz');
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][0] === userNickname && sorted[0][1] > 0) {
      recordPersonalWin('quiz');
    }
  }, [phase]);

  const usedQuestionIds = gameData.usedQuestionIds || [];

  const startQuizRef = useRef(false);
  const handleStartQuiz = async () => {
    if (!isHost || startQuizRef.current) return;
    startQuizRef.current = true;
    feedback('gameStart');
    const qs = getShuffledQuestions(TOTAL_QUESTIONS, usedQuestionIds);
    const newUsedIds = [...usedQuestionIds, ...qs.map(q => q._idx).filter(i => i !== undefined)];
    const initScores = {};
    players.forEach((p) => { initScores[p] = 0; });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        questions: qs,
        currentQuestion: 0,
        scores: initScores,
        answers: {},
        questionStartedAt: Date.now(),
        usedQuestionIds: newUsedIds,
      });
    } finally {
      startQuizRef.current = false;
    }
  };

  const handleAnswer = async (choiceIdx) => {
    if (selectedAnswer !== null) return;
    if (phase !== 'playing') return;
    if (answerSubmittingRef.current) return;
    answerSubmittingRef.current = true;

    setSelectedAnswer(choiceIdx);
    const isCorrect = choiceIdx === question.answer;
    if (isCorrect) feedback('success');
    else feedback('error');
    const elapsed = Math.floor((Date.now() - (gameData.questionStartedAt || 0)) / 1000);
    const timeBonus = Math.max(0, QUESTION_TIME - elapsed);
    const points = isCorrect ? 10 + timeBonus : 0;

    try {
      await safeUpdate(`rooms/${roomId}/gameData/answers/${currentQ}`, {
        [userNickname]: { choice: choiceIdx, correct: isCorrect, points },
      });
      if (isCorrect) {
        await safeUpdate(`rooms/${roomId}/gameData/scores`, {
          [userNickname]: increment(points),
        });
      }
    } finally {
      answerSubmittingRef.current = false;
    }
  };

  const handleNextQuestion = async () => {
    if (!isHost) return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
      if (currentQ + 1 >= questions.length) {
        await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'finished' });
        const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        if (sortedScores.length > 0 && sortedScores[0][1] > 0) {
          await recordWin(roomId, sortedScores[0][0], 'quiz');
        }
      } else {
        await safeUpdate(`rooms/${roomId}/gameData`, {
          currentQuestion: currentQ + 1,
          questionStartedAt: Date.now(),
          [`answers/${currentQ + 1}`]: null,
        });
      }
    } finally {
      advancingRef.current = false;
    }
  };

  const playAgainRef = useRef(false);
  const handlePlayAgain = async () => {
    if (!isHost || playAgainRef.current) return;
    playAgainRef.current = true;
    const qs = getShuffledQuestions(TOTAL_QUESTIONS, usedQuestionIds);
    const newUsedIds = [...usedQuestionIds, ...qs.map(q => q._idx).filter(i => i !== undefined)];
    const initScores = {};
    players.forEach((p) => { initScores[p] = 0; });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'playing',
        questions: qs,
        currentQuestion: 0,
        scores: initScores,
        answers: {},
        questionStartedAt: Date.now(),
        usedQuestionIds: newUsedIds,
      });
    } finally {
      playAgainRef.current = false;
    }
  };

  const handleBackToLobby = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
  };

  // Timer
  useEffect(() => {
    if (phase !== 'playing' || !gameData.questionStartedAt) return;

    setSelectedAnswer(null);
    setShowResult(false);

    let lastTick = QUESTION_TIME;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - gameData.questionStartedAt) / 1000);
      const remaining = Math.max(0, QUESTION_TIME - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 5 && remaining > 0 && remaining !== lastTick) {
        feedback('countdown');
      }
      lastTick = remaining;

      if (remaining === 0) {
        feedback('timeUp');
        setShowResult(true);
        clearInterval(interval);
        if (isHost) {
          autoAdvanceRef.current = setTimeout(() => handleNextQuestion(), 3000);
        }
      }
    }, 200);

    return () => {
      clearInterval(interval);
      if (autoAdvanceRef.current) { clearTimeout(autoAdvanceRef.current); autoAdvanceRef.current = null; }
    };
  }, [phase, currentQ, gameData.questionStartedAt]);

  // Show result when all players answered
  useEffect(() => {
    if (phase !== 'playing') return;
    const currentAnswers = answers[currentQ];
    if (!currentAnswers) return;
    const answeredCount = Object.keys(currentAnswers).length;
    if (answeredCount >= players.length) {
      setShowResult(true);
    }
  }, [answers, currentQ, players.length, phase]);

  const ErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
      {errorMsg}
    </div>
  ) : null;

  // ─── Waiting Phase ───
  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
        <ErrorToast />
        <div className="text-6xl animate-bounce-soft"></div>
        <div className="text-center">
          <h2 className="font-display font-bold text-[20px] text-olive-800 mb-1">Quiz Trivia</h2>
          <p className="text-olive-400 text-[13px]">ตอบคำถามให้เร็วที่สุด ยิ่งเร็วยิ่งได้คะแนนเยอะ!</p>
        </div>
        <div className="card p-4 w-full max-w-xs">
          <div className="text-center space-y-1">
            <p className="text-[12px] font-bold text-olive-500">{TOTAL_QUESTIONS} คำถาม • {QUESTION_TIME} วินาที/ข้อ</p>
            <p className="text-[12px] text-olive-400">{players.length} ผู้เล่น</p>
          </div>
        </div>
        {isHost ? (
          <button onClick={handleStartQuiz} className="btn btn-primary py-3.5 px-8 text-[15px]">
            เริ่มเกม!
          </button>
        ) : (
          <div className="flex items-center gap-2 text-olive-400">
            <span className="w-2.5 h-2.5 bg-sage-400 rounded-full animate-pulse-soft"></span>
            <span className="text-[13px] font-semibold">รอ Host เริ่มเกม...</span>
          </div>
        )}
      </div>
    );
  }

  // ─── Finished Phase ───
  if (phase === 'finished') {
    const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const winner = sortedScores[0];

    return (
      <div className="flex-1 flex flex-col gap-4 py-4">
        <ErrorToast />
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-center">
          <span className="text-5xl"></span>
          <h2 className="font-display font-bold text-[20px] text-olive-800 mt-2">จบเกม!</h2>
        </div>

        {/* Winner */}
        {winner && (
          <div className="card p-5 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 text-center">
            <Crown size={24} className="text-amber-500 mx-auto mb-2" />
            <p className="font-bold text-[16px] text-olive-800">{winner[0]}</p>
            <p className="text-[22px] font-black text-amber-600">{winner[1]} คะแนน</p>
          </div>
        )}

        {/* Scoreboard */}
        <div className="card p-4">
          <h3 className="font-bold text-[13px] text-olive-600 mb-3">คะแนนรวม</h3>
          <div className="space-y-2">
            {sortedScores.map(([name, score], idx) => (
              <div key={name} className="flex items-center gap-3 p-2.5 rounded-xl bg-olive-50/60">
                <span className="w-7 h-7 rounded-full bg-sage-100 flex-center text-[12px] font-black text-sage-700">
                  {idx + 1}
                </span>
                <span className="flex-1 font-bold text-[14px] text-olive-700">{name}</span>
                <span className="font-black text-[15px] text-sage-600">{score}</span>
                {name === userNickname && (
                  <span className="text-[9px] font-extrabold text-sage-600 bg-sage-100 px-1.5 py-0.5 rounded-md">คุณ</span>
                )}
              </div>
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

  // ─── Playing Phase ───
  if (!question) return null;

  const myAnswer = answers?.[currentQ]?.[userNickname];
  const hasAnswered = selectedAnswer !== null || myAnswer;
  const timerPercent = (timeLeft / QUESTION_TIME) * 100;
  const timerColor = timeLeft > 7 ? 'bg-sage-400' : timeLeft > 3 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="flex-1 flex flex-col gap-3">
      <ErrorToast />
      {/* Header */}
      <div className="flex-between">
        <span className="text-[11px] font-bold text-olive-400 bg-olive-50 px-3 py-1.5 rounded-full">
          ข้อ {currentQ + 1}/{questions.length}
        </span>
        {question.category && (
          <span className="text-[10px] font-bold text-sage-600 bg-sage-100 px-2.5 py-1 rounded-full">
            {CATEGORY_LABELS[question.category] || question.category}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <Clock size={13} className={timeLeft <= 3 ? 'text-red-500' : 'text-olive-400'} />
          <span className={`font-black text-[15px] ${timeLeft <= 3 ? 'text-red-500' : 'text-olive-700'}`}>
            {timeLeft}
          </span>
        </div>
      </div>

      {/* Timer Bar */}
      <div className="h-1.5 rounded-full bg-olive-100 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${timerColor}`}
          initial={{ width: '100%' }}
          animate={{ width: `${timerPercent}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>

      {/* Question */}
      <div className="card p-5 mt-1">
        <p className="font-bold text-[16px] text-olive-800 leading-relaxed text-center">
          {question.q}
        </p>
      </div>

      {/* Choices */}
      <div className="space-y-2.5 mt-1">
        {question.choices.map((choice, idx) => {
          const isSelected = selectedAnswer === idx || myAnswer?.choice === idx;
          const isCorrectAnswer = idx === question.answer;
          const showCorrect = showResult && isCorrectAnswer;
          const showWrong = showResult && isSelected && !isCorrectAnswer;

          let bg = 'bg-white border-2 border-olive-100';
          if (showCorrect) bg = 'bg-green-50 border-2 border-green-300';
          else if (showWrong) bg = 'bg-red-50 border-2 border-red-300';
          else if (isSelected) bg = 'bg-sage-50 border-2 border-sage-300';

          return (
            <motion.button
              key={idx}
              whileTap={!hasAnswered && !showResult ? { scale: 0.97 } : {}}
              onClick={() => !showResult && handleAnswer(idx)}
              disabled={!!hasAnswered || showResult}
              className={`w-full p-4 rounded-2xl text-left flex items-center gap-3 transition-all ${bg} ${
                !hasAnswered && !showResult ? 'active:scale-[0.97]' : ''
              }`}
              style={!showResult && !hasAnswered ? {} : { cursor: 'default' }}
            >
              <span className={`w-8 h-8 rounded-xl flex-center text-[13px] font-black shrink-0 ${
                showCorrect ? 'bg-green-200 text-green-700' :
                showWrong ? 'bg-red-200 text-red-700' :
                isSelected ? 'bg-sage-200 text-sage-700' :
                'bg-olive-100 text-olive-600'
              }`}>
                {showCorrect ? <CheckCircle size={16} /> :
                 showWrong ? <XCircle size={16} /> :
                 String.fromCharCode(65 + idx)}
              </span>
              <span className={`font-bold text-[14px] ${
                showCorrect ? 'text-green-700' :
                showWrong ? 'text-red-600' :
                'text-olive-700'
              }`}>
                {choice}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Answered Status / Next Button */}
      <div className="mt-auto pt-3">
        {showResult ? (
          <div className="space-y-3">
            {/* Who answered what */}
            <div className="card p-3">
              <div className="flex flex-wrap gap-2">
                {players.map((p) => {
                  const pa = answers?.[currentQ]?.[p];
                  return (
                    <div key={p} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold ${
                      pa?.correct ? 'bg-green-50 text-green-600 border border-green-200' :
                      pa ? 'bg-red-50 text-red-500 border border-red-200' :
                      'bg-olive-50 text-olive-400 border border-olive-100'
                    }`}>
                      {pa?.correct ? <CheckCircle size={11} /> : pa ? <XCircle size={11} /> : <Clock size={11} />}
                      {p}
                      {pa?.points ? <span className="ml-1 text-green-500">+{pa.points}</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {isHost && (
              <button onClick={handleNextQuestion} className="btn btn-primary w-full py-3.5 text-[15px]">
                {currentQ + 1 >= questions.length ? 'ดูผลลัพธ์' : 'ข้อถัดไป'}
              </button>
            )}
            {!isHost && (
              <p className="text-center text-[12px] text-olive-400 font-semibold">รอ Host กดข้อถัดไป...</p>
            )}
          </div>
        ) : hasAnswered ? (
          <div className="flex-center gap-2 py-3">
            <CheckCircle size={16} className="text-sage-500" />
            <span className="text-[13px] font-bold text-sage-600">ตอบแล้ว! รอคนอื่น...</span>
          </div>
        ) : null}
      </div>

      {/* Live Scores (mini) */}
      <div className="flex items-center gap-2 px-1 pb-1 overflow-x-auto">
        {Object.entries(scores)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, score]) => (
            <div key={name} className="flex items-center gap-1 bg-olive-50 px-2 py-1 rounded-lg shrink-0">
              <span className="text-[10px] font-bold text-olive-500 truncate max-w-[60px]">{name}</span>
              <span className="text-[11px] font-black text-sage-600">{score}</span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default Quiz;
