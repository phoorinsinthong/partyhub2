import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, onValue, get } from 'firebase/database';
import { db } from '../firebase';
import { Moon, Sun, Eye, Shield, Skull, Users, Play, RefreshCw, CheckCircle2, XCircle, AlertCircle, Info, ChevronRight, Timer, Volume2, VolumeX, LogOut } from 'lucide-react';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGameTimer } from '../hooks/useGameTimer';
import { useGame } from '../contexts/GameContext';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import NeonCard from '../components/NeonCard';
import GiantButton from '../components/GiantButton';
import { useTranslation } from 'react-i18next';
import { TimerDisplay } from '../components/game-ui/TimerDisplay';
import { 
  checkWinCondition, 
  handleDeathSideEffects, 
  resolveNightActions, 
  WOLF_ROLES 
} from './logic/werewolfLogic';
import { VOICE_SCRIPTS, ROLES, ROLE_CATEGORIES } from './logic/werewolfData';
import './Werewolf.css';

// ─── Main Component ──────────────────────────────────────────────────────────

const Werewolf: React.FC = () => {
  const { t } = useTranslation();
  const { roomId, roomData, userNickname, isHost } = useGame();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname || '');
  
  const gameData = roomData?.gameData || {};
  const players = roomData?.players || {};
  const playerNames = Object.keys(players);

  const wwData = gameData.wwData || {};
  const phase = wwData.phase || 'waiting';
  // If currentGame is werewolf_physical, force physical mode. Otherwise use digital.
  const gameMode = roomData?.currentGame === 'werewolf_physical' ? 'physical' : 'digital';
  const dayCount = wwData.dayCount || 0;

  const [vfx, setVfx] = useState({ show: false, type: '', text: '' });
  
  // Trigger VFX when lastElimination changes
  useEffect(() => {
    if (wwData.lastElimination?.playerName) {
      const elim = wwData.lastElimination;
      let type = 'vfx-overlay-active-vote';
      if (elim.reason === 'werewolf') type = 'vfx-overlay-active-werewolf';
      
      setTimeout(() => setVfx({ show: true, type, text: `${elim.playerName} ตาย!` }), 0);
      const timer = setTimeout(() => setVfx({ show: false, type: '', text: '' }), 4000);
      return () => clearTimeout(timer);
    }
  }, [wwData.lastElimination]);

  const myPlayerData = wwData.players?.[userNickname || ''];
  const myRole = myPlayerData?.role || '';
  const myIsAlive = myPlayerData?.isAlive !== false;
  const isGM = isHost;
  const roleInfo = ROLES[myRole];
  
  const { timeLeft } = useGameTimer(wwData.timerEnd);

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [showRoleReveal, setShowRoleReveal] = useState(false);
  const personalRecordedRef = useRef(false);
  const castVoteRef = useRef(false);
  const resolvingRef = useRef(false);
  const startVotingRef = useRef(false);
  const startNextNightRef = useRef(false);
  const playAgainRef = useRef(false);
  const [showDeckSetup, setShowDeckSetup] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [activeScriptIndex, setActiveScriptIndex] = useState(0);
  const [guestName, setGuestName] = useState('');

  const safeUpdate = React.useCallback(async (refPath: string, data: any) => {
    try {
      await update(ref(db, refPath), data);
    } catch {
      setErrorMsg(t('common.error') || 'เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  }, [t, roomId]);

  const addGuest = React.useCallback(async () => {
    if (!guestName.trim()) return;
    const guests = { ...(wwData.guests || {}) };
    guests[guestName.trim()] = { role: 'villager', isAlive: true, isGuest: true };
    await safeUpdate(`rooms/${roomId}/gameData/wwData/guests`, guests);
    setGuestName('');
  }, [guestName, wwData.guests, roomId, safeUpdate]);

  const removeGuest = React.useCallback(async (name: string) => {
    const guests = { ...(wwData.guests || {}) };
    delete guests[name];
    await safeUpdate(`rooms/${roomId}/gameData/wwData/guests`, guests);
  }, [wwData.guests, roomId, safeUpdate]);

  useEffect(() => {
    if (phase === 'waiting' || phase === 'night') personalRecordedRef.current = false;
  }, [phase]);

  // Reset vote guard when phase changes away from voting
  useEffect(() => {
    castVoteRef.current = false;
  }, [phase]);

  // Record personal stats when result phase reached
  useEffect(() => {
    if (phase !== 'result') return;
    if (personalRecordedRef.current) return;
    personalRecordedRef.current = true;
    const winner = wwData.winnerTeam;
    const wwPlayers = wwData.players || {};
    const myRoleResult = wwPlayers[userNickname || '']?.role;
    const isWolfTeam = WOLF_ROLES.includes(myRoleResult) || myRoleResult === 'minion';
    const iWon = (winner === 'werewolf' && isWolfTeam) ||
                 (winner === 'villager' && !isWolfTeam && myRoleResult !== 'gm') ||
                 (winner === 'independent');
    recordPersonalGame('werewolf');
    if (iWon) recordPersonalWin('werewolf');
    if (isHost && winner) {
      const winningPlayers = Object.entries(wwPlayers)
        .filter(([, p]: [string, any]) => p.isAlive && p.role !== 'gm')
        .filter(([, p]: [string, any]) => {
          if (winner === 'werewolf') return WOLF_ROLES.includes(p.role) || p.role === 'minion';
          if (winner === 'villager') return !WOLF_ROLES.includes(p.role) && p.role !== 'minion';
          return false;
        });
      if (winningPlayers.length > 0) {
        (async () => {
          try {
            await recordWin(roomId || '', winningPlayers[0][0], 'werewolf');
          } catch (err) {
            console.error('Failed to record win:', err);
          }
        })();
      }
    }
  }, [phase, isHost, wwData.winnerTeam, wwData.players, userNickname, roomId]);

  // Show role reveal when game starts
  useEffect(() => {
    if (phase === 'night' && dayCount === 1 && !isGM && myRole && gameMode === 'digital') {
      setTimeout(() => setShowRoleReveal(true), 0);
    }
  }, [phase, dayCount, isGM, myRole, gameMode]);


  // ─── Game Actions ────────────────────────────────────────────────────────────

  const startGame = async () => {
    if (!isHost) return;
    const connectedPlayers = playerNames.filter(n => n !== roomData.host);
    const guestNames = wwData.guests ? Object.keys(wwData.guests) : [];
    const allGamePlayers = [...connectedPlayers, ...guestNames];
    
    // Digital mode is limited to 4-10, physical mode has no limit
    if (gameMode === 'digital' && (allGamePlayers.length < 4 || allGamePlayers.length > 10)) return;
    // For physical mode, we just need at least one player to act as GM's subject
    if (gameMode === 'physical' && allGamePlayers.length < 1) return;

    const deckCounts = wwData.deckCounts || {};
    const deck = [];
    for (const [role, count] of Object.entries(deckCounts)) {
      for (let i = 0; i < count; i++) deck.push(role);
    }

    if (deck.length === 0) {
      const count = allGamePlayers.length;
      const wolfCount = count >= 7 ? 2 : 1;
      for (let i = 0; i < wolfCount; i++) deck.push('werewolf');
      if (count >= 4) deck.push('seer');
      if (count >= 5) deck.push('bodyguard');
      while (deck.length < count) deck.push('villager');
    }

    if (deck.length !== allGamePlayers.length) {
      return;
    }

    // Physical mode doesn't necessarily need to assign roles to players, 
    // but we'll do it if they want to track stats.
    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const shuffledPlayers = [...allGamePlayers];
    for (let i = shuffledPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
    }
    const wwPlayers = {};
    shuffledPlayers.forEach((name, idx) => {
      // In physical mode, we assign 'villager' by default unless the host manual entry is added later.
      // For simplicity, we assign the deck here too so stats work if they follow the app.
      wwPlayers[name] = { 
        role: deck[idx], 
        isAlive: true, 
        vote: '', 
        status: {},
        isGuest: guestNames.includes(name)
      };
    });
    wwPlayers[roomData.host] = { role: 'gm', isAlive: true, vote: '', status: {} };

    await safeUpdate(`rooms/${roomId}/gameData`, {
      wwData: {
        ...wwData,
        players: wwPlayers,
        phase: 'night',
        dayCount: 1,
        nightActions: {},
        nightTurn: null,
        lastElimination: null,
        winnerTeam: null,
        lovers: null,
        hunterPending: null,
        timerEnd: Date.now() + 120000,
      }
    });
  };

  const updatePlayerRole = async (playerName, newRole) => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}/gameData/wwData/players/${playerName}`, { role: newRole });
  };

  const updateDeckCount = async (role, change) => {
    if (!isHost) return;
    const currentCounts = { ...(wwData.deckCounts || {}) };
    const val = (currentCounts[role] || 0) + change;
    if (val < 0) return;
    if (val === 0) delete currentCounts[role];
    else currentCounts[role] = val;
    await safeUpdate(`rooms/${roomId}/gameData/wwData`, { deckCounts: currentCounts });
  };

  const submitNightAction = React.useCallback(async (role: string, targetId: string, extraData: any = null) => {
    const updates: Record<string, any> = {};
    updates[`nightActions/${role}Target`] = targetId;
    updates[`nightActions/${role}TargetDone`] = true;
    if (extraData) updates[`nightActions/${role}Extra`] = extraData;

    if (role === 'spellcaster' && targetId && targetId !== 'skip') {
      updates[`players/${targetId}/status/silenced`] = true;
    }
    if (role === 'old_hag' && targetId && targetId !== 'skip') {
      updates[`players/${targetId}/status/banned`] = true;
    }
    if (role === 'cupid' && targetId && targetId !== 'skip') {
      const cupidTargets = targetId.split(',');
      if (cupidTargets.length === 2) {
        updates['lovers'] = { player1: cupidTargets[0], player2: cupidTargets[1] };
        updates[`players/${cupidTargets[0]}/status/lover`] = cupidTargets[1];
        updates[`players/${cupidTargets[1]}/status/lover`] = cupidTargets[0];
      }
    }
    if (['seer', 'apprentice_seer', 'mystic_wolf', 'aura_seer'].includes(role) && targetId && targetId !== 'skip') {
      const targetRole = wwData.players?.[targetId]?.role;
      const isWolf = (WOLF_ROLES.includes(targetRole) && targetRole !== 'wolf_man') || targetRole === 'lycan';
      const now = Date.now();
      updates[`privateData/${userNickname}/seerResult`] = { targetName: targetId, isWolf, timestamp: now };
    }

    await safeUpdate(`rooms/${roomId}/gameData/wwData`, updates);
  }, [wwData.players, userNickname, roomId, safeUpdate]);

  // GM selects target on behalf of a role
  const gmSubmitForRole = React.useCallback(async (actionKey: string, targetId: string) => {
    const updates: Record<string, any> = {};
    updates[`nightActions/${actionKey}Target`] = targetId;
    updates[`nightActions/${actionKey}TargetDone`] = true;

    if (actionKey === 'spellcaster' && targetId && targetId !== 'skip') {
      updates[`players/${targetId}/status/silenced`] = true;
    }
    if (actionKey === 'old_hag' && targetId && targetId !== 'skip') {
      updates[`players/${targetId}/status/banned`] = true;
    }
    if (actionKey === 'cupid' && targetId && targetId !== 'skip') {
      const pts = targetId.split(',');
      if (pts.length === 2) {
        updates['lovers'] = { player1: pts[0], player2: pts[1] };
        updates[`players/${pts[0]}/status/lover`] = pts[1];
        updates[`players/${pts[1]}/status/lover`] = pts[0];
      }
    }
    
    // Support finding Seer role among real players or guests
    if (['seer', 'apprentice_seer', 'mystic_wolf', 'aura_seer'].includes(actionKey) && targetId && targetId !== 'skip') {
      const allPlayersMap = { ...(wwData.players || {}), ...(wwData.guests || {}) };
      const seerEntry = Object.entries(allPlayersMap).find(([, p]: [string, any]) => p.role === actionKey);
      
      if (seerEntry) {
        const [seerName] = seerEntry;
        const targetRole = allPlayersMap[targetId]?.role;
        const isWolf = (WOLF_ROLES.includes(targetRole) && targetRole !== 'wolf_man') || targetRole === 'lycan';
        const now = Date.now();
        updates[`privateData/${seerName}/seerResult`] = { targetName: targetId, isWolf, timestamp: now };
        // For physical mode, also store in a common GM viewable area
        updates[`lastSeerResult`] = { seerName, targetName: targetId, isWolf };
      }
    }

    await safeUpdate(`rooms/${roomId}/gameData/wwData`, updates);
  }, [wwData.players, wwData.guests, roomId, safeUpdate]);

  const clearSeerResults = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}/gameData/wwData`, { lastSeerResult: null });
  };

  const resolveNightToDay = async () => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}/gameData/wwData`, {
      phase: 'day',
      nightTurn: null,
      timerEnd: Date.now() + 180000,
    });
  };

  const startVotingPhase = async () => {
    if (!isHost || startVotingRef.current) return;
    startVotingRef.current = true;
    const updates = { phase: 'voting', timerEnd: Date.now() + 180000 };
    const wwPlayers = wwData.players || {};
    for (const name of Object.keys(wwPlayers)) {
      updates[`players/${name}/vote`] = '';
    }
    try {
      await safeUpdate(`rooms/${roomId}/gameData/wwData`, updates);
    } finally {
      startVotingRef.current = false;
    }
  };

  const castVote = async (targetName) => {
    if (!myIsAlive || myPlayerData?.status?.silenced || myPlayerData?.status?.banned) return;
    if (castVoteRef.current) return;
    castVoteRef.current = true;
    try {
      await safeUpdate(`rooms/${roomId}/gameData/wwData/players/${userNickname}`, { vote: targetName });
    } finally {
      castVoteRef.current = false;
    }
  };

  const resolveVotes = async () => {
    if (!isHost || resolvingRef.current) return;
    resolvingRef.current = true;
    const wwPlayers = wwData.players || {};
    const voteTally = {};
    Object.entries(wwPlayers).forEach(([name, p]) => {
      if (p.isAlive && p.role !== 'gm' && p.vote) {
        const weight = p.role === 'mayor' ? 2 : 1;
        voteTally[p.vote] = (voteTally[p.vote] || 0) + weight;
      }
    });

    let topName = null;
    let topVotes = 0;
    for (const [name, count] of Object.entries(voteTally)) {
      if (count > topVotes) { topVotes = count; topName = name; }
    }
    const topNames = Object.entries(voteTally).filter(([, c]) => c === topVotes).map(([n]) => n);
    if (topNames.length > 1) topName = null;

    const updates = {};
    if (topName) {
      const target = wwPlayers[topName];
      if (target?.role === 'prince' && !target?.status?.princeUsed) {
        updates[`players/${topName}/status/princeUsed`] = true;
        updates['lastElimination'] = { playerName: topName, playerRole: target.role, reason: 'prince_saved' };
      } else {
        updates[`players/${topName}/isAlive`] = false;
        updates['lastElimination'] = { playerName: topName, playerRole: target?.role, reason: 'vote' };
        if (target?.role === 'hunter') updates['hunterPending'] = topName;
        // Lover death
        if (wwData.lovers) {
          const { player1, player2 } = wwData.lovers;
          if (topName === player1 && wwPlayers[player2]?.isAlive) updates[`players/${player2}/isAlive`] = false;
          if (topName === player2 && wwPlayers[player1]?.isAlive) updates[`players/${player1}/isAlive`] = false;
        }
      }
    } else {
      updates['lastElimination'] = { playerName: null, reason: 'tie' };
    }

    updates['phase'] = 'standby';
    updates['timerEnd'] = null;
    // Clear votes
    Object.keys(wwPlayers).forEach(name => { updates[`players/${name}/vote`] = ''; });
    // Clear status effects
    Object.keys(wwPlayers).forEach(name => {
      if (wwPlayers[name]?.status?.silenced) updates[`players/${name}/status/silenced`] = null;
      if (wwPlayers[name]?.status?.banned) updates[`players/${name}/status/banned`] = null;
    });

    try {
      await safeUpdate(`rooms/${roomId}/gameData/wwData`, updates);

      // Check win condition after update
      const snap = await get(ref(db, `rooms/${roomId}/gameData/wwData/players`));
      const updatedPlayers = snap.val() || {};
      const winner = checkWinCondition(updatedPlayers);
      if (winner) {
        await safeUpdate(`rooms/${roomId}/gameData/wwData`, { phase: 'result', winnerTeam: winner });
      }
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    } finally {
      resolvingRef.current = false;
    }
  };

  const gmSkipVote = async () => {
    if (!isHost) return;
    const updates = { phase: 'standby', timerEnd: null, lastElimination: { playerName: null, reason: 'skipped' } };
    const wwPlayers = wwData.players || {};
    Object.keys(wwPlayers).forEach(name => { updates[`players/${name}/vote`] = ''; });
    await safeUpdate(`rooms/${roomId}/gameData/wwData`, updates);
  };

  const startNextNight = async () => {
    if (!isHost || startNextNightRef.current) return;
    startNextNightRef.current = true;
    try {
      const wwPlayers = wwData.players || {};
      const updates = { 
        nightActions: {},
        phase: 'night',
        dayCount: dayCount + 1,
        nightTurn: null,
        lastElimination: null,
        timerEnd: Date.now() + 120000,
      };
      
      // Clear nightly status effects
      Object.keys(wwPlayers).forEach(name => {
        if (wwPlayers[name]?.status?.silenced) updates[`players/${name}/status/silenced`] = null;
        if (wwPlayers[name]?.status?.banned) updates[`players/${name}/status/banned`] = null;
      });

      await safeUpdate(`rooms/${roomId}/gameData/wwData`, updates);
    } finally {
      startNextNightRef.current = false;
    }
  };

  const togglePlayerAlive = async (name, currentlyDead) => {
    if (!isHost) return;
    const toLive = currentlyDead;
    
    let updatedPlayers = { ...wwData.players };
    let hunterPending = wwData.hunterPending || null;

    if (!toLive) {
      const result = handleDeathSideEffects(name, { 
        players: updatedPlayers, 
        lovers: wwData.lovers, 
        hunterPending 
      });
      updatedPlayers = result.players;
      hunterPending = result.hunterPending;
    } else {
      updatedPlayers[name].isAlive = true;
    }

    const updates = { players: updatedPlayers, hunterPending };
    
    // Check win condition
    const winner = checkWinCondition(updatedPlayers);
    if (winner) {
      updates.phase = 'result';
      updates.winnerTeam = winner;
    }

    await safeUpdate(`rooms/${roomId}/gameData/wwData`, updates);
  };

  const announceWinner = async (team) => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}/gameData/wwData`, { phase: 'result', winnerTeam: team });
  };

  const resetToLobby = async () => {
    if (!isHost) return;
    personalRecordedRef.current = false;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', gameData: null });
  };

  const handlePlayAgain = async () => {
    if (!isHost || playAgainRef.current) return;
    playAgainRef.current = true;
    personalRecordedRef.current = false;
    try {
      await safeUpdate(`rooms/${roomId}/gameData`, {
        wwData: {
          ...wwData,
          players: null,
          phase: 'waiting',
          dayCount: 0,
          nightActions: {},
          nightTurn: null,
          lastElimination: null,
          winnerTeam: null,
          lovers: null,
          hunterPending: null,
          timerEnd: null,
        }
      });
    } finally {
      playAgainRef.current = false;
    }
  };


  // ─── Render: Waiting / Lobby ──────────────────────────────────────────────────

  if (phase === 'waiting' || !wwData.players) {
    const connectedPlayers = playerNames.filter(n => n !== roomData.host);
    const guestNames = wwData.guests ? Object.keys(wwData.guests) : [];
    const allGamePlayers = [...connectedPlayers, ...guestNames];
    
    const deckCounts = wwData.deckCounts || {};
    const totalDeck = Object.values(deckCounts).reduce((a, b) => a + b, 0);
    const limit = gameMode === 'digital' ? 10 : 999;

    return (
      <div className="flex flex-col gap-4 w-full animate-fade-in pb-20 relative z-10 px-2">
        <NeonCard color="amber" className="p-6 text-center">
          <div className="flex-center mb-4">
            <div className="w-20 h-20 bg-amber-500/20 rounded-full flex-center text-amber-500 border border-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
              <Skull size={40} />
            </div>
          </div>
          <h2 className="font-display font-black text-3xl uppercase tracking-widest text-amber-500 mb-2">WEREWOLF</h2>
          <p className="text-[12px] font-bold text-slate-300 leading-relaxed">
            {gameMode === 'digital' 
              ? 'หมาป่ากำลังแฝงตัวอยู่ในหมู่ชาวบ้าน! ทุกอย่างรันบนแอป 100%' 
              : 'โหมด GM Dashboard: แอปจะช่วย Host คุมเกมแบบใช้ไพ่จริง'}
          </p>
          {isHost && (
            <div className="mt-4 inline-block px-4 py-1.5 bg-amber-500/20 border border-amber-500/50 rounded-full">
              <p className="text-amber-400 font-bold text-[10px] uppercase tracking-widest">🎭 คุณเป็นผู้ดำเนินเกม (GM)</p>
            </div>
          )}
        </NeonCard>

        {isHost && gameMode === 'physical' && (
          <NeonCard color="slate" className="p-4 space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={14}/> เพิ่มผู้เล่น (Guest)</h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ชื่อผู้เล่น..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:border-neon-blue outline-none text-sm"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGuest()}
              />
              <button className="px-4 py-2 bg-neon-blue text-slate-900 font-black rounded-xl" onClick={addGuest}>เพิ่ม</button>
            </div>
            {guestNames.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {guestNames.map(name => (
                  <span key={name} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-800 border border-slate-700 flex items-center gap-1 text-slate-300">
                    {name}
                    <button onClick={() => removeGuest(name)} className="text-red-400 hover:text-red-300"><XCircle size={12}/></button>
                  </span>
                ))}
              </div>
            )}
          </NeonCard>
        )}

        <NeonCard color="slate" className="p-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Users size={14}/> รายชื่อผู้เล่น ({allGamePlayers.length} คน)</h4>
          <div className="flex flex-wrap gap-2">
            {allGamePlayers.map(name => {
              const isGuest = guestNames.includes(name);
              return (
                <span key={name} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border ${isGuest ? 'border-dashed border-slate-600 text-slate-400 bg-slate-800/50' : 'border-slate-700 text-white bg-slate-800'}`}>
                  {name} {isGuest && '(Guest)'}
                </span>
              );
            })}
          </div>
        </NeonCard>

        {isHost && (
          <NeonCard color="slate" className="p-4">
            <div className="flex-between mb-4 pb-2 border-b border-slate-700">
              <h4 className="font-black flex items-center gap-2 text-sm text-white uppercase tracking-widest">
                🎴 จัดเตรียมการ์ด
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${totalDeck === allGamePlayers.length ? 'bg-neon-green/20 text-neon-green border border-neon-green' : 'bg-red-500/20 text-red-400 border border-red-500'}`}>
                  {totalDeck}/{allGamePlayers.length}
                </span>
              </h4>
              <button className="text-[10px] font-bold text-slate-400 border border-slate-700 px-2 py-1 rounded hover:text-white" onClick={() => setShowDeckSetup(!showDeckSetup)}>
                {showDeckSetup ? 'ซ่อน' : 'แสดง'}
              </button>
            </div>

            {showDeckSetup && Object.entries(ROLE_CATEGORIES).map(([teamKey, teamInfo]) => (
              <div key={teamKey} className="mb-4">
                <p className="text-[11px] font-black uppercase tracking-widest mb-2" style={{ color: teamInfo.color }}>{teamInfo.name}</p>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(ROLES).filter(([, r]) => r.team === teamKey).map(([roleKey, role]) => {
                    const count = deckCounts[roleKey] || 0;
                    return (
                      <div key={roleKey} className="flex justify-between items-center p-3 bg-slate-800/50 border border-slate-700 rounded-xl" style={{ borderLeftWidth: '4px', borderLeftColor: role.color }}>
                        <div className="flex items-center gap-3 overflow-hidden">
                          <span className="text-xl bg-slate-900 w-8 h-8 rounded-full flex-center shadow-inner">{role.icon}</span>
                          <span className="text-[12px] font-bold truncate" style={{ color: role.color }}>{role.name}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-700">
                          <button className="w-6 h-6 rounded bg-slate-800 text-white font-bold text-sm flex-center active:scale-95" onClick={() => updateDeckCount(roleKey, -1)}>-</button>
                          <span className="w-4 text-center font-bold text-[12px] text-white">{count}</span>
                          <button className="w-6 h-6 rounded bg-slate-800 text-white font-bold text-sm flex-center active:scale-95" onClick={() => updateDeckCount(roleKey, 1)}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </NeonCard>
        )}

        {totalDeck > 0 && (
          <NeonCard color="slate" className="p-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">การ์ดที่จะใช้ในเกม</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(deckCounts).filter(([, c]) => c > 0).map(([roleKey, count]) => {
                const role = ROLES[roleKey];
                return (
                  <span key={roleKey} className="px-2 py-1 rounded-lg text-[10px] font-bold border bg-slate-900" style={{ borderColor: `${role.color}60`, color: role.color }}>
                    {role.icon} {role.name} <span className="text-white ml-1">x{count}</span>
                  </span>
                );
              })}
            </div>
          </NeonCard>
        )}

        {isHost ? (
          <GiantButton
            color="pink"
            onClick={startGame}
            disabled={
              (gameMode === 'digital' && (allGamePlayers.length < 4 || allGamePlayers.length > 10)) ||
              (gameMode === 'physical' && allGamePlayers.length < 1) ||
              (totalDeck > 0 && totalDeck !== allGamePlayers.length)
            }
          >
            {gameMode === 'digital' && allGamePlayers.length < 4
              ? `รอผู้เล่น (ขาด ${4 - allGamePlayers.length} คน)`
              : (gameMode === 'digital' && allGamePlayers.length > 10)
                ? `ผู้เล่นเกิน (สูงสุด 10)`
                : totalDeck > 0 && totalDeck !== allGamePlayers.length
                  ? `จัดไพ่ไม่พอดี (${totalDeck}/${allGamePlayers.length})`
                  : 'เริ่มเกม!'}
          </GiantButton>
        ) : (
          <div className="mt-4 p-4 rounded-2xl border border-neon-blue/30 bg-neon-blue/10 text-center shadow-[0_0_15px_rgba(0,240,255,0.2)]">
            <p className="animate-pulse text-neon-blue font-bold uppercase tracking-widest text-[12px]">Waiting for GM to start...</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Render Helpers ──────────────────────────────────────────────────────────

  const renderStarsBackground = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {[...Array(20)].map((_, i) => (
        <div 
          key={i}
          className="star-twinkle absolute rounded-full bg-white"
          style={{
            width: Math.random() * 3 + 'px',
            height: Math.random() * 3 + 'px',
            top: Math.random() * 100 + '%',
            left: Math.random() * 100 + '%',
            opacity: Math.random(),
            animationDelay: Math.random() * 5 + 's'
          }}
        />
      ))}
    </div>
  );

  const renderAmbientMist = () => (
    <div className={`ambient-mist transition-all duration-1000 ${phase === 'night' ? 'opacity-60' : 'opacity-20'}`} 
         style={{ background: phase === 'night' ? 'radial-gradient(circle, rgba(76, 29, 149, 0.2) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(245, 158, 11, 0.1) 0%, transparent 70%)' }} 
    />
  );

  const renderRoleRevealOverlay = () => {
    return (
      <AnimatePresence>
        {showRoleReveal && roleInfo && !isGM && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex-center p-xl bg-black/90 backdrop-blur-2xl"
          >
            <div className="flex flex-col items-center gap-xl text-center perspective-1000">
              <p className="text-secondary font-bold tracking-[8px] uppercase mb-lg">แตะการ์ดเพื่อเปิดดูบทบาท</p>
              
              <motion.div 
                onClick={() => setShowRoleReveal(false)}
                className="relative w-64 h-96 preserve-3d transition-transform duration-700 cursor-pointer"
              >
                {/* Simplified for now, just show the role */}
                <div className="absolute inset-0 glass-panel-werewolf border-4 border-indigo-500/50 flex flex-col items-center justify-between p-xl rounded-3xl bg-slate-900">
                  <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex-center text-6xl shadow-inner">
                    {roleInfo.icon}
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-black mb-sm" style={{ color: roleInfo.color }}>{roleInfo.name}</h3>
                    <p className="text-sm text-secondary leading-relaxed">{roleInfo.description}</p>
                  </div>
                  {WOLF_ROLES.includes(myRole) && (
                    <div className="w-full p-md bg-danger/10 border border-danger/30 rounded-xl">
                      <p className="text-[10px] text-danger font-black uppercase mb-1">Wolf Allies</p>
                      <p className="text-xs text-white font-bold truncate">
                        {Object.entries(wwData.players || {}).filter(([n, p]: [string, any]) => WOLF_ROLES.includes(p.role) && n !== userNickname).map(([n]) => n).join(', ') || 'Lone Wolf'}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              <button 
                onClick={() => { setShowRoleReveal(false); }}
                className="btn btn-glass px-xl py-md mt-xl font-bold border-white/10 hover:border-white/30"
              >
                เข้าสู่หมู่บ้าน
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderVFXOverlay = () => (
    <div className={`werewolf-vfx-overlay ${vfx.show ? 'animate-shake' : 'hidden'} ${vfx.type}`}>
      <div className="vfx-blood" />
      <div className="vfx-text">{vfx.text}</div>
    </div>
  );

  // ─── Render: Game Result ──────────────────────────────────────────────────────

  if (phase === 'result') {
    const winner = wwData.winnerTeam;
    const wwPlayers = wwData.players || {};

    const winnerColor = winner === 'werewolf' ? 'red' : winner === 'villager' ? 'green' : 'purple';
    const winnerTitle = winner === 'werewolf' ? 'หมาป่าชนะ!' : winner === 'villager' ? 'ชาวบ้านชนะ!' : 'ฝ่ายอิสระชนะ!';
    const winnerDesc = winner === 'werewolf' ? 'หมู่บ้านตกอยู่ในความมืด...' : winner === 'villager' ? 'หมาป่าทุกตัวถูกกำจัด!' : 'ผู้เล่นอิสระบรรลุเป้าหมาย!';

    return (
      <div className="flex flex-col gap-6 w-full animate-fade-in pb-20 relative z-10 px-2 mt-8">
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        
        <EpicPopup
          isOpen={true}
          title={winnerTitle}
          description={winnerDesc}
          color={winnerColor}
          icon={winner === 'werewolf' ? <Skull size={48} /> : winner === 'villager' ? <CheckCircle2 size={48} /> : <Eye size={48} />}
          onClose={() => {}} // Always open
          disableClose={true}
        />

        <NeonCard color="slate" className="p-4 space-y-3 mt-[320px]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">เปิดเผยบทบาท</p>
          <div className="flex flex-col gap-2">
            {Object.entries(wwPlayers).filter(([, p]) => p.role !== 'gm').map(([name, p]) => {
              const cfg = ROLES[p.role] || ROLES.villager;
              return (
                <div key={name} className={`flex justify-between items-center p-3 rounded-xl border ${p.isAlive ? 'bg-slate-800 border-slate-700' : 'bg-slate-900/80 border-slate-800 opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl drop-shadow-md">{cfg.icon}</span>
                    <span className="font-bold text-sm text-white">{name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>{cfg.name}</span>
                    {!p.isAlive && <span className="text-red-500 text-xs ml-2">💀</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </NeonCard>

        {isHost ? (
          <div className="flex flex-col gap-3 w-full">
            <GiantButton color="pink" onClick={handlePlayAgain}>
              🔄 เล่นอีกครั้ง
            </GiantButton>
            <GiantButton color="slate" onClick={resetToLobby}>
              กลับสู่ล็อบบี้
            </GiantButton>
          </div>
        ) : (
          <GiantButton color="slate" onClick={requestLeave}>
            <LogOut size={18} /> ออกจากห้อง
          </GiantButton>
        )}
      </div>
    );
  }

  // ─── Render: Active Game ──────────────────────────────────────────────────────

  const wwPlayers = wwData.players || {};
  const nightActions = wwData.nightActions || {};

  const phaseLabel = phase === 'night' ? `🌙 คืนที่ ${dayCount}` : phase === 'day' ? `☀️ กลางวันที่ ${dayCount}` : phase === 'voting' ? '🗳️ ถึงเวลาโหวต!' : '🎭 รอเริ่มรอบ';
  const phaseBg = phase === 'night' ? 'border-indigo-500/30' : phase === 'day' ? 'border-orange-400/30' : phase === 'voting' ? 'border-red-400/30' : 'border-glass';

  if (gameMode === 'physical') {
    return (
      <div className="flex flex-col gap-6 w-full animate-fade-in pb-32 z-10 relative px-2">
        <StarsBackground />
        <AmbientMist />
        <VFXOverlay />
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        
        <NeonCard color={phase === 'night' ? 'indigo' : phase === 'day' ? 'amber' : phase === 'voting' ? 'red' : 'slate'} className="p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {phase === 'night' ? <Moon className="text-indigo-400" size={24} /> : <Sun className="text-amber-400" size={24} />}
            <p className="font-display font-black text-xl text-white uppercase tracking-widest">{phaseLabel}</p>
          </div>
          <div className="text-right">
            {isGM ? <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">GM Dashboard</span> : (
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${myIsAlive ? 'bg-neon-green/10 text-neon-green border-neon-green/30' : 'bg-red-500/10 text-red-500 border-red-500/30'}`}>
                {myIsAlive ? 'ยังมีชีวิต' : 'ตายแล้ว'}
              </span>
            )}
          </div>
        </NeonCard>

        {isGM ? (
          <NeonCard color="amber" className="p-5 space-y-4">
            <h3 className="font-black flex items-center gap-2 text-amber-500 uppercase tracking-widest text-[11px] mb-4">🕹️ ควบคุมเกม (ไพ่จริง)</h3>

            {/* Manual Life/Death Grid (Top level view) */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {Object.entries(wwPlayers).filter(([, p]) => p.role !== 'gm').map(([name, p]) => (
                <button
                  key={name}
                  onClick={() => togglePlayerAlive(name, !p.isAlive)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    p.isAlive ? 'bg-slate-800 border-slate-700 text-white hover:border-slate-500' : 'bg-red-500/10 border-red-500/30 text-red-500 opacity-70'
                  }`}
                >
                  <span className="text-sm font-bold truncate flex-1 text-left">{name}</span>
                  {p.isAlive ? <CheckCircle2 size={16} className="text-neon-green" /> : <Skull size={16} />}
                </button>
              ))}
            </div>

            {/* Phase Logic */}
            {phase === 'night' && (
              <div className="space-y-4 border-t border-slate-700 pt-4 animate-fade-in">
                <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-center mb-4">
                   <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-1">Night Step Manager</p>
                   <p className="text-[10px] text-slate-400">เรียกบทบาทตามลำดับด้านล่าง และบันทึกผลการกระทำ</p>
                </div>

                {/* Seer Quick View for GM */}
                {wwData.lastSeerResult && (
                  <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/30 flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                       <Eye size={16} className="text-purple-400" />
                       <span className="text-[11px] text-white">ผลการส่องล่าสุด: <strong>{wwData.lastSeerResult.targetName}</strong> คือ <strong>{wwData.lastSeerResult.isWolf ? '🐺 หมาป่า!' : '🏘️ ชาวบ้าน'}</strong></span>
                    </div>
                    <button onClick={clearSeerResults} className="text-[10px] text-slate-400 hover:text-white underline">ล้าง</button>
                  </div>
                )}

                <div className="space-y-4 border-t border-slate-700 pt-4">
                  <p className="text-sm font-bold text-indigo-300 flex items-center gap-2"><Moon size={16} /> ขั้นตอนการเรียกบทบาท (Physical):</p>
                  <div className="bg-slate-900/40 rounded-xl p-4 border border-indigo-500/20 space-y-4">
                    {(() => {
                      const deckRoles = Object.entries(wwData.deckCounts || {}).filter(([, c]) => c > 0).map(([r]) => r);
                      const actionRoles = Object.keys(ROLES).filter(r => 
                        deckRoles.includes(r) && 
                        (ROLES[r].actionPhase === 'nightly' || (ROLES[r].actionPhase === 'firstNight' && dayCount === 1))
                      );
                      
                      const activeRoles = actionRoles.sort((a, b) => {
                        if (ROLES[a].team !== ROLES[b].team) return ROLES[a].team === 'werewolf' ? -1 : 1;
                        return a.localeCompare(b);
                      });

                      return (
                        <div className="space-y-6">
                          <div className="p-3 bg-indigo-500/10 rounded-xl text-center border border-indigo-500/20 shadow-inner">
                            <p className="text-[11px] font-black text-indigo-300 uppercase tracking-widest">1. ทุกคนหลับตาลง</p>
                          </div>

                          {activeRoles.map((roleKey, idx) => {
                            const role = ROLES[roleKey];
                            const rolePlayers = Object.entries(wwPlayers).filter(([, p]) => p.role === roleKey && p.role !== 'gm');
                            const deckCount = (wwData.deckCounts || {})[roleKey] || 0;
                            const isCurrentStep = activeScriptIndex === idx;
                            
                            return (
                              <div 
                                key={roleKey} 
                                onClick={() => setActiveScriptIndex(idx)}
                                className={`space-y-sm border-l-4 pl-md py-sm transition-all cursor-pointer ${
                                  isCurrentStep ? 'border-indigo-500 bg-indigo-500/10 shadow-lg' : 'border-indigo-500/20 opacity-60'
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <p className="text-sm font-bold flex items-center gap-xs" style={{ color: role.color }}>
                                    {idx + 2}. {role.icon} {role.name} ลืมตาขึ้นมา... <span className="text-xs opacity-70">({rolePlayers.length}/{deckCount} คน)</span>
                                  </p>
                                  {isCurrentStep && <span className="px-xs py-0.5 bg-indigo-500 text-[8px] font-black text-white rounded uppercase">Active</span>}
                                </div>
                                
                                {VOICE_SCRIPTS[roleKey] && isCurrentStep && (
                                  <div className="p-xs bg-white/5 rounded border border-white/10 text-[11px] text-warning italic px-sm animate-pulse">
                                    🎤 "{VOICE_SCRIPTS[roleKey]}"
                                  </div>
                                )}
                                
                                {isCurrentStep && (
                                  <>
                                    <p className="text-[10px] text-indigo-300/80 mb-xs">ระบุเป้าหมาย (หากต้องการให้ระบบช่วยจำ):</p>
                                    <div className="flex flex-wrap gap-xs mb-sm">
                                      {Object.entries(wwPlayers).filter(([, p]) => p.role !== 'gm' && p.isAlive).map(([name]) => {
                                        const isSelected = roleKey === 'cupid' 
                                          ? nightActions['cupidTarget']?.split(',').includes(name)
                                          : nightActions[`${roleKey}Target`] === name;
                                          
                                        return (
                                          <button
                                            key={name}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (roleKey === 'cupid') {
                                                const current = nightActions['cupidTarget'] ? nightActions['cupidTarget'].split(',') : [];
                                                let next;
                                                if (current.includes(name)) {
                                                  next = current.filter(t => t !== name);
                                                } else {
                                                  next = [...current, name].slice(-2);
                                                }
                                                gmSubmitForRole('cupid', next.join(','));
                                              } else {
                                                gmSubmitForRole(roleKey, nightActions[`${roleKey}Target`] === name ? 'skip' : name);
                                              }
                                            }}
                                            className={`px-sm py-xs rounded-lg text-[10px] font-bold border transition-all ${
                                              isSelected ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-glass border-glass text-secondary'
                                            }`}
                                          >
                                            {name}
                                          </button>
                                        );
                                      })}
                                    </div>

                                    <p className="text-[10px] text-indigo-300/80 mb-xs">ระบุผู้ถือบทบาทนี้ (ถ้ายังไม่ได้ระบุ):</p>
                                    <div className="flex flex-wrap gap-sm">
                                      {Object.entries(wwPlayers).filter(([, p]) => p.role !== 'gm').map(([name, p]) => {
                                        const isThisRole = p.role === roleKey;
                                        return (
                                          <button
                                            key={name}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              updatePlayerRole(name, isThisRole ? 'villager' : roleKey);
                                            }}
                                            className={`px-md py-sm rounded-xl text-xs font-bold border-2 transition-all shadow-sm active:scale-95 ${
                                              isThisRole ? 'bg-indigo-500 border-indigo-400 text-white shadow-indigo-500/20' : 'bg-glass border-glass/50 text-secondary hover:text-white hover:border-glass'
                                            }`}
                                          >
                                            {name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}

                          <div className="p-3 bg-amber-400/10 rounded-xl text-center mt-4 border border-amber-400/20 shadow-inner">
                            <p className="text-[11px] font-black text-amber-300 uppercase tracking-widest">{activeRoles.length + 2}. ทุกคนลืมตาขึ้น... เข้าสู่ตอนเช้า</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Night Kill Section */}
                <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20 space-y-4 mt-4">
                  <p className="text-[12px] font-black text-red-400 flex items-center gap-2 uppercase tracking-widest"><Skull size={16} /> บันทึกผู้เสียชีวิตในคืนนี้</p>
                  
                  {/* Suggested Results based on nightActions */}
                  {(() => {
                    const result = resolveNightActions(nightActions, { 
                      players: wwPlayers, 
                      lovers: wwData.lovers, 
                      hunterPending: wwData.hunterPending 
                    });
                    if (!result.finalEliminated) return null;
                    return (
                      <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/40 mb-2">
                        <p className="text-[10px] font-black text-red-400 uppercase mb-2">💡 ระบบวิเคราะห์ผู้ตาย:</p>
                        {result.finalEliminated.map(name => (
                          <div key={name} className="flex justify-between items-center mb-2 last:mb-0">
                             <span className="text-[12px] font-bold text-white">{name}</span>
                             <button 
                               onClick={() => togglePlayerAlive(name, false)}
                               className="px-3 py-1 bg-red-500 text-white font-black text-[10px] rounded-lg shadow-sm"
                             >
                               ยืนยันการตาย
                             </button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <p className="text-[10px] text-red-300/80 leading-tight mb-2">แตะที่ชื่อผู้เล่นเพื่อทำการยืนยันการตาย (สามารถกดซ้ำที่กริดด้านบนเพื่อยกเลิกได้)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(wwPlayers).filter(([, p]) => p.role !== 'gm' && p.isAlive).map(([name, p]) => (
                      <button
                        key={name}
                        onClick={() => {
                          if(confirm(`ยืนยันการสังหาร ${name} ในคืนนี้ใช่หรือไม่?`)) {
                             togglePlayerAlive(name, false);
                          }
                        }}
                        className="flex justify-between items-center p-3 bg-slate-800 border border-red-500/30 rounded-xl hover:bg-red-500/20 active:scale-95 transition-all text-white group"
                      >
                         <span className="font-bold text-sm truncate">{name}</span>
                         <span className="text-lg opacity-50 group-hover:opacity-100 group-hover:text-red-500 drop-shadow-md">🔪</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <GiantButton color="amber" onClick={resolveNightToDay}>
                    ☀️ ประกาศผลตอนเช้า
                  </GiantButton>
                </div>
              </div>
            )}

            {phase === 'day' && (
              <div className="space-y-4 border-t border-slate-700 pt-4">
                <NeonCard color="amber" className="text-center p-6 bg-amber-400/10">
                  <p className="text-lg font-black text-amber-400 mb-2 flex-center gap-2"><Sun size={20} /> โหวตแขวนคอ</p>
                  <p className="text-[11px] text-slate-300 mb-6 leading-relaxed">ให้ทุกคนอภิปรายและโหวตแขวนคอ 1 คน <br/> <strong className="text-white">แตะที่ชื่อด้านล่างเพื่อประหารผู้เล่นที่ถูกโหวต</strong></p>
                  
                  <div className="grid grid-cols-2 gap-2 text-left">
                    {Object.entries(wwPlayers).filter(([, p]) => p.role !== 'gm' && p.isAlive).map(([name, p]) => (
                      <button
                        key={name}
                        onClick={() => {
                          if(confirm(`ยืนยันการแขวนคอ ${name} ใช่หรือไม่?`)) {
                             togglePlayerAlive(name, false);
                          }
                        }}
                        className="flex justify-between items-center p-3 bg-slate-900/50 border border-amber-500/30 rounded-xl hover:border-red-500 hover:bg-red-500/20 active:scale-95 transition-all text-white group"
                      >
                         <span className="font-bold text-sm truncate">{name}</span>
                         <span className="text-xl opacity-40 group-hover:opacity-100 group-hover:text-red-500 drop-shadow-md">🪢</span>
                      </button>
                    ))}
                  </div>
                </NeonCard>
                
                <GiantButton color="slate" onClick={startNextNight}>
                  🌙 ข้ามโหวต / เริ่มคืนถัดไป
                </GiantButton>
              </div>
            )}

            {/* Manual Winner Buttons */}
            <div className="border-t border-slate-700 pt-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">ประกาศผลผู้ชนะ / สรุปเกม</p>
              <div className="flex gap-2">
                <button className="flex-1 py-2 px-1 bg-slate-900 border border-neon-green/30 text-[10px] font-bold text-neon-green rounded-xl" onClick={() => announceWinner('villager')}>🏘️ ชาวบ้านชนะ</button>
                <button className="flex-1 py-2 px-1 bg-slate-900 border border-red-500/30 text-[10px] font-bold text-red-500 rounded-xl" onClick={() => announceWinner('werewolf')}>🐺 หมาป่าชนะ</button>
                <button className="flex-1 py-2 px-1 bg-slate-900 border border-purple-400/30 text-[10px] font-bold text-purple-400 rounded-xl" onClick={() => announceWinner('independent')}>🎭 อิสระชนะ</button>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4 mt-4">
              <button 
                className="w-full py-3 bg-slate-900 font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 rounded-xl flex items-center justify-center transition-all active:scale-95 text-sm" 
                onClick={async () => {
                  if(confirm('ต้องการจบเกมและกลับสู่ล็อบบี้ใช่หรือไม่?')) {
                    await resetToLobby();
                  }
                }}
              >
                <LogOut size={16} className="inline mr-2" /> จบเกม (กลับสู่ล็อบบี้)
              </button>
            </div>
          </NeonCard>
        ) : (
          <NeonCard color={myIsAlive ? 'slate' : 'red'} className="p-8 text-center flex flex-col items-center">
            <div className="text-6xl animate-pulse mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
              {phase === 'night' ? '🌙' : '☀️'}
            </div>
            <h3 className="text-2xl font-black text-white mb-2">
              {phase === 'night' ? 'ถึงเวลากลางคืน' : 'ถึงเวลากลางวัน'}
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              {phase === 'night' ? 'หลับตาลงและทำตามที่ GM บอก...' : 'ลืมตาขึ้นและพูดคุยหาตัวหมาป่า!'}
            </p>
            <div className={`p-4 rounded-2xl border-2 w-full mb-6 ${myIsAlive ? 'bg-neon-green/5 border-neon-green/30 text-neon-green shadow-[0_0_15px_rgba(0,255,0,0.1)]' : 'bg-red-500/5 border-red-500/30 text-red-500 shadow-[0_0_15px_rgba(255,0,0,0.1)]'}`}>
              <p className="font-black tracking-widest uppercase text-sm">{myIsAlive ? '🟢 คุณยังมีชีวิตอยู่' : '💀 คุณเสียชีวิตแล้ว'}</p>
            </div>
            
            <div className="pt-6 w-full border-t border-slate-700">
              <GiantButton color="slate" onClick={requestLeave}>
                <LogOut size={16} /> ออกจากห้อง
              </GiantButton>
            </div>
          </NeonCard>
        )}

        {/* Player List Sidebar */}
        <NeonCard color="slate" className="p-4 mt-6">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Users size={14}/> ผู้เล่นทั้งหมด ({Object.values(wwPlayers).filter(p => p.role !== 'gm').length} คน)</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(wwPlayers).filter(([, p]) => p.role !== 'gm').map(([name, p]) => (
              <span key={name} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border ${!p.isAlive ? 'opacity-40 line-through bg-slate-900 border-slate-800 text-slate-500' : 'bg-slate-800 border-slate-700 text-white shadow-sm'}`}>
                {!p.isAlive && '💀 '}{name}
              </span>
            ))}
          </div>
        </NeonCard>
      </div>
    );
  }

  const renderErrorToast = () => errorMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-danger text-white px-lg py-sm rounded-2xl font-bold text-sm shadow-xl animate-fade-in">
      {errorMsg}
    </div>
  ) : null;

  if (!roomData) return null;

  // ─── Digital Mode UI (Original) ───
  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in pb-32 relative z-10 px-2">
      {renderErrorToast()}
      {renderStarsBackground()}
      {renderAmbientMist()}
      {renderVFXOverlay()}
      {renderRoleRevealOverlay()}

      {/* Phase Banner */}
      <NeonCard color={phase === 'night' ? 'indigo' : phase === 'day' ? 'amber' : phase === 'voting' ? 'red' : 'slate'} className="p-4 flex justify-between items-center mt-4">
        <div className="flex items-center gap-3">
          {phase === 'night' ? <Moon className="text-indigo-400" size={24} /> : phase === 'day' ? <Sun className="text-amber-400" size={24} /> : <Users className="text-red-400" size={24} />}
          <div>
            <p className="font-display font-black text-xl text-white uppercase tracking-widest leading-none">{phaseLabel}</p>
          </div>
          {wwData.timerEnd && (
            <div className="ml-2">
              <TimerDisplay timeLeft={timeLeft} />
            </div>
          )}
        </div>
        <div className="text-right flex items-center justify-end gap-2">
          {!isGM && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${myIsAlive ? 'bg-neon-green/10 border-neon-green/30 text-neon-green' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
              <span className="text-xl drop-shadow-md">{roleInfo?.icon || '🎭'}</span>
              <span className="text-[10px] font-black uppercase tracking-widest">
                {myIsAlive ? 'ยังมีชีวิต' : 'ตายแล้ว'}
              </span>
            </div>
          )}
          {isGM && <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">GM</span>}
        </div>
      </NeonCard>

      {/* Last Elimination Banner */}
      {wwData.lastElimination && wwData.lastElimination.playerName && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <NeonCard color="pink" className="p-4 text-center bg-red-500/10">
            <p className="text-red-400 font-black text-sm uppercase tracking-widest">
              {wwData.lastElimination.reason === 'vote' && `🗳️ ${wwData.lastElimination.playerName} ถูกโหวตไล่ออก!`}
              {wwData.lastElimination.reason === 'prince_saved' && `👑 ${wwData.lastElimination.playerName} ถูกโหวต แต่เจ้าชายรอดชีวิต!`}
              {wwData.lastElimination.reason === 'tie' && '🗳️ โหวตเสมอ! ไม่มีผู้ถูกกำจัด'}
              {wwData.lastElimination.reason === 'skipped' && '⏭️ GM ข้ามรอบโหวต'}
            </p>
          </NeonCard>
        </motion.div>
      )}

      {/* GM Panel */}
      {isGM && (
        <NeonCard color="amber" className="p-5 space-y-4">
          <h3 className="font-black flex items-center gap-2 text-amber-500 text-[11px] uppercase tracking-widest">🎭 แผงควบคุม GM</h3>

          {/* Player Status Table */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">สถานะผู้เล่น</p>
            {Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.role !== 'gm').map(([name, p]: [string, any]) => {
              const cfg = ROLES[p.role] || ROLES.villager;
              const isDead = !p.isAlive;
              return (
                <div key={name} className={`flex items-center gap-2 p-3 rounded-xl border ${isDead ? 'bg-slate-900/50 border-slate-800 opacity-60' : 'bg-slate-800 border-slate-700'}`}>
                  <span className="text-xl drop-shadow-md">{cfg.icon}</span>
                  <span className="flex-1 text-sm font-bold truncate text-white">{name}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>{cfg.name}</span>
                  {p.status?.silenced && <span className="text-sm">🤐</span>}
                  {p.status?.banned && <span className="text-sm">🚫</span>}
                  {p.status?.lover && <span className="text-sm">💘</span>}
                  <button
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ml-2 transition-all active:scale-95 shadow-sm ${isDead ? 'bg-neon-green/20 text-neon-green hover:bg-neon-green/30' : 'bg-red-500 text-white hover:bg-red-400'}`}
                    onClick={() => togglePlayerAlive(name, isDead)}
                  >
                    {isDead ? 'ชุบ' : 'ฆ่า'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Night Controls */}
          {phase === 'night' && (
            <div className="space-y-4 border-t border-slate-700 pt-4">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Moon size={14}/> บทบาทคืนนี้ (GM เลือกให้)</p>
              {(() => {
                // Only include roles where at least one alive player has that role
                const activeRoles = Array.from(new Set(
                  Object.values(wwPlayers)
                    .filter((p: any) => p.isAlive && p.role !== 'gm')
                    .map((p: any) => p.role)
                    .filter(role => {
                      const cfg = ROLES[role];
                      return cfg && (cfg.actionPhase === 'nightly' || (cfg.actionPhase === 'firstNight' && dayCount === 1));
                    })
                ));

                // Collapse alive wolf roles into one "werewolf" action key
                const wolfPresent = activeRoles.some(r => WOLF_ROLES.includes(r));
                const nonWolfRoles = activeRoles.filter(r => !WOLF_ROLES.includes(r));
                const actionKeys = wolfPresent ? ['werewolf', ...nonWolfRoles] : nonWolfRoles;

                // Alive non-GM players as target options
                const targets = Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.isAlive && p.role !== 'gm');

                return actionKeys.map(actionKey => {
                  const cfg = ROLES[actionKey] || ROLES.villager;
                  const isDone = !!nightActions[`${actionKey}TargetDone`];
                  const chosenTarget = nightActions[`${actionKey}Target`];

                  // Label & color per action type
                  let actionLabel = 'เลือกเป้าหมาย';
                  const doneLabel = `→ ${chosenTarget === 'skip' ? 'ข้าม' : chosenTarget}`;
                  let cardBorder = 'border-indigo-500/30';
                  let cardBg = 'bg-indigo-500/5';
                  if (WOLF_ROLES.includes(actionKey)) { actionLabel = '🔪 ฆ่า'; cardBorder = 'border-red-500/30'; cardBg = 'bg-red-500/5'; }
                  else if (actionKey === 'bodyguard') { actionLabel = '🛡️ ปกป้อง'; cardBorder = 'border-neon-green/30'; cardBg = 'bg-neon-green/5'; }
                  else if (['seer', 'apprentice_seer', 'mystic_wolf', 'aura_seer'].includes(actionKey)) { actionLabel = '🔮 ส่อง'; cardBorder = 'border-purple-500/30'; cardBg = 'bg-purple-500/5'; }

                  return (
                    <div key={actionKey} className={`rounded-xl p-3 border ${cardBorder} ${cardBg}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: cfg.color }}>
                          {cfg.icon} {WOLF_ROLES.includes(actionKey) ? 'หมาป่า' : cfg.name} — {actionLabel}
                        </span>
                        {isDone && (
                          <span className="text-[10px] font-black text-neon-green bg-neon-green/10 px-2 py-0.5 rounded-full border border-neon-green/20">✅ {doneLabel}</span>
                        )}
                      </div>
                      {!isDone ? (
                        <div className="flex flex-wrap gap-2">
                          {targets.map(([name]) => (
                            <button
                              key={name}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold border border-slate-600 bg-slate-800 text-white active:scale-95 transition-all shadow-sm hover:border-slate-400"
                              onClick={() => gmSubmitForRole(actionKey, name)}
                            >
                              {name}
                            </button>
                          ))}
                          <button
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold border border-slate-700 bg-slate-900 text-slate-400 active:scale-95 transition-all hover:text-white"
                            onClick={() => gmSubmitForRole(actionKey, 'skip')}
                          >
                            ข้าม
                          </button>
                        </div>
                      ) : (
                        <button
                          className="text-[10px] text-slate-400 underline hover:text-white"
                          onClick={async () => {
                            await safeUpdate(`rooms/${roomId}/gameData/wwData`, {
                              [`nightActions/${actionKey}Target`]: null,
                              [`nightActions/${actionKey}TargetDone`]: null,
                            });
                          }}
                        >
                          เปลี่ยนใจ
                        </button>
                      )}
                    </div>
                  );
                });
              })()}

              {/* Night summary: killed / protected / seen */}
              {(() => {
                const killed = nightActions['werewolfTarget'];
                const protected_ = nightActions['bodyguardTarget'];
                const seen = nightActions['seerTarget'] || nightActions['apprentice_seerTarget'] || nightActions['mystic_wolfTarget'] || nightActions['aura_seerTarget'];
                const seenRole = seen && seen !== 'skip' ? wwData.players?.[seen]?.role : null;
                const isWolf = seenRole ? (WOLF_ROLES.includes(seenRole) && seenRole !== 'wolf_man') || seenRole === 'lycan' : false;

                if (!killed && !protected_ && !seen) return null;
                return (
                  <div className="bg-slate-900/50 rounded-xl p-4 space-y-2 border border-slate-700">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">สรุปคืนนี้ (มองเห็นแค่ GM)</p>
                    {killed && killed !== 'skip' && (
                      <p className="text-xs font-bold text-red-500">🔪 หมาป่าฆ่า: <span className="text-white">{killed}</span>
                        {protected_ === killed && <span className="text-neon-green ml-2">→ ถูกปกป้อง! รอด</span>}
                      </p>
                    )}
                    {protected_ && protected_ !== 'skip' && (
                      <p className="text-xs font-bold text-neon-green">🛡️ บอดี้การ์ดปกป้อง: <span className="text-white">{protected_}</span></p>
                    )}
                    {seen && seen !== 'skip' && seenRole && (
                      <p className={`text-xs font-bold ${isWolf ? 'text-red-500' : 'text-neon-green'}`}>
                        🔮 ส่อง: <span className="text-white">{seen}</span> = {isWolf ? '🐺 หมาป่า' : '✅ ไม่ใช่หมาป่า'} ({ROLES[seenRole]?.name || seenRole})
                      </p>
                    )}
                  </div>
                );
              })()}

              <GiantButton color="amber" onClick={resolveNightToDay}>
                ☀️ เข้าสู่กลางวัน
              </GiantButton>
            </div>
          )}

          {/* Day Controls */}
          {phase === 'day' && (
            <div className="border-t border-slate-700 pt-4">
              <GiantButton color="pink" onClick={startVotingPhase}>
                🗳️ เริ่มโหวต
              </GiantButton>
            </div>
          )}

          {/* Voting Controls */}
          {phase === 'voting' && (
            <div className="space-y-4 border-t border-slate-700 pt-4">
              <p className="text-[11px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2"><Users size={14}/> ผลโหวตปัจจุบัน</p>
              <div className="flex flex-col gap-2">
                {Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.isAlive && p.role !== 'gm').map(([name]) => {
                  const voteCount = Object.values(wwPlayers).filter((pp: any) => pp.vote === name).reduce((acc: number, pp: any) => acc + (pp.role === 'mayor' ? 2 : 1), 0);
                  return voteCount > 0 ? (
                    <div key={name} className="flex justify-between items-center p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <span className="text-sm font-bold text-white">{name}</span>
                      <span className="text-red-500 font-black text-xs px-2 py-1 bg-red-500/20 rounded-lg">{voteCount} โหวต</span>
                    </div>
                  ) : null;
                })}
              </div>
              <div className="flex flex-col gap-3 mt-4">
                <GiantButton color="pink" onClick={resolveVotes}>✅ อนุมัติผลโหวต</GiantButton>
                <GiantButton color="slate" onClick={gmSkipVote}>⏭️ ข้าม</GiantButton>
              </div>
            </div>
          )}

          {/* Standby Controls */}
          {phase === 'standby' && (
            <div className="space-y-4 border-t border-slate-700 pt-4">
              <GiantButton color="blue" onClick={startNextNight}>
                🌙 เริ่มคืนถัดไป
              </GiantButton>
              <div className="border-t border-slate-700 pt-4 mt-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">จบเกมล่วงหน้า</p>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 px-1 bg-slate-900 border border-neon-green/30 text-[10px] font-bold text-neon-green rounded-xl active:scale-95 transition-all" onClick={() => announceWinner('villager')}>🏘️ ชาวบ้าน</button>
                  <button className="flex-1 py-2 px-1 bg-slate-900 border border-red-500/30 text-[10px] font-bold text-red-500 rounded-xl active:scale-95 transition-all" onClick={() => announceWinner('werewolf')}>🐺 หมาป่า</button>
                  <button className="flex-1 py-2 px-1 bg-slate-900 border border-purple-400/30 text-[10px] font-bold text-purple-400 rounded-xl active:scale-95 transition-all" onClick={() => announceWinner('independent')}>🎭 อิสระ</button>
                </div>
              </div>
            </div>
          )}
        </NeonCard>
      )}

      {/* Player View */}
      {!isGM && (
        <div className="space-y-4 w-full">
          {/* Role Card */}
          <NeonCard 
            color="slate" 
            className="p-4 flex items-center gap-4 cursor-pointer active:scale-95 transition-all" 
            onClick={() => setShowRoleReveal(true)}
            style={{ borderLeft: `6px solid ${roleInfo?.color || '#666'}` }}
          >
            <div className="text-4xl drop-shadow-md">{roleInfo?.icon || '❓'}</div>
            <div className="flex-1">
              <p className="font-display font-black text-xl uppercase tracking-widest" style={{ color: roleInfo?.color, textShadow: `0 0 10px ${roleInfo?.color}40` }}>{roleInfo?.name || 'ไม่ทราบ'}</p>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">{roleInfo?.description || ''}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-800 flex-center">
              <Info size={16} className="text-slate-400" />
            </div>
          </NeonCard>

          {/* Wolf allies */}
          {WOLF_ROLES.includes(myRole) && (
            <NeonCard color="pink" className="p-3 bg-red-500/10 border-red-500/30">
              <p className="text-[11px] text-red-400 font-black uppercase tracking-widest flex items-center gap-2">
                <Users size={14} /> เพื่อนหมาป่า: <span className="text-white normal-case font-bold">{Object.entries(wwPlayers).filter(([n, p]: [string, any]) => WOLF_ROLES.includes(p.role) && n !== userNickname && p.role !== 'gm').map(([n]) => n).join(', ') || 'ไม่มี'}</span>
              </p>
            </NeonCard>
          )}

          {/* Seer Result */}
          {userNickname && ['seer', 'apprentice_seer', 'mystic_wolf', 'aura_seer'].includes(myRole) && wwData.privateData?.[userNickname]?.seerResult && (
            <NeonCard color={wwData.privateData[userNickname].seerResult.isWolf ? 'red' : 'indigo'} className={`p-4 text-center ${wwData.privateData[userNickname].seerResult.isWolf ? 'bg-red-500/10' : 'bg-indigo-500/10'}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex-center gap-2"><Eye size={14} /> ผลการส่อง</p>
              <p className="font-bold text-sm">
                <span className="text-white">{wwData.privateData[userNickname].seerResult.targetName}</span> คือ{' '}
                <span className={`font-black uppercase tracking-widest px-2 py-0.5 rounded-lg text-[11px] ${wwData.privateData[userNickname].seerResult.isWolf ? 'text-red-500 bg-red-500/20' : 'text-neon-green bg-neon-green/20'}`}>
                  {wwData.privateData[userNickname].seerResult.isWolf ? '🐺 หมาป่า!' : '✅ ไม่ใช่หมาป่า'}
                </span>
              </p>
            </NeonCard>
          )}

          {/* Night: Action Panel */}
          {phase === 'night' && myIsAlive && (
            <NeonCard color="blue" className="p-5 border-indigo-500/30 bg-indigo-500/5">
              {(() => {
                const cfg = ROLES[myRole];
                if (!cfg || cfg.actionPhase === 'none' || (cfg.actionPhase === 'firstNight' && dayCount > 1)) {
                  return (
                    <div className="text-center p-4">
                      <div className="text-5xl mb-4 animate-pulse drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">🌙</div>
                      <p className="text-indigo-300 font-bold">กำลังหลับอยู่... ไม่ต้องทำอะไรในคืนนี้</p>
                    </div>
                  );
                }

                const isDone = !!nightActions[`${myRole}TargetDone`];
                if (isDone) {
                  return (
                    <div className="text-center p-4">
                      <div className="w-16 h-16 mx-auto bg-neon-green/20 rounded-full flex-center mb-4 border border-neon-green/50">
                        <CheckCircle2 size={32} className="text-neon-green" />
                      </div>
                      <p className="text-neon-green font-black uppercase tracking-widest text-sm drop-shadow-[0_0_10px_rgba(0,255,0,0.5)]">ส่งการกระทำแล้ว</p>
                      <p className="text-[10px] text-slate-400 mt-2">รอ GM ประกาศผล</p>
                    </div>
                  );
                }

                // Show targets
                const targets = Object.entries(wwPlayers).filter(([name, p]: [string, any]) => {
                  if (!p.isAlive || p.role === 'gm') return false;
                  if (name === userNickname && myRole !== 'bodyguard') return false;
                  if (cfg.team === 'werewolf' && WOLF_ROLES.includes(p.role) && name !== userNickname) return false;
                  return true;
                });

                return (
                  <div className="space-y-4">
                    <p className="text-[11px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">{cfg.icon} ถึงตาคุณแล้ว — เลือกเป้าหมาย:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {targets.map(([name]) => (
                        <button
                          key={name}
                          className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${selectedTarget === name ? 'border-neon-green bg-neon-green/20 scale-[0.98] shadow-[0_0_10px_rgba(0,255,0,0.2)]' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}
                          onClick={() => {
                            if (cfg.actionType === 'target2') {
                              const newTargets = selectedTargets.includes(name)
                                ? selectedTargets.filter(t => t !== name)
                                : [...selectedTargets, name].slice(-2);
                              setSelectedTargets(newTargets);
                              if (newTargets.length === 2) {
                                submitNightAction(myRole, newTargets.join(','));
                                setSelectedTargets([]);
                              }
                            } else {
                              setSelectedTarget(name);
                              submitNightAction(myRole, name);
                            }
                          }}
                        >
                          <span className="font-bold text-sm text-white">{name}</span>
                          {selectedTarget === name && <span className="text-[9px] text-neon-green font-black uppercase">เลือกแล้ว</span>}
                        </button>
                      ))}
                    </div>
                    <GiantButton color="slate" onClick={() => submitNightAction(myRole, 'skip')}>
                      ข้าม (ไม่ใช้พลัง)
                    </GiantButton>
                  </div>
                );
              })()}
            </NeonCard>
          )}

          {/* Night: Dead */}
          {phase === 'night' && !myIsAlive && (
            <NeonCard color="slate" className="p-4 text-center opacity-70 bg-slate-900/50">
              <p className="text-red-500 font-black uppercase tracking-widest text-[11px]"><Skull size={14} className="inline mr-1 mb-1"/> คุณเสียชีวิตแล้ว — รอชมเกมต่อ</p>
            </NeonCard>
          )}

          {/* Day Panel */}
          {phase === 'day' && (
            <NeonCard color="amber" className="p-8 text-center bg-amber-400/10">
              {myIsAlive ? (
                myPlayerData?.status?.silenced ? (
                  <div>
                    <div className="text-4xl mb-4">🤐</div>
                    <p className="text-purple-400 font-black uppercase tracking-widest drop-shadow-md">คุณถูกปิดปาก!</p>
                    <p className="text-xs text-slate-300 mt-2">ห้ามพูดหรือโหวตวันนี้</p>
                  </div>
                ) : myPlayerData?.status?.banned ? (
                  <div>
                    <div className="text-4xl mb-4">🚫</div>
                    <p className="text-red-500 font-black uppercase tracking-widest drop-shadow-md">คุณถูกแบน!</p>
                    <p className="text-xs text-slate-300 mt-2">ไม่มีสิทธิ์โหวตวันนี้</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-5xl mb-4 animate-pulse drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">☀️</div>
                    <p className="text-amber-400 font-black uppercase tracking-widest drop-shadow-md">คุยกันและค้นหาหมาป่า!</p>
                    <p className="text-[10px] text-slate-400 mt-3 border-t border-amber-500/30 pt-3">รอ GM เริ่มโหวต</p>
                  </div>
                )
              ) : (
                <p className="text-red-500 font-black uppercase tracking-widest drop-shadow-md"><Skull size={18} className="inline mr-2 mb-1"/>คุณเสียชีวิตแล้ว</p>
              )}
            </NeonCard>
          )}

          {/* Voting Panel */}
          {phase === 'voting' && (
            <NeonCard color="pink" className="p-5 border-red-500/30 bg-red-500/10">
              <p className="text-[11px] font-black text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2 drop-shadow-md"><Users size={14} /> 🗳️ เลือกคนที่จะแขวนคอ</p>
              {myIsAlive && !myPlayerData?.status?.silenced && !myPlayerData?.status?.banned ? (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(wwPlayers).filter(([name, p]: [string, any]) => p.isAlive && p.role !== 'gm' && name !== userNickname).map(([name]) => {
                    const isSelected = myPlayerData?.vote === name;
                    const voteCount = Object.values(wwPlayers).filter((p: any) => p.vote === name).length;
                    return (
                      <button
                        key={name}
                        onClick={() => castVote(name)}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-1 relative transition-all active:scale-95 ${isSelected ? 'border-red-500 bg-red-500/20 scale-[0.98] shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}
                        disabled={!!myPlayerData?.vote}
                      >
                        <span className="font-bold text-sm text-white">{name}</span>
                        {isSelected && <span className="text-[9px] text-red-500 font-black uppercase">โหวตแล้ว</span>}
                        {voteCount > 0 && (
                          <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex-center text-[11px] font-black text-white shadow-[0_0_10px_rgba(239,68,68,0.5)] border-2 border-slate-900">{voteCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-6 bg-slate-900/50 rounded-xl border border-slate-700">
                  <p className="text-red-500 font-black uppercase tracking-widest text-sm drop-shadow-md">
                    {!myIsAlive ? '💀 วิญญาณไม่มีสิทธิ์โหวต' : myPlayerData?.status?.silenced ? '🤐 คุณถูกปิดปาก' : '🚫 คุณถูกแบน'}
                  </p>
                </div>
              )}
            </NeonCard>
          )}

          {/* Standby */}
          {phase === 'standby' && (
            <NeonCard color="slate" className="p-8 text-center bg-slate-800/50">
              <div className="text-5xl mb-4 opacity-50 drop-shadow-md">🎭</div>
              <p className="text-slate-300 font-black uppercase tracking-widest drop-shadow-md">รอ GM เริ่มรอบต่อไป...</p>
            </NeonCard>
          )}
        </div>
      )}

      {/* Player List Sidebar */}
      <NeonCard color="slate" className="p-4 mt-6">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Users size={14}/> ผู้เล่น</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(wwPlayers).filter(([, p]: [string, any]) => p.role !== 'gm').map(([name, p]: [string, any]) => (
            <span key={name} className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center shadow-sm ${!p.isAlive ? 'opacity-40 line-through bg-slate-900 border-slate-800 text-slate-500' : name === userNickname ? 'border-neon-green/50 text-neon-green bg-neon-green/10' : 'bg-slate-800 border-slate-700 text-white'}`}>
              {!p.isAlive && <Skull size={10} className="mr-1" />}
              {name}
              {isGM && WOLF_ROLES.includes(p.role) && <span className="text-red-500 ml-1">🐺</span>}
            </span>
          ))}
        </div>
      </NeonCard>

      {/* Show Role button (non-GM) */}
      {!isGM && (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <GiantButton color="slate" onClick={() => setShowRoleReveal(true)}>
             <Eye size={16} /> ดูบทบาทอีกครั้ง
          </GiantButton>
        </div>
      )}

      {errorMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-fade-in border border-red-400 flex items-center gap-2">
          <AlertCircle size={16} />
          {errorMsg}
        </div>
      )}
    </div>
  );
};

export default Werewolf;
