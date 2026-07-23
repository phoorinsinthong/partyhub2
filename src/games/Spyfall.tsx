import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { useTranslation } from 'react-i18next';
import { generateInitialState, checkVoteResult } from './logic/spyfallLogic';
import { TimerDisplay } from '../components/game-ui/TimerDisplay';
import { CAT_META } from './logic/spyfallCats';
import {
  MapPin, User, Timer, AlertCircle, CheckCircle2, XCircle,
  Search, Info, ChevronDown, Vote, Eye,
  Users, Shield, Clock, LogOut, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TIMER_PRESETS } from '../hooks/useGameTimer';
import { feedback } from '../utils/feedback';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGame } from '../contexts/GameContext';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import EpicPopup from '../components/EpicPopup';
import GiantButton from '../components/GiantButton';
import NeonCard from '../components/NeonCard';
import HoldToRevealCard from '../components/HoldToRevealCard';
import { useHaptics } from '../hooks/useHaptics';

// ─── Main Component ──────────────────────────────────────────────────────────

const Spyfall: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { vibrateLight, vibrateMedium, vibrateSuccess, vibrateHeavy } = useHaptics();
  
  const nickname = userNickname || '';
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, nickname);
  const players = roomData?.players || {};
  const gameData = roomData?.gameData || {};
  const isHostActually = isHost;

  const myGameData = (gameData.players && gameData.players[nickname]) || {};

  // State
  const [timeLeft, setTimeLeft] = useState(0);
  const [showLocations, setShowLocations] = useState(false);
  const [showGuessModal, setShowGuessModal] = useState(false);
  const [selectedGuess, setSelectedGuess] = useState('');
  const [selectedCats, setSelectedCats] = useState(['food', 'travel', 'health', 'funny']);
  const [useDefaultPack, setUseDefaultPack] = useState(false);
  const [useNonStandardPack, setUseNonStandardPack] = useState(false);
  const [enableAccomplice, setEnableAccomplice] = useState(true);
  const [voteTarget, setVoteTarget] = useState('');
  const [timerMinutes, setTimerMinutes] = useState(8);

  const [errorMsg, setErrorMsg] = useState('');
  const personalRecordedRef = useRef(false);
  const advancingRef = useRef(false);
  const guessRef = useRef(false);
  const submitVoteRef = useRef(false);
  const voteResultRef = useRef(false);

  const playerList = Object.keys(players);
  const playerCount = playerList.length;
  const gamePlayerList = Object.keys(gameData.players || {});
  const gamePlayerCount = gamePlayerList.length;

  useEffect(() => {
    if (roomData?.status === 'waiting' || gameData.status === 'waiting') {
      personalRecordedRef.current = false;
      advancingRef.current = false;
      guessRef.current = false;
      submitVoteRef.current = false;
      voteResultRef.current = false;
    }
  }, [roomData?.status, gameData.status]);

  useEffect(() => {
    const isFinished = roomData?.status === 'finished' || gameData.status === 'finished';
    if (!isFinished || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    const gamePlayers = gameData.players || {};
    const myData = gamePlayers[nickname] || {};
    const iSpy = myData.isSpy || myData.isAccomplice;
    const iWon = (gameData.winner === 'Spy' && iSpy) || (gameData.winner === 'Civilians' && !iSpy);
    recordPersonalGame('spyfall');
    if (iWon) recordPersonalWin('spyfall');
  }, [roomData?.status, gameData.status, nickname, gameData.players, gameData.winner]);

  // ─── Timer ───────────────────────────────────────────────────────────────────

  const safeUpdate = useCallback(async (refPath: string, data: any) => {
    try {
      await update(ref(db, refPath), data);
    } catch {
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
      vibrateHeavy();
      setTimeout(() => setErrorMsg(''), 3000);
    }
  }, [t, vibrateHeavy]);

  useEffect(() => {
    if (roomData?.status === 'playing' && gameData.timerEnd && gameData.status === 'playing') {
      let transitioned = false;
      const interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((gameData.timerEnd - now) / 1000));
        if (diff !== timeLeft) setTimeLeft(diff);

        // Auto-transition to voting when timer reaches 0
        if (diff === 0 && isHostActually && !transitioned && !voteResultRef.current) {
          transitioned = true;
          clearInterval(interval);
          const snap = roomData.gameData || {};
          if (snap.status === 'playing') {
            safeUpdate(`rooms/${roomId}/gameData`, {
              status: 'voting',
              timerEnd: null
            });
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [roomData?.status, gameData.timerEnd, isHostActually, gameData.status, roomId, timeLeft, safeUpdate]);

  // ─── Sound on spy reveal (notify other players after spy confirmed guess) ───

  const prevSpyRevealingRef = useRef<string | null>(null);
  useEffect(() => {
    const newVal = gameData.spyRevealing || null;
    if (newVal !== prevSpyRevealingRef.current) {
      if (newVal && newVal !== nickname) {
        feedback('spyReveal');
        vibrateHeavy();
      }
      prevSpyRevealingRef.current = newVal;
    }
  }, [gameData.spyRevealing, nickname, vibrateHeavy]);

  // ─── Show guess modal for spy when forced ───────────────────────────────────

  useEffect(() => {
    if (gameData.spyForced && gameData.spyRevealing === nickname && myGameData.isSpy && gameData.status !== 'finished') {
      setTimeout(() => setShowGuessModal(true), 0);
    }
  }, [gameData.spyForced, gameData.spyRevealing, nickname, myGameData.isSpy, gameData.status]);

  // ─── Check voting results (host only) ────────────────────────────────────────

  useEffect(() => {
    if (!isHostActually || gameData.status !== 'voting') return;

    const gamePlayers = gameData.players || {};
    const result = checkVoteResult(gamePlayers, gamePlayerCount);
    
    if (!result) return;
    if (voteResultRef.current) return;
    voteResultRef.current = true;

    if (result.winner) {
      (async () => {
        try {
          await safeUpdate(`rooms/${roomId}/gameData`, { status: 'finished', winner: result.winner });
          await safeUpdate(`rooms/${roomId}`, { status: 'finished' });
          const civilianWinner = gamePlayerList.find(p => !gamePlayers[p].isSpy) || roomData.host;
          await recordWin(roomId || '', civilianWinner, 'spyfall');
        } catch (_) {
          voteResultRef.current = false;
        }
      })();
    } else if (result.forcedSpy) {
      const spyName = gamePlayerList.find(p => gamePlayers[p].isSpy);
      (async () => {
        try {
          await safeUpdate(`rooms/${roomId}/gameData`, {
            spyRevealing: spyName,
            spyForced: true,
            timerEnd: null
          });
        } catch (_) {
          voteResultRef.current = false;
        }
      })();
    }
  }, [gameData.players, gameData.status, isHostActually, gamePlayerCount, gamePlayerList, roomId, roomData.host, safeUpdate]);

  // ─── Check vote request threshold ───────────────────────────────────────────

  useEffect(() => {
    if (!isHostActually || gameData.status !== 'playing') return;

    const gamePlayers = gameData.players || {};
    const wantsCount = gamePlayerList.filter(p => gamePlayers[p]?.wantsToVote).length;
    const threshold = Math.ceil(gamePlayerCount * 2 / 3);

    if (wantsCount >= threshold && gamePlayerCount > 0) {
      setTimeout(() => {
        safeUpdate(`rooms/${roomId}/gameData`, {
          status: 'voting',
          timerEnd: null
        });
      }, 0);
    }
  }, [gameData.players, gameData.status, isHostActually, gamePlayerCount, gamePlayerList, roomId, safeUpdate]);

  const renderErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border border-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-fade-in">
      {errorMsg}
    </div>
  ) : null;

  if (!roomData) return null;

  // ─── Game Actions ────────────────────────────────────────────────────────────

  const startGame = async () => {
    if (!isHostActually) return;
    if (playerCount < 3) return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    vibrateSuccess();

    const { CATS, DEFAULT_LOCATIONS, NON_STANDARD_LOCATIONS } = await import('./logic/spyfallData');

    let pool = [];

    selectedCats.forEach(catId => {
      const cat = CATS.find(c => c.id === catId);
      if (cat) pool.push(...cat.places.map(p => ({ n: p.n, r: p.r })));
    });

    if (useDefaultPack) {
      Object.entries(DEFAULT_LOCATIONS).forEach(([name, roles]) => {
        pool.push({ n: name, r: roles });
      });
    }

    if (useNonStandardPack) {
      Object.entries(NON_STANDARD_LOCATIONS).forEach(([name, roles]) => {
        pool.push({ n: name, r: roles });
      });
    }

    if (pool.length === 0) pool = CATS[0].places.map(p => ({ n: p.n, r: p.r }));

    let placeCategory = '';
    const targetIdx = Math.floor(Math.random() * pool.length);
    const targetPlace = pool[targetIdx];
    for (const cat of CATS) {
      if (cat.places.some(p => p.n === targetPlace.n)) {
        placeCategory = cat.name;
        break;
      }
    }
    if (!placeCategory) {
      if (Object.keys(DEFAULT_LOCATIONS).includes(targetPlace.n)) placeCategory = 'ทั่วไป';
      else if (Object.keys(NON_STANDARD_LOCATIONS).includes(targetPlace.n)) placeCategory = 'พิเศษ';
    }

    const newGameData = generateInitialState(
      playerList,
      pool,
      placeCategory,
      timerMinutes,
      enableAccomplice
    );

    try {
      await safeUpdate(`rooms/${roomId}`, {
        status: 'playing',
        gameData: newGameData
      });
    } finally {
      advancingRef.current = false;
    }
  };

  const handleReveal = () => {
    if (!myGameData.isSpy) return;
    vibrateLight();
    setShowGuessModal(true);
  };

  const handleCancelReveal = () => {
    if (gameData.spyForced) return;
    vibrateLight();
    setShowGuessModal(false);
    setSelectedGuess('');
  };

  const handleGuess = async () => {
    if (!selectedGuess) return;
    if (guessRef.current) return;
    guessRef.current = true;
    vibrateMedium();

    const isCorrect = selectedGuess === gameData.targetPlace;
    const gamePlayers = gameData.players || {};
    const winnerName = isCorrect
      ? nickname
      : (gamePlayerList.find(p => !gamePlayers[p]?.isSpy) || roomData.host);
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        spyRevealing: nickname,
        winner: isCorrect ? 'Spy' : 'Civilians',
        status: 'finished',
        guess: selectedGuess
      });
      await safeUpdate(`rooms/${roomId}`, { status: 'finished' });
      await recordWin(roomId || '', winnerName, 'spyfall');
      setShowGuessModal(false);
    } finally {
      guessRef.current = false;
    }
  };

  const requestVote = async () => {
    vibrateLight();
    await safeUpdate(`rooms/${roomId}/gameData/players/${nickname}`, { wantsToVote: true });
  };

  const cancelVoteRequest = async () => {
    vibrateLight();
    await safeUpdate(`rooms/${roomId}/gameData/players/${nickname}`, { wantsToVote: false });
  };

  const submitVote = async () => {
    if (!voteTarget) return;
    if (submitVoteRef.current) return;
    submitVoteRef.current = true;
    vibrateMedium();
    try {
      await safeUpdate(`rooms/${roomId}/gameData/players/${nickname}`, { votedFor: voteTarget });
    } finally {
      submitVoteRef.current = false;
    }
  };

  const toggleCategory = (id: string) => {
    vibrateLight();
    if (selectedCats.includes(id)) {
      if (selectedCats.length > 1 || useDefaultPack || useNonStandardPack) {
        setSelectedCats(selectedCats.filter(c => c !== id));
      }
    } else {
      setSelectedCats([...selectedCats, id]);
    }
  };

  const resetToLobby = () => {
    vibrateMedium();
    personalRecordedRef.current = false;
    safeUpdate(`rooms/${roomId}`, { status: 'waiting', gameData: null });
  };

  const handlePlayAgain = async () => {
    if (!isHostActually || advancingRef.current) return;
    advancingRef.current = true;
    vibrateMedium();
    personalRecordedRef.current = false;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, { status: 'waiting' });
    } finally {
      advancingRef.current = false;
    }
  };

  const getVoteRequestInfo = () => {
    const gamePlayers = gameData.players || {};
    const wantsCount = gamePlayerList.filter(p => gamePlayers[p]?.wantsToVote).length;
    const threshold = Math.ceil(gamePlayerCount * 2 / 3);
    return { wantsCount, threshold };
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: WAITING / LOBBY
  // ═══════════════════════════════════════════════════════════════════════════════

  if (roomData.status === 'waiting' || gameData.status === 'waiting') {
    return (
      <div className="flex flex-col gap-4 w-full animate-fade-in relative z-10 px-2 py-4">
        {renderErrorToast()}
        
        <div className="flex-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-800 flex-center shadow-[0_0_15px_rgba(0,240,255,0.3)] border border-neon-blue">
              <Search size={20} className="text-neon-blue" />
            </div>
            <div>
              <h1 className="font-display text-[18px] font-black text-white tracking-wider uppercase">Spyfall</h1>
              <p className="text-neon-blue text-[11px] font-bold tracking-widest uppercase">Find the imposter</p>
            </div>
          </div>
          <button onClick={requestLeave} className="w-10 h-10 rounded-xl bg-slate-800 flex-center text-slate-400 hover:text-white border border-slate-700 active:scale-95">
            <LogOut size={18} />
          </button>
        </div>

        <NeonCard color="slate" className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 mb-2">
            <MapPin size={18} className="text-neon-pink" />
            <h4 className="text-[12px] font-black uppercase tracking-widest text-white">Select Places ({selectedCats.length})</h4>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {CAT_META.map(cat => (
              <button
                key={cat.id}
                onClick={() => isHostActually && toggleCategory(cat.id)}
                className={`p-3 rounded-2xl border-2 transition-all text-left flex items-center gap-2 ${
                  selectedCats.includes(cat.id)
                    ? 'border-neon-pink bg-neon-pink/10 shadow-[0_0_10px_rgba(255,20,147,0.3)]'
                    : 'border-slate-700 bg-slate-800/50 opacity-60'
                } ${!isHostActually && 'cursor-default pointer-events-none'}`}
              >
                <span className="text-xl">{cat.emoji}</span>
                <span className={`text-[12px] font-bold ${selectedCats.includes(cat.id) ? 'text-white' : 'text-slate-400'}`}>{cat.name}</span>
              </button>
            ))}
          </div>

          <div className="h-[1px] bg-slate-700 my-2" />

          <div className="flex items-center gap-3 mb-2">
            <Clock size={18} className="text-neon-blue" />
            <h4 className="text-[12px] font-black uppercase tracking-widest text-white">Timer</h4>
          </div>

          <div className="flex gap-2 flex-wrap mb-2">
            {TIMER_PRESETS.spyfall.map(opt => (
              <button
                key={opt.value}
                onClick={() => isHostActually && setTimerMinutes(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black border-2 transition-all uppercase tracking-widest ${
                  timerMinutes === opt.value
                    ? 'border-neon-blue bg-neon-blue/10 text-neon-blue shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400'
                } ${!isHostActually && 'cursor-default pointer-events-none'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="h-[1px] bg-slate-700 my-2" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-purple-500" />
              <div>
                <span className="text-[12px] font-black text-white uppercase tracking-widest">Accomplice Role</span>
                <p className="text-[10px] text-slate-400">ผู้สมรู้ร่วมคิด (4+ คน)</p>
              </div>
            </div>
            {isHostActually && (
              <button
                onClick={() => { vibrateLight(); setEnableAccomplice(!enableAccomplice); }}
                className={`w-12 h-6 rounded-full transition-all relative border-2 ${
                  enableAccomplice ? 'bg-purple-600/30 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-slate-800 border-slate-600'
                }`}
              >
                <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${
                  enableAccomplice ? 'left-[24px]' : 'left-[2px]'
                }`} />
              </button>
            )}
          </div>
        </NeonCard>

        {isHostActually ? (
          <GiantButton color="pink" className="mt-4" onClick={startGame} disabled={playerCount < 3}>
            {playerCount < 3 ? 'รอผู้เล่น (ขั้นต่ำ 3)' : `เริ่มเกม! (${playerCount} คน)`}
          </GiantButton>
        ) : (
          <div className="mt-4 p-4 rounded-2xl border border-neon-blue/30 bg-neon-blue/10 text-center shadow-[0_0_15px_rgba(0,240,255,0.2)]">
            <p className="animate-pulse text-neon-blue font-bold uppercase tracking-widest text-[12px]">Waiting for Host to start...</p>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: PLAYING
  // ═══════════════════════════════════════════════════════════════════════════════

  if (roomData.status === 'playing' && gameData.status === 'playing') {
    const { wantsCount, threshold } = getVoteRequestInfo();
    const isSpy = myGameData.isSpy;
    const isAccomplice = myGameData.isAccomplice;

    return (
      <div className="flex flex-col gap-4 w-full animate-fade-in relative z-10 p-4">
        {renderErrorToast()}
        
        <EpicPopup
          isOpen={!!gameData.spyRevealing}
          title="SPY REVEALED"
          subtitle={`"${gameData.spyRevealing}" กำลังทายสถานที่...`}
          type="danger"
          icon="🚨"
        />

        <div className="flex justify-center mb-2">
          <div className="bg-slate-900 border border-neon-blue shadow-[0_0_15px_rgba(0,240,255,0.2)] rounded-3xl px-6 py-3 flex items-center gap-3">
            <Timer size={20} className="text-neon-blue" />
            <span className="font-display font-black text-3xl text-white tracking-widest">
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        {gameData.placeCategory && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">หมวดหมู่:</span>
            <span className="text-[12px] font-black text-neon-pink uppercase tracking-widest bg-neon-pink/10 px-3 py-1 rounded-full border border-neon-pink/30">{gameData.placeCategory}</span>
          </div>
        )}

        <HoldToRevealCard placeholderText="กดค้างไว้เพื่อดูบทบาท" className="mb-4 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          <h2 className={`font-display font-black text-4xl uppercase tracking-widest mb-2 ${
            isSpy ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]' 
              : isAccomplice ? 'text-purple-500 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]' 
              : 'text-neon-blue drop-shadow-[0_0_15px_rgba(0,240,255,0.8)]'
          }`}>
            {isSpy ? 'SPY' : isAccomplice ? 'ACCOMPLICE' : 'CITIZEN'}
          </h2>
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 w-full max-w-[200px] text-center mb-2">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">สถานที่</p>
            <p className="text-xl font-bold text-white">
              {isSpy || isAccomplice ? '???' : myGameData.place}
            </p>
          </div>
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 w-full max-w-[200px] text-center">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">อาชีพ/บทบาท</p>
            <p className="text-xl font-bold text-white">
              {isSpy ? 'สายลับ' : myGameData.role}
            </p>
          </div>
          
          {isSpy && <p className="text-red-400 text-xs mt-4 font-bold animate-pulse text-center">หาที่นี่ให้เจอจากคำพูดคนอื่น!</p>}
          {isAccomplice && <p className="text-purple-400 text-xs mt-4 font-bold text-center">ช่วยปกป้องสายลับ: {myGameData.spyName}</p>}
        </HoldToRevealCard>

        {isSpy && !gameData.spyRevealing && (
          <GiantButton color="pink" onClick={handleReveal} className="mb-4 shadow-[0_0_30px_rgba(255,20,147,0.3)]">
            ประกาศตัวทายสถานที่!
          </GiantButton>
        )}

        <button
          className="w-full py-3 rounded-xl border border-slate-700 bg-slate-800 flex items-center justify-center gap-2 text-[12px] font-bold text-slate-300 hover:text-white transition-colors"
          onClick={() => setShowLocations(!showLocations)}
        >
          <Search size={16} /> {showLocations ? 'ซ่อนโพยสถานที่' : 'ดูโพยสถานที่'}
        </button>

        <AnimatePresence>
          {showLocations && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-2 mt-4 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {gameData.allPlaces?.map(p => (
                  <div key={p} className="text-[11px] p-3 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-300 font-bold text-center">
                    {p}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="h-[1px] bg-slate-700 my-2" />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-slate-400 uppercase">ขอโหวต: {wantsCount}/{threshold} คน</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-neon-blue transition-all duration-300" style={{ width: `${Math.min(100, (wantsCount / threshold) * 100)}%` }} />
          </div>
          {myGameData.wantsToVote ? (
            <button className="py-2.5 rounded-xl border border-neon-blue bg-neon-blue/10 text-neon-blue font-bold text-[12px]" onClick={cancelVoteRequest}>
              ยกเลิกคำขอโหวต
            </button>
          ) : (
            <button className="py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold text-[12px]" onClick={requestVote}>
              โหวตจับสายลับ
            </button>
          )}
        </div>

        {/* Guess Modal for Spy */}
        <AnimatePresence>
          {showGuessModal && myGameData.isSpy && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex-center p-4 bg-slate-950/90 backdrop-blur-md">
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="glass-panel p-6 w-full max-w-sm flex flex-col gap-4 border-neon-pink shadow-neon-pink">
                <h3 className="font-display font-black text-2xl text-neon-pink uppercase tracking-widest text-center">ทายสถานที่</h3>
                <p className="text-slate-300 text-sm text-center">เลือกสถานที่ที่คุณคิดว่าถูกต้อง หากทายถูกคุณจะชนะทันที!</p>
                <div className="relative mt-2">
                  <select
                    className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-neon-pink outline-none appearance-none"
                    value={selectedGuess}
                    onChange={(e) => setSelectedGuess(e.target.value)}
                  >
                    <option value="">-- เลือกสถานที่ --</option>
                    {gameData.allPlaces?.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                </div>
                <div className="flex gap-3 mt-4">
                  {!gameData.spyForced && (
                    <button className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold" onClick={handleCancelReveal}>ยกเลิก</button>
                  )}
                  <button 
                    className={`flex-1 py-3 rounded-xl font-black shadow-[0_0_15px_rgba(255,20,147,0.4)] ${selectedGuess ? 'bg-neon-pink text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                    onClick={handleGuess} disabled={!selectedGuess}
                  >
                    ยืนยัน
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: VOTING
  // ═══════════════════════════════════════════════════════════════════════════════

  if (roomData.status === 'playing' && gameData.status === 'voting') {
    const gamePlayers = gameData.players || {};
    const myVote = gamePlayers[nickname]?.votedFor;
    const votedCount = gamePlayerList.filter(p => gamePlayers[p]?.votedFor).length;

    return (
      <div className="flex flex-col gap-4 w-full animate-fade-in relative z-10 p-4">
        {renderErrorToast()}

        <EpicPopup
          isOpen={!!gameData.spyRevealing}
          title="SPY REVEALED"
          subtitle={`"${gameData.spyRevealing}" กำลังทายสถานที่...`}
          type="danger"
          icon="🚨"
        />
        
        <NeonCard color="amber" className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 flex-center mx-auto mb-4 shadow-[0_0_20px_rgba(251,191,36,0.5)]">
            <Vote size={32} className="text-amber-500" />
          </div>
          <h2 className="font-display font-black text-2xl text-amber-500 uppercase tracking-widest mb-1">VOTE TIME</h2>
          <p className="text-[12px] font-bold text-slate-300">เลือกคนที่คุณคิดว่าเป็นสายลับ</p>
          <p className="text-[10px] text-amber-500/70 font-bold uppercase mt-2">โหวตแล้ว {votedCount}/{gamePlayerCount} คน</p>
        </NeonCard>

        {!myVote ? (
          <div className="flex flex-col gap-3 mt-4">
            {gamePlayerList.filter(p => p !== nickname).map(p => (
              <button
                key={p}
                onClick={() => { vibrateLight(); setVoteTarget(p); }}
                className={`w-full p-4 rounded-2xl border-2 flex items-center gap-3 transition-all text-left ${
                  voteTarget === p
                    ? 'border-neon-pink bg-neon-pink/10 text-white shadow-[0_0_15px_rgba(255,20,147,0.3)]'
                    : 'border-slate-700 bg-slate-800/50 text-slate-300'
                }`}
              >
                <div className="w-10 h-10 rounded-full flex-center bg-slate-900 border border-slate-600 font-bold text-[14px]">
                  {p.charAt(0)}
                </div>
                <span className="font-bold flex-1">{p}</span>
                {voteTarget === p && <CheckCircle2 size={20} className="text-neon-pink" />}
              </button>
            ))}

            <GiantButton color="pink" className="mt-4" onClick={submitVote} disabled={!voteTarget}>
              ยืนยันโหวต
            </GiantButton>
          </div>
        ) : (
          <div className="mt-8 p-6 text-center">
            <div className="w-20 h-20 bg-neon-green/20 rounded-full flex-center mx-auto mb-4 border border-neon-green shadow-[0_0_20px_rgba(57,255,20,0.3)]">
              <CheckCircle2 size={40} className="text-neon-green" />
            </div>
            <p className="font-bold text-white text-lg">คุณโหวตให้ "{myVote}" แล้ว</p>
            <p className="text-slate-400 text-sm mt-2">รอผู้เล่นคนอื่น...</p>
          </div>
        )}

        <AnimatePresence>
          {showGuessModal && myGameData.isSpy && gameData.spyRevealing === nickname && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex-center p-4 bg-slate-950/90 backdrop-blur-md">
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="glass-panel p-6 w-full max-w-sm flex flex-col gap-4 border-neon-pink shadow-neon-pink">
                <h3 className="font-display font-black text-2xl text-neon-pink uppercase tracking-widest text-center">ทายสถานที่</h3>
                <p className="text-slate-300 text-sm text-center">ชาวบ้านโหวตผิดคน! คุณได้โอกาสทายสถานที่ หากทายถูกคุณจะชนะ!</p>
                <div className="relative mt-2">
                  <select
                    className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl px-4 py-3 text-white font-bold focus:border-neon-pink outline-none appearance-none"
                    value={selectedGuess}
                    onChange={(e) => setSelectedGuess(e.target.value)}
                  >
                    <option value="">-- เลือกสถานที่ --</option>
                    {gameData.allPlaces?.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                </div>
                <GiantButton color="pink" className="mt-4" onClick={handleGuess} disabled={!selectedGuess}>
                  ยืนยันทาย
                </GiantButton>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: FINISHED
  // ═══════════════════════════════════════════════════════════════════════════════

  if (roomData.status === 'finished' || gameData.status === 'finished') {
    const gamePlayers = gameData.players || {};
    const spyWon = gameData.winner === 'Spy';
    const accentColor = spyWon ? 'pink' : 'blue';

    return (
      <div className="flex flex-col gap-4 w-full animate-fade-in relative z-10 p-4">
        {renderErrorToast()}
        
        <NeonCard color={accentColor} className="text-center py-8">
          <div className="flex-center mb-6">
            <div className={`w-24 h-24 rounded-full flex-center shadow-lg border-2 ${
              spyWon ? 'bg-red-500/20 border-red-500 text-red-500 shadow-red-500/50' : 'bg-neon-blue/20 border-neon-blue text-neon-blue shadow-neon-blue/50'
            }`}>
              {spyWon ? <XCircle size={48} /> : <CheckCircle2 size={48} />}
            </div>
          </div>
          
          <h2 className={`font-display font-black text-4xl uppercase tracking-widest mb-6 ${
            spyWon ? 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'text-neon-blue drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]'
          }`}>
            {spyWon ? 'SPY WINS!' : 'CITIZENS WIN!'}
          </h2>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">สถานที่จริง</p>
            <p className="text-2xl font-bold text-white mb-2">{gameData.targetPlace}</p>
            {gameData.guess && (
              <p className="text-sm">
                สายลับทายว่า: <span className={`font-bold ${spyWon ? 'text-neon-green' : 'text-red-500'}`}>"{gameData.guess}"</span>
              </p>
            )}
          </div>

          <div className="text-left space-y-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">สรุปบทบาท</p>
            {gamePlayerList.map(name => {
              const pData = gamePlayers[name];
              const isP_Spy = pData?.isSpy;
              const isP_Acc = pData?.isAccomplice;
              return (
                <div key={name} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                  <span className={`font-bold ${isP_Spy ? 'text-red-400' : isP_Acc ? 'text-purple-400' : 'text-white'}`}>{name}</span>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${
                    isP_Spy ? 'bg-red-500/20 text-red-400' : isP_Acc ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isP_Spy ? 'สายลับ' : isP_Acc ? 'ผู้สมรู้ร่วมคิด' : pData?.role || 'ชาวบ้าน'}
                  </span>
                </div>
              );
            })}
          </div>
        </NeonCard>

        {isHostActually ? (
          <div className="flex flex-col gap-3 mt-4">
            <GiantButton color="blue" onClick={handlePlayAgain}>
              เล่นอีกครั้ง
            </GiantButton>
            <button className="py-4 font-bold text-slate-400 hover:text-white uppercase tracking-widest text-[12px]" onClick={resetToLobby}>
              กลับ Lobby
            </button>
          </div>
        ) : (
          <GiantButton color="slate" onClick={requestLeave} className="mt-4">
            กลับ Lobby (ขอลา)
          </GiantButton>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: FALLBACK
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="w-full flex-center flex-1">
      {renderErrorToast()}
      <div className="w-8 h-8 border-[3px] border-neon-blue/30 border-t-neon-blue rounded-full animate-spin"></div>
    </div>
  );
};

export default Spyfall;
