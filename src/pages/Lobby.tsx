import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Crown, Play, ArrowLeft, Copy, Check, X, ShieldAlert } from 'lucide-react';
import { ref, update, remove } from 'firebase/database';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { usePresence, usePlayerCleanup, useHostPromotedToast } from '../hooks/usePresence';
import { getAvatarUrl, getRandomGradient } from '../utils/avatars';
import Scoreboard from '../components/Scoreboard';
import PersonalStats from '../components/PersonalStats';
import ConnectionIndicator from '../components/ConnectionIndicator';
import { saveSession, clearSession } from '../components/ReconnectBanner';
import EpicPopup from '../components/EpicPopup';
import SmartTutorialOverlay, { TutorialStep } from '../components/SmartTutorialOverlay';
import { useGame } from '../contexts/GameContext';
import { useHaptics } from '../hooks/useHaptics';

const gameCategories = [
  {
    label: 'บอร์ดเกม',
    games: [
      { id: 'spyfall', name: 'สปายฟอล', icon: '🕵️‍♂️', minPlayers: 3 },
      { id: 'werewolf', name: 'หมาป่า (แอป)', icon: '🐺', minPlayers: 4 },
      { id: 'twentyquestions', name: 'Insider', icon: '🕵️', minPlayers: 4 },
      { id: 'drawing', name: 'วาดรูปทายคำ', icon: '🎨', minPlayers: 2 },
      { id: 'fakeartist', name: 'ศิลปินปลอม', icon: '🎭', minPlayers: 4 },
    ],
  },
  {
    label: 'วงเหล้า',
    games: [
      { id: 'drinking', name: 'วงเหล้า', icon: '🍺', minPlayers: 1 },
      { id: 'truthordare', name: 'จริงหรือกล้า', icon: '🎭', minPlayers: 2 },
      { id: 'wordbomb', name: 'บอมบ์คำ', icon: '💣', minPlayers: 2 },
    ],
  }
];

const allGames = gameCategories.flatMap(cat => cat.games);

const Lobby: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { roomData, userNickname, isHost, isLoading, setRoomId, setUserNickname } = useGame();
  const { vibrateLight, vibrateMedium, vibrateHeavy, vibrateSuccess } = useHaptics();
  
  const [selectedGame, setSelectedGame] = useState('drinking');
  const [copied, setCopied] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [startingPopup, setStartingPopup] = useState(false);

  const leavingRef = useRef(false);
  const startingRef = useRef(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Handle navigation and status sync
  useEffect(() => {
    if (leavingRef.current) return;
    
    if (!roomData && !isLoading && roomId) {
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
      
      if (roomData.status === 'playing' || roomData.status === 'finished') {
        if (!isHost && !startingPopup) {
          const timer = setTimeout(() => {
            setStartingPopup(true);
            vibrateSuccess();
          }, 0);
          const navTimer = setTimeout(() => {
            navigate(`/game/${roomId}`);
          }, 1500);
          return () => {
            clearTimeout(timer);
            clearTimeout(navTimer);
          };
        } else if (isHost) {
          navigate(`/game/${roomId}`);
        }
      }
    }
  }, [roomData, isLoading, roomId, navigate, userNickname, isHost, startingPopup, vibrateSuccess]);

  const handleStartGame = async () => {
    if (!isHost || startingRef.current) return;
    startingRef.current = true;
    vibrateSuccess();
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
    vibrateMedium();
    try {
      if (isHost) await remove(ref(db, `rooms/${roomId}`));
      else if (userNickname) await remove(ref(db, `rooms/${roomId}/players/${userNickname}`));
      navigate('/');
    } catch {
      leavingRef.current = false;
      setLeaveError('ออกจากห้องไม่สำเร็จ ลองอีกครั้ง');
      vibrateHeavy();
      setTimeout(() => setLeaveError(''), 3000);
    }
  };

  const handleKickPlayer = async (name: string) => { 
    if (isHost && roomId) {
      vibrateHeavy();
      await remove(ref(db, `rooms/${roomId}/players/${name}`)); 
    }
  };

  const copyRoomCode = () => {
    if (!roomId) return;
    vibrateLight();
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
      <div className="w-8 h-8 border-[3px] border-neon-blue/30 border-t-neon-blue rounded-full animate-spin"></div>
      <p className="text-neon-blue text-[13px] font-bold tracking-widest uppercase animate-pulse">Connecting...</p>
    </div>
  );

  const playersList = Object.entries(roomData.players || {}).map(([key, val]: [string, any]) => ({
    key,
    ...val,
    name: val.name || key
  }));

  const tutorialSteps: TutorialStep[] = [
    { title: 'เตรียมตัว', description: 'ให้ทุกคนชาร์จแบตให้พร้อม และเปิดเสียงมือถือไว้', icon: '🔋' },
    { title: 'เริ่มเกม', description: 'Host จะเป็นคนกดเริ่มเกม และระบบจะสุ่มบทบาทให้ทุกคน', icon: '🎲' },
    { title: 'ลุยเลย!', description: 'ทำตามคำสั่งบนหน้าจอของตัวเอง ห้ามให้เพื่อนเห็นนะ!', icon: '🤫' }
  ];

  return (
    <div className="animate-fade-in flex flex-col flex-1 relative z-10 p-2">
      <EpicPopup 
        isOpen={showHostPromotedToast}
        title="Host Promoted"
        subtitle="คุณได้รับตำแหน่ง Host ดูแลห้องนี้แล้ว!"
        icon="👑"
        type="warning"
        autoCloseMs={3000}
      />
      <EpicPopup 
        isOpen={startingPopup}
        title="Game Start"
        subtitle="กำลังเข้าสู่เกม..."
        icon="🚀"
        type="success"
      />
      <SmartTutorialOverlay
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        gameName={allGames.find(g => g.id === selectedGame)?.name || ''}
        steps={tutorialSteps}
      />

      {leaveError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 border border-red-500 text-white px-4 py-2 rounded-2xl font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)]">
          {leaveError}
        </div>
      )}
      
      <div className="flex-between py-2 mb-2">
        <button className="btn py-2 px-3.5 min-h-[44px] text-[13px] bg-slate-800 border-slate-700 text-slate-300 hover:text-white" onClick={handleLeaveRoom}>
          <ArrowLeft size={16} />
          {isHost ? 'ปิดห้อง' : 'ออก'}
        </button>

        <button
          onClick={copyRoomCode}
          className="flex items-center gap-3 glass-panel px-4 py-2 active:scale-95 transition-transform border-neon-pink/50 shadow-[0_0_10px_rgba(255,20,147,0.2)]"
        >
          <span className="text-[10px] text-neon-pink font-bold uppercase tracking-widest">CODE</span>
          <span className="text-[20px] font-black text-white tracking-[0.2em] font-display">{roomId}</span>
          {copied ? <Check size={16} className="text-neon-green" /> : <Copy size={14} className="text-slate-400" />}
        </button>
      </div>

      <div className="flex-center gap-3 mb-4 flex-wrap">
        <div className="inline-flex items-center gap-2 bg-slate-800 border border-neon-blue/50 rounded-full px-4 py-2 shadow-neon-blue">
          <span className="w-2.5 h-2.5 bg-neon-blue rounded-full animate-pulse shadow-[0_0_8px_#00f0ff]"></span>
          <span className="text-[12px] font-black text-white uppercase tracking-wider">Players: {playersList.length}</span>
        </div>
        <Scoreboard roomId={roomId || ''} isHost={isHost} />
        <PersonalStats />
        <ConnectionIndicator />
      </div>

      {/* Players Grid (Dark Neon Style) */}
      <section className="glass-panel p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-neon-pink" />
            <span className="font-bold text-[14px] text-white uppercase tracking-wider">Lobby</span>
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase">Live Sync</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          <AnimatePresence>
            {playersList.map((p, index) => (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300, delay: index * 0.05 }}
                className={`relative flex flex-col items-center gap-2 p-2 rounded-2xl transition-all duration-200 ${
                  p.online === false ? 'opacity-40 grayscale' : ''
                } ${
                  p.isHost ? 'bg-slate-800/80 border border-neon-pink shadow-neon-pink' : 'bg-slate-900/50 border border-slate-700/50'
                }`}
              >
                <div 
                  className="w-14 h-14 rounded-2xl flex-center shadow-md border-2 border-white/20 overflow-hidden"
                  style={{ background: p.avatarColor || getRandomGradient() }}
                >
                  <img src={getAvatarUrl(p.avatar)} alt={p.name} className="w-[120%] h-[120%] object-cover mt-[20%]" style={{ imageRendering: 'pixelated' }} />
                </div>
                
                <div className="text-center w-full px-1">
                  <p className="font-bold text-[12px] text-white truncate w-full">{p.name}</p>
                </div>

                {p.isHost && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-900 border border-neon-pink rounded-full flex-center text-[10px] shadow-neon-pink z-10">
                    👑
                  </div>
                )}
                {p.key === userNickname && (
                  <div className="absolute -bottom-2 bg-neon-blue text-slate-900 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider z-10">
                    YOU
                  </div>
                )}

                {isHost && !p.isHost && (
                  <button 
                    onClick={() => handleKickPlayer(p.key)} 
                    className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-slate-900 border border-red-500 flex-center text-red-500 active:bg-red-900 z-10"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {isHost ? (
        <section className="flex flex-col gap-4 flex-1">
          <div className="glass-panel p-5 space-y-5 flex-1 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-blue/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex-between">
              <h3 className="font-display font-black text-[15px] text-white uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-neon-blue animate-pulse"></span> Select Game
              </h3>
              <button 
                onClick={() => { vibrateLight(); setShowTutorial(true); }}
                className="text-[11px] font-bold text-neon-pink border border-neon-pink/50 rounded-full px-3 py-1 hover:bg-neon-pink/10 transition-colors uppercase tracking-wider"
              >
                วิธีเล่น
              </button>
            </div>

            {gameCategories.map((category) => (
              <div key={category.label}>
                <h4 className="mb-2.5 font-bold text-[11px] text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1">
                  {category.label}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {category.games.map((game) => (
                    <button
                      key={game.id}
                      className={`rounded-2xl p-3 flex flex-col items-center gap-2 border-2 transition-all active:scale-95 relative overflow-hidden ${
                        selectedGame === game.id 
                          ? 'bg-slate-800 border-neon-blue shadow-neon-blue' 
                          : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600'
                      }`}
                      onClick={() => { vibrateLight(); setSelectedGame(game.id); }}
                    >
                      {selectedGame === game.id && (
                        <div className="absolute inset-0 bg-gradient-to-b from-neon-blue/10 to-transparent pointer-events-none"></div>
                      )}
                      <span className="text-3xl relative z-10 drop-shadow-md">{game.icon}</span>
                      <span className="font-bold text-[13px] text-white relative z-10">{game.name}</span>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md relative z-10">MIN {game.minPlayers}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 pt-2 pb-6">
            <button
              className="py-3 px-4 rounded-2xl bg-purple-900/20 border border-purple-500/30 hover:bg-purple-900/40 text-purple-300 font-bold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg"
              onClick={() => { vibrateLight(); navigate('/werewolf-moderator'); }}
            >
              <ShieldAlert size={16} />
              สวมบทบาท GM ออฟไลน์ (Werewolf Moderator)
            </button>

            {(() => {
              const selectedGameObj = allGames.find(g => g.id === selectedGame);
              const minP = selectedGameObj?.minPlayers ?? 2;
              const notEnough = playersList.length < minP;
              return (
                <>
                  <button
                    className="btn btn-primary w-full py-4 text-[17px] shadow-neon-blue relative overflow-hidden group"
                    onClick={handleStartGame}
                    disabled={notEnough}
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <Play size={20} fill="currentColor" />
                      START MISSION
                    </span>
                  </button>
                  {notEnough && (
                    <motion.p 
                      initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                      className="text-center text-[12px] font-bold text-red-400 bg-red-900/30 border border-red-500/30 p-2.5 rounded-xl"
                    >
                      ต้องการผู้เล่นอย่างน้อย {minP} คน
                    </motion.p>
                  )}
                </>
              );
            })()}
          </div>
        </section>
      ) : (
        <section className="glass-panel flex-center flex-col gap-6 p-8 flex-1 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-neon-blue/5 to-transparent"></div>
          
          <motion.div 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-24 h-24 rounded-full bg-slate-800 border-2 border-neon-blue flex-center shadow-neon-blue text-5xl relative z-10"
          >
            🎮
          </motion.div>
          <div className="text-center relative z-10">
            <h2 className="font-display font-black text-2xl text-white uppercase tracking-widest mb-2">Standby</h2>
            <p className="text-neon-blue text-[13px] font-bold uppercase tracking-widest">Waiting for Host...</p>
          </div>
          <div className="flex gap-2 mt-2 relative z-10">
            <span className="w-2 h-2 bg-neon-blue rounded-full animate-pulse shadow-[0_0_8px_#00f0ff]"></span>
            <span className="w-2 h-2 bg-neon-pink rounded-full animate-pulse shadow-[0_0_8px_#ff1493]" style={{animationDelay:'0.3s'}}></span>
            <span className="w-2 h-2 bg-neon-green rounded-full animate-pulse shadow-[0_0_8px_#39ff14]" style={{animationDelay:'0.6s'}}></span>
          </div>
        </section>
      )}
    </div>
  );
};

export default Lobby;
