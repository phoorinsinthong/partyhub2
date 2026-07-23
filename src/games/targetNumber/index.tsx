// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, update, get } from 'firebase/database';
import { db } from '../../firebase';
import { Target, User, Trophy, Play, RotateCcw, Crown, Skull, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { recordWin } from '../../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../../components/PersonalStats';
import { useGameLeave } from '../../hooks/useGameLeave';
import { useGame } from '../../contexts/GameContext';
import { useGameUpdate } from '../../hooks/useGameUpdate';
import { useGameTimer } from '../../hooks/useGameTimer';
import { TimerDisplay } from '../../components/game-ui/TimerDisplay';
import { useTranslation } from 'react-i18next';
import LeaveConfirmModal from '../../components/LeaveConfirmModal';
import { feedback } from '../../utils/feedback';
import NeonCard from '../../components/NeonCard';
import GiantButton from '../../components/GiantButton';

const TURN_TIME = 30;

const TargetNumber = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { safeUpdate, errorMsg, setErrorMsg } = useGameUpdate(roomId);
  
  const [selectedTarget, setSelectedTarget] = useState('');
    const personalRecordedRef = useRef(false);
  const advancingRef = useRef(false);
  const startGameRef = useRef(false);

  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');

  const renderErrorToast = () => {
    if (!errorMsg) return null;
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border border-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-fade-in">
        {errorMsg}
      </div>
    );
  };

  
  const handleTimeUp = useCallback(async () => {
    if (!isHost) return;
    feedback('timeUp');

    const gameData = roomData?.gameData || {};
    const gameStatus = gameData.gameStatus || 'waiting';
    const playerNames = Object.keys(roomData?.players || {});
    const players = roomData?.players || {};
    const targetChooser = gameData.targetChooser || null;
    const currentPlayerIndex = gameData.currentPlayerIndex ?? null;
    const currentPlayer = gameData.playerOrder?.[currentPlayerIndex] || null;

    if (gameStatus === 'choosing_target') {
      const randomTarget = Math.floor(Math.random() * 100) + 1;
      const allPlayers = [...playerNames].sort((a, b) => {
        const aTime = players[a]?.joinedAt || 0;
        const bTime = players[b]?.joinedAt || 0;
        return aTime - bTime;
      });
      const chooserIdx = allPlayers.indexOf(targetChooser);
      const firstPlayerIndex = (chooserIdx + 1) % allPlayers.length;

      await safeUpdate(`rooms/${roomId}/gameData`, {
        gameStatus: 'playing',
        targetNumber: randomTarget,
        range: {
          min: Math.max(1, randomTarget - 5),
          max: Math.min(100, randomTarget + 5)
        },
        currentCount: 0,
        currentPlayerIndex: firstPlayerIndex,
        playerOrder: allPlayers,
        loser: null,
        lastMove: null,
        timerEnd: Date.now() + (TURN_TIME * 1000)
      });
    } else if (gameStatus === 'playing') {
      const currentCount = gameData.currentCount || 0;
      const target = gameData.targetNumber;
      const playerOrder = gameData.playerOrder || [];
      const newCount = currentCount + 1;
      const loser = newCount === target ? currentPlayer : null;
      const nextPlayerIndex = loser ? currentPlayerIndex : (currentPlayerIndex + 1) % playerOrder.length;
      
      const updates: any = {
        currentCount: newCount,
        currentPlayerIndex: nextPlayerIndex,
        lastMove: {
          player: currentPlayer,
          numbers: [newCount],
          increment: 1
        },
        timerEnd: loser ? null : Date.now() + (TURN_TIME * 1000)
      };

      if (loser) {
        updates.loser = loser;
        updates.gameStatus = 'finished';
        const currentScores = gameData.scores || {};
        const newScores = { ...currentScores };
        playerOrder.forEach(name => {
          if (name !== loser) newScores[name] = (newScores[name] || 0) + 1;
        });
        updates.scores = newScores;
      }

      await safeUpdate(`rooms/${roomId}/gameData`, updates);
    }
  }, [isHost, roomId, roomData]);

  const { timeLeft } = useGameTimer(roomData?.gameData?.timerEnd, isHost ? handleTimeUp : null);

  useEffect(() => {
    advancingRef.current = false;
  }, [roomData?.gameData?.roundNumber, roomData?.gameData?.gameStatus]);

  useEffect(() => {
    if (roomData?.gameData?.gameStatus === 'waiting' || roomData?.gameData?.gameStatus === 'playing') personalRecordedRef.current = false;
  }, [roomData?.gameData?.gameStatus]);

  useEffect(() => {
    if (roomData?.gameData?.gameStatus !== 'finished' || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    recordPersonalGame('target');
    const loser = roomData?.gameData?.loser;
    if (loser && loser !== userNickname) recordPersonalWin('target');
  }, [roomData?.gameData?.gameStatus, roomData?.gameData?.loser, userNickname]);

  useEffect(() => {
    if (!isHost || roomData?.gameData?.gameStatus !== 'playing') return;
    const playerOrder = roomData?.gameData?.playerOrder || [];
    const currentPlayerIndex = roomData?.gameData?.currentPlayerIndex ?? null;
    const current = playerOrder[currentPlayerIndex];
    if (current && !roomData?.players?.[current]) {
      const nextIndex = (currentPlayerIndex + 1) % playerOrder.length;
      setTimeout(() => {
        safeUpdate(`rooms/${roomId}/gameData`, { 
          currentPlayerIndex: nextIndex,
          timerEnd: Date.now() + (TURN_TIME * 1000)
        });
      }, 0);
    }
  }, [isHost, roomData?.gameData?.gameStatus, roomData?.gameData?.currentPlayerIndex, roomData?.gameData?.playerOrder, roomData?.players, roomId]);

  if (!roomData) return null;

  const gameData = roomData?.gameData || {};
  const players = roomData?.players || {};
  const playerNames = Object.keys(players);
  const gameStatus = gameData.gameStatus || 'waiting';
  const targetChooser = gameData.targetChooser || null;
  const isTargetChooser = targetChooser === userNickname;
  const currentPlayerIndex = gameData.currentPlayerIndex ?? null;
  const currentPlayer = gameData.playerOrder?.[currentPlayerIndex] || null;
  const isMyTurn = currentPlayer === userNickname;

  const startGame = async () => {
    if (!isHost) return;
    if (playerNames.length < 2) return;
    if (startGameRef.current) return;
    startGameRef.current = true;

    const chooserIndex = Math.floor(Math.random() * playerNames.length);

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        gameStatus: 'choosing_target',
        targetChooser: playerNames[chooserIndex],
        targetNumber: null,
        range: null,
        currentCount: 0,
        currentPlayerIndex: null,
        playerOrder: null,
        loser: null,
        lastMove: null,
        roundNumber: (gameData.roundNumber || 0) + 1,
        timerEnd: Date.now() + (TURN_TIME * 1000)
      });
    } finally {
      startGameRef.current = false;
    }
  };

  const handleSetTarget = async () => {
    const num = parseInt(selectedTarget, 10);
    if (isNaN(num) || num < 1 || num > 100) return;
    if (advancingRef.current) return;
    advancingRef.current = true;

    const allPlayers = [...playerNames].sort((a, b) => {
      const aTime = players[a]?.joinedAt || 0;
      const bTime = players[b]?.joinedAt || 0;
      return aTime - bTime;
    });

    const chooserIdx = allPlayers.indexOf(userNickname);
    const firstPlayerIndex = (chooserIdx + 1) % allPlayers.length;

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        gameStatus: 'playing',
        targetNumber: num,
        range: {
          min: Math.max(1, num - 5),
          max: Math.min(100, num + 5)
        },
        currentCount: 0,
        currentPlayerIndex: firstPlayerIndex,
        playerOrder: allPlayers,
        loser: null,
        lastMove: null,
        timerEnd: Date.now() + (TURN_TIME * 1000)
      });
    } finally {
      advancingRef.current = false;
    }

    setSelectedTarget('');
  };

  const handleMove = async (increment: number) => {
    if (!isMyTurn) return;
    if (gameStatus !== 'playing') return;
    if (advancingRef.current) return;
    advancingRef.current = true;

    const currentCount = gameData.currentCount || 0;
    const target = gameData.targetNumber;
    const playerOrder = gameData.playerOrder || [];

    const startNum = currentCount + 1;
    const numbersSaid = Array.from({ length: increment }, (_, i) => startNum + i);
    const newCount = currentCount + increment;

    let loser = null;
    if (numbersSaid.includes(target)) {
      loser = userNickname;
    }

    const nextPlayerIndex = loser
      ? currentPlayerIndex
      : (currentPlayerIndex + 1) % playerOrder.length;

    const updates = {
      currentCount: newCount,
      currentPlayerIndex: nextPlayerIndex,
      lastMove: {
        player: userNickname,
        numbers: numbersSaid,
        increment
      },
      timerEnd: loser ? null : Date.now() + (TURN_TIME * 1000)
    };

    if (loser) {
      updates.loser = loser;
      updates.gameStatus = 'finished';

      const currentScores = gameData.scores || {};
      const newScores = { ...currentScores };
      playerOrder.forEach(name => {
        if (name !== loser) {
          newScores[name] = (newScores[name] || 0) + 1;
        }
      });
      updates.scores = newScores;
    }

    try {
      await safeUpdate(`rooms/${roomId}/gameData`, updates);
      if (loser) {
        const newScores = (updates as any).scores;
        const topWinner = Object.entries(newScores).sort((a: any, b: any) => b[1] - a[1])[0];
        if (topWinner) await recordWin(roomId, topWinner[0], 'target');
      }
    } finally {
      advancingRef.current = false;
    }
  };

  const nextRound = () => {
    startGame();
  };

  // Waiting screen
  if (gameStatus === 'waiting') {
    return (
      <div className="flex flex-col gap-4 w-full animate-fade-in bg-slate-950 text-slate-200 py-4 px-2">
        {renderErrorToast()}
        <div className="text-center">
          <motion.div
            className="text-8xl drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] mb-4 flex-center"
            animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            🎯
          </motion.div>
          <h2 className="font-black text-[32px] uppercase tracking-widest text-white mb-2 drop-shadow-md">{t('target.title')}</h2>
          <p className="text-slate-400 text-[12px] font-bold leading-relaxed max-w-xs mx-auto">
            {t('target.description')}
          </p>

          <NeonCard color="rose" className="mt-6 p-4 text-left border-rose-500/30 bg-rose-950/20 text-sm text-slate-300 mx-4">
            <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-3 text-center">{t('spyfall.timerTitle')}</h4>
            <div className="space-y-3 font-medium text-[11px] leading-relaxed">
              <p>🎯 {t('target.description').split(' ')[0] === 'ทาย' ? 'คนหนึ่งจะถูกสุ่มให้ตั้งตัวเลขลับ 1-100' : 'One player will be randomly selected to set a secret number 1-100'}</p>
              <p>💡 {t('target.description').split(' ')[0] === 'ทาย' ? 'ผู้เล่นอื่นจะเห็นช่วงใบ้ (±5 จากเป้า)' : 'Other players will see a hint range (±5 from target)'}</p>
              <p>🔢 {t('target.description').split(' ')[0] === 'ทาย' ? 'ผลัดกันนับ +1, +2, หรือ +3' : 'Take turns counting +1, +2, or +3'}</p>
              <p>💀 {t('target.description').split(' ')[0] === 'ทาย' ? 'ใครนับถึงตัวเลขเป้า...แพ้!' : 'Whoever counts to the target number... loses!'}</p>
            </div>
          </NeonCard>
        </div>

        {isHost ? (
          <div className="mt-6 px-4">
            <GiantButton color="rose" onClick={startGame} className="w-full">
              <Play size={20} fill="currentColor" className="mr-2 inline-block mb-1" />
              {t('target.startGame')}
            </GiantButton>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 mt-8">
            <div className="w-8 h-8 border-4 border-slate-800 border-t-rose-500 rounded-full animate-spin shadow-[0_0_15px_rgba(244,63,94,0.5)]" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 animate-pulse">{t('target.waitingHost')}</span>
          </div>
        )}
      </div>
    );
  }

  // Choosing target screen
  if (gameStatus === 'choosing_target') {
    return (
      <div className="flex flex-col gap-4 w-full animate-fade-in bg-slate-950 text-slate-200 py-4 px-2 h-full">
        {renderErrorToast()}
        <div className="text-center h-full flex flex-col justify-center">
          <div className="flex-center mb-6">
            <div className="text-7xl drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">🎯</div>
          </div>

          {isTargetChooser ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col gap-6"
            >
              <div>
                <h2 className="text-[28px] font-black mb-2 uppercase tracking-widest text-amber-500 drop-shadow-md">{t('target.setTarget')}</h2>
                <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest leading-relaxed max-w-[280px] mx-auto">{t('target.description').split(' ')[0] === 'ทาย' ? 'เลือกตัวเลขระหว่าง 1 ถึง 100 ผู้เล่นอื่นจะเห็นช่วง ±5 เท่านั้น' : 'Choose a number between 1 and 100. Others will only see ±5 range.'}</p>
              </div>

              <div className="flex flex-col gap-6 items-center">
                <TimerDisplay timeLeft={timeLeft} />
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  placeholder="1-100"
                  className="bg-slate-900 border-2 border-amber-500/50 text-white rounded-3xl py-4 text-center text-4xl font-black w-48 focus:outline-none focus:border-amber-400 focus:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all font-mono placeholder:text-slate-700"
                />
                <GiantButton
                  color="amber"
                  className="px-8 w-48"
                  onClick={handleSetTarget}
                  disabled={!selectedTarget || parseInt(selectedTarget) < 1 || parseInt(selectedTarget) > 100}
                >
                  {t('target.confirmTarget')}
                </GiantButton>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <h2 className="text-[24px] font-black uppercase tracking-widest text-slate-300">{t('target.choosingTarget')}</h2>
              <TimerDisplay timeLeft={timeLeft} />
              <p className="text-amber-400 font-black text-[12px] uppercase tracking-widest bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-xl">
                {t('target.waitChooser', { name: targetChooser })}
              </p>
              <div className="text-6xl animate-bounce mt-4 drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]">🎲</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Playing screen
  if (gameStatus === 'playing') {
    const playerOrder = gameData.playerOrder || [];
    const currentCount = gameData.currentCount || 0;
    const range = gameData.range || {};
    const lastMove = gameData.lastMove;

    return (
      <div className="flex flex-col gap-3 w-full animate-fade-in bg-slate-950 text-slate-200 pb-20 px-2">
        {renderErrorToast()}
        
        {/* Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30">
              <Target size={20} />
            </div>
            <div>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{t('target.description').split(' ')[0] === 'ทาย' ? 'ตัวเลขปัจจุบัน' : 'Current Number'}</p>
              <p className="font-black text-3xl text-white font-mono">{currentCount}</p>
            </div>
          </div>
          <div className="text-right bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{t('taboo.currentScores').split(' ')[0] === 'คะแนน' ? 'คะแนนของคุณ' : 'Your Score'}</p>
            <p className="font-black text-rose-500 text-xl">{gameData.scores?.[userNickname] || 0}</p>
          </div>
        </div>

        {/* Hint Range */}
        {!isTargetChooser && (
          <NeonCard color="amber" className="p-4 text-center border-amber-500/30 bg-amber-950/20">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3">💡 {t('target.description').split(' ')[0] === 'ทาย' ? 'ช่วงตัวเลขใบ้' : 'Hint Range'}</p>
            <div className="flex items-center justify-center gap-4">
              <span className="bg-amber-500/20 text-amber-400 font-black text-3xl font-mono px-4 py-2 rounded-xl border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                {range.min}
              </span>
              <span className="text-slate-400 font-black text-[12px] uppercase tracking-widest">{t('target.description').split(' ')[0] === 'ทาย' ? 'ถึง' : 'to'}</span>
              <span className="bg-amber-500/20 text-amber-400 font-black text-3xl font-mono px-4 py-2 rounded-xl border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                {range.max}
              </span>
            </div>
          </NeonCard>
        )}

        {isTargetChooser && (
          <NeonCard color="purple" className="p-4 text-center border-purple-500/30 bg-purple-950/20">
            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2">🤫 {t('target.targetIs', { number: '' }).trim()}</p>
            <p className="text-5xl font-black text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)] font-mono">{gameData.targetNumber}</p>
          </NeonCard>
        )}

        {/* Last Move */}
        <AnimatePresence mode="wait">
          {lastMove && (
            <motion.div
              key={`${lastMove.player}-${lastMove.numbers.join(',')}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-slate-900 border border-slate-800 p-4 text-center rounded-3xl"
            >
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">{t('target.description').split(' ')[0] === 'ทาย' ? 'เมื่อกี้' : 'Just now'}</p>
              <p className="font-bold text-[14px]">
                <span className="text-rose-400 font-black">{lastMove.player}</span> <span className="text-slate-400">{t('target.description').split(' ')[0] === 'ทาย' ? 'นับ' : 'counted'}</span>{' '}
                <span className="text-white font-black bg-slate-800 px-2 py-1 rounded border border-slate-700">
                  {lastMove.numbers.join(', ')}
                </span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Turn Indicator */}
        <NeonCard color={isMyTurn ? 'emerald' : 'slate'} className={`p-4 text-center ${isMyTurn ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] bg-emerald-950/20' : 'border-slate-800 bg-slate-900'}`}>
          <div className="flex justify-center mb-3">
            <TimerDisplay timeLeft={timeLeft} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            {isMyTurn ? t('target.yourTurn') : t('target.waitTurn', { name: '' }).trim()}
          </p>
          <p className={`text-[16px] font-black uppercase tracking-widest ${isMyTurn ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'text-slate-300'}`}>
            {isMyTurn ? (t('target.description').split(' ')[0] === 'ทาย' ? 'เร็วเข้า! เลือกจำนวนเลขที่จะนับ' : 'Hurry! Select how many to count') : t('target.waitTurn', { name: currentPlayer })}
          </p>
        </NeonCard>

        {/* Controls */}
        {isMyTurn ? (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col gap-3 mt-2"
          >
            <p className="text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">🎮 {t('target.description').split(' ')[0] === 'ทาย' ? 'เลือกจำนวนเลขที่จะนับ' : 'Choose how many to count'}</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                className="bg-blue-950/30 p-4 flex flex-col items-center gap-2 border-2 border-blue-500/40 rounded-3xl active:scale-95 transition-all hover:bg-blue-900/40 hover:border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                onClick={() => handleMove(1)}
              >
                <span className="text-3xl font-black text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">+1</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('target.description').split(' ')[0] === 'ทาย' ? 'นับ 1 ตัว' : 'Count 1'}</span>
                <span className="text-[11px] text-blue-300 font-bold bg-blue-900/50 px-2 py-0.5 rounded-full border border-blue-500/30">{currentCount + 1}</span>
              </button>
              <button
                className="bg-emerald-950/30 p-4 flex flex-col items-center gap-2 border-2 border-emerald-500/40 rounded-3xl active:scale-95 transition-all hover:bg-emerald-900/40 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                onClick={() => handleMove(2)}
              >
                <span className="text-3xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">+2</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('target.description').split(' ')[0] === 'ทาย' ? 'นับ 2 ตัว' : 'Count 2'}</span>
                <span className="text-[11px] text-emerald-300 font-bold bg-emerald-900/50 px-2 py-0.5 rounded-full border border-emerald-500/30">{currentCount + 1}-{currentCount + 2}</span>
              </button>
              <button
                className="bg-amber-950/30 p-4 flex flex-col items-center gap-2 border-2 border-amber-500/40 rounded-3xl active:scale-95 transition-all hover:bg-amber-900/40 hover:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                onClick={() => handleMove(3)}
              >
                <span className="text-3xl font-black text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">+3</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('target.description').split(' ')[0] === 'ทาย' ? 'นับ 3 ตัว' : 'Count 3'}</span>
                <span className="text-[11px] text-amber-300 font-bold bg-amber-900/50 px-2 py-0.5 rounded-full border border-amber-500/30">{currentCount + 1}-{currentCount + 3}</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 p-6 flex-center flex-col gap-4 rounded-3xl mt-2">
            <div className="text-5xl animate-spin-slow">⏳</div>
            <p className="text-slate-400 font-black text-[11px] uppercase tracking-widest">{t('target.waitTurn', { name: currentPlayer })}</p>
          </div>
        )}

        {/* Player Order */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-3xl mt-2">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">{t('taboo.players')}</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {playerOrder.map((name, idx) => (
              <div
                key={name}
                className={`px-3 py-1.5 rounded-xl text-[10px] uppercase tracking-widest font-black flex items-center gap-2 ${
                  idx === currentPlayerIndex
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {idx === currentPlayerIndex && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>}
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Finished screen
  if (gameStatus === 'finished') {
    const loser = gameData.loser;
    const isLoser = loser === userNickname;
    const playerOrder = gameData.playerOrder || [];
    const winners = playerOrder.filter(n => n !== loser);

    return (
      <div className="flex flex-col gap-4 w-full animate-fade-in bg-slate-950 text-slate-200 pb-24 h-full px-2">
        {renderErrorToast()}
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center mt-6"
        >
          <div className="text-6xl mb-4 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">🎯</div>
          <h2 className="text-[28px] font-black mb-4 uppercase tracking-widest text-white drop-shadow-md">{t('target.gameOver')}</h2>

          {/* Loser */}
          <NeonCard color={isLoser ? 'rose' : 'slate'} className={`p-6 text-center mx-4 mb-4 ${isLoser ? 'border-rose-500/50 bg-rose-950/20 shadow-[0_0_30px_rgba(225,29,72,0.15)]' : 'border-slate-800 bg-slate-900/50'}`}>
            <div className="text-6xl mb-4">{isLoser ? '💥' : '💀'}</div>
            <h3 className={`text-[20px] font-black uppercase tracking-widest mb-4 ${isLoser ? 'text-rose-400 drop-shadow-[0_0_10px_rgba(225,29,72,0.5)]' : 'text-slate-300'}`}>
              {isLoser ? (t('target.description').split(' ')[0] === 'ทาย' ? 'ตู้ม! คุณระเบิดแล้ว' : 'BOOM! You Lost!') : t('target.loserIs', { name: loser })}
            </h3>
            <div className="flex items-center justify-center gap-3 mt-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('taboo.secretWordWas')}</span>
              <span className="bg-rose-500/20 text-rose-400 font-black text-3xl font-mono px-4 py-2 rounded-xl border border-rose-500/50 shadow-[0_0_15px_rgba(225,29,72,0.3)]">
                {gameData.targetNumber}
              </span>
            </div>
          </NeonCard>

          {/* Winners */}
          <div className="p-4 mx-4 rounded-3xl bg-emerald-950/20 border border-emerald-500/30 mb-4 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Trophy size={16} className="text-emerald-400" />
              <h4 className="font-black text-emerald-400 text-[10px] uppercase tracking-widest">{t('spyfall.citizenWin').split(' ')[0] === 'พลเมือง' ? 'ผู้รอดชีวิต' : 'Survivors'}</h4>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {winners.map(name => (
                <span key={name} className="bg-emerald-500/10 text-emerald-300 font-black text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-lg border border-emerald-500/30">
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Scores */}
          <div className="p-4 mx-4 bg-slate-900/50 border border-slate-800 rounded-3xl">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t('taboo.totalScores')}</p>
            <div className="space-y-2">
              {Object.entries(gameData.scores || {}).sort((a: any, b: any) => b[1] - a[1]).map(([name, score]) => (
                <div key={name} className="flex justify-between items-center p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    {name === loser ? <Skull size={16} className="text-rose-500" /> : <Crown size={16} className="text-amber-500" />}
                    <span className="font-black text-[12px] uppercase tracking-widest text-slate-300">{name}</span>
                  </div>
                  <span className="font-black text-amber-400 text-[14px] drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">{score as number} <span className="text-[10px] text-slate-500">{t('taboo.pointsGuesser').split(' ')[1]}</span></span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800 z-50 flex gap-3">
          {isHost ? (
            <>
              <GiantButton color="rose" className="flex-1" onClick={nextRound}>
                <RotateCcw size={18} className="mr-2 inline-block mb-0.5" />
                {t('taboo.playAgain')}
              </GiantButton>
              <button className="flex-1 py-4 text-[12px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800 text-slate-300 rounded-2xl active:scale-95 transition-all hover:border-slate-500" onClick={requestLeave}>
                <LogOut size={16} className="mr-2 inline-block mb-0.5" />
                {t('taboo.leaveRoom')}
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

  return null;
};

export default TargetNumber;
