import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ref, update, increment } from 'firebase/database';
import { db } from '../firebase';
import { Crown, RotateCcw, LogOut, Play, Clock, Shuffle } from 'lucide-react';
import { getRandomWord, ALL_CATEGORIES } from './insiderData';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { feedback } from '../utils/feedback';

const DISCUSSION_TIME_OPTIONS = [
  { label: '5 นาที', seconds: 300 },
  { label: '8 นาที', seconds: 480 },
  { label: '10 นาที', seconds: 600 },
];
const VOTE_TIME = 180;

const TwentyQuestions = ({ roomId, roomData, userNickname }) => {
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const isHost = userNickname === roomData.host;
  const gameData = roomData.gameData || {};
  const players = Object.keys(roomData.players || {});
  const nonHostPlayers = players.filter(p => p !== roomData.host);

  const phase = gameData.phase || 'waiting';
  const secretWord = gameData.secretWord || '';
  const category = gameData.category || '';
  const insiderName = gameData.insider || '';
  const isInsider = userNickname === insiderName;
  const isModerator = isHost;
  const roundNumber = gameData.roundNumber || 1;
  const scores = gameData.scores || {};
  const usedWords = gameData.usedWords || [];
  const wordGuessed = gameData.wordGuessed || false;
  const guesser = gameData.guesser || '';
  const votes = gameData.votes || {};
  const timerEnd = gameData.timerEnd || 0;

  const [timeLeft, setTimeLeft] = useState(0);
  const [votedFor, setVotedFor] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedTime, setSelectedTime] = useState(300);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [showCategorySetting, setShowCategorySetting] = useState(true);
  const [confirmGuesser, setConfirmGuesser] = useState(null);
  const discussionTime = gameData.discussionTime || 300;
  const showCategory = gameData.showCategory !== false;
  const personalRecordedRef = useRef(false);
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

  useEffect(() => {
    if (phase === 'waiting' || phase === 'reveal') {
      personalRecordedRef.current = false;
    }
    if (phase === 'voting') {
      feedback('newRound');
    } else {
      setVotedFor('');
    }
    if (phase === 'result') {
      feedback('spyReveal');
    }
    advancingRef.current = false;
  }, [phase]);

  // Timer
  useEffect(() => {
    if (!timerEnd || (phase !== 'discussion' && phase !== 'voting')) {
      setTimeLeft(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timerEnd, phase]);

  // Host auto-advance when timer expires
  useEffect(() => {
    if (!isHost || timeLeft > 0) return;
    if (phase === 'discussion' && timerEnd && Date.now() >= timerEnd) {
      handleTimeUp();
    }
    if (phase === 'voting' && timerEnd && Date.now() >= timerEnd) {
      handleVoteEnd();
    }
  }, [timeLeft, phase, timerEnd, isHost]);

  useEffect(() => {
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('twentyquestions');
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][0] === userNickname && sorted[0][1] > 0) {
      recordPersonalWin('twentyquestions');
    }
  }, [phase]);

  // ─── Host: Start Game ───
  const handleStartGame = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('gameStart');
    const initScores = {};
    players.forEach(p => { initScores[p] = 0; });
    const wordObj = getRandomWord([], selectedCategories.length > 0 ? selectedCategories : '');
    const insider = nonHostPlayers[Math.floor(Math.random() * nonHostPlayers.length)];

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'reveal',
        scores: initScores,
        roundNumber: 1,
        usedWords: [],
        secretWord: wordObj.word,
        category: wordObj.category,
        filterCategories: selectedCategories.length > 0 ? selectedCategories : null,
        showCategory: showCategorySetting,
        insider,
        wordGuessed: false,
        guesser: '',
        votes: {},
        timerEnd: 0,
        caughtInsider: null,
        topVoted: null,
        discussionTime: selectedTime,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  // ─── Host: Start Discussion Timer ───
  const handleStartDiscussion = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('tap');
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'discussion',
        timerEnd: Date.now() + discussionTime * 1000,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  // ─── Host: Re-roll word ───
  const handleRerollWord = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('tap');
    const wordObj = getRandomWord([...usedWords, secretWord], gameData.filterCategories || '');
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        secretWord: wordObj.word,
        category: wordObj.category,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  // ─── Host: Time's up (nobody guessed) — no one scores ───
  const handleTimeUp = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'result',
        wordGuessed: false,
        caughtInsider: false,
        topVoted: null,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  // ─── Player: Vote for suspected insider ───
  const voteRef = useRef(false);
  const handleVote = async (target) => {
    if (votedFor || isModerator) return;
    if (voteRef.current) return;
    voteRef.current = true;
    setVotedFor(target);
    feedback('success');
    try {
      await safeUpdate(`rooms/${roomId}/gameData/votes`, { [userNickname]: target });
    } finally {
      voteRef.current = false;
    }
  };

  // ─── Host: End voting ───
  const handleVoteEnd = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;

    const currentVotes = gameData.votes || {};
    const voteCounts = {};
    Object.values(currentVotes).forEach(target => {
      voteCounts[target] = (voteCounts[target] || 0) + 1;
    });

    const sorted = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
    const topVoted = sorted.length > 0 ? sorted[0][0] : '';
    const caughtInsider = topVoted === insiderName;

    const scoreUpdates = {};
    if (caughtInsider) {
      nonHostPlayers.forEach(p => {
        if (p !== insiderName && p !== guesser) scoreUpdates[p] = increment(2);
      });
      if (guesser && guesser !== insiderName) scoreUpdates[guesser] = increment(3);
    } else {
      scoreUpdates[insiderName] = increment(3);
    }

    const flatScoreUpdates = {};
    Object.entries(scoreUpdates).forEach(([k, v]) => { flatScoreUpdates[`scores/${k}`] = v; });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        ...flatScoreUpdates,
        phase: 'result',
        caughtInsider,
        topVoted,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  // ─── Host: Auto-end voting when all players voted ───
  useEffect(() => {
    if (phase !== 'voting' || !isHost || advancingRef.current) return;
    const currentVotes = gameData.votes || {};
    const totalVoted = Object.keys(currentVotes).length;
    if (totalVoted >= nonHostPlayers.length && totalVoted > 0) {
      handleVoteEnd();
    }
  }, [gameData.votes, phase]);

  // ─── Host: Next round ───
  const handleNextRound = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('newRound');

    const newUsedWords = [...usedWords, secretWord];

    try {
      if (roundNumber >= nonHostPlayers.length) {
        await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'finished', usedWords: newUsedWords });
        feedback('victory');
        const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        if (sortedScores.length > 0 && sortedScores[0][1] > 0) {
          await recordWin(roomId, sortedScores[0][0], 'twentyquestions');
        }
      } else {
        const nextInsider = nonHostPlayers[Math.floor(Math.random() * nonHostPlayers.length)];
        const wordObj = getRandomWord(newUsedWords, gameData.filterCategories || '');
        await safeUpdate(`rooms/${roomId}/gameData`, {
          phase: 'reveal',
          roundNumber: roundNumber + 1,
          usedWords: newUsedWords,
          secretWord: wordObj.word,
          category: wordObj.category,
          insider: nextInsider,
          wordGuessed: false,
          guesser: '',
          votes: {},
          timerEnd: 0,
          caughtInsider: null,
          topVoted: null,
        });
      }
    } finally {
      advancingRef.current = false;
    }
  };

  const handlePlayAgain = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('gameStart');
    const initScores = {};
    players.forEach(p => { initScores[p] = 0; });
    const wordObj = getRandomWord([], selectedCategories.length > 0 ? selectedCategories : '');
    const insider = nonHostPlayers[Math.floor(Math.random() * nonHostPlayers.length)];

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'reveal',
        scores: initScores,
        roundNumber: 1,
        usedWords: [],
        secretWord: wordObj.word,
        category: wordObj.category,
        filterCategories: selectedCategories.length > 0 ? selectedCategories : null,
        showCategory: showCategorySetting,
        insider,
        wordGuessed: false,
        guesser: '',
        votes: {},
        timerEnd: 0,
        caughtInsider: null,
        topVoted: null,
        discussionTime: selectedTime,
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const backToLobbyRef = useRef(false);
  const handleBackToLobby = async () => {
    if (!isHost || backToLobbyRef.current) return;
    backToLobbyRef.current = true;
    try {
      await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
    } finally {
      backToLobbyRef.current = false;
    }
  };

  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  const ErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
      {errorMsg}
    </div>
  ) : null;

  // ════════════════════════════════════════════════════════════════
  // WAITING
  // ════════════════════════════════════════════════════════════════
  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in">
        <ErrorToast />
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} className="text-7xl select-none">
          🕵️
        </motion.div>

        <div className="text-center">
          <h2 className="font-display font-bold text-[22px] text-olive-800 mb-1">Insider</h2>
          <p className="text-olive-400 text-[13px] leading-relaxed px-4">
            มีคนในกลุ่มรู้คำตอบ...จะจับได้ไหม?
          </p>
        </div>

        <div className="card p-4 w-full max-w-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[12px] text-olive-500">
              <span>👑</span><span>Host เป็นกรรมการ รู้คำตอบ ตอบใช่/ไม่ใช่</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-olive-500">
              <span>🕵️</span><span>1 คนเป็น Insider แอบรู้คำตอบ</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-olive-500">
              <span>❓</span><span>ผู้เล่นถามคำถาม + ทายคำภายในเวลา</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-olive-500">
              <span>🗳️</span><span>ทายถูกแล้ว → โหวตหา Insider</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-olive-500">
              <span>🏆</span><span>จับ Insider ได้ = ชาวบ้านชนะ!</span>
            </div>
          </div>
        </div>

        <div className="card p-3 w-full max-w-xs">
          <p className="text-[11px] font-bold text-olive-500 mb-2">ผู้เล่น {players.length} คน</p>
          <div className="flex flex-wrap gap-1.5">
            {players.map(p => (
              <span key={p} className={`text-[12px] font-bold px-2.5 py-1 rounded-full ${p === roomData.host ? 'bg-amber-100 text-amber-700' : 'bg-sage-100 text-sage-700'}`}>
                {p === roomData.host ? `👑 ${p}` : p === userNickname ? `${p} (คุณ)` : p}
              </span>
            ))}
          </div>
        </div>

        {isHost ? (
          <>
            <div className="w-full max-w-xs">
              <p className="text-[11px] font-bold text-olive-500 mb-2 text-center">หมวดคำศัพท์ (เลือกได้หลายหมวด)</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                <button
                  onClick={() => setSelectedCategories([])}
                  className={`py-2 px-3 rounded-2xl text-[12px] font-bold border-2 transition-colors ${
                    selectedCategories.length === 0
                      ? 'bg-sage-500 border-sage-500 text-white'
                      : 'bg-white border-olive-100 text-olive-600'
                  }`}
                >
                  🎲 ทุกหมวด
                </button>
                {ALL_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategories(prev =>
                      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                    )}
                    className={`py-2 px-3 rounded-2xl text-[12px] font-bold border-2 transition-colors ${
                      selectedCategories.includes(cat)
                        ? 'bg-sage-500 border-sage-500 text-white'
                        : 'bg-white border-olive-100 text-olive-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-full max-w-xs">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-bold text-olive-500">แสดงหมวดหมู่ระหว่างเล่น</p>
                <button
                  onClick={() => setShowCategorySetting(!showCategorySetting)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${showCategorySetting ? 'bg-sage-500' : 'bg-olive-200'}`}
                >
                  <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${showCategorySetting ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
            <div className="w-full max-w-xs">
              <p className="text-[11px] font-bold text-olive-500 mb-2 text-center">เวลาในการเล่น</p>
              <div className="flex gap-2">
                {DISCUSSION_TIME_OPTIONS.map(opt => (
                  <button
                    key={opt.seconds}
                    onClick={() => setSelectedTime(opt.seconds)}
                    className={`flex-1 py-2.5 rounded-2xl text-[13px] font-bold border-2 transition-colors ${
                      selectedTime === opt.seconds
                        ? 'bg-sage-500 border-sage-500 text-white'
                        : 'bg-white border-olive-100 text-olive-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleStartGame} className="btn btn-primary py-3.5 px-8 text-[15px]" disabled={nonHostPlayers.length < 2}>
              <Play size={18} fill="currentColor" /> เริ่มเกม!
            </button>
            {nonHostPlayers.length < 2 && (
              <p className="text-center text-[11px] font-bold text-warm-500 bg-warm-50 border-2 border-warm-100 p-2.5 rounded-xl">
                ต้องมีผู้เล่น (ไม่นับ Host) อย่างน้อย 2 คน
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

  // ════════════════════════════════════════════════════════════════
  // REVEAL — Show roles
  // ════════════════════════════════════════════════════════════════
  if (phase === 'reveal') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 py-6 animate-fade-in">
        <ErrorToast />
        <div className="text-[11px] font-bold text-olive-400 bg-olive-50 px-3 py-1.5 rounded-full">
          รอบ {roundNumber}/{nonHostPlayers.length}
        </div>

        {isModerator && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card p-6 w-full max-w-xs text-center bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">คุณเป็นกรรมการ 👑</p>
            {showCategory && <p className="text-[11px] text-olive-500 mb-3">หมวด: <span className="font-bold">{category}</span></p>}
            <p className="font-display font-black text-[32px] text-olive-800">{secretWord}</p>
            <p className="text-[11px] text-olive-400 mt-3">ตอบ ใช่/ไม่ใช่ ด้วยวาจา</p>
            <div className="flex gap-2 mt-4 w-full">
              <button onClick={handleRerollWord} className="btn btn-outline flex-1 py-3 text-[13px]">
                <Shuffle size={14} /> สุ่มใหม่
              </button>
              <button onClick={handleStartDiscussion} className="btn btn-primary flex-1 py-3 text-[14px]">
                <Clock size={16} /> เริ่ม ({Math.floor(discussionTime / 60)} นาที)
              </button>
            </div>
          </motion.div>
        )}

        {isInsider && !isModerator && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card p-6 w-full max-w-xs text-center bg-gradient-to-br from-purple-50 to-fuchsia-50 border-2 border-purple-200">
            <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-2">คุณเป็น Insider 🕵️</p>
            {showCategory && <p className="text-[11px] text-olive-500 mb-3">หมวด: <span className="font-bold">{category}</span></p>}
            <p className="font-display font-black text-[32px] text-olive-800">{secretWord}</p>
            <p className="text-[11px] text-olive-400 mt-3">นำทางให้คนอื่นทาย แต่อย่าให้ถูกจับได้!</p>
            <div className="mt-3 flex-center gap-2 text-olive-400">
              <span className="w-2 h-2 bg-sage-400 rounded-full animate-pulse-soft" />
              <span className="text-[12px] font-semibold">รอกรรมการเริ่มจับเวลา...</span>
            </div>
          </motion.div>
        )}

        {!isModerator && !isInsider && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card p-6 w-full max-w-xs text-center">
            <p className="text-[10px] font-bold text-sage-600 uppercase tracking-widest mb-2">คุณเป็นชาวบ้าน 🏘️</p>
            {showCategory && <p className="text-[11px] text-olive-500 mb-3">หมวด: <span className="font-bold">{category}</span></p>}
            <p className="font-display font-black text-[28px] text-olive-300">???</p>
            <p className="text-[11px] text-olive-400 mt-3">ถามคำถามเพื่อเดาคำลับ!</p>
            <div className="mt-3 flex-center gap-2 text-olive-400">
              <span className="w-2 h-2 bg-sage-400 rounded-full animate-pulse-soft" />
              <span className="text-[12px] font-semibold">รอกรรมการเริ่มจับเวลา...</span>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // DISCUSSION — Ask questions + guess
  // ════════════════════════════════════════════════════════════════
  if (phase === 'discussion') {
    const timerColor = timeLeft <= 15 ? 'text-red-600 bg-red-50' : timeLeft <= 30 ? 'text-amber-600 bg-amber-50' : 'text-sage-600 bg-sage-100';
    const discMinutes = Math.floor(timeLeft / 60);
    const discSeconds = timeLeft % 60;
    const discTimerDisplay = `${discMinutes}:${discSeconds.toString().padStart(2, '0')}`;

    return (
      <div className="flex-1 flex flex-col gap-3 min-h-0 animate-fade-in">
        <ErrorToast />
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-olive-400 bg-olive-50 px-3 py-1.5 rounded-full">
            รอบ {roundNumber}/{nonHostPlayers.length}
          </span>
          <span className={`text-[13px] font-black px-4 py-2 rounded-full ${timerColor}`}>
            <Clock size={13} className="inline mr-1" />{discTimerDisplay}
          </span>
        </div>

        {/* Category + Word hints */}
        <div className="card p-3 flex items-center justify-between">
          {showCategory && (
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-olive-500">หมวด:</span>
              <span className="text-[14px] font-extrabold text-sage-600">{category}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {isModerator && (
              <span className="text-[12px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
                คำตอบ: {secretWord}
              </span>
            )}
            {isInsider && !isModerator && (
              <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg">
                🕵️ {secretWord}
              </span>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="card p-4 text-center bg-olive-50/60">
          {isModerator ? (
            <div>
              <p className="text-[13px] text-olive-700 font-bold mb-1">ตอบคำถามผู้เล่นด้วยวาจา (ใช่/ไม่ใช่)</p>
              <p className="text-[11px] text-olive-400">ถ้าใครทายถูก กดชื่อด้านล่าง</p>
            </div>
          ) : (
            <div>
              <p className="text-[13px] text-olive-700 font-bold mb-1">ถามกรรมการด้วยวาจา (ใช่/ไม่ใช่)</p>
              <p className="text-[11px] text-olive-400">พูดคำตอบที่คุณเดาออกเสียง!</p>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Host: mark who guessed correctly */}
        {isModerator && !wordGuessed && (
          <div className="card p-4">
            {!confirmGuesser ? (
              <>
                <p className="text-[11px] font-bold text-olive-500 mb-3">ใครทายถูก? (กดเมื่อผู้เล่นพูดคำตอบถูก)</p>
                <div className="flex flex-wrap gap-2">
                  {nonHostPlayers.map(p => (
                    <button
                      key={p}
                      onClick={() => setConfirmGuesser(p)}
                      className="text-[13px] font-bold px-4 py-2.5 rounded-xl bg-sage-100 text-sage-700 active:scale-95 border-2 border-sage-200"
                    >
                      ✓ {p}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="text-[13px] font-bold text-olive-700 mb-3">ยืนยัน: <span className="text-sage-600">{confirmGuesser}</span> ทายถูก?</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => setConfirmGuesser(null)}
                    className="btn btn-outline py-2.5 px-5 text-[13px]"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={async () => {
                      if (advancingRef.current) return;
                      advancingRef.current = true;
                      feedback('correctGuess');
                      const p = confirmGuesser;
                      setConfirmGuesser(null);
                      try {
                        await safeUpdate(`rooms/${roomId}/gameData`, {
                          wordGuessed: true,
                          guesser: p,
                          phase: 'voting',
                          timerEnd: Date.now() + VOTE_TIME * 1000,
                          votes: {},
                        });
                      } finally {
                        advancingRef.current = false;
                      }
                    }}
                    className="btn btn-primary py-2.5 px-5 text-[13px]"
                  >
                    ยืนยัน
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Non-host: waiting indicator */}
        {!isModerator && !wordGuessed && (
          <div className="card p-4 text-center">
            <p className="text-[12px] text-olive-500 font-semibold">🗣️ ถามและทายด้วยวาจา — กรรมการจะกดยืนยันเมื่อทายถูก</p>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // VOTING — Vote for suspected insider
  // ════════════════════════════════════════════════════════════════
  if (phase === 'voting') {
    const voteCount = Object.keys(votes).length;
    const totalVoters = nonHostPlayers.length;
    const timerColor = timeLeft <= 10 ? 'text-red-600 bg-red-50' : 'text-sage-600 bg-sage-100';
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timerDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    return (
      <div className="flex-1 flex flex-col gap-4 py-4 animate-fade-in">
        <ErrorToast />
        <div className="text-center">
          <span className="text-4xl">🗳️</span>
          <h3 className="font-display font-bold text-[18px] text-olive-800 mt-2">โหวตหา Insider!</h3>
          <p className="text-[12px] text-olive-400 mt-1">ใครคือคนที่แอบรู้คำตอบ?</p>
        </div>

        <div className="flex-center gap-3">
          <span className={`text-[13px] font-black px-4 py-2 rounded-full ${timerColor}`}>
            <Clock size={13} className="inline mr-1" />{timerDisplay}
          </span>
          <span className="text-[12px] font-bold text-olive-500 bg-olive-50 px-3 py-2 rounded-full">
            🗳️ {voteCount}/{totalVoters}
          </span>
        </div>

        <div className="card p-3 text-center bg-green-50 border border-green-200">
          <p className="text-[12px] text-olive-500">{guesser} ทายคำ "<span className="font-bold">{secretWord}</span>" ถูก!</p>
        </div>

        {/* Vote buttons */}
        {!isModerator && (
          <div className="card p-4">
            <p className="text-[11px] font-bold text-olive-500 mb-3">เลือกคนที่คุณสงสัย:</p>
            <div className="space-y-2">
              {nonHostPlayers.filter(p => p !== userNickname).map(p => (
                <button
                  key={p}
                  onClick={() => handleVote(p)}
                  disabled={!!votedFor}
                  className={`w-full p-3 rounded-xl text-left font-bold text-[14px] border-2 transition-all ${
                    votedFor === p
                      ? 'bg-purple-50 border-purple-300 text-purple-700'
                      : votedFor
                        ? 'bg-olive-50 border-olive-100 text-olive-400'
                        : 'bg-white border-olive-100 text-olive-700 active:scale-[0.98]'
                  }`}
                >
                  {votedFor === p && '🗳️ '}{p}
                </button>
              ))}
            </div>
            {votedFor && <p className="text-[11px] text-sage-600 font-semibold mt-2 text-center">โหวตแล้ว!</p>}
          </div>
        )}

        {isModerator && (
          <div className="card p-4 text-center">
            <p className="text-[12px] text-olive-500 mb-3">โหวตแล้ว {voteCount}/{totalVoters} คน</p>
            <button
              onClick={handleVoteEnd}
              disabled={voteCount === 0}
              className="btn btn-primary py-3 px-6 text-[14px]"
            >
              สรุปผลโหวต
            </button>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // RESULT — Show who was the insider
  // ════════════════════════════════════════════════════════════════
  if (phase === 'result') {
    const caughtInsider = gameData.caughtInsider;
    const topVoted = gameData.topVoted || '';

    return (
      <div className="flex-1 flex flex-col gap-4 py-4 animate-fade-in">
        <ErrorToast />
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <span className="text-5xl">{caughtInsider ? '🎉' : wordGuessed ? '🕵️' : '⏰'}</span>
          <h3 className="font-display font-bold text-[20px] text-olive-800 mt-2">
            {!wordGuessed ? 'หมดเวลา! ไม่มีใครได้คะแนน' : caughtInsider ? 'จับ Insider ได้!' : 'Insider หลุดรอด!'}
          </h3>
        </motion.div>

        <div className="card p-5 text-center">
          <p className="text-[10px] font-bold text-olive-400 uppercase tracking-widest mb-2">Insider คือ</p>
          <p className="font-display font-black text-[24px] text-purple-600">{insiderName}</p>
          {wordGuessed && topVoted && (
            <p className="text-[12px] text-olive-400 mt-2">
              โดนโหวตมากสุด: <span className="font-bold">{topVoted}</span>
              {caughtInsider ? ' ✅' : ' ❌'}
            </p>
          )}
        </div>

        <div className="card p-4 text-center">
          <p className="text-[10px] font-bold text-olive-400 mb-1">คำลับ</p>
          <p className="font-display font-black text-[22px] text-olive-800">{secretWord}</p>
          <p className="text-[11px] text-olive-400">{category}</p>
        </div>

        <div className="card p-4">
          <h3 className="font-bold text-[12px] text-olive-600 mb-2.5">📊 คะแนนสะสม</h3>
          <div className="space-y-1.5">
            {sortedScores.map(([name, score], idx) => (
              <div key={name} className="flex items-center gap-2.5 p-2 rounded-xl bg-olive-50/60">
                <span className="text-[11px] font-black text-olive-400 w-4">{idx + 1}</span>
                <span className="flex-1 font-bold text-[13px] text-olive-700">
                  {name}
                  {name === insiderName && <span className="ml-1 text-[9px] text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded">Insider</span>}
                </span>
                <span className="font-black text-[14px] text-sage-600">{score}</span>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button onClick={handleNextRound} className="btn btn-primary w-full py-3.5 text-[15px]">
            {roundNumber >= nonHostPlayers.length ? '🏆 ดูผลลัพธ์สุดท้าย' : '➡️ รอบถัดไป'}
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

  // ════════════════════════════════════════════════════════════════
  // FINISHED
  // ════════════════════════════════════════════════════════════════
  if (phase === 'finished') {
    const topPlayer = sortedScores[0];
    return (
      <div className="flex-1 flex flex-col gap-4 py-4 animate-fade-in">
        <ErrorToast />
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-center">
          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }} className="text-5xl mb-2">
            🏆
          </motion.div>
          <h2 className="font-display font-bold text-[22px] text-olive-800">จบเกม!</h2>
        </div>

        {topPlayer && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card p-5 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 text-center">
            <Crown size={22} className="text-amber-500 mx-auto mb-2" />
            <p className="font-bold text-[14px] text-olive-600 mb-0.5">ผู้ชนะ</p>
            <p className="font-display font-black text-[20px] text-olive-800">{topPlayer[0]}</p>
            <p className="text-[15px] font-bold text-amber-600 mt-1">{topPlayer[1]} คะแนน</p>
          </motion.div>
        )}

        <div className="card p-4">
          <h3 className="text-[11px] font-bold text-olive-400 uppercase tracking-wider mb-3">อันดับ</h3>
          <div className="space-y-2">
            {sortedScores.map(([name, score], idx) => (
              <div key={name} className={`flex-between p-3 rounded-xl border-2 ${
                idx === 0 ? 'bg-amber-50 border-amber-200' : 'bg-olive-50 border-olive-100'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</span>
                  <span className="font-bold text-[14px] text-olive-700">{name}</span>
                </div>
                <span className="font-bold text-[14px] text-sage-600">{score}</span>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <div className="space-y-2">
            <button onClick={handlePlayAgain} className="btn btn-primary w-full py-3.5 text-[15px]">
              <RotateCcw size={16} /> เล่นอีกครั้ง
            </button>
            <button onClick={handleBackToLobby} className="btn btn-outline w-full py-3 text-[13px]">
              <LogOut size={14} /> กลับ Lobby
            </button>
          </div>
        ) : (
          <button onClick={requestLeave} className="btn btn-outline w-full py-3.5 text-[14px]">
            <LogOut size={15} /> ออกจากห้อง
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-center flex-1 flex-col gap-3">
      <div className="w-7 h-7 border-[3px] border-sage-200 border-t-sage-500 rounded-full animate-spin"></div>
      <p className="text-olive-400 text-[13px] font-semibold">กำลังโหลด...</p>
    </div>
  );
};

export default TwentyQuestions;
