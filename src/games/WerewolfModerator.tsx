// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Moon, Sun, Volume2, VolumeX, Users, Check, 
  RotateCcw, Skull, Play, ChevronRight, ChevronLeft, 
  UserCheck, Shuffle, Home, Info
} from 'lucide-react';
import { ROLES, VOICE_SCRIPTS } from './werewolf/werewolfData';

interface PlayerSetup {
  id: string;
  name: string;
  role: string;
  isAlive: boolean;
  isLovers: boolean;
  isSilenced: boolean;
  isProtected: boolean;
  notes: string;
}

const STORAGE_KEY = 'werewolf_moderator_session';
const NIGHT_ORDER = ['cupid', 'werewolf', 'seer', 'bodyguard', 'witch', 'hunter'];

const getSavedSession = () => {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (parsed && Array.isArray(parsed.players) && parsed.players.length > 0) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
};

export const WerewolfModerator: React.FC = () => {
  const savedSession = getSavedSession();
  const navigate = useNavigate();

  const handleExit = () => {
    const sessionStr = localStorage.getItem('partyhub_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        if (session?.roomId) {
          navigate(`/lobby/${session.roomId}`);
          return;
        }
      } catch { /* ignore */ }
    }
    navigate('/');
  };
  
  // Game Setup State
  const [phase, setPhase] = useState<'setup' | 'game' | 'finished'>(() => savedSession?.phase || 'setup');
  const [playerCount, setPlayerCount] = useState<number>(() => savedSession?.players?.length || 7);
  const [selectedDeck, setSelectedDeck] = useState<string[]>(() => savedSession?.selectedDeck || [
    'werewolf', 'werewolf', 'seer', 'bodyguard', 'witch', 'villager', 'villager'
  ]);
  const [players, setPlayers] = useState<PlayerSetup[]>(() => {
    if (savedSession?.players) return savedSession.players;
    const defaultDeck = ['werewolf', 'werewolf', 'seer', 'bodyguard', 'witch', 'villager', 'villager'];
    return defaultDeck.map((role, i) => ({
      id: `p_${i + 1}`,
      name: `ผู้เล่น ${i + 1}`,
      role,
      isAlive: true,
      isLovers: false,
      isSilenced: false,
      isProtected: false,
      notes: ''
    }));
  });
  const [assignMode, setAssignMode] = useState<'random' | 'manual'>('random');
  const [enableTTS, setEnableTTS] = useState<boolean>(true);

  // Gameplay State
  const [gamePhase, setGamePhase] = useState<'night' | 'day'>(() => savedSession?.gamePhase || 'night');
  const [dayNumber, setDayNumber] = useState<number>(() => savedSession?.dayNumber || 1);
  const [nightStepIndex, setNightStepIndex] = useState<number>(() => savedSession?.nightStepIndex || 0);
  const [nightLogs, setNightLogs] = useState<string[]>(() => savedSession?.nightLogs || []);
  const [nightActions, setNightActions] = useState<Record<string, string>>(() => savedSession?.nightActions || {});
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  // Day Voting Modal State
  const [showVoteModal, setShowVoteModal] = useState<boolean>(false);
  const [voteTarget, setVoteTarget] = useState<string>('');

  const activeNightRoles = NIGHT_ORDER.filter(role => 
    players.some(p => p.role === role && p.isAlive)
  );

  const currentNightRole = activeNightRoles[nightStepIndex] || null;

  const speakScript = (text: string) => {
    if (!enableTTS || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch {
      /* ignore */
    }
  };

  // Auto-Save State
  useEffect(() => {
    if (players.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        phase,
        players,
        selectedDeck,
        gamePhase,
        dayNumber,
        nightStepIndex,
        nightLogs,
        nightActions
      }));
    }
  }, [phase, players, selectedDeck, gamePhase, dayNumber, nightStepIndex, nightLogs, nightActions]);

  // Handler for playerCount slider change
  const handlePlayerCountChange = (count: number) => {
    setPlayerCount(count);
    setPlayers(prev => {
      const newPlayers: PlayerSetup[] = [];
      for (let i = 0; i < count; i++) {
        const name = prev[i]?.name || `ผู้เล่น ${i + 1}`;
        const role = selectedDeck[i] || 'villager';
        newPlayers.push({
          id: `p_${i + 1}`,
          name,
          role,
          isAlive: prev[i]?.isAlive ?? true,
          isLovers: prev[i]?.isLovers ?? false,
          isSilenced: prev[i]?.isSilenced ?? false,
          isProtected: prev[i]?.isProtected ?? false,
          notes: prev[i]?.notes || ''
        });
      }
      return newPlayers;
    });
  };

  // Setup: Toggle role in active deck
  const toggleRoleInDeck = (roleKey: string) => {
    const newDeck = [...selectedDeck];
    const index = newDeck.indexOf(roleKey);
    if (index > -1) {
      newDeck.splice(index, 1);
    } else {
      newDeck.push(roleKey);
    }
    setSelectedDeck(newDeck);
    handlePlayerCountChange(newDeck.length || 7);
  };

  // Start Game
  const handleStartGame = () => {
    let finalPlayers = [...players];
    if (assignMode === 'random') {
      const shuffledRoles = [...selectedDeck].sort(() => Math.random() - 0.5);
      finalPlayers = finalPlayers.map((p, idx) => ({
        ...p,
        role: shuffledRoles[idx] || 'villager'
      }));
    }
    setPlayers(finalPlayers);
    setPhase('game');
    setGamePhase('night');
    setDayNumber(1);
    setNightStepIndex(0);
    setNightLogs([`--- เริ่มต้น คืนที่ 1 ---`]);
    setNightActions({});

    if (activeNightRoles.length > 0) {
      const firstRole = activeNightRoles[0];
      const script = VOICE_SCRIPTS[firstRole] || `${ROLES[firstRole]?.name || firstRole} ลืมตาขึ้นมาทำหน้าที่ของคุณ`;
      speakScript(script);
    }
  };

  // Reset Game
  const handleResetGame = () => {
    if (confirm('คุณต้องการรีเซ็ตเกม และกลับไปตั้งค่าใหม่ใช่หรือไม่?')) {
      localStorage.removeItem(STORAGE_KEY);
      setPhase('setup');
    }
  };

  // Toggle player status
  const updatePlayerStatus = <K extends keyof PlayerSetup>(id: string, field: K, value: PlayerSetup[K]) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  // Next Night Step
  const handleNextNightStep = () => {
    if (selectedTarget && currentNightRole) {
      const targetPlayer = players.find(p => p.id === selectedTarget);
      const actionMsg = `${ROLES[currentNightRole]?.name || currentNightRole} เลือกเป้าหมาย: ${targetPlayer?.name || selectedTarget}`;
      setNightLogs(prev => [...prev, actionMsg]);
      setNightActions(prev => ({ ...prev, [currentNightRole]: selectedTarget }));
    }

    setSelectedTarget(null);

    if (nightStepIndex < activeNightRoles.length - 1) {
      const nextIdx = nightStepIndex + 1;
      setNightStepIndex(nextIdx);
      const nextRole = activeNightRoles[nextIdx];
      const script = VOICE_SCRIPTS[nextRole] || `${ROLES[nextRole]?.name || nextRole} ลืมตาขึ้นมาทำหน้าที่ของคุณ`;
      speakScript(script);
    } else {
      // Transition to Day
      setGamePhase('day');
      setNightLogs(prev => [...prev, `--- อรุณสวัสดิ์ เช้าวันที่ ${dayNumber} ---`]);
      speakScript(`ทุกคนลืมตาขึ้นมา อรุณสวัสดิ์ เช้าวันที่ ${dayNumber}`);
    }
  };

  // Previous Night Step
  const handlePrevNightStep = () => {
    if (nightStepIndex > 0) {
      const prevIdx = nightStepIndex - 1;
      setNightStepIndex(prevIdx);
      const prevRole = activeNightRoles[prevIdx];
      const script = VOICE_SCRIPTS[prevRole] || `${ROLES[prevRole]?.name || prevRole} ลืมตาขึ้นมาทำหน้าที่ของคุณ`;
      speakScript(script);
    }
  };

  // Next Day Phase -> Night
  const handleStartNextNight = () => {
    setGamePhase('night');
    setDayNumber(prev => prev + 1);
    setNightStepIndex(0);
    setNightLogs(prev => [...prev, `--- เริ่มต้น คืนที่ ${dayNumber + 1} ---`]);
    setNightActions({});
    
    // Clear temp night statuses (protected, silenced)
    setPlayers(prev => prev.map(p => ({ ...p, isProtected: false, isSilenced: false })));

    if (activeNightRoles.length > 0) {
      const firstRole = activeNightRoles[0];
      const script = VOICE_SCRIPTS[firstRole] || `${ROLES[firstRole]?.name || firstRole} ลืมตาขึ้นมาทำหน้าที่ของคุณ`;
      speakScript(script);
    }
  };

  // Execute Day Vote Execution
  const handleExecuteDayVote = () => {
    if (!voteTarget) return;
    const targetPlayer = players.find(p => p.id === voteTarget);
    if (targetPlayer) {
      updatePlayerStatus(targetPlayer.id, 'isAlive', false);
      setNightLogs(prev => [...prev, `☀️ ผลการโหวตประจำวันที่ ${dayNumber}: ${targetPlayer.name} ถูกประหารชีวิต`]);
    }
    setShowVoteModal(false);
    setVoteTarget('');
  };

  const aliveCount = players.filter(p => p.isAlive).length;
  const werewolfCount = players.filter(p => p.isAlive && ROLES[p.role]?.team === 'werewolf').length;
  const villagerCount = aliveCount - werewolfCount;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-3 sm:p-6 font-sans">
      {/* Header Bar */}
      <div className="max-w-4xl mx-auto flex items-center justify-between bg-slate-800/90 border border-slate-700 rounded-2xl p-4 mb-6 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400">
            🎭
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Werewolf Moderator
              <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                การ์ดจริง (GM)
              </span>
            </h1>
            <p className="text-xs text-slate-400">แดชบอร์ดผู้บรรยายสำหรับควบคุมเกม</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setEnableTTS(!enableTTS)}
            className={`p-2.5 rounded-xl border transition-all ${
              enableTTS 
                ? 'bg-purple-600/20 border-purple-500 text-purple-300' 
                : 'bg-slate-700/50 border-slate-600 text-slate-400'
            }`}
            title="เปิด/ปิด เสียงบรรยายอัตโนมัติ"
          >
            {enableTTS ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          
          <button
            onClick={handleExit}
            className="p-2.5 rounded-xl bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-slate-700 transition-all"
            title="กลับหน้าหลักหรือหน้าล็อบบี้"
          >
            <Home size={18} />
          </button>
        </div>
      </div>

      {/* ─── SETUP PHASE ─── */}
      {phase === 'setup' && (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Card 1: Player Count & Deck Config */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg">
            <h2 className="text-base font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Users size={18} className="text-purple-400" />
              1. กำหนดจำนวนผู้เล่นและบทบาท ({selectedDeck.length} คน)
            </h2>

            <div className="mb-5">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-300 font-medium">จำนวนผู้เล่นทั้งหมด</span>
                <span className="text-purple-400 font-bold text-lg">{playerCount} คน</span>
              </div>
              <input
                type="range"
                min="4"
                max="25"
                value={playerCount}
                onChange={(e) => handlePlayerCountChange(Number(e.target.value))}
                className="w-full accent-purple-500 bg-slate-700 h-2 rounded-lg cursor-pointer"
              />
            </div>

            {/* Role Selection Grid */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">เลือกบทบาทลงสำรับ</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {Object.entries(ROLES).filter(([key]) => key !== 'gm').map(([key, role]) => {
                  const countInDeck = selectedDeck.filter(r => r === key).length;
                  return (
                    <button
                      key={key}
                      onClick={() => toggleRoleInDeck(key)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        countInDeck > 0
                          ? 'bg-slate-700 border-purple-500/60 text-slate-100 shadow-md'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">{role.icon}</span>
                        <span className="text-xs font-semibold truncate">{role.name}</span>
                      </div>
                      {countInDeck > 0 && (
                        <span className="text-xs font-bold bg-purple-500 text-white w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                          {countInDeck}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Player Names & Role Assignment Mode */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                <UserCheck size={18} className="text-purple-400" />
                2. รายชื่อผู้เล่นและการแจกบทบาท
              </h2>

              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs">
                <button
                  onClick={() => setAssignMode('random')}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                    assignMode === 'random' ? 'bg-purple-600 text-white' : 'text-slate-400'
                  }`}
                >
                  <Shuffle size={13} /> สุ่มแจกการ์ด
                </button>
                <button
                  onClick={() => setAssignMode('manual')}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                    assignMode === 'manual' ? 'bg-purple-600 text-white' : 'text-slate-400'
                  }`}
                >
                  <UserCheck size={13} /> ระบุเอง
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {players.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/80">
                  <span className="text-xs font-bold text-purple-400 w-6 text-center">{idx + 1}.</span>
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPlayers(prev => prev.map(item => item.id === p.id ? { ...item, name: val } : item));
                    }}
                    placeholder={`ผู้เล่น ${idx + 1}`}
                    className="flex-1 bg-slate-800 border border-slate-700 text-xs text-slate-100 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500"
                  />

                  {assignMode === 'manual' ? (
                    <select
                      value={p.role}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlayers(prev => prev.map(item => item.id === p.id ? { ...item, role: val } : item));
                      }}
                      className="bg-slate-800 border border-slate-700 text-xs text-purple-300 font-semibold rounded-lg px-2 py-1.5 focus:outline-none"
                    >
                      {selectedDeck.map((roleKey, rIdx) => (
                        <option key={rIdx} value={roleKey}>
                          {ROLES[roleKey]?.icon} {ROLES[roleKey]?.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                      สุ่มบทบาท
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartGame}
            className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 font-bold text-slate-100 text-base shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <Play size={20} />
            เริ่มดำเนินเกม (Start Moderator Session)
          </button>
        </div>
      )}

      {/* ─── GAMEPLAY DASHBOARD PHASE ─── */}
      {phase === 'game' && (
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Phase Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-xl transition-all ${
            gamePhase === 'night' 
              ? 'bg-indigo-950/80 border-indigo-700/80 text-indigo-200' 
              : 'bg-amber-950/80 border-amber-700/80 text-amber-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${
                gamePhase === 'night' ? 'bg-indigo-900/80 text-indigo-300' : 'bg-amber-900/80 text-amber-300'
              }`}>
                {gamePhase === 'night' ? <Moon size={24} /> : <Sun size={24} />}
              </div>
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  {gamePhase === 'night' ? `เฟสกลางคืน (คืนที่ ${dayNumber})` : `เฟสกลางวัน (วันที่ ${dayNumber})`}
                </h2>
                <p className="text-xs opacity-80">
                  มีชีวิตอยู่: {aliveCount} คน | หมาป่า: {werewolfCount} คน | ชาวบ้าน/อื่นๆ: {villagerCount} คน
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {gamePhase === 'night' ? (
                <button
                  onClick={() => {
                    setGamePhase('day');
                    setNightLogs(prev => [...prev, `--- อรุณสวัสดิ์ เช้าวันที่ ${dayNumber} ---`]);
                  }}
                  className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md"
                >
                  <Sun size={14} /> ข้ามไปตอนเช้า
                </button>
              ) : (
                <button
                  onClick={handleStartNextNight}
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md"
                >
                  <Moon size={14} /> เข้าสู่คืนถัดไป
                </button>
              )}

              <button
                onClick={handleResetGame}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
                title="รีเซ็ตเกม"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* Night Script Wizard (Night Phase) */}
          {gamePhase === 'night' && currentNightRole && (
            <div className="bg-indigo-900/40 border border-indigo-700/60 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  สคริปต์เรียกตอนกลางคืน (ลำดับที่ {nightStepIndex + 1}/{activeNightRoles.length})
                </span>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={handlePrevNightStep}
                    disabled={nightStepIndex === 0}
                    className="px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-700 text-indigo-300 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={handleNextNightStep}
                    className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1"
                  >
                    ถัดไป <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Role Script Prompt Box */}
              <div className="bg-indigo-950/90 border border-indigo-700 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{ROLES[currentNightRole]?.icon}</span>
                    <h3 className="text-base font-bold text-indigo-100">{ROLES[currentNightRole]?.name}</h3>
                  </div>
                  <button
                    onClick={() => speakScript(VOICE_SCRIPTS[currentNightRole] || `${ROLES[currentNightRole]?.name} ลืมตาขึ้นมา`)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-800/60 hover:bg-indigo-800 text-indigo-200 text-xs flex items-center gap-1 border border-indigo-600"
                  >
                    <Volume2 size={13} /> อ่านเสียง
                  </button>
                </div>
                <p className="text-sm font-semibold text-indigo-200 italic">
                  "{VOICE_SCRIPTS[currentNightRole] || `${ROLES[currentNightRole]?.name} ลืมตาขึ้นมาทำหน้าที่ของคุณ`}"
                </p>
                <p className="text-xs text-indigo-400 mt-1">{ROLES[currentNightRole]?.description}</p>
              </div>

              {/* Action Target Selector */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-indigo-300">ระบุผู้เล่นที่เป็นเป้าหมายของบทบาทนี้:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {players.filter(p => p.isAlive).map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedTarget(p.id === selectedTarget ? null : p.id)}
                      className={`p-2.5 rounded-xl border text-xs text-left flex items-center justify-between transition-all ${
                        selectedTarget === p.id
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-md font-bold'
                          : 'bg-indigo-950/50 border-indigo-800/80 text-indigo-200 hover:border-indigo-600'
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      {selectedTarget === p.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Player Matrix Grid */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                <Users size={18} className="text-purple-400" />
                สถานะผู้เล่นทั้งหมด ({players.length} คน)
              </h3>

              {gamePhase === 'day' && (
                <button
                  onClick={() => setShowVoteModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 shadow-md"
                >
                  <Skull size={14} /> คำนวณโหวตประหาร
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {players.map(p => (
                <div
                  key={p.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    !p.isAlive 
                      ? 'bg-slate-900/80 border-slate-800 opacity-60' 
                      : 'bg-slate-900 border-slate-700/80'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100">{p.name}</span>
                        {!p.isAlive && (
                          <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold">
                            เสียชีวิต
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-purple-400 font-semibold mt-0.5 flex items-center gap-1">
                        <span>{ROLES[p.role]?.icon}</span>
                        <span>{ROLES[p.role]?.name}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => updatePlayerStatus(p.id, 'isAlive', !p.isAlive)}
                      className={`p-1.5 rounded-lg text-xs font-bold border transition-all ${
                        p.isAlive 
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30' 
                          : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {p.isAlive ? 'มีชีวิต' : 'ฟื้นคืน'}
                    </button>
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-800">
                    <button
                      onClick={() => updatePlayerStatus(p.id, 'isLovers', !p.isLovers)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                        p.isLovers ? 'bg-pink-500/20 border-pink-500/40 text-pink-300' : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}
                    >
                      💘 คู่รัก
                    </button>
                    <button
                      onClick={() => updatePlayerStatus(p.id, 'isProtected', !p.isProtected)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                        p.isProtected ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}
                    >
                      🛡️ ป้องกัน
                    </button>
                    <button
                      onClick={() => updatePlayerStatus(p.id, 'isSilenced', !p.isSilenced)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                        p.isSilenced ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-500'
                      }`}
                    >
                      🤐 ปิดปาก
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Night Log Timeline */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg">
            <h3 className="text-base font-bold text-slate-200 mb-3 flex items-center gap-2">
              <Info size={18} className="text-purple-400" />
              บันทึกเหตุการณ์ (Night Logs & Events)
            </h3>

            <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3.5 max-h-48 overflow-y-auto text-xs font-mono text-slate-300 space-y-1">
              {nightLogs.length === 0 ? (
                <p className="text-slate-500 italic">ยังไม่มีข้อมูลบันทึก...</p>
              ) : (
                nightLogs.map((log, idx) => (
                  <p key={idx} className={log.startsWith('---') ? 'text-purple-400 font-bold py-1' : 'text-slate-300'}>
                    {log}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── VOTE EXECUTION MODAL ─── */}
      <AnimatePresence>
        {showVoteModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                  <Skull size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">ผลการโหวตประหารประจำวัน</h3>
                  <p className="text-xs text-slate-400">เลือกผู้เล่นที่ได้รับเสียงโหวตมากที่สุดเพื่อประหาร</p>
                </div>
              </div>

              <div className="space-y-2">
                {players.filter(p => p.isAlive).map(p => (
                  <button
                    key={p.id}
                    onClick={() => setVoteTarget(p.id)}
                    className={`w-full p-3 rounded-xl border text-xs text-left flex items-center justify-between transition-all ${
                      voteTarget === p.id
                        ? 'bg-red-600 border-red-500 text-white font-bold'
                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <span>{p.name}</span>
                    {voteTarget === p.id && <Check size={14} />}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowVoteModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleExecuteDayVote}
                  disabled={!voteTarget}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  ยืนยันประหารชีวิต
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WerewolfModerator;
