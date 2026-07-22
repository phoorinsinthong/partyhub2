import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Crown, Play, ArrowLeft, Copy, Check, X } from 'lucide-react';
import { ref, update, remove } from 'firebase/database';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { usePresence, usePlayerCleanup, useHostPromotedToast } from '../hooks/usePresence';
import { getAvatarColor } from '../utils/avatars';
import Scoreboard from '../components/Scoreboard';
import PersonalStats from '../components/PersonalStats';
import ConnectionIndicator from '../components/ConnectionIndicator';
import { saveSession, clearSession } from '../components/ReconnectBanner';
import { feedback } from '../utils/feedback';
import { useGame } from '../contexts/GameContext';

const gameCategories = [
  {
    label: 'บอร์ดเกม',
    games: [
      { id: 'spyfall', name: 'สปายฟอล', icon: '🕵️‍♂️', bg: 'from-sage-50 to-emerald-50', border: 'border-sage-200', minPlayers: 3 },
      { id: 'werewolf', name: 'หมาป่า (ดิจิทัล)', icon: '🐺', bg: 'from-stone-50 to-zinc-50', border: 'border-stone-200', minPlayers: 4 },
      { id: 'werewolf_physical', name: 'หมาป่า (ไพ่จริง)', icon: '🎴', bg: 'from-orange-50 to-red-50', border: 'border-orange-200', minPlayers: 1 },
      { id: 'twentyquestions', name: 'Insider', icon: '🕵️', bg: 'from-purple-50 to-fuchsia-50', border: 'border-purple-200', minPlayers: 4 },
      { id: 'quiz', name: 'ควิซ', icon: '🧠', bg: 'from-blue-50 to-indigo-50', border: 'border-blue-200', minPlayers: 2 },
      { id: 'drawing', name: 'วาดรูปทายคำ', icon: '🎨', bg: 'from-purple-50 to-fuchsia-50', border: 'border-purple-200', minPlayers: 2 },
      { id: 'taboo', name: 'ใบ้คำ', icon: '🤫', bg: 'from-violet-50 to-purple-50', border: 'border-violet-200', minPlayers: 2 },
      { id: 'fakeartist', name: 'ศิลปินปลอม', icon: '🎭', bg: 'from-pink-50 to-rose-50', border: 'border-pink-200', minPlayers: 4 },
    ],
  },
  {
    label: 'วงเหล้า',
    games: [
      { id: 'drinking', name: 'วงเหล้า', icon: '🍺', bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', minPlayers: 1 },
      { id: 'truthordare', name: 'จริงหรือกล้า', icon: '🎭', bg: 'from-pink-50 to-rose-50', border: 'border-pink-200', minPlayers: 2 },
      { id: 'neverhaveiever', name: 'ไม่เคย...', icon: '🙋', bg: 'from-red-50 to-rose-50', border: 'border-red-200', minPlayers: 2 },
      { id: 'target', name: 'เลขเป้า', icon: '🎯', bg: 'from-lime-50 to-green-50', border: 'border-lime-200', minPlayers: 2 },
      { id: 'wouldyourather', name: 'เลือกข้าง', icon: '⚖️', bg: 'from-rose-50 to-pink-50', border: 'border-rose-200', minPlayers: 2 },
      { id: 'wordbomb', name: 'บอมบ์คำ', icon: '💣', bg: 'from-amber-50 to-yellow-50', border: 'border-amber-200', minPlayers: 2 },
      { id: 'mathrace', name: 'คำนวณเร็ว', icon: '🔢', bg: 'from-cyan-50 to-blue-50', border: 'border-cyan-200', minPlayers: 2 },
    ],
  },
  {
    label: 'เกมไพ่',
    games: [
      { id: 'pokdeng', name: 'ป๊อกเด้ง', icon: '💰', bg: 'from-rose-50 to-red-50', border: 'border-rose-200', minPlayers: 2 },
      { id: 'poker', name: 'โป๊กเกอร์', icon: '💵', bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-200', minPlayers: 2 },
      { id: 'blackjack', name: 'แบล็คแจ็ค', icon: '🃏', bg: 'from-green-50 to-emerald-50', border: 'border-green-200', minPlayers: 2 },
      { id: 'slaves', name: 'สลาฟ', icon: '👑', bg: 'from-indigo-50 to-purple-50', border: 'border-indigo-200', minPlayers: 4 },
    ],
  },
];

const allGames = gameCategories.flatMap(cat => cat.games);

const Lobby: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { roomData, userNickname, isHost, isLoading, setRoomId } = useGame();
  
  const [selectedGame, setSelectedGame] = useState('drinking');
  const [copied, setCopied] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const leavingRef = useRef(false);
  const startingRef = useRef(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showHostPromotedToast = useHostPromotedToast();

  // Set roomId in context
  useEffect(() => {
    setRoomId(roomId || null);
  }, [roomId, setRoomId]);

  usePresence(roomId || '', userNickname || '', isHost);
  usePlayerCleanup(roomId || '');

  useEffect(() => {
    if (!userNickname && !isLoading) { navigate('/'); return; }
  }, [userNickname, navigate, isLoading]);

  useEffect(() => {
    if (roomId && userNickname) saveSession(roomId, userNickname);
  }, [roomId, userNickname]);

  // Handle navigation and status sync
  useEffect(() => {
    if (leavingRef.current) return;
    
    if (!roomData && !isLoading && roomId) {
      navigate('/');
      return;
    }
    
    if (roomData) {
      // Check if kicked
      if (userNickname && roomData.players && !roomData.players[userNickname]) {
        clearSession();
        navigate('/', { state: { kicked: true } });
        return;
      }
      
      // Navigate to game if started
      if (roomData.status === 'playing' || roomData.status === 'finished') {
        navigate(`/game/${roomId}`);
      }
    }
  }, [roomData, isLoading, roomId, navigate, userNickname]);

  const handleStartGame = async () => {
    if (!isHost || startingRef.current) return;
    startingRef.current = true;
    feedback('gameStart');
    try {
      const now = Date.now();
      await update(ref(db, `rooms/${roomId}`), { 
        status: 'playing', 
        currentGame: selectedGame, 
        gameData: { status: 'waiting', startTime: now } 
      });
    } finally {
      startingRef.current = false;
    }
  };

  const handleLeaveRoom = async () => {
    leavingRef.current = true;
    clearSession();
    try {
      if (isHost) await remove(ref(db, `rooms/${roomId}`));
      else if (userNickname) await remove(ref(db, `rooms/${roomId}/players/${userNickname}`));
      navigate('/');
    } catch {
      leavingRef.current = false;
      setLeaveError('ออกจากห้องไม่สำเร็จ ลองอีกครั้ง');
      setTimeout(() => setLeaveError(''), 3000);
    }
  };

  const handleKickPlayer = async (name: string) => { 
    if (isHost && roomId) await remove(ref(db, `rooms/${roomId}/players/${name}`)); 
  };

  const copyRoomCode = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); };
  }, []);

  if (!roomData) return (
    <div className="flex-center flex-1 flex-col gap-3">
      <div className="w-7 h-7 border-[3px] border-sage-200 border-t-sage-500 rounded-full animate-spin"></div>
      <p className="text-olive-400 text-[13px] font-semibold">กำลังเชื่อมต่อ...</p>
    </div>
  );

  const playersList = Object.entries(roomData.players || {}).map(([key, val]) => ({
    key,
    ...val,
    name: val.name || key
  }));

  return (
    <div className="animate-fade-in flex flex-col flex-1">
      {leaveError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-xl">
          {leaveError}
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

      <div className="flex-between py-2 mb-4">
        <button className="btn btn-outline py-2 px-3.5 min-h-[44px] text-[13px]" onClick={handleLeaveRoom}>
          <ArrowLeft size={16} />
          {isHost ? 'ปิดห้อง' : 'ออก'}
        </button>

        <button
          onClick={copyRoomCode}
          className="flex items-center gap-2 card px-4 py-2.5 active:scale-95 transition-transform"
        >
          <span className="text-[10px] text-olive-400 font-bold uppercase tracking-wide">ห้อง</span>
          <span className="text-[18px] font-black text-sage-600 tracking-[0.2em] font-display">{roomId}</span>
          {copied ? <Check size={14} className="text-sage-500" /> : <Copy size={14} className="text-olive-300" />}
        </button>
      </div>

      <div className="flex-center gap-3 mb-4">
        <div className="inline-flex items-center gap-2 bg-sage-50 border-2 border-sage-100 rounded-full px-4 py-2">
          <span className="w-2.5 h-2.5 bg-sage-400 rounded-full animate-pulse-soft"></span>
          <span className="text-[12px] font-extrabold text-sage-700">รอผู้เล่น • {playersList.length} คน</span>
        </div>
        <Scoreboard roomId={roomId || ''} isHost={isHost} />
        <PersonalStats />
        <ConnectionIndicator />
      </div>

      <section className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={14} className="text-sage-400" />
          <span className="font-bold text-[13px] text-olive-600">ผู้เล่นในห้อง</span>
        </div>

        <div className="space-y-2">
          <AnimatePresence>
            {playersList.map((p, index) => (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15, delay: index * 0.03 }}
                className={`flex items-center justify-between p-3 rounded-2xl transition-all duration-200 ${
                  p.online === false ? 'opacity-40 grayscale-[30%]' : ''
                } ${
                  p.isHost ? 'bg-gradient-to-r from-sage-50 to-emerald-50 border-2 border-sage-100' : 'bg-olive-50/60 border-2 border-olive-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex-center text-lg shadow-sm border-2 border-white/70"
                    style={{ backgroundColor: p.avatarColor || getAvatarColor(p.name) }}
                  >
                    {p.avatar || p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[14px] text-olive-800">{p.name}</span>
                      {p.isHost && <span className="text-[9px] font-extrabold text-warm-500 bg-warm-100 px-1.5 py-0.5 rounded-md">HOST</span>}
                      {p.key === userNickname && <span className="text-[9px] font-extrabold text-sage-600 bg-sage-100 px-1.5 py-0.5 rounded-md">คุณ</span>}
                      {p.online === false && <span className="text-[9px] font-extrabold text-olive-400 bg-olive-100/70 px-1.5 py-0.5 rounded-md">ออฟไลน์</span>}
                    </div>
                  </div>
                </div>
                {isHost && !p.isHost && (
                  <button onClick={()=>handleKickPlayer(p.key)} className="w-9 h-9 rounded-xl bg-red-50 border-2 border-red-100 flex-center text-red-400 active:bg-red-100">
                    <X size={14} />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {isHost ? (
        <section className="flex flex-col gap-4 flex-1">
          <div className="card p-4 space-y-5">
            {gameCategories.map((category) => (
              <div key={category.label}>
                <h3 className="mb-3 font-display font-bold text-[13px] text-olive-600 uppercase tracking-wider">
                  {category.label}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {category.games.map((game) => (
                    <button
                      key={game.id}
                      className={`rounded-2xl p-4 flex flex-col items-center gap-1.5 border-2 transition-transform active:scale-95 ${
                        selectedGame === game.id ? `bg-gradient-to-br ${game.bg} ${game.border} shadow-sm` : 'bg-white border-transparent'
                      }`}
                      onClick={() => setSelectedGame(game.id)}
                    >
                      <span className="text-3xl">{game.icon}</span>
                      <span className="font-display font-bold text-[13px] text-olive-700">{game.name}</span>
                      <span className="text-[9px] font-bold text-olive-300">{game.minPlayers}+ คน</span>
                      {selectedGame === game.id && (
                        <span className="w-2 h-2 rounded-full bg-sage-400 mt-0.5"></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-2">
            {(() => {
              const selectedGameObj = allGames.find(g => g.id === selectedGame);
              const minP = selectedGameObj?.minPlayers ?? 2;
              const notEnough = playersList.length < minP;
              return (
                <>
                  <button
                    className="btn btn-primary w-full py-4 text-[17px]"
                    onClick={handleStartGame}
                    disabled={notEnough}
                  >
                    <Play size={18} fill="currentColor" />
                    เริ่มเกมเลย!
                  </button>
                  {notEnough && (
                    <p className="text-center text-[11px] font-bold text-warm-500 bg-warm-50 border-2 border-warm-100 p-2.5 rounded-xl mt-2.5">
                      ต้องมีอย่างน้อย {minP} คน
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </section>
      ) : (
        <section className="card flex-center flex-col gap-4 p-8 flex-1">
          <span className="text-5xl animate-bounce-soft">🎮</span>
          <div className="text-center">
            <p className="font-bold text-[15px] text-olive-700 mb-1">รอสักครู่นะ...</p>
            <p className="text-olive-400 text-[13px]">Host กำลังเลือกเกม</p>
          </div>
          <div className="flex gap-1.5 mt-1">
            <span className="w-2.5 h-2.5 bg-sage-300 rounded-full animate-pulse-soft"></span>
            <span className="w-2.5 h-2.5 bg-sage-400 rounded-full animate-pulse-soft" style={{animationDelay:'0.3s'}}></span>
            <span className="w-2.5 h-2.5 bg-sage-300 rounded-full animate-pulse-soft" style={{animationDelay:'0.6s'}}></span>
          </div>
        </section>
      )}
    </div>
  );
};

export default Lobby;
