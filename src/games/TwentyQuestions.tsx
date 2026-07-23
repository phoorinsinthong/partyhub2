import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ref, update, increment } from 'firebase/database';
import { db } from '../firebase';
import { Crown, RotateCcw, LogOut, Play, Clock, Shuffle } from 'lucide-react';
import { getRandomWord, ALL_CATEGORIES } from './logic/insiderData';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGame } from '../contexts/GameContext';
import { useGameTimer } from '../hooks/useGameTimer';
import { TimerDisplay } from '../components/game-ui/TimerDisplay';
import { useTranslation } from 'react-i18next';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { feedback } from '../utils/feedback';
import NeonCard from '../components/NeonCard';
import GiantButton from '../components/GiantButton';

const DISCUSSION_TIME_OPTIONS = (t: any) => [
  { label: t('insider.discussionTime') + ' 5 ' + (t('insider.discussionTime').includes('Time') ? 'min' : 'นาที'), seconds: 300 },
  { label: t('insider.discussionTime') + ' 8 ' + (t('insider.discussionTime').includes('Time') ? 'min' : 'นาที'), seconds: 480 },
  { label: t('insider.discussionTime') + ' 10 ' + (t('insider.discussionTime').includes('Time') ? 'min' : 'นาที'), seconds: 600 },
];
const VOTE_TIME = 180;

const TwentyQuestions = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  
  const [votedFor, setVotedFor] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedTime, setSelectedTime] = useState(300);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showCategorySetting, setShowCategorySetting] = useState(true);
  const [confirmGuesser, setConfirmGuesser] = useState<string | null>(null);
  
  const personalRecordedRef = useRef(false);
  const advancingRef = useRef(false);
  const voteRef = useRef(false);
  const backToLobbyRef = useRef(false);

  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');

  const renderErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border border-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-fade-in">
      {errorMsg}
    </div>
  ) : null;

  const safeUpdate = async (refPath: string, data: any) => {
    try {
      await update(ref(db, refPath), data);
    } catch {
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  const handleTimeUp = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        phase: 'result',
        wordGuessed: false,
        caughtInsider: false,
        topVoted: null,
        timerEnd: null
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleVoteEnd = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;

    const gameData = roomData?.gameData || {};
    const currentVotes = gameData.votes || {};
    const insiderName = gameData.insider || '';
    const guesser = gameData.guesser || '';
    const players = Object.keys(roomData?.players || {});
    const nonHostPlayers = players.filter(p => p !== roomData?.host);

    const voteCounts: Record<string, number> = {};
    Object.values(currentVotes).forEach((target: any) => {
      voteCounts[target] = (voteCounts[target] || 0) + 1;
    });

    const sorted = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
    const topVoted = sorted.length > 0 ? sorted[0][0] : '';
    const caughtInsider = topVoted === insiderName;

    const scoreUpdates: Record<string, any> = {};
    if (caughtInsider) {
      nonHostPlayers.forEach(p => {
        if (p !== insiderName && p !== guesser) scoreUpdates[p] = increment(2);
      });
      if (guesser && guesser !== insiderName) scoreUpdates[guesser] = increment(3);
    } else {
      scoreUpdates[insiderName] = increment(3);
    }

    const flatScoreUpdates: Record<string, any> = {};
    Object.entries(scoreUpdates).forEach(([k, v]) => { flatScoreUpdates[`scores/${k}`] = v; });

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        ...flatScoreUpdates,
        phase: 'result',
        caughtInsider,
        topVoted,
        timerEnd: null
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleTimeUpLocal = useCallback(async () => {
    if (!isHost) return;
    const phase = roomData?.gameData?.phase;
    if (phase === 'discussion') {
      await handleTimeUp();
    } else if (phase === 'voting') {
      await handleVoteEnd();
    }
  }, [isHost, roomData?.gameData?.phase]);

  const { timeLeft } = useGameTimer(roomData?.gameData?.timerEnd, isHost ? handleTimeUpLocal : null);

  useEffect(() => {
    const phase = roomData?.gameData?.phase;
    if (phase === 'waiting' || phase === 'reveal') {
      personalRecordedRef.current = false;
    }
    if (phase === 'voting') {
      feedback('newRound');
    } else {
      if (votedFor !== '') setTimeout(() => setVotedFor(''), 0);
    }
    if (phase === 'result') {
      feedback('spyReveal');
    }
    advancingRef.current = false;
  }, [roomData?.gameData?.phase]);

  useEffect(() => {
    const phase = roomData?.gameData?.phase;
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('twentyquestions');
    const scores = roomData?.gameData?.scores || {};
    const sorted = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));
    if (sorted.length > 0 && sorted[0][0] === userNickname && (sorted[0][1] as number) > 0) {
      recordPersonalWin('twentyquestions');
    }
  }, [roomData?.gameData?.phase, roomData?.gameData?.scores, userNickname]);

  useEffect(() => {
    const phase = roomData?.gameData?.phase;
    const players = Object.keys(roomData?.players || {});
    const nonHostPlayers = players.filter(p => p !== roomData?.host);
    if (phase !== 'voting' || !isHost || advancingRef.current) return;
    const currentVotes = roomData?.gameData?.votes || {};
    const totalVoted = Object.keys(currentVotes).length;
    if (totalVoted >= nonHostPlayers.length && totalVoted > 0) {
      handleVoteEnd();
    }
  }, [roomData?.gameData?.votes, roomData?.gameData?.phase, isHost, roomData?.players, roomData?.host]);

  if (!roomData) return null;

  const gameData = roomData?.gameData || {};
  const players = Object.keys(roomData?.players || {});
  const nonHostPlayers = players.filter(p => p !== roomData?.host);

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

  const discussionTime = gameData.discussionTime || 300;
  const showCategory = gameData.showCategory !== false;

  const handleStartGame = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('gameStart');
    const initScores: Record<string, number> = {};
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

  const handleVote = async (target: string) => {
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

  const handleNextRound = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    feedback('newRound');

    const newUsedWords = [...usedWords, secretWord];

    try {
      if (roundNumber >= nonHostPlayers.length) {
        await safeUpdate(`rooms/${roomId}/gameData`, { phase: 'finished', usedWords: newUsedWords, timerEnd: null });
        feedback('victory');
        const sortedScores = Object.entries(scores).sort((a: any, b: any) => b[1] - a[1]);
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
    const initScores: Record<string, number> = {};
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

  const handleBackToLobby = async () => {
    if (!isHost || backToLobbyRef.current) return;
    backToLobbyRef.current = true;
    try {
      await safeUpdate(`rooms/${roomId}`, { status: 'waiting', currentGame: null, gameData: null });
    } finally {
      backToLobbyRef.current = false;
    }
  };

  const sortedScores = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));

  // ════════════════════════════════════════════════════════════════
  // WAITING
  // ════════════════════════════════════════════════════════════════
  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 animate-fade-in bg-slate-950 text-slate-200 px-4">
        {renderErrorToast()}
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} className="text-7xl select-none drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]">
          🕵️
        </motion.div>

        <div className="text-center">
          <h2 className="font-black text-[28px] uppercase tracking-widest text-white mb-2 drop-shadow-md">{t('insider.title')}</h2>
          <p className="text-slate-400 text-[12px] font-bold leading-relaxed px-4 max-w-sm">
            {t('insider.description')}
          </p>
        </div>

        <NeonCard color="purple" className="p-4 w-full max-w-xs text-left bg-purple-950/20 border-purple-500/30">
          <div className="space-y-3 font-medium text-[11px] leading-relaxed text-slate-300">
            <div className="flex items-center gap-3">
              <span className="text-[16px] drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">👑</span><span><strong className="text-amber-400">{t('insider.roleMaster')}</strong> {t('insider.roleMasterDesc')}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[16px] drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">🕵️</span><span><strong className="text-purple-400">{t('insider.roleInsider')}</strong> {t('insider.roleInsiderDesc')}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[16px] drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">❓</span><span><strong className="text-emerald-400">{t('insider.roleCommon')}</strong> {t('insider.roleCommonDesc')}</span>
            </div>
          </div>
        </NeonCard>

        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl w-full max-w-xs">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">{t('taboo.players')} {players.length} {t('spyfall.startGame').split(' ')[1]}</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {players.map(p => (
              <span key={p} className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${p === roomData.host ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                {p === roomData.host ? `👑 ${p}` : p === userNickname ? `${p} (${t('taboo.you')})` : p}
              </span>
            ))}
          </div>
        </div>

        {isHost ? (
          <>
            <div className="w-full max-w-xs">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">{t('insider.categoryTitle')}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => setSelectedCategories([])}
                  className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${
                    selectedCategories.length === 0
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  {t('taboo.cardPackAll')}
                </button>
                {ALL_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategories(prev =>
                      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                    )}
                    className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${
                      selectedCategories.includes(cat)
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-full max-w-xs bg-slate-900/50 p-4 rounded-3xl border border-slate-800">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">แสดงหมวดหมู่ระหว่างเล่น</p>
                <button
                  onClick={() => setShowCategorySetting(!showCategorySetting)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${showCategorySetting ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${showCategorySetting ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
            <div className="w-full max-w-xs">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">{t('taboo.roundTime')}</p>
              <div className="flex gap-2">
                {DISCUSSION_TIME_OPTIONS(t).map(opt => (
                  <button
                    key={opt.seconds}
                    onClick={() => setSelectedTime(opt.seconds)}
                    className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-colors ${
                      selectedTime === opt.seconds
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <GiantButton color="purple" onClick={handleStartGame} className="w-full max-w-xs" disabled={nonHostPlayers.length < 2}>
              <Play size={20} fill="currentColor" className="mr-2 inline-block mb-1" /> {t('insider.startGame')}
            </GiantButton>
            {nonHostPlayers.length < 2 && (
              <p className="text-center text-[11px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl mt-2 w-full max-w-xs">
                {t('taboo.minPlayers')} (ไม่นับ Host)
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 mt-8">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-purple-500 rounded-full animate-spin shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 animate-pulse">{t('insider.waitingHost')}</span>
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
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-6 animate-fade-in bg-slate-950 text-slate-200 px-4">
        {renderErrorToast()}
        <div className="text-[10px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/30 px-4 py-2 rounded-xl">
          {t('taboo.round')} {roundNumber}/{nonHostPlayers.length}
        </div>

        {isModerator && (
          <NeonCard color="amber" className="p-8 w-full max-w-xs text-center border-amber-500/30 bg-amber-950/20">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3">{t('insider.roleMaster')} 👑</p>
            {showCategory && <p className="text-[11px] font-bold text-slate-400 mb-4">{t('insider.category', { name: category })}</p>}
            <p className="font-black text-[36px] text-white drop-shadow-[0_0_15px_rgba(245,158,11,0.5)] mb-4 leading-tight">{secretWord}</p>
            <p className="text-[11px] font-medium text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800">{t('insider.roleMasterDesc').split('!')[1].trim()}</p>
            <div className="flex flex-col gap-3 mt-6 w-full">
              <button onClick={handleRerollWord} className="w-full py-4 text-[12px] font-black uppercase tracking-widest border border-amber-500/50 bg-amber-500/10 text-amber-400 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                <Shuffle size={16} /> {t('spyfall.actualLocation').split(' ')[0] === 'สถานที่' ? 'สุ่มใหม่' : 'Reroll'}
              </button>
              <GiantButton color="emerald" onClick={handleStartDiscussion} className="w-full">
                <Clock size={20} className="mr-2 inline-block mb-1" /> {t('taboo.startNow')} ({Math.floor(discussionTime / 60)} {t('taboo.roundTime').includes('Time') ? 'min' : 'นาที'})
              </GiantButton>
            </div>
          </NeonCard>
        )}

        {isInsider && !isModerator && (
          <NeonCard color="purple" className="p-8 w-full max-w-xs text-center border-purple-500/30 bg-purple-950/20">
            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-3">{t('insider.roleInsider')} 🕵️</p>
            {showCategory && <p className="text-[11px] font-bold text-slate-400 mb-4">{t('insider.category', { name: category })}</p>}
            <p className="font-black text-[36px] text-white drop-shadow-[0_0_15px_rgba(168,85,247,0.5)] mb-4 leading-tight">{secretWord}</p>
            <p className="text-[11px] font-medium text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800">{t('insider.roleInsiderDesc')}</p>
            <div className="flex flex-col items-center gap-3 mt-8">
              <div className="w-6 h-6 border-4 border-slate-800 border-t-purple-500 rounded-full animate-spin shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse">{t('insider.waitingHost')}</span>
            </div>
          </NeonCard>
        )}

        {!isModerator && !isInsider && (
          <NeonCard color="emerald" className="p-8 w-full max-w-xs text-center border-emerald-500/30 bg-emerald-950/20">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3">{t('insider.roleCommon')} 🏘️</p>
            {showCategory && <p className="text-[11px] font-bold text-slate-400 mb-4">{t('insider.category', { name: category })}</p>}
            <p className="font-black text-[42px] text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] mb-4">???</p>
            <p className="text-[11px] font-medium text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800">{t('insider.roleCommonDesc')}</p>
            <div className="flex flex-col items-center gap-3 mt-8">
              <div className="w-6 h-6 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse">{t('insider.waitingHost')}</span>
            </div>
          </NeonCard>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // DISCUSSION — Ask questions + guess
  // ════════════════════════════════════════════════════════════════
  if (phase === 'discussion') {
    return (
      <div className="flex-1 flex flex-col gap-3 min-h-0 animate-fade-in bg-slate-950 text-slate-200 px-4 py-4">
        {renderErrorToast()}
        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex justify-between items-center shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
            {t('taboo.round')} {roundNumber}/{nonHostPlayers.length}
          </span>
          <TimerDisplay timeLeft={timeLeft} />
        </div>

        {/* Category + Word hints */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex items-center justify-between">
          {showCategory && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('insider.categoryTitle')}:</span>
              <span className="text-[14px] font-black text-slate-300">{category}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {(isModerator || isInsider) && (
              <span className={`text-[10px] font-black uppercase tracking-widest border px-3 py-1.5 rounded-xl ${
                isModerator ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-purple-400 bg-purple-500/10 border-purple-500/30'
              }`}>
                {t('insider.secretWord')}: <span className="text-[14px]">{secretWord}</span>
              </span>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 text-center rounded-3xl">
          {isModerator ? (
            <div>
              <p className="text-[12px] font-black text-amber-400 uppercase tracking-widest mb-2">{t('insider.roleMasterDesc')}</p>
              <p className="text-[11px] font-bold text-slate-500">{t('taboo.selectWhoCorrect')}</p>
            </div>
          ) : (
            <div>
              <p className="text-[12px] font-black text-emerald-400 uppercase tracking-widest mb-2">{t('insider.roleCommonDesc')}</p>
              <p className="text-[11px] font-bold text-slate-500">{t('taboo.shoutAnswer')}</p>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Host: mark who guessed correctly */}
        {isModerator && !wordGuessed && (
          <NeonCard color="emerald" className="p-4 border-emerald-500/30 bg-emerald-950/20">
            {!confirmGuesser ? (
              <>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 text-center">{t('taboo.whoCorrect')}</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {nonHostPlayers.map(p => (
                    <button
                      key={p}
                      onClick={() => setConfirmGuesser(p)}
                      className="text-[12px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 active:scale-95 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all"
                    >
                      ✓ {p}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="text-[12px] font-black text-slate-300 mb-4">{t('taboo.someoneCorrect')} <span className="text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">{confirmGuesser}</span> {t('taboo.correct')}</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setConfirmGuesser(null)}
                    className="flex-1 py-3 text-[11px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-400 rounded-2xl active:scale-95 transition-all hover:border-slate-500"
                  >
                    {t('taboo.cancel')}
                  </button>
                  <GiantButton
                    color="emerald"
                    className="flex-1"
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
                  >
                    {t('target.confirmTarget')}
                  </GiantButton>
                </div>
              </div>
            )}
          </NeonCard>
        )}

        {/* Non-host: waiting indicator */}
        {!isModerator && !wordGuessed && (
          <div className="bg-slate-900/50 border border-slate-800 p-6 text-center rounded-3xl flex flex-col items-center gap-3">
            <div className="text-4xl animate-bounce">🗣️</div>
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400 animate-pulse">{t('taboo.listenAndAnswer')}</p>
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

    return (
      <div className="flex-1 flex flex-col gap-4 py-4 animate-fade-in bg-slate-950 text-slate-200 px-4">
        {renderErrorToast()}
        <div className="text-center">
          <span className="text-5xl drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]">🗳️</span>
          <h3 className="font-black text-[24px] uppercase tracking-widest text-white mt-4 drop-shadow-md">{t('insider.votingPhase')}</h3>
          <p className="text-[12px] font-bold text-slate-400 mt-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl inline-block">{t('insider.voteInsider')}</p>
        </div>

        <div className="flex-center gap-4 mt-2">
          <TimerDisplay timeLeft={timeLeft} />
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 bg-rose-500/10 border border-rose-500/30 px-4 py-2 rounded-xl">
            🗳️ {voteCount}/{totalVoters}
          </span>
        </div>

        <NeonCard color="emerald" className="p-4 text-center border-emerald-500/30 bg-emerald-950/20">
          <p className="text-[12px] font-medium text-slate-300">{t('insider.wordGuessedDesc', { name: guesser })} "<span className="font-black text-emerald-400">{secretWord}</span>" {t('taboo.correct')}</p>
        </NeonCard>

        {/* Vote buttons */}
        {!isModerator && (
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">{t('spyfall.votePanelDesc')}:</p>
            <div className="space-y-2">
              {nonHostPlayers.filter(p => p !== userNickname).map(p => (
                <button
                  key={p}
                  onClick={() => handleVote(p)}
                  disabled={!!votedFor}
                  className={`w-full p-4 rounded-2xl text-left font-black text-[14px] uppercase tracking-widest border transition-all ${
                    votedFor === p
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.3)]'
                      : votedFor
                        ? 'bg-slate-900 border-slate-800 text-slate-600'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white active:scale-95'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {votedFor === p ? <span className="text-xl">🗳️</span> : <span className="w-5" />}
                    {p}
                  </div>
                </button>
              ))}
            </div>
            {votedFor && <p className="text-[10px] text-rose-400 font-black uppercase tracking-widest mt-4 text-center animate-pulse">{t('insider.voted')}</p>}
          </div>
        )}

        {isModerator && (
          <NeonCard color="slate" className="p-6 text-center border-slate-800 bg-slate-900">
            <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('insider.voted')} <span className="text-white">{voteCount}/{totalVoters}</span></p>
            <GiantButton
              color="rose"
              onClick={handleVoteEnd}
              disabled={voteCount === 0}
              className="w-full"
            >
              {t('quiz.viewResults')}
            </GiantButton>
          </NeonCard>
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
      <div className="flex-1 flex flex-col gap-4 py-4 animate-fade-in bg-slate-950 text-slate-200 px-4 h-full pb-24">
        {renderErrorToast()}
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mt-4">
          <span className={`text-6xl drop-shadow-[0_0_20px_rgba(${caughtInsider ? '16,185,129' : wordGuessed ? '168,85,247' : '239,68,68'},0.5)]`}>
            {caughtInsider ? '🎉' : wordGuessed ? '🕵️' : '⏰'}
          </span>
          <h3 className="font-black text-[24px] uppercase tracking-widest text-white mt-4 drop-shadow-md">
            {!wordGuessed ? t('taboo.timeUp') : caughtInsider ? t('insider.commonsWin') : t('insider.insiderWin')}
          </h3>
        </motion.div>

        <NeonCard color="purple" className="p-6 text-center border-purple-500/30 bg-purple-950/20 mt-2">
          <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-3">{t('insider.insiderWas', { name: '' }).trim()}</p>
          <p className="font-black text-[32px] text-white drop-shadow-[0_0_15px_rgba(168,85,247,0.5)] leading-tight">{insiderName}</p>
          {wordGuessed && topVoted && (
            <div className="mt-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
              <p className="text-[11px] font-bold text-slate-400">
                {t('spyfall.spyGuessed').split(' ')[0] === 'สายลับ' ? 'โดนโหวตมากสุด' : 'Top Voted'}: <span className="font-black text-slate-200">{topVoted}</span>
                {caughtInsider ? ' ✅' : ' ❌'}
              </p>
            </div>
          )}
        </NeonCard>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl text-center">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{t('insider.secretWord')}</p>
          <p className="font-black text-[24px] text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">{secretWord}</p>
          <p className="text-[11px] font-bold text-slate-500 mt-1">{category}</p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl">
          <h3 className="font-black text-[10px] text-slate-500 uppercase tracking-widest mb-3 text-center">📊 {t('taboo.currentScores')}</h3>
          <div className="space-y-2">
            {sortedScores.map(([name, score], idx) => (
              <div key={name} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] font-black text-slate-500 w-4">{idx + 1}</span>
                <span className="flex-1 font-black text-[13px] text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  {name}
                  {name === insiderName && <span className="text-[8px] text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded-md">Insider</span>}
                </span>
                <span className="font-black text-[16px] text-emerald-400">{score as number}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50">
          {isHost ? (
            <GiantButton color="emerald" onClick={handleNextRound} className="w-full">
              {roundNumber >= nonHostPlayers.length ? t('taboo.viewResults') : t('taboo.nextRound')}
            </GiantButton>
          ) : (
            <div className="flex-center gap-3 py-3">
              <div className="w-5 h-5 border-2 border-slate-800 border-t-emerald-500 rounded-full animate-spin" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{t('insider.waitingHost')}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // FINISHED
  // ════════════════════════════════════════════════════════════════
  if (phase === 'finished') {
    const topPlayer = sortedScores[0];
    return (
      <div className="flex-1 flex flex-col gap-4 py-4 animate-fade-in bg-slate-950 text-slate-200 px-4 pb-24 h-full">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        
        <div className="text-center mt-6">
          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }} className="text-6xl mb-4 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
            🏆
          </motion.div>
          <h2 className="font-black text-[28px] uppercase tracking-widest text-white drop-shadow-md">{t('quiz.finished')}</h2>
        </div>

        {topPlayer && (
          <NeonCard color="amber" className="p-8 text-center border-amber-500/50 bg-amber-950/20 shadow-[0_0_30px_rgba(245,158,11,0.15)] mt-4">
            <Crown size={32} className="text-amber-400 mx-auto mb-4 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            <p className="font-black text-[10px] text-amber-500 uppercase tracking-widest mb-2">{t('spyfall.citizenWin').split(' ')[0] === 'พลเมือง' ? 'ผู้ชนะ' : 'Winner'}</p>
            <p className="font-black text-[32px] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] leading-tight">{topPlayer[0]}</p>
            <p className="text-[16px] font-black text-amber-400 mt-2">{topPlayer[1]} <span className="text-[10px] text-amber-500/70">{t('taboo.pointsGuesser').split(' ')[1]}</span></p>
          </NeonCard>
        )}

        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl mt-4">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 text-center">{t('taboo.totalScores')}</h3>
          <div className="space-y-2">
            {sortedScores.map(([name, score], idx) => (
              <div key={name} className={`flex justify-between items-center p-4 rounded-2xl border ${
                idx === 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900 border-slate-800'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl drop-shadow-md">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : <span className="text-slate-600 text-sm font-black w-8 text-center inline-block">#{idx + 1}</span>}</span>
                  <span className={`font-black text-[14px] uppercase tracking-widest ${idx === 0 ? 'text-amber-400' : 'text-slate-300'}`}>{name}</span>
                </div>
                <span className={`font-black text-[18px] ${idx === 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{score as number}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50 flex gap-3">
          {isHost ? (
            <>
              <GiantButton color="emerald" className="flex-1" onClick={handlePlayAgain}>
                <RotateCcw size={18} className="mr-2 inline-block mb-0.5" />
                {t('taboo.playAgain')}
              </GiantButton>
              <button className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all hover:border-slate-500" onClick={handleBackToLobby}>
                <LogOut size={16} className="mr-2 inline-block mb-0.5" />
                {t('quiz.backToLobby')}
              </button>
            </>
          ) : (
            <button className="w-full py-4 text-[12px] font-black uppercase tracking-widest border border-red-500/50 bg-red-500/10 text-red-500 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-500/20" onClick={requestLeave}>
              <LogOut size={16} /> {t('taboo.leaveRoom')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-center flex-1 flex-col gap-4 bg-slate-950">
      {renderErrorToast()}
      <div className="w-10 h-10 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
      <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest animate-pulse">{t('common.loading')}</p>
    </div>
  );
};

export default TwentyQuestions;
