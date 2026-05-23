import React, { useState, useEffect, useRef } from 'react';
import { ref, update } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { CAT_META } from './spyfallCats';
import {
  MapPin, User, Timer, AlertCircle, CheckCircle2, XCircle,
  Search, Info, ChevronDown, Vote, Eye,
  Users, Shield, Clock, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TIMER_PRESETS } from '../hooks/useGameTimer';
import { feedback } from '../utils/feedback';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import LeaveConfirmModal from '../components/LeaveConfirmModal';

// ─── Main Component ──────────────────────────────────────────────────────────

const Spyfall = ({ roomId, roomData, userNickname }) => {
  const navigate = useNavigate();
  const nickname = userNickname;
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, nickname);
  const players = roomData.players || {};
  const gameData = roomData.gameData || {};
  const isHost = roomData.host === nickname;

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
  const [prevSpyRevealing, setPrevSpyRevealing] = useState(null);
  const [timerMinutes, setTimerMinutes] = useState(8);

  const [errorMsg, setErrorMsg] = useState('');
  const personalRecordedRef = useRef(false);
  const advancingRef = useRef(false);
  const guessRef = useRef(false);
  const submitVoteRef = useRef(false);
  const voteResultRef = useRef(false);

  useEffect(() => {
    if (roomData.status === 'waiting' || gameData.status === 'waiting') {
      personalRecordedRef.current = false;
      advancingRef.current = false;
      guessRef.current = false;
      submitVoteRef.current = false;
      voteResultRef.current = false;
    }
  }, [roomData.status, gameData.status]);

  useEffect(() => {
    const isFinished = roomData.status === 'finished' || gameData.status === 'finished';
    if (!isFinished || personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    const gamePlayers = gameData.players || {};
    const myData = gamePlayers[nickname] || {};
    const iSpy = myData.isSpy || myData.isAccomplice;
    const iWon = (gameData.winner === 'Spy' && iSpy) || (gameData.winner === 'Civilians' && !iSpy);
    recordPersonalGame('spyfall');
    if (iWon) recordPersonalWin('spyfall');
  }, [roomData.status, gameData.status]);

  const playerList = Object.keys(players);
  const playerCount = playerList.length;
  const gamePlayerList = Object.keys(gameData.players || {});
  const gamePlayerCount = gamePlayerList.length;

  const safeUpdate = async (refPath, data) => {
    try {
      await update(ref(db, refPath), data);
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
      throw e;
    }
  };

  // ─── Timer ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (roomData.status === 'playing' && gameData.timerEnd && gameData.status === 'playing') {
      const interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((gameData.timerEnd - now) / 1000));
        setTimeLeft(diff);

        // Auto-transition to voting when timer reaches 0
        if (diff === 0 && isHost && gameData.status === 'playing') {
          clearInterval(interval);
          if (!voteResultRef.current) {
            safeUpdate(`rooms/${roomId}/gameData`, {
              status: 'voting',
              timerEnd: null
            });
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [roomData.status, gameData.timerEnd, isHost, gameData.status]);

  // ─── Sound on spy reveal (notify other players after spy confirmed guess) ───

  useEffect(() => {
    if (gameData.spyRevealing && gameData.spyRevealing !== prevSpyRevealing) {
      if (gameData.spyRevealing !== nickname) {
        feedback('spyReveal');
      }
    }
    setPrevSpyRevealing(gameData.spyRevealing || null);
  }, [gameData.spyRevealing]);

  // ─── Show guess modal for spy when forced ───────────────────────────────────

  useEffect(() => {
    if (gameData.spyForced && gameData.spyRevealing === nickname && myGameData.isSpy && gameData.status !== 'finished') {
      setShowGuessModal(true);
    }
  }, [gameData.spyForced, gameData.spyRevealing, nickname, myGameData.isSpy, gameData.status]);

  // ─── Check voting results (host only) ────────────────────────────────────────

  useEffect(() => {
    if (!isHost || gameData.status !== 'voting') return;

    const gamePlayers = gameData.players || {};
    const allVoted = gamePlayerList.every(p => gamePlayers[p]?.votedFor);
    if (!allVoted) return;

    // Count votes
    const voteCounts = {};
    gamePlayerList.forEach(p => {
      const target = gamePlayers[p].votedFor;
      if (target) {
        voteCounts[target] = (voteCounts[target] || 0) + 1;
      }
    });

    // Find who got most votes
    let maxVotes = 0;
    let maxTarget = null;
    Object.entries(voteCounts).forEach(([target, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        maxTarget = target;
      }
    });

    // Check if majority voted for the spy
    const spyName = gamePlayerList.find(p => gamePlayers[p].isSpy);
    const majority = Math.ceil(gamePlayerCount / 2);

    if (voteResultRef.current) return;
    voteResultRef.current = true;

    if (maxTarget === spyName && maxVotes >= majority) {
      (async () => {
        try {
          await safeUpdate(`rooms/${roomId}/gameData`, { status: 'finished', winner: 'Civilians' });
          await safeUpdate(`rooms/${roomId}`, { status: 'finished' });
          const civilianWinner = gamePlayerList.find(p => !gamePlayers[p].isSpy) || roomData.host;
          await recordWin(roomId, civilianWinner, 'spyfall');
        } catch (_) {
          voteResultRef.current = false;
        }
      })();
    } else {
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
  }, [gameData.players, gameData.status, isHost]);

  // ─── Check vote request threshold ───────────────────────────────────────────

  useEffect(() => {
    if (!isHost || gameData.status !== 'playing') return;

    const gamePlayers = gameData.players || {};
    const wantsCount = gamePlayerList.filter(p => gamePlayers[p]?.wantsToVote).length;
    const threshold = Math.ceil(gamePlayerCount * 2 / 3);

    if (wantsCount >= threshold && gamePlayerCount > 0) {
      // Transition to voting
      safeUpdate(`rooms/${roomId}/gameData`, {
        status: 'voting',
        timerEnd: null
      });
      // Reset wantsToVote flags
      const resetUpdates = {};
      gamePlayerList.forEach(p => {
        resetUpdates[`players/${p}/wantsToVote`] = false;
      });
      safeUpdate(`rooms/${roomId}/gameData`, resetUpdates);
    }
  }, [gameData.players, gameData.status, isHost]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  // ─── Game Actions ────────────────────────────────────────────────────────────

  const startGame = async () => {
    if (!isHost) return;
    if (playerCount < 3) return;
    if (advancingRef.current) return;
    advancingRef.current = true;

    const { CATS, DEFAULT_LOCATIONS, NON_STANDARD_LOCATIONS } = await import('./spyfallData');

    // Build location pool
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

    const targetIdx = Math.floor(Math.random() * pool.length);
    const targetPlace = pool[targetIdx];

    // Find the main category of the target place
    let placeCategory = '';
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
    const shuffledPlayers = [...playerList];
    for (let i = shuffledPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
    }

    const spyId = shuffledPlayers[0];
    let accompliceId = null;
    // Accomplice enabled at 4+ players
    if (enableAccomplice && playerCount >= 4) {
      accompliceId = shuffledPlayers[1];
    }

    const availableRoles = [...targetPlace.r];
    for (let i = availableRoles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableRoles[i], availableRoles[j]] = [availableRoles[j], availableRoles[i]];
    }
    const gamePlayers = {};

    playerList.forEach((pid) => {
      if (pid === spyId) {
        gamePlayers[pid] = {
          role: 'สายลับ',
          place: '',
          isSpy: true,
          isAccomplice: false,
          spyName: '',
          votedFor: '',
          wantsToVote: false
        };
      } else if (pid === accompliceId) {
        gamePlayers[pid] = {
          role: 'ผู้สมรู้ร่วมคิด',
          place: '???',
          isSpy: false,
          isAccomplice: true,
          spyName: spyId,
          votedFor: '',
          wantsToVote: false
        };
      } else {
        const roleName = availableRoles.pop() || 'ชาวบ้าน';
        gamePlayers[pid] = {
          role: roleName,
          place: targetPlace.n,
          isSpy: false,
          isAccomplice: false,
          spyName: '',
          votedFor: '',
          wantsToVote: false
        };
      }
    });

    const newGameData = {
      status: 'playing',
      targetPlace: targetPlace.n,
      placeCategory: placeCategory || 'อื่นๆ',
      timerEnd: Date.now() + timerMinutes * 60 * 1000,
      players: gamePlayers,
      allPlaces: pool.map(p => p.n).sort(),
      spyRevealing: null,
      spyForced: false,
      winner: null,
      guess: null,
      enableAccomplice: enableAccomplice && playerCount >= 4
    };

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
    setShowGuessModal(true);
  };

  const handleCancelReveal = () => {
    if (gameData.spyForced) return;
    setShowGuessModal(false);
    setSelectedGuess('');
  };

  const handleGuess = async () => {
    if (!selectedGuess) return;
    if (guessRef.current) return;
    guessRef.current = true;

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
      await recordWin(roomId, winnerName, 'spyfall');
      setShowGuessModal(false);
    } finally {
      guessRef.current = false;
    }
  };

  const requestVote = async () => {
    await safeUpdate(`rooms/${roomId}/gameData/players/${nickname}`, {
      wantsToVote: true
    });
  };

  const cancelVoteRequest = async () => {
    await safeUpdate(`rooms/${roomId}/gameData/players/${nickname}`, {
      wantsToVote: false
    });
  };

  const submitVote = async () => {
    if (!voteTarget) return;
    if (submitVoteRef.current) return;
    submitVoteRef.current = true;
    try {
      await safeUpdate(`rooms/${roomId}/gameData/players/${nickname}`, {
        votedFor: voteTarget
      });
    } finally {
      submitVoteRef.current = false;
    }
  };

  const toggleCategory = (id) => {
    if (selectedCats.includes(id)) {
      if (selectedCats.length > 1 || useDefaultPack || useNonStandardPack) {
        setSelectedCats(selectedCats.filter(c => c !== id));
      }
    } else {
      setSelectedCats([...selectedCats, id]);
    }
  };

  const resetToLobby = () => {
    personalRecordedRef.current = false;
    safeUpdate(`rooms/${roomId}`, { status: 'waiting', gameData: null });
  };

  const handlePlayAgain = async () => {
    if (!isHost || advancingRef.current) return;
    advancingRef.current = true;
    personalRecordedRef.current = false;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, { status: 'waiting' });
    } finally {
      advancingRef.current = false;
    }
  };

  // ─── Vote Request Info ───────────────────────────────────────────────────────

  const getVoteRequestInfo = () => {
    const gamePlayers = gameData.players || {};
    const wantsCount = gamePlayerList.filter(p => gamePlayers[p]?.wantsToVote).length;
    const threshold = Math.ceil(gamePlayerCount * 2 / 3);
    return { wantsCount, threshold };
  };


  // ─── Error Toast ─────────────────────────────────────────────────────────────

  const ErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-danger text-white px-lg py-sm rounded-2xl font-bold text-sm shadow-xl animate-fade-in">
      {errorMsg}
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: WAITING / LOBBY
  // ═══════════════════════════════════════════════════════════════════════════════

  if (roomData.status === 'waiting' || gameData.status === 'waiting') {
    return (
      <div className="flex flex-col gap-lg w-full animate-fade-in">
        <div className="glass-panel p-lg">
          <div className="flex items-center gap-md mb-md">
            <div className="p-sm bg-primary/20 rounded-lg text-primary">
              <Info size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">Spyfall</h3>
              <p className="text-secondary text-sm">หาตัวสายลับที่แฝงตัวอยู่ในกลุ่ม!</p>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--glass-border)', margin: '16px 0' }}></div>

          {/* Category Selection */}
          <h4 className="text-sm font-bold mb-md flex items-center gap-sm">
            <MapPin size={16} /> หมวดหมู่สถานที่ ({selectedCats.length} หมวด)
          </h4>

          <div className="grid grid-cols-2 gap-sm mb-md">
            {CAT_META.map(cat => (
              <button
                key={cat.id}
                onClick={() => isHost && toggleCategory(cat.id)}
                className={`p-md rounded-xl border flex items-center gap-md transition-all text-left ${
                  selectedCats.includes(cat.id)
                    ? 'border-primary bg-primary/10 text-primary shadow-lg shadow-primary/5'
                    : 'border-glass text-secondary opacity-60'
                } ${!isHost && 'cursor-default'}`}
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className="text-sm font-bold">{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Additional Packs */}
          <div style={{ height: '1px', background: 'var(--glass-border)', margin: '16px 0' }}></div>

          <h4 className="text-sm font-bold mb-md flex items-center gap-sm">
            <MapPin size={16} /> แพ็คเสริม
          </h4>

          <div className="flex flex-col gap-sm mb-md">
            <button
              onClick={() => isHost && setUseDefaultPack(!useDefaultPack)}
              className={`p-md rounded-xl border flex items-center gap-md transition-all text-left ${
                useDefaultPack
                  ? 'border-primary bg-primary/10 text-primary shadow-lg shadow-primary/5'
                  : 'border-glass text-secondary opacity-60'
              } ${!isHost && 'cursor-default'}`}
            >
              <span className="text-2xl">🎭</span>
              <div>
                <span className="text-sm font-bold">สถานที่ดั้งเดิม</span>
                <p className="text-xs opacity-60">20 สถานที่</p>
              </div>
            </button>

            <button
              onClick={() => isHost && setUseNonStandardPack(!useNonStandardPack)}
              className={`p-md rounded-xl border flex items-center gap-md transition-all text-left ${
                useNonStandardPack
                  ? 'border-primary bg-primary/10 text-primary shadow-lg shadow-primary/5'
                  : 'border-glass text-secondary opacity-60'
              } ${!isHost && 'cursor-default'}`}
            >
              <span className="text-2xl">🏢</span>
              <div>
                <span className="text-sm font-bold">สถานที่พิเศษ</span>
                <p className="text-xs opacity-60">2 สถานที่</p>
              </div>
            </button>
          </div>

          {/* Timer Setting */}
          <div style={{ height: '1px', background: 'var(--glass-border)', margin: '16px 0' }}></div>

          <h4 className="text-sm font-bold mb-md flex items-center gap-sm">
            <Clock size={16} /> เวลาในเกม
          </h4>

          <div className="flex gap-xs flex-wrap mb-md">
            {TIMER_PRESETS.spyfall.map(opt => (
              <button
                key={opt.value}
                onClick={() => isHost && setTimerMinutes(opt.value)}
                className={`px-md py-xs rounded-xl text-xs font-bold border-2 transition-all ${
                  timerMinutes === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-glass text-secondary opacity-60'
                } ${!isHost && 'cursor-default'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Accomplice Toggle */}
          <div style={{ height: '1px', background: 'var(--glass-border)', margin: '16px 0' }}></div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-md">
              <Shield size={16} className="text-secondary" />
              <div>
                <span className="text-sm font-bold">ผู้สมรู้ร่วมคิด</span>
                <p className="text-xs text-secondary">เปิดใช้เมื่อมี 4+ คน</p>
              </div>
            </div>
            {isHost && (
              <button
                onClick={() => setEnableAccomplice(!enableAccomplice)}
                className={`w-12 h-6 rounded-full transition-all relative ${
                  enableAccomplice ? 'bg-primary' : 'bg-glass-dark'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  enableAccomplice ? 'left-7' : 'left-1'
                }`} />
              </button>
            )}
          </div>
        </div>

        {isHost && selectedCats.includes('funny') && playerCount >= 3 && playerCount < 5 && (
          <div className="w-full bg-pink-500/10 border border-pink-300/30 rounded-xl p-md text-center">
            <p className="text-xs font-bold text-pink-300">🤪 หมวดปั่นๆ ฮาๆ เล่น 5+ คนจะสนุกกว่า!</p>
          </div>
        )}
        {isHost ? (
          <button
            className="btn btn-primary w-full py-xl text-xl font-black shadow-xl shadow-primary/20"
            onClick={startGame}
            disabled={playerCount < 3}
          >
            {playerCount < 3 ? 'รอผู้เล่น (ขั้นต่ำ 3 คน)' : `เริ่มเกม! (${playerCount} คน)`}
          </button>
        ) : (
          <div className="glass-panel p-md text-center border-primary/30">
            <p className="animate-pulse text-primary font-bold">รอโฮสต์เริ่มเกม...</p>
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

    return (
      <div className="flex flex-col gap-lg w-full animate-fade-in">
        <ErrorToast />
        {/* Timer */}
        <div className="glass-panel px-lg py-md flex items-center gap-md border-primary/30 w-fit">
          <Timer size={20} className={timeLeft < 60 ? 'text-danger animate-pulse' : 'text-primary'} />
          <span className={`font-mono text-2xl font-black ${timeLeft < 60 ? 'text-danger' : 'text-white'}`}>
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* Category Hint */}
        {gameData.placeCategory && (
          <div className="glass-panel px-lg py-md flex items-center gap-md border-accent/30 w-full">
            <MapPin size={18} className="text-accent" />
            <span className="text-sm font-bold text-secondary">หมวดหมู่หลัก:</span>
            <span className="text-sm font-black text-white">{gameData.placeCategory}</span>
          </div>
        )}

        {/* Spy Reveal Banner */}
        <AnimatePresence>
          {gameData.spyRevealing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full bg-danger/20 border-2 border-danger p-lg rounded-2xl animate-pulse text-center"
            >
              <h4 className="text-danger font-black text-lg mb-xs">SPY REVEALED!</h4>
              <p className="font-bold">
                "{gameData.spyRevealing}" กำลังทายสถานที่...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Location List Toggle */}
        <button
          className={`glass-panel px-lg py-md flex items-center gap-md transition-all w-full justify-center ${showLocations ? 'bg-primary/20 border-primary' : ''}`}
          onClick={() => setShowLocations(!showLocations)}
        >
          <Search size={20} />
          <span className="font-bold">{showLocations ? 'ซ่อนโพยสถานที่' : 'ดูโพยสถานที่'}</span>
        </button>

        <AnimatePresence>
          {showLocations && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: -20 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -20 }}
              className="glass-panel p-lg w-full overflow-hidden border-primary/20"
            >
              <div className="flex justify-between items-center mb-md">
                <h4 className="text-sm font-bold opacity-60 flex items-center gap-sm">
                  <MapPin size={14} /> สถานที่ที่เป็นไปได้ ({gameData.allPlaces?.length || 0})
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-sm max-h-60 overflow-y-auto pr-sm">
                {gameData.allPlaces?.map(p => (
                  <div key={p} className="text-xs p-md rounded-lg border border-glass bg-glass-dark/30 hover:border-primary/50 transition-colors">
                    {p}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Identity Card */}
        <div className="relative w-full">
          <motion.div
            className="w-full rounded-3xl glass-panel flex flex-col p-xl border-t-2 border-l-2 border-white/20 shadow-2xl relative overflow-hidden"
            style={{
              background: myGameData.isSpy
                ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.3) 0%, rgba(127, 29, 29, 0.1) 100%)'
                : myGameData.isAccomplice
                  ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(88, 28, 135, 0.1) 100%)'
                  : 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(30, 58, 138, 0.1) 100%)'
            }}
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-accent/10 rounded-full blur-3xl"></div>

            <div className="flex justify-between items-start mb-xl relative z-10">
              <div>
                <p className="text-secondary uppercase tracking-[4px] text-[10px] font-black mb-xs">
                  IDENTITY CARD
                </p>
                <h2 className={`text-4xl font-black filter drop-shadow-md ${
                  myGameData.isSpy ? 'text-danger' : myGameData.isAccomplice ? 'text-purple-400' : 'text-primary'
                }`}>
                  {myGameData.isSpy ? 'SPY' : myGameData.isAccomplice ? 'ACCOMPLICE' : 'CITIZEN'}
                </h2>
              </div>
              <div className={`p-md rounded-2xl shadow-inner ${
                myGameData.isSpy ? 'bg-danger/20 text-danger' : myGameData.isAccomplice ? 'bg-purple-500/20 text-purple-400' : 'bg-primary/20 text-primary'
              }`}>
                {myGameData.isSpy ? <AlertCircle size={32} /> : myGameData.isAccomplice ? <Eye size={32} /> : <User size={32} />}
              </div>
            </div>

            <div className="space-y-lg relative z-10">
              <div className="bg-glass-dark/50 p-lg rounded-2xl border border-glass backdrop-blur-md">
                <p className="text-secondary text-[10px] uppercase font-bold mb-sm tracking-widest flex items-center gap-xs">
                  <User size={12} /> บทบาทของคุณ
                </p>
                <p className="text-2xl font-black">
                  {myGameData.isSpy ? 'สายลับปริศนา' : myGameData.role}
                </p>
              </div>

              <div className="bg-glass-dark/50 p-lg rounded-2xl border border-glass backdrop-blur-md">
                <p className="text-secondary text-[10px] uppercase font-bold mb-sm tracking-widest flex items-center gap-xs">
                  <MapPin size={12} /> สถานที่
                </p>
                <p className="text-2xl font-black">
                  {myGameData.isSpy || myGameData.isAccomplice ? '???' : myGameData.place}
                </p>
                {myGameData.isSpy && (
                  <p className="text-danger text-xs mt-sm font-bold animate-pulse">หาที่นี่ให้เจอจากคำพูดคนอื่น!</p>
                )}
                {myGameData.isAccomplice && (
                  <p className="text-purple-400 text-xs mt-sm font-bold">
                    คุณเป็นผู้สมรู้ร่วมคิด — ช่วยปกป้องสายลับ
                  </p>
                )}
                {myGameData.isAccomplice && (
                  <p className="text-purple-400 text-xs mt-sm font-bold">
                    สายลับคือ: {myGameData.spyName}
                  </p>
                )}
              </div>
            </div>

            {/* Spy action button */}
            {myGameData.isSpy && !gameData.spyRevealing && (
              <button
                className="mt-xl btn btn-danger w-full py-xl text-lg font-black shadow-xl shadow-danger/20 z-10"
                onClick={handleReveal}
              >
                ประกาศตัวและทายสถานที่!
              </button>
            )}
          </motion.div>
        </div>

        {/* Vote Request Section */}
        <div className="glass-panel p-md">
          <div className="flex items-center justify-between mb-sm">
            <div className="flex items-center gap-sm">
              <Vote size={16} className="text-secondary" />
              <span className="text-sm font-bold">ขอเปิดโหวต</span>
            </div>
            <span className="text-xs text-secondary">{wantsCount}/{threshold} คน</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-glass-dark/50 rounded-full mb-md overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min(100, (wantsCount / threshold) * 100)}%` }}
            />
          </div>

          {myGameData.wantsToVote ? (
            <button
              className="btn btn-glass w-full py-sm text-sm"
              onClick={cancelVoteRequest}
            >
              ยกเลิกคำขอโหวต
            </button>
          ) : (
            <button
              className="btn btn-primary w-full py-sm text-sm font-bold"
              onClick={requestVote}
            >
              ขอเปิดการโหวต ({wantsCount}/{threshold})
            </button>
          )}
        </div>

        {/* Guess Modal (for spy) */}
        <AnimatePresence>
          {showGuessModal && myGameData.isSpy && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex-center p-md bg-black/90 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                className="glass-panel p-xl w-full max-w-sm flex flex-col gap-lg border-danger/30"
              >
                <div className="flex items-center gap-md">
                  <div className="p-sm bg-danger/20 rounded-lg text-danger">
                    <Search size={24} />
                  </div>
                  <h3 className="text-2xl font-black">ทายสถานที่</h3>
                </div>

                <p className="text-secondary text-sm leading-relaxed">
                  {gameData.spyForced
                    ? 'คุณถูกบังคับให้ทาย! เลือกสถานที่ที่คุณคิดว่าถูกต้อง'
                    : 'คุณกำลังจะเปิดเผยตัวตน! เลือกสถานที่ที่คุณคิดว่าพลเมืองอยู่ หากทายถูกคุณจะชนะทันที'
                  }
                </p>

                <div className="relative">
                  <select
                    className="input-field w-full py-xl px-lg appearance-none font-bold"
                    value={selectedGuess}
                    onChange={(e) => setSelectedGuess(e.target.value)}
                  >
                    <option value="">-- เลือกสถานที่ --</option>
                    {gameData.allPlaces?.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <div className="absolute right-md top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                    <ChevronDown size={24} />
                  </div>
                </div>

                <div className="flex gap-md mt-md">
                  {!gameData.spyForced && (
                    <button
                      className="btn btn-glass flex-1 py-md font-bold"
                      onClick={handleCancelReveal}
                    >
                      ยกเลิก
                    </button>
                  )}
                  <button
                    className={`btn btn-danger py-md font-black shadow-lg shadow-danger/20 ${gameData.spyForced ? 'w-full' : 'flex-1'}`}
                    onClick={handleGuess}
                    disabled={!selectedGuess}
                  >
                    ยืนยันการทาย
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
      <div className="flex flex-col gap-lg w-full animate-fade-in">
        <ErrorToast />
        {/* Spy Reveal Banner (if spy is forced to guess after vote) */}
        <AnimatePresence>
          {gameData.spyRevealing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full bg-danger/20 border-2 border-danger p-lg rounded-2xl animate-pulse text-center"
            >
              <h4 className="text-danger font-black text-lg mb-xs">SPY REVEALED!</h4>
              <p className="font-bold">
                "{gameData.spyRevealing}" กำลังทายสถานที่...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="glass-panel p-xl text-center border-warning/30">
          <div className="flex-center mb-md">
            <div className="p-md bg-warning/20 rounded-full">
              <Vote size={40} className="text-warning" />
            </div>
          </div>
          <h2 className="text-2xl font-black mb-sm">โหวตหาสายลับ!</h2>
          <p className="text-secondary text-sm">เลือกคนที่คุณคิดว่าเป็นสายลับ</p>
          <p className="text-xs text-secondary mt-sm">โหวตแล้ว {votedCount}/{gamePlayerCount} คน</p>
        </div>

        {/* Voting list */}
        {!myVote ? (
          <div className="glass-panel p-lg space-y-sm">
            <h4 className="text-sm font-bold mb-md">เลือกผู้ต้องสงสัย:</h4>
            {gamePlayerList
              .filter(p => p !== nickname)
              .map(p => (
                <button
                  key={p}
                  onClick={() => setVoteTarget(p)}
                  className={`w-full p-md rounded-xl border flex items-center gap-md transition-all text-left ${
                    voteTarget === p
                      ? 'border-danger bg-danger/10 text-danger'
                      : 'border-glass text-secondary hover:border-primary/50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full flex-center bg-glass-dark/50 text-sm font-bold">
                    {p.charAt(0)}
                  </div>
                  <span className="font-bold">{p}</span>
                  {voteTarget === p && <CheckCircle2 size={18} className="ml-auto text-danger" />}
                </button>
              ))}

            <button
              className="btn btn-danger w-full py-lg mt-md font-black"
              onClick={submitVote}
              disabled={!voteTarget}
            >
              ยืนยันโหวต
            </button>
          </div>
        ) : (
          <div className="glass-panel p-lg text-center">
            <CheckCircle2 size={40} className="text-success mx-auto mb-md" />
            <p className="font-bold">คุณโหวตให้ "{myVote}" แล้ว</p>
            <p className="text-secondary text-sm mt-sm">รอผู้เล่นคนอื่น...</p>
          </div>
        )}


        {/* Guess Modal for forced spy */}
        <AnimatePresence>
          {showGuessModal && myGameData.isSpy && gameData.spyRevealing === nickname && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex-center p-md bg-black/90 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                className="glass-panel p-xl w-full max-w-sm flex flex-col gap-lg border-danger/30"
              >
                <div className="flex items-center gap-md">
                  <div className="p-sm bg-danger/20 rounded-lg text-danger">
                    <Search size={24} />
                  </div>
                  <h3 className="text-2xl font-black">ทายสถานที่</h3>
                </div>

                <p className="text-secondary text-sm leading-relaxed">
                  ชาวบ้านโหวตผิดคน! คุณได้โอกาสทายสถานที่ หากทายถูกคุณจะชนะ!
                </p>

                <div className="relative">
                  <select
                    className="input-field w-full py-xl px-lg appearance-none font-bold"
                    value={selectedGuess}
                    onChange={(e) => setSelectedGuess(e.target.value)}
                  >
                    <option value="">-- เลือกสถานที่ --</option>
                    {gameData.allPlaces?.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <div className="absolute right-md top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                    <ChevronDown size={24} />
                  </div>
                </div>

                <button
                  className="btn btn-danger w-full py-md font-black shadow-lg shadow-danger/20"
                  onClick={handleGuess}
                  disabled={!selectedGuess}
                >
                  ยืนยันการทาย
                </button>
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
    const myData = gamePlayers[nickname] || {};
    const iSpy = myData.isSpy || myData.isAccomplice;
    const iWon = (gameData.winner === 'Spy' && iSpy) || (gameData.winner === 'Civilians' && !iSpy);

    return (
      <div className="flex flex-col gap-lg w-full text-center animate-fade-in">
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <ErrorToast />
        <div className={`glass-panel p-xl w-full border-2 shadow-2xl relative overflow-hidden ${
          gameData.winner === 'Spy' ? 'border-danger' : 'border-success'
        }`}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>

          <div className="flex-center mb-lg">
            {gameData.winner === 'Spy' ? (
              <div className="bg-danger/20 p-xl rounded-full shadow-lg shadow-danger/20">
                <XCircle size={80} className="text-danger" />
              </div>
            ) : (
              <div className="bg-success/20 p-xl rounded-full shadow-lg shadow-success/20">
                <CheckCircle2 size={80} className="text-success" />
              </div>
            )}
          </div>

          <h2 className={`text-5xl font-black mb-md ${gameData.winner === 'Spy' ? 'text-danger' : 'text-success'}`}>
            {gameData.winner === 'Spy' ? 'สายลับชนะ!' : 'พลเมืองชนะ!'}
          </h2>

          <div className="bg-glass-dark/30 p-lg rounded-2xl border border-glass mb-xl">
            <p className="text-secondary text-sm mb-xs">สถานที่จริงคือ</p>
            <p className="text-2xl font-black text-white">{gameData.targetPlace}</p>
            {gameData.guess && (
              <p className="mt-sm text-sm">
                สายลับทายว่า: <span className={gameData.winner === 'Spy' ? 'text-success font-bold' : 'text-danger font-bold'}>"{gameData.guess}"</span>
              </p>
            )}
          </div>

          {/* Vote results if voting happened */}
          {Object.values(gamePlayers).some(p => p.votedFor) && (
            <div className="bg-glass-dark/30 p-lg rounded-2xl border border-glass mb-xl text-left">
              <p className="text-xs font-bold opacity-40 uppercase tracking-widest mb-md">ผลการโหวต</p>
              {gamePlayerList.map(name => (
                <div key={name} className="flex justify-between items-center text-sm py-xs">
                  <span className="font-bold">{name}</span>
                  <span className="text-secondary">
                    {gamePlayers[name]?.votedFor ? `โหวต: ${gamePlayers[name].votedFor}` : '-'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-sm text-left">
            <p className="text-xs font-bold opacity-40 uppercase tracking-widest mb-md">สรุปบทบาทผู้เล่น</p>
            {Object.entries(gamePlayers).map(([name, data]) => (
              <div key={name} className="flex justify-between items-center p-md bg-glass-dark/20 rounded-xl border border-glass/30">
                <div className="flex items-center gap-md">
                  <div className={`w-8 h-8 rounded-full flex-center text-xs font-bold ${
                    data.isSpy ? 'bg-danger/20 text-danger' : data.isAccomplice ? 'bg-purple-500/20 text-purple-400' : 'bg-primary/20 text-primary'
                  }`}>
                    {name.charAt(0)}
                  </div>
                  <span className="font-bold">{name}</span>
                </div>
                <span className={`text-sm px-md py-xs rounded-full ${
                  data.isSpy ? 'bg-danger/20 text-danger font-black'
                    : data.isAccomplice ? 'bg-purple-500/20 text-purple-400 font-black'
                    : 'bg-glass text-secondary font-medium'
                }`}>
                  {data.isSpy ? 'สายลับ' : data.isAccomplice ? 'ผู้สมรู้ร่วมคิด' : data.role}
                </span>
              </div>
            ))}
          </div>
        </div>


        {isHost ? (
          <div className="flex flex-col gap-md w-full">
            <button
              className="btn btn-primary py-3 px-6 text-[14px] w-full"
              onClick={handlePlayAgain}
            >
              🔄 เล่นอีกครั้ง
            </button>
            <button
              className="btn btn-outline w-full py-lg font-black"
              onClick={resetToLobby}
            >
              กลับไปล็อบบี้
            </button>
          </div>
        ) : (
          <button
            className="btn btn-outline w-full py-lg font-black"
            onClick={requestLeave}
          >
            <LogOut size={18} /> ออกจากห้อง
          </button>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: FALLBACK (should not happen normally)
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="w-full flex-center">
      <div className="glass-panel p-lg text-center">
        <p className="text-secondary">กำลังโหลด...</p>
      </div>
    </div>
  );
};

export default Spyfall;
