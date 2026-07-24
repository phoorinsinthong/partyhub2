import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import { ref, update, remove } from 'firebase/database';
import { db } from '../../firebase';
import { motion } from 'framer-motion';
import { usePresence, usePlayerCleanup, useHostPromotedToast } from '../../hooks/usePresence';
import Scoreboard from '../../components/features/Scoreboard';
import PersonalStats from '../../components/features/PersonalStats';
import ConnectionIndicator from '../../components/core/ConnectionIndicator';
import { saveSession, clearSession } from '../../components/core/ReconnectBanner';
import EpicPopup from '../../components/ui/EpicPopup';
import SmartTutorialOverlay, { TutorialStep } from '../../components/features/SmartTutorialOverlay';
import { useGame } from '../../contexts/GameContext';
import { useHaptics } from '../../hooks/useHaptics';

import PlayerList from './PlayerList';
import GameSelector, { allGames } from './GameSelector';

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
        if (!isHost) {
          if (!startingPopup) {
            setTimeout(() => setStartingPopup(true), 0);
            vibrateSuccess();
            setTimeout(() => {
              navigate(`/game/${roomId}`);
            }, 1500);
          }
        } else {
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
    } catch (error: any) {
      console.error("Start Game Error:", error);
      setLeaveError(`Start failed: ${error.message}`);
      setTimeout(() => setLeaveError(''), 5000);
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

      <PlayerList 
        playersList={playersList} 
        userNickname={userNickname} 
        isHost={isHost} 
        handleKickPlayer={handleKickPlayer} 
      />

      {isHost ? (
        <GameSelector
          selectedGame={selectedGame}
          setSelectedGame={setSelectedGame}
          setShowTutorial={setShowTutorial}
          handleStartGame={handleStartGame}
          playersCount={playersList.length}
          vibrateLight={vibrateLight}
        />
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
