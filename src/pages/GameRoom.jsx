import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, onValue, update, remove } from 'firebase/database';
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

const PARTY_GAMES = ['drinking', 'truthordare', 'neverhaveiever', 'target', 'wouldyourather', 'wordbomb', 'mathrace'];

// Lazy-load game components to reduce initial bundle size
const DrinkingGame = lazy(() => import('../games/DrinkingGame'));
const Spyfall = lazy(() => import('../games/Spyfall'));
const TargetNumber = lazy(() => import('../games/TargetNumber'));
const Werewolf = lazy(() => import('../games/Werewolf'));
const TruthOrDare = lazy(() => import('../games/TruthOrDare'));
const Quiz = lazy(() => import('../games/Quiz'));
const Drawing = lazy(() => import('../games/Drawing'));
const WouldYouRather = lazy(() => import('../games/WouldYouRather'));
const WordBomb = lazy(() => import('../games/WordBomb'));
const NeverHaveIEver = lazy(() => import('../games/NeverHaveIEver'));
const Taboo = lazy(() => import('../games/Taboo'));
const MathRace = lazy(() => import('../games/MathRace'));
const TwentyQuestions = lazy(() => import('../games/TwentyQuestions'));
const FakeArtist = lazy(() => import('../games/FakeArtist'));
const Blackjack = lazy(() => import('../games/Blackjack'));
const Slaves = lazy(() => import('../games/Slaves'));
const Poker = lazy(() => import('../games/Poker'));


const GameLoadingFallback = () => (
  <div className="flex-center flex-1 flex-col gap-3 py-20">
    <div className="w-7 h-7 border-[3px] border-sage-200 border-t-sage-500 rounded-full animate-spin"></div>
    <p className="text-olive-400 text-[13px] font-semibold">กำลังโหลดเกม...</p>
  </div>
);

const ConfirmModal = ({ message, onConfirm, onCancel }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex-center p-6"
    style={{ background: 'rgba(47,42,34,0.5)' }}
    onClick={onCancel}
  >
    <motion.div
      initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
      transition={{ duration: 0.15 }}
      className="card p-6 w-full max-w-[300px] flex flex-col gap-4"
      onClick={e => e.stopPropagation()}
    >
      <p className="font-bold text-[15px] text-olive-800 text-center leading-relaxed">{message}</p>
      <div className="flex gap-3">
        <button className="btn btn-outline flex-1 py-3 text-[14px]" onClick={onCancel}>ยกเลิก</button>
        <button className="btn btn-primary flex-1 py-3 text-[14px] bg-red-500 border-red-500" onClick={onConfirm}>ยืนยัน</button>
      </div>
    </motion.div>
  </motion.div>
);

const GameRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [roomData, setRoomData] = useState(null);
  const [restartingOverlay, setRestartingOverlay] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionError, setActionError] = useState('');
  const [showGameSwitcher, setShowGameSwitcher] = useState(false);
  const prevPhaseRef = useRef(null);
  const userNickname = localStorage.getItem('nickname');
  const isHost = userNickname === roomData?.host;
  const showHostPromotedToast = useHostPromotedToast();

  usePresence(roomId, userNickname, isHost);
  usePlayerCleanup(roomId);

  useEffect(() => {
    if (!userNickname) { navigate('/'); return; }
  }, [userNickname, navigate]);

  useEffect(() => {
    if (roomId && userNickname) saveSession(roomId, userNickname);
  }, [roomId, userNickname]);

  useEffect(() => {
    const unsub = onValue(ref(db, `rooms/${roomId}`), (snap) => {
      if (!snap.exists()) { clearSession(); navigate('/'); return; }
      const d = snap.val();
      // ถ้าผู้เล่นถูกเตะ (ไม่อยู่ในรายชื่อแล้ว) -> กลับหน้าแรก
      if (d.players && !d.players[userNickname]) { clearSession(); navigate('/', { state: { kicked: true } }); return; }
      // ถ้า host กดจบเกม (status กลับเป็น waiting) -> กลับ lobby
      if (d.status === 'waiting') { navigate(`/lobby/${roomId}`); return; }
      setRoomData(d);
    });
    return () => unsub();
  }, [roomId, navigate, userNickname]);

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
  }, [roomData?.gameData?.phase, roomData?.gameData?.status]);

  const showActionError = (msg) => {
    setActionError(msg);
    setTimeout(() => setActionError(''), 3000);
  };

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

  const handleSwitchGame = async (gameId) => {
    if (!isHost) return;
    setShowGameSwitcher(false);
    try {
      await update(ref(db, `rooms/${roomId}`), { currentGame: gameId, gameData: { status: 'waiting', startTime: Date.now() } });
    } catch {
      showActionError('เปลี่ยนเกมไม่สำเร็จ');
    }
  };

  if (!roomData) return (
    <div className="flex-center flex-1 flex-col gap-3">
      <div className="w-7 h-7 border-[3px] border-sage-200 border-t-sage-500 rounded-full animate-spin"></div>
      <p className="text-olive-400 text-[13px]">กำลังโหลด...</p>
    </div>
  );

  const meta = {
    icon: GAME_ICONS[roomData.currentGame] || '🎮',
    name: GAME_NAMES[roomData.currentGame] || roomData.currentGame,
  };

  const renderGame = () => {
    const props = { roomId, roomData, userNickname };
    switch (roomData.currentGame) {
      case 'drinking': return <DrinkingGame {...props} />;
      case 'spyfall': return <Spyfall {...props} />;
      case 'target': return <TargetNumber {...props} />;
      case 'werewolf':
      case 'werewolf_physical': return <Werewolf {...props} />;
      case 'truthordare': return <TruthOrDare {...props} />;
      case 'quiz': return <Quiz {...props} />;
      case 'drawing': return <Drawing {...props} />;
      case 'wouldyourather': return <WouldYouRather {...props} />;
      case 'wordbomb': return <WordBomb {...props} />;
      case 'neverhaveiever': return <NeverHaveIEver {...props} />;
      case 'taboo': return <Taboo {...props} />;
      case 'mathrace': return <MathRace {...props} />;
      case 'twentyquestions': return <TwentyQuestions {...props} />;
      case 'fakeartist': return <FakeArtist {...props} />;
      case 'blackjack': return <Blackjack {...props} />;
      case 'slaves': return <Slaves {...props} />;
      case 'poker': return <Poker {...props} />;
      default: return (
        <div className="card flex-center flex-col p-8 text-center flex-1 gap-3">
          <span className="text-4xl">🔨</span>
          <p className="font-bold text-olive-700">กำลังรอสักครู่...</p>
          <p className="text-olive-400 text-sm">รอหัวห้องเลือกเกม!</p>
        </div>
      );
    }
  };

  const myPlayer = roomData.players?.[userNickname];

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
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-sage-500 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-[13px] font-bold"
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
            className="fixed inset-0 z-50 flex-center flex-col gap-3 bg-white/80 backdrop-blur-sm"
          >
            <div className="w-8 h-8 border-[3px] border-sage-200 border-t-sage-500 rounded-full animate-spin" />
            <p className="font-bold text-[15px] text-olive-700">กำลังเริ่มเกมใหม่...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Switcher Modal (party games only) */}
      <AnimatePresence>
        {showGameSwitcher && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-0"
            style={{ background: 'rgba(47,42,34,0.4)' }}
            onClick={() => setShowGameSwitcher(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="bg-white rounded-t-3xl w-full max-w-[460px] p-5"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-display font-bold text-[14px] text-olive-700 mb-3">เปลี่ยนเกม</h3>
              <div className="grid grid-cols-2 gap-2">
                {PARTY_GAMES.filter(id => id !== roomData.currentGame).map((id) => (
                  <button
                    key={id}
                    onClick={() => handleSwitchGame(id)}
                    className="flex items-center gap-2 p-3 rounded-2xl border-2 border-olive-100 active:bg-sage-50 active:border-sage-200 transition-all"
                  >
                    <span className="text-xl">{GAME_ICONS[id]}</span>
                    <span className="font-bold text-[12px] text-olive-700">{GAME_NAMES[id]}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-between py-2 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{meta.icon}</span>
          <span className="font-display font-bold text-[15px] text-olive-800">{meta.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Scoreboard roomId={roomId} isHost={isHost} />
          <ConnectionIndicator />
          {isHost && PARTY_GAMES.includes(roomData.currentGame) && (
            <button className="btn btn-outline py-2 px-3 text-[12px] min-h-[42px]" onClick={() => setShowGameSwitcher(true)}>
              <ArrowLeftRight size={13} /> เปลี่ยน
            </button>
          )}
          <GameGuide gameId={roomData.currentGame} />
          {isHost ? (
            <button className="btn btn-outline py-2 px-3 text-[12px] min-h-[42px]" onClick={handleBack}>
              <RefreshCw size={13} /> จบเกม
            </button>
          ) : (
            <button className="btn btn-outline py-2 px-3 text-[12px] min-h-[42px]" onClick={handleLeaveGame}>
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
