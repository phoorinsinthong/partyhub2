// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, increment } from 'firebase/database';
import { db } from '../firebase';
import { useTranslation } from 'react-i18next';
import { useGame } from '../contexts/GameContext';
import { useGameTimer } from '../hooks/useGameTimer';
import { TimerDisplay } from '../components/game-ui/TimerDisplay';
import { Clock, Crown, SkipForward, EyeOff, LogOut, RotateCcw } from 'lucide-react';
import { getRandomCards } from './logic/tabooData';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useTurnNotification } from '../hooks/useTurnNotification';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { feedback } from '../utils/feedback';
import NeonCard from '../components/NeonCard';
import GiantButton from '../components/GiantButton';

const ROUND_TIME = 60;
const MAX_SKIPS = 2;

function shuffle(arr: any[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const Taboo = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  
  const [showGuesserPicker, setShowGuesserPicker] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cardMode, setCardMode] = useState('all');
  const lastCountdownRef = useRef<number | null>(null);
  const advancingRef = useRef(false);
  const skipRef = useRef(false);
  const confirmRef = useRef(false);
  const correctGuessRef = useRef(false);
  const personalRecordedRef = useRef(false);
  const startGameRef = useRef(false);

  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');

  const renderErrorToast = () => {
    if (!errorMsg) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
        {errorMsg}
      </div>
    );
  };

  const safeUpdate = useCallback(async (path: string, data: any) => {
    try {
      await update(ref(db, path), data);
    } catch {
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  }, [t]);

  const handleTimeUp = useCallback(async () => {
    if (!isHost) return;
    feedback('timeUp');

    await safeUpdate(`rooms/${roomId}/gameData`, {
      phase: 'roundEnd',
      roundResult: 'timeUp',
      roundEndedAt: Date.now(),
      timerEnd: null
    });
  }, [isHost, roomId, safeUpdate]);

  const { timeLeft } = useGameTimer(roomData?.gameData?.timerEnd, isHost ? handleTimeUp : null);

  const currentDescriber = roomData?.gameData?.describerOrder?.[roomData?.gameData?.currentDescriberIndex ?? 0] || '';
  const isDescriber = userNickname === currentDescriber;
  const phase = roomData?.gameData?.phase || 'waiting';

  useTurnNotification(isDescriber, phase);

  useEffect(() => {
    if (timeLeft <= 5 && timeLeft > 0 && timeLeft !== lastCountdownRef.current) {
      lastCountdownRef.current = timeLeft;
      feedback('countdown');
    }
  }, [timeLeft]);

  useEffect(() => {
    if (phase === 'waiting' || phase === 'playing' || phase === 'choosing') {
      personalRecordedRef.current = false;
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('taboo');
    const scores = roomData?.gameData?.scores || {};
    const sorted = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));
    if (sorted.length > 0 && sorted[0][0] === userNickname && (sorted[0][1] as number) > 0) {
      recordPersonalWin('taboo');
    }
  }, [phase, roomData?.gameData?.scores, userNickname]);

  useEffect(() => {
    advancingRef.current = false;
    skipRef.current = false;
    confirmRef.current = false;
    correctGuessRef.current = false;
    lastCountdownRef.current = null;
  }, [roomData?.gameData?.round, phase]);

  const handleNextRound = useCallback(async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;

    const gameData = roomData?.gameData || {};
    const currentDescriberIndex = gameData.currentDescriberIndex ?? 0;
    const describerOrder = gameData.describerOrder || [];
    const scores = gameData.scores || {};
    const currentCard = gameData.currentCard || null;
    const usedWords = gameData.usedWords || [];
    const round = gameData.round || 1;

    const nextIndex = currentDescriberIndex + 1;
    const newUsedWords = currentCard ? [...usedWords, currentCard.word] : usedWords;

    try {
      if (nextIndex >= describerOrder.length) {
        const sortedScores = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));
        await safeUpdate(`rooms/${roomId}/gameData`, {
          phase: 'finished',
          usedWords: newUsedWords,
          timerEnd: null
        });
        if (sortedScores.length > 0 && (sortedScores[0][1] as number) > 0) {
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
          timerEnd: null,
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
  }, [isHost, roomId, safeUpdate, roomData?.gameData]);

  useEffect(() => {
    if (phase !== 'roundEnd' || !isHost) return;
    const t = setTimeout(handleNextRound, 3500);
    return () => clearTimeout(t);
  }, [phase, isHost, handleNextRound]);

  if (!roomData) return null;

  const gameData = roomData?.gameData || {};
  const players = Object.keys(roomData?.players || {});
  const currentDescriberIndex = gameData.currentDescriberIndex ?? 0;
  const describerOrder = gameData.describerOrder || [];
  const currentCard = gameData.currentCard || null;
  const scores = gameData.scores || {};
  const round = gameData.round || 1;
  const totalRounds = gameData.totalRounds || players.length;
  const usedWords = gameData.usedWords || [];
  const skipsUsed = gameData.skipsUsed || 0;

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
        timerEnd: null,
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
        timerEnd: Date.now() + (ROUND_TIME * 1000),
      });
    } finally {
      confirmRef.current = false;
    }
  };

  // ─── Describer: Handle correct guess ───
  const handleCorrectGuess = async (guesserName: string) => {
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
        timerEnd: null
      });
    } finally {
      correctGuessRef.current = false;
    }
  };

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
        timerEnd: null,
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

  const sortedScores = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));

  // ──────────────────────────────────────────────
  // PHASE: waiting
  // ──────────────────────────────────────────────
  if (phase === 'waiting') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8 bg-slate-950 text-slate-200">
        {renderErrorToast()}
        <motion.div
          className="text-8xl drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]"
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}
        >
          🤫
        </motion.div>
        <div className="text-center px-4">
          <h2 className="font-black text-[32px] uppercase tracking-widest text-slate-200 mb-2 drop-shadow-md">{t('taboo.title')}</h2>
          <p className="text-slate-400 text-[12px] font-bold leading-relaxed max-w-xs mx-auto">
            {t('taboo.description')}
          </p>
        </div>

        <NeonCard color="amber" className="p-4 w-full max-w-xs space-y-2 border-amber-500/30 bg-amber-900/10">
          <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
            <span className="text-slate-500">{t('taboo.players')}</span>
            <span className="text-amber-500">{players.length} {t('common.people') || 'คน'}</span>
          </div>
          <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
            <span className="text-slate-500">{t('taboo.roundTime')}</span>
            <span className="text-amber-500">{ROUND_TIME} {t('common.seconds') || 'วินาที'}</span>
          </div>
          <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
            <span className="text-slate-500">{t('taboo.maxSkips')}</span>
            <span className="text-amber-500">{MAX_SKIPS} {t('common.times') || 'ครั้ง'}/{t('common.round') || 'รอบ'}</span>
          </div>
          <hr className="border-slate-800" />
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 space-y-1 mt-2">
            <p className="flex items-center gap-2"><span className="text-emerald-500 text-[14px]">🎯</span> {t('taboo.pointsDescriber')}</p>
            <p className="flex items-center gap-2"><span className="text-amber-500 text-[14px]">✅</span> {t('taboo.pointsGuesser')}</p>
          </div>
        </NeonCard>

        {isHost ? (
          <>
            <div className="w-full max-w-xs px-2 mt-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 text-center">{t('taboo.cardPack')}</p>
              <div className="flex gap-2">
                {[
                  { id: 'all', label: t('taboo.cardPackAll') },
                  { id: 'normal', label: t('taboo.cardPackNormal') },
                  { id: 'funny', label: t('taboo.cardPackFunny') },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setCardMode(opt.id)}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                      cardMode === opt.id
                        ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)] text-amber-400'
                        : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <GiantButton
              color="emerald"
              onClick={handleStartGame}
              className="w-full max-w-xs mt-4"
              disabled={players.length < 2}
            >
              {t('taboo.startGame')}
            </GiantButton>
            {players.length < 2 && (
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-950/50 border border-red-500/30 p-2.5 rounded-xl w-full max-w-xs mt-2">
                {t('taboo.minPlayers')}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 mt-8">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-amber-500 rounded-full animate-spin shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 animate-pulse">{t('taboo.waitingHost')}</span>
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
      <div className="flex-1 flex flex-col gap-4 py-4 bg-slate-950 pb-24 text-slate-200">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className="text-center">
          <div className="text-7xl mb-2 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">🏆</div>
          <h2 className="font-black text-[28px] uppercase tracking-widest text-slate-200 mt-2 drop-shadow-md">{t('common.finished') || 'จบเกม!'}</h2>
        </div>

        {winner && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-6 text-center border-amber-500/50 bg-amber-900/20 mx-4 shadow-[0_0_30px_rgba(245,158,11,0.15)] rounded-3xl border"
          >
            <Crown size={32} className="text-amber-400 mx-auto mb-3 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
            <p className="font-black text-[18px] uppercase tracking-widest text-amber-500">{winner[0]}</p>
            <p className="text-[32px] font-black text-white drop-shadow-md">{winner[1]} {t('common.points') || 'คะแนน'}</p>
          </motion.div>
        )}

        <div className="p-4 mx-4 bg-slate-900/50 border border-slate-800 rounded-3xl backdrop-blur-sm">
          <h3 className="font-black text-[12px] uppercase tracking-widest text-slate-400 mb-4 text-center">📊 {t('taboo.totalScores')}</h3>
          <div className="space-y-3">
            {sortedScores.map(([name, score], idx) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.07 }}
                className="flex items-center gap-4 p-3 rounded-2xl bg-slate-900 border border-slate-800"
              >
                <span className={`w-8 h-8 rounded-xl flex-center text-[12px] font-black shrink-0 ${idx === 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/50' : idx === 2 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/50' : 'bg-slate-800 text-slate-500'}`}>
                  {idx + 1}
                </span>
                <span className={`flex-1 font-black text-[14px] uppercase tracking-widest ${idx === 0 ? 'text-amber-400' : 'text-slate-300'}`}>{name}</span>
                <span className={`font-black text-[16px] ${idx === 0 ? 'text-white' : 'text-slate-400'}`}>{score as number}</span>
                {name === userNickname && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-md">{t('taboo.you')}</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {isHost ? (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50 flex gap-3">
            <GiantButton color="emerald" onClick={handlePlayAgain} className="flex-1">
              <RotateCcw size={16} className="mr-2 inline-block" /> {t('taboo.playAgain')}
            </GiantButton>
            <button onClick={handleBackToLobby} className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:border-slate-500">
              <LogOut size={14} /> {t('taboo.backToLobby')}
            </button>
          </div>
        ) : (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50">
            <button
              className="w-full py-4 text-[12px] font-black uppercase tracking-widest border border-red-500/50 bg-red-500/10 text-red-500 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-red-500/20"
              onClick={requestLeave}
            >
              <LogOut size={15} /> {t('taboo.leaveRoom')}
            </button>
          </div>
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
        <div className="flex-1 flex flex-col gap-4 py-4 px-2 bg-slate-950 text-slate-200">
          {renderErrorToast()}
          {/* Round info */}
          <div className="flex-between px-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              {t('taboo.round')} {round}/{totalRounds}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg shadow-[0_0_10px_rgba(245,158,11,0.2)]">
              {t('taboo.youAreDescriber')}
            </span>
          </div>

          <div className="text-center mb-2 mt-4">
            <p className="text-[20px] font-black uppercase tracking-widest text-white drop-shadow-md">{t('taboo.chooseYourCard')}</p>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mt-2">{t('taboo.skipsLeft', { count: skipsLeft })}</p>
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
                className="p-8 text-center bg-slate-900 border border-slate-700 rounded-3xl mx-2 shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                style={{ perspective: 600 }}
              >
                {/* Secret word */}
                <p className="text-[10px] font-black text-slate-500 mb-4 uppercase tracking-widest">{t('taboo.secretWord')}</p>
                <p className="font-black text-[42px] text-white mb-6 uppercase tracking-widest drop-shadow-lg">
                  {card.word}
                </p>

                {/* Taboo words */}
                <p className="text-[10px] font-black text-red-500/70 mb-3 uppercase tracking-wider">{t('taboo.tabooWords')}</p>
                <div className="flex flex-col gap-2 justify-center max-w-[200px] mx-auto">
                  {(card.taboo || card.examples || []).map((w: string) => (
                    <span
                      key={w}
                      className="bg-red-500/10 border border-red-500/30 text-red-400 text-[14px] font-black uppercase tracking-widest px-4 py-2 rounded-xl"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-3 mt-auto mb-4 mx-2">
            <button
              onClick={handleSkip}
              disabled={skipsLeft <= 0}
              className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:border-slate-500 disabled:opacity-30 disabled:grayscale"
            >
              <SkipForward size={16} />
              {t('taboo.skip')} ({skipsLeft})
            </button>
            <GiantButton
              color="emerald"
              onClick={handleConfirmCard}
              className="flex-[2]"
            >
              {t('taboo.startNow')}
            </GiantButton>
          </div>
        </div>
      );
    }

    // Non-describer waiting view
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-6 bg-slate-950 text-slate-200">
        {renderErrorToast()}
        <motion.div
          className="text-7xl drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          🤔
        </motion.div>
        <div className="text-center px-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{t('taboo.round')} {round}/{totalRounds}</p>
          <p className="font-black text-[22px] uppercase tracking-widest text-white drop-shadow-md">
            {t('taboo.isChoosing', { name: currentDescriber })}
          </p>
        </div>

        {/* Mini scores */}
        {Object.keys(scores).length > 0 && (
          <div className="p-4 w-full max-w-xs mt-6 bg-slate-900/50 border border-slate-800 rounded-3xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 text-center">{t('taboo.currentScores')}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {sortedScores.map(([name, score]) => (
                <div key={name} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 max-w-[70px] truncate">{name}</span>
                  <span className="text-[12px] font-black text-emerald-400">{score as number}</span>
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
      <div className="flex-1 flex flex-col gap-4 py-6 bg-slate-950 pb-24 text-slate-200">
        {renderErrorToast()}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center px-4"
        >
          <span className="text-7xl drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">{correct ? '🎉' : '⏰'}</span>
          <h3 className="font-black text-[28px] uppercase tracking-widest text-white mt-4 drop-shadow-md">
            {correct ? t('taboo.correct') : t('taboo.timeUp')}
          </h3>
          {correct && correctGuesser && (
            <p className="text-[12px] font-black uppercase tracking-widest text-slate-400 mt-2 bg-emerald-500/10 border border-emerald-500/30 inline-block px-4 py-2 rounded-xl">
              <span className="text-emerald-400">{correctGuesser}</span> {t('taboo.correct')}
            </p>
          )}
        </motion.div>

        {/* Reveal card */}
        {currentCard && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="p-6 text-center bg-slate-900 border border-slate-700 rounded-3xl mx-4 mt-4 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
          >
            <p className="text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest">{t('taboo.secretWordWas')}</p>
            <p className="font-black text-[36px] uppercase tracking-widest text-white mb-5 drop-shadow-lg">
              {currentCard.word}
            </p>
            <p className="text-[10px] font-black text-red-500/70 mb-3 uppercase tracking-wider">{t('taboo.tabooWords')}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {(currentCard.taboo || currentCard.examples || []).map((w: string) => (
                <span key={w} className="bg-red-500/10 border border-red-500/30 text-red-400 text-[12px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl">
                  {w}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Scores */}
        <div className="p-4 mx-4 bg-slate-900/50 border border-slate-800 rounded-3xl mt-4">
          <h3 className="font-black text-[12px] uppercase tracking-widest text-slate-500 mb-4 text-center">📊 {t('taboo.currentScores')}</h3>
          <div className="space-y-2">
            {sortedScores.map(([name, score], idx) => (
              <div key={name} className="flex items-center gap-4 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] font-black text-slate-600 w-4 text-center">{idx + 1}</span>
                <span className="flex-1 font-black text-[12px] uppercase tracking-widest text-slate-300">{name}</span>
                <span className="font-black text-[14px] text-emerald-400">{score as number}</span>
                {name === userNickname && (
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-md">{t('taboo.you')}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50">
            <GiantButton color="emerald" onClick={handleNextRound} className="w-full">
              {currentDescriberIndex + 1 >= describerOrder.length ? t('taboo.viewResults') : t('taboo.nextRound')}
            </GiantButton>
          </div>
        ) : (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50 flex justify-center">
            <div className="flex-center gap-3 text-slate-400">
              <span className="w-3 h-3 bg-amber-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
              <span className="text-[11px] font-black uppercase tracking-widest">{t('taboo.waitNextRound')}</span>
            </div>
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
    <div className="flex-1 flex flex-col gap-3 min-h-0 bg-slate-950 px-2 py-4">
      {renderErrorToast()}
      {/* Round header */}
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          {t('taboo.round')} {round}/{totalRounds}
        </span>
        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 text-center">
          {t('taboo.isExplaining', { name: currentDescriber })}
        </span>
        {/* Timer display */}
        <TimerDisplay timeLeft={timeLeft} size="sm" />
      </div>

      {/* ─── Describer view ─── */}
      {isDescriber ? (
        <div className="flex-1 flex flex-col gap-4 min-h-0 relative">
          {/* The secret card */}
          <div className="p-8 text-center bg-slate-900 border border-slate-700 rounded-3xl mx-2 flex flex-col justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <p className="text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest">{t('taboo.secretWord')}</p>
            <p className="font-black text-[42px] uppercase tracking-widest text-white leading-none mb-6 drop-shadow-lg">
              {currentCard?.word}
            </p>
            <p className="text-[10px] font-black text-red-500/70 mb-3 uppercase tracking-wider">{t('taboo.tabooWords')}</p>
            <div className="flex flex-col gap-2 justify-center max-w-[200px] mx-auto">
              {(currentCard?.taboo || currentCard?.examples || []).map((w: string) => (
                <span key={w} className="bg-red-500/10 border border-red-500/30 text-red-400 text-[14px] font-black uppercase tracking-widest px-4 py-2 rounded-xl">
                  {w}
                </span>
              ))}
            </div>
          </div>

          <div className="mx-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl mt-auto">
            <p className="text-[11px] text-amber-400 font-black uppercase tracking-widest text-center">
               {t('taboo.description')}
            </p>
          </div>

          {/* Correct guess button */}
          <div className="mx-2 mt-2">
            <GiantButton
              color="emerald"
              onClick={() => setShowGuesserPicker(true)}
              className="w-full"
            >
              {t('taboo.someoneCorrect')}
            </GiantButton>
          </div>

          {/* Guesser picker overlay */}
          <AnimatePresence>
            {showGuesserPicker && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-6 backdrop-blur-sm"
                onClick={() => setShowGuesserPicker(false)}
              >
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-sm shadow-[0_0_40px_rgba(0,0,0,1)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="font-black text-[20px] uppercase tracking-widest text-white text-center mb-2 drop-shadow-md">{t('taboo.whoCorrect')}</p>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 text-center mb-6">{t('taboo.selectWhoCorrect')}</p>
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 hide-scrollbar">
                    {nonDescribers.map((name) => (
                      <button
                        key={name}
                        onClick={() => handleCorrectGuess(name)}
                        className="w-full py-4 rounded-2xl text-[14px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-200 active:scale-95 transition-all hover:border-emerald-500 hover:text-emerald-400"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowGuesserPicker(false)}
                    className="w-full mt-6 text-[12px] font-black uppercase tracking-widest text-slate-500 py-3 border border-transparent hover:bg-slate-800 hover:border-slate-700 rounded-xl transition-all"
                  >
                    {t('taboo.cancel')}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* ─── Non-describer view ─── */
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {/* Hidden word card */}
          <div className="p-8 text-center w-full max-w-[280px] bg-slate-900 border border-slate-700 rounded-3xl mx-auto shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <p className="text-[10px] font-black text-slate-500 mb-4 uppercase tracking-widest">{t('taboo.secretWord')}</p>
            <p className="font-black text-[64px] text-slate-800 leading-none select-none mb-6 drop-shadow-md">
              ???
            </p>
            <p className="text-[10px] font-black text-slate-600 mb-2 uppercase tracking-wider">{t('taboo.tabooWords')}</p>
            <div className="flex items-center justify-center gap-2 text-slate-500 mt-4 bg-slate-950 p-2 rounded-xl">
              <EyeOff size={14} />
              <span className="text-[9px] font-black uppercase tracking-widest">{t('common.revealAfterRound') || 'เปิดเผยหลังรอบจบ'}</span>
            </div>
          </div>

          {/* Listening prompt */}
          <div className="p-6 text-center w-full max-w-[280px] mx-auto bg-emerald-500/10 border border-emerald-500/30 rounded-3xl">
            <p className="text-[40px] mb-4 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">👂</p>
            <p className="font-black text-[16px] uppercase tracking-widest text-emerald-400 mb-2">{t('taboo.listenAndAnswer')}</p>
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500/70">{t('taboo.shoutAnswer')}</p>
          </div>
        </div>
      )}

      {/* Mini score strip */}
      <div className="flex items-center gap-2 px-2 overflow-x-auto pb-2 mt-4 hide-scrollbar opacity-70">
        {sortedScores.map(([name, score]) => (
          <div
            key={name}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0 border ${
              name === currentDescriber ? 'bg-amber-500/20 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-slate-900 border-slate-800'
            }`}
          >
            {name === currentDescriber && <span className="text-[10px]">🎤</span>}
            <span className={`text-[10px] font-black uppercase tracking-widest max-w-[64px] truncate ${name === currentDescriber ? 'text-amber-400' : 'text-slate-500'}`}>{name}</span>
            <span className={`text-[11px] font-black ${name === currentDescriber ? 'text-white' : 'text-slate-300'}`}>{score as number}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Taboo;
