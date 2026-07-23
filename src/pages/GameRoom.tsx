// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, update, remove } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { RefreshCw, LogOut, Crown, ArrowLeftRight } from 'lucide-react';
import { usePresence, usePlayerCleanup, useHostPromotedToast } from '../hooks/usePresence';
import GameGuide from '../components/GameGuide';
import Scoreboard from '../components/Scoreboard';
import ConnectionIndicator from '../components/ConnectionIndicator';
import { saveSession, clearSession } from '../components/ReconnectBanner';
import { GAME_NAMES, GAME_ICONS } from '../utils/gameData';
import { fireConfetti } from '../utils/confetti';
import { useGame } from '../contexts/GameContext';

const PARTY_GAMES = ['drinking', 'truthordare', 'neverhaveiever', 'target', 'wouldyourather', 'wordbomb', 'mathrace'];

// Lazy-load game components
const DrinkingGame = lazy(() => import('../games/drinkingGame'));
const Spyfall = lazy(() => import('../games/spyfall'));
const TargetNumber = lazy(() => import('../games/targetNumber'));
const Werewolf = lazy(() => import('../games/Werewolf'));
const TruthOrDare = lazy(() => import('../games/truthOrDare'));
const Quiz = lazy(() => import('../games/quiz'));
const Drawing = lazy(() => import('../games/drawing'));
const WouldYouRather = lazy(() => import('../games/wouldYouRather'));
const WordBomb = lazy(() => import('../games/wordBomb'));
const NeverHaveIEver = lazy(() => import('../games/neverHaveIEver'));
const Taboo = lazy(() => import('../games/taboo'));
const MathRace = lazy(() => import('../games/mathRace'));
const TwentyQuestions = lazy(() => import('../games/twentyQuestions'));
const FakeArtist = lazy(() => import('../games/fakeArtist'));
const Blackjack = lazy(() => import('../games/blackjack'));
const Slaves = lazy(() => import('../games/slaves'));
const Poker = lazy(() => import('../games/poker'));
const PokDeng = lazy(() => import('../games/pokDeng'));

const GameLoadingFallback = () => (
  <div className="flex items-center justify-center flex-1 flex-col gap-3 py-20">
    <div className="w-7 h-7 border-[3px] border-slate-700 border-t-neon-blue rounded-full animate-spin"></div>
    <p className="text-slate-400 text-[13px] font-semibold">กำลังโหลดเกม...</p>
  </div>
);

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ message, onConfirm, onCancel }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
    onClick={onCancel}
  >
    <motion.div
      initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
      transition={{ duration: 0.15 }}
      className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-[300px] flex flex-col gap-4"
      onClick={e => e.stopPropagation()}
    >
      <p className="font-bold text-[15px] text-white text-center leading-relaxed">{message}</p>
      <div className="flex gap-3">
        <button className="bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl py-3 flex-1 text-[14px]" onClick={onCancel}>ยกเลิก</button>
        <button className="bg-neon-pink text-white font-bold rounded-xl py-3 shadow-[0_0_15px_rgba(255,0,128,0.3)] border border-neon-pink flex-1 text-[14px]" onClick={onConfirm}>ยืนยัน</button>
      </div>
    </motion.div>
  </motion.div>
);

const GameRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { roomData, userNickname, isHost, isLoading, setRoomId, setUserNickname } = useGame();
  
  const [restartingOverlay, setRestartingOverlay] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [actionError, setActionError] = useState('');
  const [showGameSwitcher, setShowGameSwitcher] = useState(false);
  const prevPhaseRef = useRef<string | null>(null);
  const showHostPromotedToast = useHostPromotedToast();

  // Set roomId in context
  useEffect(() => {
    setRoomId(roomId || null);
  }, [roomId, setRoomId]);

  const effectiveNickname = userNickname || localStorage.getItem('nickname');

  useEffect(() => {
    if (!userNickname && effectiveNickname) {
      setUserNickname(effectiveNickname);
    }
  }, [userNickname, effectiveNickname, setUserNickname]);

  usePresence(roomId || '', effectiveNickname || '', isHost);
  usePlayerCleanup(roomId || '');

  useEffect(() => {
    if (!effectiveNickname && !isLoading) { navigate('/'); return; }
  }, [effectiveNickname, navigate, isLoading]);

  useEffect(() => {
    if (roomId && effectiveNickname) saveSession(roomId, effectiveNickname);
  }, [roomId, effectiveNickname]);

  // Handle navigation and session cleanup based on room state
  useEffect(() => {
    if (!roomData && !isLoading && roomId) {
      clearSession();
      navigate('/');
      return;
    }
    
    if (roomData) {
      if (userNickname && roomData.players) {
        const playerKeys = Object.keys(roomData.players);
        const isPlayerInRoom = playerKeys.some(k => k.toLowerCase() === userNickname.toLowerCase());
        if (playerKeys.length > 0 && !isPlayerInRoom) {
          clearSession();
          navigate('/', { state: { kicked: true } });
          return;
        }
      }
      
      if (roomData.status === 'waiting') {
        navigate(`/lobby/${roomId}`);
        return;
      }
    }
  }, [roomData, isLoading, roomId, navigate, userNickname]);

  // Show "restarting" overlay + confetti on game finish
  useEffect(() => {
    if (!roomData?.gameData) return;
    const phase = roomData.gameData.phase;
    const gameStatus = roomData.gameData.status;
    const currentState = phase || gameStatus || '';
    const prev = prevPhaseRef.current;
    
    if (prev === 'finished' && currentState === 'waiting') {
      setRestartingOverlay(true);
      const t = setTimeout(() => setRestartingOverlay(false), 2000);
      prevPhaseRef.current = currentState;
      return () => clearTimeout(t);
    }
    
    if (currentState === 'finished' && prev && prev !== 'finished') {
      fireConfetti();
    }
    prevPhaseRef.current = currentState;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomData?.gameData?.phase, roomData?.gameData?.status]);

  const showActionError = useCallback((msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError(''), 3000);
  }, []);

  const handleBack = () => {
    if (!isHost) return;
    setConfirmAction({
      message: 'จบเกมและกลับ Lobby? ข้อมูลเกมจะหายทั้งหมด',
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          await update(ref(db, `rooms/${roomId}`), { status: 'waiting', currentGame: null, gameData: null });
          navigate(`/lobby/${roomId}`);
        } catch {
          showActionError('เกิดข้อผิดพลาด ลองอีกครั้ง');
        }
      },
    });
  };

  const handleLeaveGame = () => {
    setConfirmAction({
      message: 'ออกจากเกมกลางคัน?',
      onConfirm: async () => {
        setConfirmAction(null);
        try {
          clearSession();
          await remove(ref(db, `rooms/${roomId}/players/${userNickname}`));
          navigate('/');
        } catch {
          showActionError('เกิดข้อผิดพลาด ลองอีกครั้ง');
        }
      },
    });
  };

  const handleSwitchGame = useCallback(async (gameId: string) => {
    if (!isHost) return;
    setShowGameSwitcher(false);
    try {
      const now = Date.now();
      await update(ref(db, `rooms/${roomId}`), { 
        currentGame: gameId, 
        gameData: { status: 'waiting', startTime: now } 
      });
    } catch {
      showActionError('เปลี่ยนเกมไม่สำเร็จ');
    }
  }, [isHost, roomId, showActionError]);

  if (!roomData) return (
    <div className="flex items-center justify-center flex-1 flex-col gap-3">
      <div className="w-7 h-7 border-[3px] border-slate-700 border-t-neon-blue rounded-full animate-spin"></div>
      <p className="text-slate-400 text-[13px]">กำลังโหลด...</p>
    </div>
  );

  const meta = {
    icon: GAME_ICONS[roomData.currentGame as keyof typeof GAME_ICONS] || '🎮',
    name: GAME_NAMES[roomData.currentGame as keyof typeof GAME_NAMES] || roomData.currentGame,
  };

  const renderGame = () => {
    const props = { roomId, roomData, userNickname };
    switch (roomData.currentGame) {
      case 'drinking': return <DrinkingGame />;
      case 'spyfall': return <Spyfall />;
      case 'target': return <TargetNumber />;
      case 'werewolf':
      case 'werewolf_physical': return <Werewolf />;
      case 'truthordare': return <TruthOrDare />;
      case 'quiz': return <Quiz />;
      case 'drawing': return <Drawing />;
      case 'wouldyourather': return <WouldYouRather />;
      case 'wordbomb': return <WordBomb />;
      case 'neverhaveiever': return <NeverHaveIEver />;
      case 'taboo': return <Taboo />;
      case 'mathrace': return <MathRace />;
      case 'twentyquestions': return <TwentyQuestions />;
      case 'fakeartist': return <FakeArtist />;
      case 'blackjack': return <Blackjack />;
      case 'slaves': return <Slaves />;
      case 'poker': return <Poker />;
      case 'pokdeng': return <PokDeng />;
      default: return (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center flex-col p-8 text-center flex-1 gap-3">
          <span className="text-4xl">🔨</span>
          <p className="font-bold text-slate-200">กำลังรอสักครู่...</p>
          <p className="text-slate-400 text-sm">รอหัวห้องเลือกเกม!</p>
        </div>
      );
    }
  };

  return (
    <div className="animate-fade-in flex flex-col flex-1">
      {actionError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
          {actionError}
        </div>
      )}
      <AnimatePresence>
        {showHostPromotedToast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-neon-green text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-[13px] font-bold"
          >
            <Crown size={16} /> คุณเป็น Host ห้องนี้แล้ว!
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmAction && (
          <ConfirmModal
            message={confirmAction.message}
            onConfirm={confirmAction.onConfirm}
            onCancel={() => setConfirmAction(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {restartingOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center flex-col gap-3 bg-slate-900/80 backdrop-blur-sm"
          >
            <div className="w-8 h-8 border-[3px] border-slate-700 border-t-neon-blue rounded-full animate-spin" />
            <p className="font-bold text-[15px] text-slate-200">กำลังเริ่มเกมใหม่...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Switcher Modal (party games only) */}
      <AnimatePresence>
        {showGameSwitcher && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setShowGameSwitcher(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="bg-slate-900 rounded-t-3xl border-t border-slate-700 w-full max-w-[460px] p-5"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-display font-bold text-[14px] text-slate-200 mb-3">เปลี่ยนเกม</h3>
              <div className="grid grid-cols-2 gap-2">
                {PARTY_GAMES.filter(id => id !== roomData.currentGame).map((id) => (
                  <button
                    key={id}
                    onClick={() => handleSwitchGame(id)}
                    className="flex items-center gap-2 p-3 rounded-2xl border-2 border-slate-700 active:bg-slate-800 active:border-slate-600 transition-all"
                  >
                    <span className="text-xl">{GAME_ICONS[id as keyof typeof GAME_ICONS]}</span>
                    <span className="font-bold text-[12px] text-slate-200">{GAME_NAMES[id as keyof typeof GAME_NAMES]}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center py-2 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{meta.icon}</span>
          <span className="font-display font-bold text-[15px] text-white">{meta.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Scoreboard roomId={roomId || ''} isHost={isHost} />
          <ConnectionIndicator />
          {isHost && PARTY_GAMES.includes(roomData.currentGame) && (
            <button className="bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl py-2 px-3 text-[12px] min-h-[42px]" onClick={() => setShowGameSwitcher(true)}>
              <ArrowLeftRight size={13} /> เปลี่ยน
            </button>
          )}
          <GameGuide gameId={roomData.currentGame} />
          {isHost ? (
            <button className="bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl py-2 px-3 text-[12px] min-h-[42px]" onClick={handleBack}>
              <RefreshCw size={13} /> จบเกม
            </button>
          ) : (
            <button className="bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-xl py-2 px-3 text-[12px] min-h-[42px]" onClick={handleLeaveGame}>
              <LogOut size={13} /> ออก
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <Suspense fallback={<GameLoadingFallback />}>
          {renderGame()}
        </Suspense>
      </div>

    </div>
  );
};

export default GameRoom;
