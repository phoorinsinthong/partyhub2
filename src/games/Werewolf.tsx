import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, onValue, get } from 'firebase/database';
import { db } from '../firebase';
import { Moon, Sun, Eye, Shield, Skull, Users, Play, RefreshCw, CheckCircle2, XCircle, AlertCircle, Info, ChevronRight, Timer, Volume2, VolumeX, LogOut } from 'lucide-react';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import { useGameTimer } from '../hooks/useGameTimer';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
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

const Werewolf = ({ roomId, roomData, userNickname }) => {
  const { t } = useTranslation();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const isHost = roomData.host === userNickname;
  const gameData = roomData.gameData || {};
  const players = roomData.players || {};
  const playerNames = Object.keys(players);

  const wwData = gameData.wwData || {};
  const phase = wwData.phase || 'waiting';
  // If currentGame is werewolf_physical, force physical mode. Otherwise use digital.
  const gameMode = roomData.currentGame === 'werewolf_physical' ? 'physical' : 'digital';
  const dayCount = wwData.dayCount || 0;

  const [vfx, setVfx] = useState({ show: false, type: '', text: '' });
  
  // Trigger VFX when lastElimination changes
  useEffect(() => {
    if (wwData.lastElimination?.playerName) {
      const elim = wwData.lastElimination;
      let type = 'vfx-overlay-active-vote';
      if (elim.reason === 'werewolf') type = 'vfx-overlay-active-werewolf';
      
      setVfx({ show: true, type, text: `${elim.playerName} ตาย!` });
      const timer = setTimeout(() => setVfx({ show: false, type: '', text: '' }), 4000);
      return () => clearTimeout(timer);
    }
  }, [wwData.lastElimination]);

  const myPlayerData = wwData.players?.[userNickname];
  const myRole = myPlayerData?.role || '';
  const myIsAlive = myPlayerData?.isAlive !== false;
  const isGM = isHost;
  const roleInfo = ROLES[myRole];
  
  const { timeLeft } = useGameTimer(wwData.timerEnd);

  const [selectedTarget, setSelectedTarget] = useState(null);
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [showRoleReveal, setShowRoleReveal] = useState(false);
  const personalRecordedRef = useRef(false);
  const castVoteRef = useRef(false);
  const resolvingRef = useRef(false);
  const startVotingRef = useRef(false);
  const [showDeckSetup, setShowDeckSetup] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [activeScriptIndex, setActiveScriptIndex] = useState(0);
  const [guestName, setGuestName] = useState('');

  const safeUpdate = async (refPath, data) => {
    try {
      await update(ref(db, refPath), data);
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
      throw e;
    }
  };

  const addGuest = async () => {
    if (!isHost || !guestName.trim()) return;
    const name = guestName.trim();
    if (playerNames.includes(name) || (wwData.guests && Object.keys(wwData.guests).includes(name))) {
      setErrorMsg('ชื่อนี้มีอยู่แล้ว');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    await safeUpdate(`rooms/${roomId}/gameData/wwData/guests/${name}`, { joinedAt: Date.now() });
    setGuestName('');
  };

  const removeGuest = async (name) => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}/gameData/wwData/guests`, { [name]: null });
  };

  const toggleGameMode = async (mode) => {
    if (!isHost) return;
    await safeUpdate(`rooms/${roomId}/gameData/wwData`, { gameMode: mode });
  };

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
    const myRoleResult = wwPlayers[userNickname]?.role;
    const isWolfTeam = WOLF_ROLES.includes(myRoleResult) || myRoleResult === 'minion';
    const iWon = (winner === 'werewolf' && isWolfTeam) ||
                 (winner === 'villager' && !isWolfTeam && myRoleResult !== 'gm') ||
                 (winner === 'independent');
    recordPersonalGame('werewolf');
    if (iWon) recordPersonalWin('werewolf');
    if (isHost && winner) {
      const winningPlayers = Object.entries(wwPlayers)
        .filter(([, p]) => p.isAlive && p.role !== 'gm')
        .filter(([, p]) => {
          if (winner === 'werewolf') return WOLF_ROLES.includes(p.role) || p.role === 'minion';
          if (winner === 'villager') return !WOLF_ROLES.includes(p.role) && p.role !== 'minion';
          return false;
        });
      if (winningPlayers.length > 0) {
        (async () => {
          try {
            await recordWin(roomId, winningPlayers[0][0], 'werewolf');
          } catch (_) {}
        })();
      }
    }
  }, [phase]);

  // Show role reveal when game starts
  useEffect(() => {
    if (phase === 'night' && dayCount === 1 && !isGM && myRole && gameMode === 'digital') {
      setShowRoleReveal(true);
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

  const submitNightAction = async (role, targetId, extraData = null) => {
    const updates = {};
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
      updates[`privateData/${userNickname}/seerResult`] = { targetName: targetId, isWolf, timestamp: Date.now() };
    }

    await safeUpdate(`rooms/${roomId}/gameData/wwData`, updates);
  };

  // GM selects target on behalf of a role
  const gmSubmitForRole = async (actionKey, targetId) => {
    const updates = {};
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
      const seerEntry = Object.entries(allPlayersMap).find(([, p]) => p.role === actionKey);
      
      if (seerEntry) {
        const [seerName] = seerEntry;
        const targetRole = allPlayersMap[targetId]?.role;
        const isWolf = (WOLF_ROLES.includes(targetRole) && targetRole !== 'wolf_man') || targetRole === 'lycan';
        updates[`privateData/${seerName}/seerResult`] = { targetName: targetId, isWolf, timestamp: Date.now() };
        // For physical mode, also store in a common GM viewable area
        updates[`lastSeerResult`] = { seerName, targetName: targetId, isWolf };
      }
    }

    await safeUpdate(`rooms/${roomId}/gameData/wwData`, updates);
  };

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

  const startNextNightRef = useRef(false);
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
    if (winner) updates.phase = 'result', updates.winnerTeam = winner;

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

  const playAgainRef = useRef(false);
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
    // No limit for physical, 10 for digital
    const limit = gameMode === 'digital' ? 10 : 999;

    return (
      <div className="flex flex-col gap-lg w-full animate-fade-in pb-20">
        <div className="glass-panel-werewolf p-xl text-center">
          <div className="flex-center mb-md">
            <div className="p-lg bg-danger/20 rounded-full text-danger shadow-lg shadow-danger/10">
              <Skull size={48} />
            </div>
          </div>
          <h2 className="text-3xl font-black mb-sm">WEREWOLF</h2>
          <p className="text-secondary leading-relaxed">
            {gameMode === 'digital' 
              ? 'หมาป่ากำลังแฝงตัวอยู่ในหมู่ชาวบ้าน! ทุกอย่างรันบนแอป 100%' 
              : 'โหมด GM Dashboard: แอปจะช่วย Host คุมเกมแบบใช้ไพ่จริง'}
          </p>
          {isHost && (
            <p className="text-primary font-bold mt-sm text-sm">🎭 คุณเป็นผู้ดำเนินเกม (GM)</p>
          )}
        </div>

        {/* Guest Management (Physical only) */}
        {isHost && gameMode === 'physical' && (
          <div className="glass-panel-werewolf p-lg space-y-md">
            <h4 className="text-xs font-black text-secondary uppercase tracking-widest">➕ เพิ่มผู้เล่น (Guest)</h4>
            <div className="flex gap-sm">
              <input
                type="text"
                placeholder="ชื่อผู้เล่น..."
                className="input-field flex-1"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGuest()}
              />
              <button className="btn btn-primary px-lg" onClick={addGuest}>เพิ่ม</button>
            </div>
            {guestNames.length > 0 && (
              <div className="flex flex-wrap gap-xs">
                {guestNames.map(name => (
                  <span key={name} className="px-sm py-xs rounded-lg text-[11px] font-bold bg-glass flex items-center gap-xs">
                    {name}
                    <button onClick={() => removeGuest(name)} className="text-danger">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Player List Summary */}
        <div className="glass-panel-werewolf p-lg">
          <h4 className="text-xs font-black text-secondary uppercase tracking-widest mb-md">👥 รายชื่อผู้เล่น ({allGamePlayers.length} คน)</h4>
          <div className="flex flex-wrap gap-xs">
            {allGamePlayers.map(name => {
              const isGuest = guestNames.includes(name);
              return (
                <span key={name} className={`px-sm py-xs rounded-lg text-xs font-bold border ${isGuest ? 'border-dashed border-secondary/40 text-secondary' : 'border-glass text-white'}`}>
                  {name} {isGuest && '(Guest)'}
                </span>
              );
            })}
          </div>
        </div>

        {/* Deck Setup (GM only) */}
        {isHost && (
          <div className="glass-panel-werewolf p-lg">
            <div className="flex-between mb-md">
              <h4 className="font-black flex items-center gap-sm text-sm">
                🎴 จัดเตรียมการ์ด
                <span className={`px-sm py-xs rounded-lg text-xs font-bold ${totalDeck === allGamePlayers.length ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                  {totalDeck}/{allGamePlayers.length}
                </span>
              </h4>
              <button className="btn btn-glass p-xs text-xs" onClick={() => setShowDeckSetup(!showDeckSetup)}>
                {showDeckSetup ? 'ซ่อน' : 'แสดง'}
              </button>
            </div>

            {showDeckSetup && Object.entries(ROLE_CATEGORIES).map(([teamKey, teamInfo]) => (
              <div key={teamKey} className="mb-md">
                <p className="text-xs font-bold mb-sm" style={{ color: teamInfo.color }}>{teamInfo.name}</p>
                <div className="grid grid-cols-1 gap-xs">
                  {Object.entries(ROLES).filter(([, r]) => r.team === teamKey).map(([roleKey, role]) => {
                    const count = deckCounts[roleKey] || 0;
                    return (
                      <div key={roleKey} className="flex justify-between items-center p-sm bg-glass-dark/30 rounded-lg" style={{ borderLeft: `3px solid ${role.color}` }}>
                        <div className="flex items-center gap-sm overflow-hidden">
                          <span>{role.icon}</span>
                          <span className="text-xs font-bold truncate" style={{ color: role.color }}>{role.name}</span>
                        </div>
                        <div className="flex items-center gap-xs">
                          <button className="w-6 h-6 rounded bg-glass-dark/50 text-white font-bold text-sm flex-center" onClick={() => updateDeckCount(roleKey, -1)}>-</button>
                          <span className="w-5 text-center font-bold text-sm">{count}</span>
                          <button className="w-6 h-6 rounded bg-glass-dark/50 text-white font-bold text-sm flex-center" onClick={() => updateDeckCount(roleKey, 1)}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Public deck display */}
        {totalDeck > 0 && (
          <div className="glass-panel-werewolf p-lg">
            <h4 className="text-xs font-black text-secondary uppercase tracking-widest mb-md">การ์ดที่จะใช้ในเกม</h4>
            <div className="flex flex-wrap gap-xs">
              {Object.entries(deckCounts).filter(([, c]) => c > 0).map(([roleKey, count]) => {
                const role = ROLES[roleKey];
                return (
                  <span key={roleKey} className="px-sm py-xs rounded-lg text-xs font-bold border" style={{ borderColor: `${role.color}60`, color: role.color, background: `${role.color}15` }}>
                    {role.icon} {role.name} x{count}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {isHost ? (
          <button
            className="btn btn-primary w-full py-xl text-xl font-black shadow-xl shadow-primary/20"
            onClick={startGame}
            disabled={
              (gameMode === 'digital' && (allGamePlayers.length < 4 || allGamePlayers.length > 10)) ||
              (gameMode === 'physical' && allGamePlayers.length < 1) ||
              (totalDeck > 0 && totalDeck !== allGamePlayers.length)
            }
          >
            {gameMode === 'digital' && allGamePlayers.length < 4
              ? `รอผู้เล่น (ต้องการอีก ${4 - allGamePlayers.length} คน)`
              : (gameMode === 'digital' && allGamePlayers.length > 10)
                ? `ผู้เล่นเกินกำหนด (ดิจิทัลสูงสุด 10 คน)`
                : totalDeck > 0 && totalDeck !== allGamePlayers.length
                  ? `จัดไพ่ไม่พอดี (${totalDeck}/${allGamePlayers.length})`
                  : '🎭 เริ่มเกม!'}
          </button>
        ) : (
          <div className="glass-panel-werewolf p-md text-center border-primary/30">
            <p className="animate-pulse text-primary font-bold">รอ GM เริ่มเกม...</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Role Reveal Overlay ──────────────────────────────────────────────

  const StarsBackground = () => (
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

  const AmbientMist = () => (
    <div className={`ambient-mist transition-all duration-1000 ${phase === 'night' ? 'opacity-60' : 'opacity-20'}`} 
         style={{ background: phase === 'night' ? 'radial-gradient(circle, rgba(76, 29, 149, 0.2) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(245, 158, 11, 0.1) 0%, transparent 70%)' }} 
    />
  );

  const RoleRevealOverlay = () => {
    const [isFlipped, setIsFlipped] = useState(false);
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
                onClick={() => setIsFlipped(!isFlipped)}
                className={`relative w-64 h-96 preserve-3d transition-transform duration-700 cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
              >
                {/* Front (Back of card design) */}
                <div className="absolute inset-0 backface-hidden glass-panel-werewolf border-4 border-white/20 flex-center rounded-3xl bg-gradient-to-br from-indigo-900 to-black">
                  <div className="text-6xl animate-pulse">🐺</div>
                </div>
                
                {/* Back (Role detail) */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 glass-panel-werewolf border-4 border-indigo-500/50 flex flex-col items-center justify-between p-xl rounded-3xl bg-slate-900">
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
                        {Object.entries(wwData.players || {}).filter(([n, p]) => WOLF_ROLES.includes(p.role) && n !== userNickname).map(([n]) => n).join(', ') || 'Lone Wolf'}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              <button 
                onClick={() => { setShowRoleReveal(false); setIsFlipped(false); }}
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

  const VFXOverlay = () => (
    <div className={`werewolf-vfx-overlay ${vfx.show ? 'animate-shake' : 'hidden'} ${vfx.type}`}>
      <div className="vfx-blood" />
      <div className="vfx-text">{vfx.text}</div>
    </div>
  );

  // ─── Render: Game Result ──────────────────────────────────────────────────────

  if (phase === 'result') {
    const winner = wwData.winnerTeam;
    const wwPlayers = wwData.players || {};

    return (
      <div className="flex flex-col gap-lg w-full animate-fade-in pb-20">
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel-werewolf p-xl text-center">
          <div className="flex-center mb-md">
            <div className={`p-xl rounded-full ${winner === 'werewolf' ? 'bg-danger/20 text-danger' : winner === 'villager' ? 'bg-success/20 text-success' : 'bg-purple-500/20 text-purple-400'}`}>
              {winner === 'werewolf' ? <Skull size={60} /> : winner === 'villager' ? <CheckCircle2 size={60} /> : <Eye size={60} />}
            </div>
          </div>
          <h2 className="text-3xl font-black mb-sm">
            {winner === 'werewolf' ? '🐺 หมาป่าชนะ!' : winner === 'villager' ? '🏘️ ชาวบ้านชนะ!' : '🎭 ฝ่ายอิสระชนะ!'}
          </h2>
          <p className="text-secondary">
            {winner === 'werewolf' ? 'หมู่บ้านตกอยู่ในความมืด...' : winner === 'villager' ? 'หมาป่าทุกตัวถูกจับได้!' : 'ผู้เล่นอิสระบรรลุเป้าหมาย!'}
          </p>
        </motion.div>

        <div className="glass-panel-werewolf p-lg space-y-sm">
          <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-sm">เปิดเผยบทบาท</p>
          {Object.entries(wwPlayers).filter(([, p]) => p.role !== 'gm').map(([name, p]) => {
            const cfg = ROLES[p.role] || ROLES.villager;
            return (
              <div key={name} className={`flex justify-between items-center p-md rounded-xl border ${p.isAlive ? 'bg-glass border-glass' : 'bg-glass-dark/30 border-glass opacity-60'}`}>
                <div className="flex items-center gap-md">
                  <span className="text-xl">{cfg.icon}</span>
                  <span className="font-bold">{name}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.name}</span>
                  {!p.isAlive && <span className="text-danger text-xs ml-sm">💀</span>}
                </div>
              </div>
            );
          })}
        </div>

        {isHost ? (
          <div className="flex flex-col gap-sm w-full">
            <button className="btn btn-primary py-3 px-6 text-[14px] w-full" onClick={handlePlayAgain}>
              🔄 เล่นอีกครั้ง
            </button>
            <button className="btn btn-outline w-full py-lg font-black" onClick={resetToLobby}>กลับสู่ล็อบบี้</button>
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

  // ─── Render: Active Game ──────────────────────────────────────────────────────

  const wwPlayers = wwData.players || {};
  const nightActions = wwData.nightActions || {};

  const phaseLabel = phase === 'night' ? `🌙 คืนที่ ${dayCount}` : phase === 'day' ? `☀️ กลางวันที่ ${dayCount}` : phase === 'voting' ? '🗳️ ถึงเวลาโหวต!' : '🎭 รอเริ่มรอบ';
  const phaseBg = phase === 'night' ? 'border-indigo-500/30' : phase === 'day' ? 'border-orange-400/30' : phase === 'voting' ? 'border-red-400/30' : 'border-glass';

  if (gameMode === 'physical') {
    return (
      <div className="flex flex-col gap-lg w-full animate-fade-in pb-32">
        <StarsBackground />
        <AmbientMist />
        <VFXOverlay />
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <div className={`glass-panel-werewolf p-md flex justify-between items-center ${phaseBg}`}>
          <div className="flex items-center gap-md">
            {phase === 'night' ? <Moon className="text-indigo-400" size={20} /> : <Sun className="text-orange-400" size={20} />}
            <p className="font-black text-white">{phaseLabel}</p>
          </div>
          <div className="text-right">
            {isGM ? <span className="text-xs font-bold text-warning">🎭 GM Dashboard</span> : (
              <span className={`text-xs font-bold ${myIsAlive ? 'text-success' : 'text-danger'}`}>
                {myIsAlive ? '🟢 ยังมีชีวิต' : '💀 ตายแล้ว'}
              </span>
            )}
          </div>
        </div>

        {isGM ? (
          <div className="glass-panel-werewolf p-lg space-y-lg border-warning/20">
            <h3 className="font-black flex items-center gap-sm text-warning">🕹️ ควบคุมเกม (ไพ่จริง)</h3>

            {/* Manual Life/Death Grid (Top level view) */}
            <div className="grid grid-cols-2 gap-sm mb-md">
              {Object.entries(wwPlayers).filter(([, p]) => p.role !== 'gm').map(([name, p]) => (
                <button
                  key={name}
                  onClick={() => togglePlayerAlive(name, !p.isAlive)}
                  className={`flex items-center gap-md p-md rounded-xl border-2 transition-all ${
                    p.isAlive ? 'bg-glass border-glass text-white hover:border-white/20' : 'bg-danger/10 border-danger/30 text-danger opacity-70'
                  }`}
                >
                  <span className="text-sm font-bold truncate flex-1 text-left">{name}</span>
                  {p.isAlive ? <CheckCircle2 size={18} className="text-success" /> : <Skull size={18} />}
                </button>
              ))}
            </div>

            {/* Phase Logic */}
            {phase === 'night' && (
              <div className="space-y-md border-t border-glass pt-md animate-fade-in">
                <div className="p-md bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-center mb-md">
                   <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">Night Step Manager</p>
                   <p className="text-[10px] text-secondary">เรียกบทบาทตามลำดับด้านล่าง และบันทึกผลการกระทำ</p>
                </div>

                {/* Seer Quick View for GM */}
                {wwData.lastSeerResult && (
                  <div className="p-sm bg-purple-500/10 rounded-lg border border-purple-500/30 flex justify-between items-center mb-md">
                    <div className="flex items-center gap-xs">
                       <Eye size={14} className="text-purple-400" />
                       <span className="text-[11px] text-white">ผลการส่องล่าสุด: <strong>{wwData.lastSeerResult.targetName}</strong> คือ <strong>{wwData.lastSeerResult.isWolf ? '🐺 หมาป่า!' : '🏘️ ชาวบ้าน'}</strong></span>
                    </div>
                    <button onClick={clearSeerResults} className="text-[10px] text-secondary hover:text-white underline">ล้าง</button>
                  </div>
                )}

                <div className="space-y-md border-t border-glass pt-md">
                  <p className="text-sm font-bold text-indigo-300 flex items-center gap-sm"><Moon size={16} /> ขั้นตอนการเรียกบทบาท (Physical):</p>
                  <div className="bg-glass-dark/40 rounded-xl p-md border border-indigo-500/20 space-y-md">
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
                        <div className="space-y-lg">
                          <div className="p-sm bg-indigo-500/10 rounded-lg text-center">
                            <p className="text-[11px] font-bold text-indigo-300 uppercase">1. ทุกคนหลับตาลง</p>
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

                          <div className="p-sm bg-orange-400/10 rounded-lg text-center mt-md border border-orange-400/20">
                            <p className="text-xs font-bold text-orange-300 uppercase">{activeRoles.length + 2}. ทุกคนลืมตาขึ้น... เข้าสู่ตอนเช้า</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Night Kill Section */}
                <div className="bg-danger/10 rounded-xl p-md border border-danger/20 space-y-md">
                  <p className="text-sm font-bold text-danger flex items-center gap-xs"><Skull size={16} /> บันทึกผู้เสียชีวิตในคืนนี้:</p>
                  
                  {/* Suggested Results based on nightActions */}
                  {(() => {
                    const result = resolveNightActions(nightActions, { 
                      players: wwPlayers, 
                      lovers: wwData.lovers, 
                      hunterPending: wwData.hunterPending 
                    });
                    if (!result.finalEliminated) return null;
                    return (
                      <div className="p-sm bg-danger/20 rounded-lg border border-danger/40 mb-sm">
                        <p className="text-[11px] font-black text-danger uppercase mb-xs">💡 ระบบวิเคราะห์ผู้ตาย:</p>
                        {result.finalEliminated.map(name => (
                          <div key={name} className="flex justify-between items-center">
                             <span className="text-xs font-bold text-white">{name}</span>
                             <button 
                               onClick={() => togglePlayerAlive(name, false)}
                               className="btn btn-danger py-xs px-sm text-[10px]"
                             >
                               ยืนยันการตาย
                             </button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <p className="text-[11px] text-danger/80 leading-tight mb-sm">แตะที่ชื่อผู้เล่นเพื่อทำการยืนยันการตาย (สามารถกดซ้ำที่กริดด้านบนเพื่อยกเลิกได้)</p>
                  <div className="grid grid-cols-2 gap-sm">
                    {Object.entries(wwPlayers).filter(([, p]) => p.role !== 'gm' && p.isAlive).map(([name, p]) => (
                      <button
                        key={name}
                        onClick={() => {
                          if(confirm(`ยืนยันการสังหาร ${name} ในคืนนี้ใช่หรือไม่?`)) {
                             togglePlayerAlive(name, false);
                          }
                        }}
                        className="flex justify-between items-center p-md bg-glass border border-danger/30 rounded-xl hover:bg-danger/20 active:scale-95 transition-all text-white group"
                      >
                         <span className="font-bold text-sm truncate">{name}</span>
                         <span className="text-lg opacity-50 group-hover:opacity-100 group-hover:text-danger drop-shadow-md">🔪</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button className="btn btn-primary w-full py-lg font-black text-lg shadow-lg shadow-primary/20" onClick={resolveNightToDay}>☀️ ประกาศผลตอนเช้า</button>
              </div>
            )}

            {phase === 'day' && (
              <div className="space-y-md border-t border-glass pt-md">
                <div className="text-center p-lg bg-orange-400/10 rounded-xl border border-orange-400/30 shadow-inner">
                  <p className="text-lg font-black text-orange-400 mb-xs flex-center gap-sm"><Sun size={20} /> โหวตแขวนคอ</p>
                  <p className="text-xs text-secondary mb-lg leading-relaxed">ให้ทุกคนอภิปรายและโหวตแขวนคอ 1 คน <br/> <strong className="text-white">แตะที่ชื่อด้านล่างเพื่อประหารผู้เล่นที่ถูกโหวต</strong></p>
                  
                  <div className="grid grid-cols-2 gap-sm text-left">
                    {Object.entries(wwPlayers).filter(([, p]) => p.role !== 'gm' && p.isAlive).map(([name, p]) => (
                      <button
                        key={name}
                        onClick={() => {
                          if(confirm(`ยืนยันการแขวนคอ ${name} ใช่หรือไม่?`)) {
                             togglePlayerAlive(name, false);
                          }
                        }}
                        className="flex justify-between items-center p-md bg-glass-dark/50 border border-orange-500/30 rounded-xl hover:border-danger hover:bg-danger/20 active:scale-95 transition-all text-white group"
                      >
                         <span className="font-bold text-sm truncate">{name}</span>
                         <span className="text-xl opacity-40 group-hover:opacity-100 group-hover:text-danger drop-shadow-md">🪢</span>
                      </button>
                    ))}
                  </div>
                </div>
                <button className="btn btn-primary w-full py-lg font-black text-lg shadow-lg shadow-primary/20" onClick={startNextNight}>🌙 ข้ามโหวต / เริ่มคืนถัดไป</button>
              </div>
            )}

            {/* Manual Winner Buttons */}
            <div className="border-t border-glass pt-md">
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-sm">ประกาศผลผู้ชนะ / สรุปเกม</p>
              <div className="flex gap-xs">
                <button className="flex-1 btn btn-glass py-sm text-[10px] text-success border-success/20" onClick={() => announceWinner('villager')}>🏘️ ชาวบ้านชนะ</button>
                <button className="flex-1 btn btn-glass py-sm text-[10px] text-danger border-danger/20" onClick={() => announceWinner('werewolf')}>🐺 หมาป่าชนะ</button>
                <button className="flex-1 btn btn-glass py-sm text-[10px] text-purple-400 border-purple-400/20" onClick={() => announceWinner('independent')}>🎭 อิสระชนะ</button>
              </div>
            </div>

            <div className="border-t border-warning/30 pt-md mt-md">
              <button 
                className="btn btn-outline w-full py-md font-bold text-danger border-danger/30 hover:bg-danger/10" 
                onClick={async () => {
                  if(confirm('ต้องการจบเกมและกลับสู่ล็อบบี้ใช่หรือไม่?')) {
                    await resetToLobby();
                  }
                }}
              >
                <LogOut size={16} className="inline mr-2" /> จบเกม (กลับสู่ล็อบบี้)
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-panel-werewolf p-xl text-center space-y-md">
            <div className="text-5xl animate-pulse">
              {phase === 'night' ? '🌙' : '☀️'}
            </div>
            <h3 className="text-xl font-black">
              {phase === 'night' ? 'ถึงเวลากลางคืน' : 'ถึงเวลากลางวัน'}
            </h3>
            <p className="text-secondary text-sm">
              {phase === 'night' ? 'หลับตาลงและทำตามที่ GM บอก...' : 'ลืมตาขึ้นและพูดคุยหาตัวหมาป่า!'}
            </p>
            <div className={`p-md rounded-2xl border-2 ${myIsAlive ? 'bg-success/5 border-success/20 text-success' : 'bg-danger/5 border-danger/20 text-danger'}`}>
              <p className="font-bold">{myIsAlive ? 'คุณยังมีชีวิตอยู่' : 'คุณเสียชีวิตแล้ว'}</p>
            </div>
            
            <div className="pt-md mt-md border-t border-glass">
              <button 
                className="btn btn-outline w-full py-md font-bold text-danger border-danger/30 hover:bg-danger/10"
                onClick={requestLeave}
              >
                <LogOut size={16} className="inline mr-2" /> ออกจากห้อง
              </button>
            </div>
          </div>
        )}

        {/* Player List Sidebar */}
        <div className="glass-panel-werewolf p-md">
          <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-sm">👥 ผู้เล่นทั้งหมด ({Object.values(wwPlayers).filter(p => p.role !== 'gm').length} คน)</p>
          <div className="flex flex-wrap gap-xs">
            {Object.entries(wwPlayers).filter(([, p]) => p.role !== 'gm').map(([name, p]) => (
              <span key={name} className={`px-sm py-xs rounded-lg text-xs font-bold border ${!p.isAlive ? 'opacity-40 line-through border-glass text-secondary' : 'border-glass text-white'}`}>
                {!p.isAlive && '💀 '}{name}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Digital Mode UI (Original) ───
  return (
    <div className="flex flex-col gap-lg w-full animate-fade-in pb-32">
      <StarsBackground />
      <AmbientMist />
      <VFXOverlay />
      <RoleRevealOverlay />

      {/* Phase Banner */}
      <div className={`glass-panel-werewolf p-md flex justify-between items-center ${phaseBg}`}>
        <div className="flex items-center gap-md">
          {phase === 'night' ? <Moon className="text-indigo-400" size={20} /> : phase === 'day' ? <Sun className="text-orange-400" size={20} /> : <Users className="text-red-400" size={20} />}
          <div>
            <p className="font-black text-white">{phaseLabel}</p>
          </div>
          {wwData.timerEnd && (
            <div className="ml-2">
              <TimerDisplay timeLeft={timeLeft} />
            </div>
          )}
        </div>
        <div className="text-right">
          {!isGM && (
            <div className="flex items-center gap-sm">
              <span className="text-xl">{roleInfo?.icon || '🎭'}</span>
              <span className={`text-xs font-bold ${myIsAlive ? 'text-success' : 'text-danger'}`}>
                {myIsAlive ? 'มีชีวิต' : '💀 ตาย'}
              </span>
            </div>
          )}
          {isGM && <span className="text-xs font-bold text-warning">🎭 GM</span>}
        </div>
      </div>

      {/* Last Elimination Banner */}
      {wwData.lastElimination && wwData.lastElimination.playerName && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel-werewolf p-md text-center border-danger/30 bg-danger/5">
          <p className="text-danger font-bold text-sm">
            {wwData.lastElimination.reason === 'vote' && `🗳️ ${wwData.lastElimination.playerName} ถูกโหวตไล่ออก!`}
            {wwData.lastElimination.reason === 'prince_saved' && `👑 ${wwData.lastElimination.playerName} ถูกโหวต แต่เจ้าชายรอดชีวิต!`}
            {wwData.lastElimination.reason === 'tie' && '🗳️ โหวตเสมอ! ไม่มีผู้ถูกกำจัด'}
            {wwData.lastElimination.reason === 'skipped' && '⏭️ GM ข้ามรอบโหวต'}
          </p>
        </motion.div>
      )}

      {/* GM Panel */}
      {isGM && (
        <div className="glass-panel-werewolf p-lg space-y-lg border-warning/20">
          <h3 className="font-black flex items-center gap-sm text-warning">🎭 แผงควบคุม GM</h3>

          {/* Player Status Table */}
          <div className="space-y-xs max-h-60 overflow-y-auto">
            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">สถานะผู้เล่น</p>
            {Object.entries(wwPlayers).filter(([, p]) => p.role !== 'gm').map(([name, p]) => {
              const cfg = ROLES[p.role] || ROLES.villager;
              const isDead = !p.isAlive;
              return (
                <div key={name} className={`flex items-center gap-sm p-sm rounded-lg ${isDead ? 'opacity-50 bg-glass-dark/20' : 'bg-glass-dark/30'}`}>
                  <span className="text-sm">{cfg.icon}</span>
                  <span className="flex-1 text-xs font-bold truncate">{name}</span>
                  <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{cfg.name}</span>
                  {p.status?.silenced && <span className="text-xs">🤐</span>}
                  {p.status?.banned && <span className="text-xs">🚫</span>}
                  {p.status?.lover && <span className="text-xs">💘</span>}
                  <button
                    className={`px-sm py-xs rounded text-[10px] font-bold ${isDead ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}
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
            <div className="space-y-md border-t border-glass pt-md">
              <p className="text-xs font-bold text-indigo-300">🌙 บทบาทคืนนี้ (GM เลือกให้)</p>
              {(() => {
                // Only include roles where at least one alive player has that role
                const activeRoles = Array.from(new Set(
                  Object.values(wwPlayers)
                    .filter(p => p.isAlive && p.role !== 'gm')
                    .map(p => p.role)
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
                const targets = Object.entries(wwPlayers).filter(([, p]) => p.isAlive && p.role !== 'gm');

                return actionKeys.map(actionKey => {
                  const cfg = ROLES[actionKey] || ROLES.villager;
                  const isDone = !!nightActions[`${actionKey}TargetDone`];
                  const chosenTarget = nightActions[`${actionKey}Target`];

                  // Label & color per action type
                  let actionLabel = 'เลือกเป้าหมาย';
                  const doneLabel = `→ ${chosenTarget === 'skip' ? 'ข้าม' : chosenTarget}`;
                  let cardBorder = 'border-indigo-500/20';
                  if (WOLF_ROLES.includes(actionKey)) { actionLabel = '🔪 ฆ่า'; cardBorder = 'border-danger/30'; }
                  else if (actionKey === 'bodyguard') { actionLabel = '🛡️ ปกป้อง'; cardBorder = 'border-success/30'; }
                  else if (['seer', 'apprentice_seer', 'mystic_wolf', 'aura_seer'].includes(actionKey)) { actionLabel = '🔮 ส่อง'; cardBorder = 'border-purple-400/30'; }

                  return (
                    <div key={actionKey} className={`bg-glass-dark/40 rounded-xl p-sm border ${cardBorder}`}>
                      <div className="flex items-center justify-between mb-xs">
                        <span className="text-xs font-bold" style={{ color: cfg.color }}>
                          {cfg.icon} {WOLF_ROLES.includes(actionKey) ? 'หมาป่า' : cfg.name} — {actionLabel}
                        </span>
                        {isDone && (
                          <span className="text-[10px] font-bold text-success">✅ {doneLabel}</span>
                        )}
                      </div>
                      {!isDone ? (
                        <div className="flex flex-wrap gap-xs">
                          {targets.map(([name]) => (
                            <button
                              key={name}
                              className="px-sm py-xs rounded-lg text-[11px] font-bold border border-glass bg-glass-dark/50 text-white active:scale-95 transition-all"
                              onClick={() => gmSubmitForRole(actionKey, name)}
                            >
                              {name}
                            </button>
                          ))}
                          <button
                            className="px-sm py-xs rounded-lg text-[11px] font-bold border border-glass text-secondary active:scale-95 transition-all"
                            onClick={() => gmSubmitForRole(actionKey, 'skip')}
                          >
                            ข้าม
                          </button>
                        </div>
                      ) : (
                        <button
                          className="text-[10px] text-secondary underline"
                          onClick={async () => {
                            await safeUpdate(`rooms/${roomId}/gameData/wwData`, {
                              [`nightActions/${actionKey}Target`]: null,
                              [`nightActions/${actionKey}TargetDone`]: null,
                            });
                          }}
                        >
                          เปลี่ยน
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
                  <div className="bg-glass-dark/30 rounded-xl p-sm space-y-xs border border-glass">
                    <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">สรุปคืนนี้ (มองเห็นแค่ GM)</p>
                    {killed && killed !== 'skip' && (
                      <p className="text-xs font-bold text-danger">🔪 หมาป่าฆ่า: <span className="text-white">{killed}</span>
                        {protected_ === killed && <span className="text-success ml-xs">→ ถูกปกป้อง! รอด</span>}
                      </p>
                    )}
                    {protected_ && protected_ !== 'skip' && (
                      <p className="text-xs font-bold text-success">🛡️ บอดี้การ์ดปกป้อง: <span className="text-white">{protected_}</span></p>
                    )}
                    {seen && seen !== 'skip' && seenRole && (
                      <p className={`text-xs font-bold ${isWolf ? 'text-danger' : 'text-success'}`}>
                        🔮 ส่อง: <span className="text-white">{seen}</span> = {isWolf ? '🐺 หมาป่า' : '✅ ไม่ใช่หมาป่า'} ({ROLES[seenRole]?.name || seenRole})
                      </p>
                    )}
                  </div>
                );
              })()}

              <button className="btn btn-primary w-full py-md font-bold" onClick={resolveNightToDay}>☀️ เข้าสู่กลางวัน</button>
            </div>
          )}

          {/* Day Controls */}
          {phase === 'day' && (
            <div className="flex gap-sm border-t border-glass pt-md">
              <button className="btn btn-danger flex-1 py-md font-bold" onClick={startVotingPhase}>🗳️ เริ่มโหวต</button>
            </div>
          )}

          {/* Voting Controls */}
          {phase === 'voting' && (
            <div className="space-y-sm border-t border-glass pt-md">
              <p className="text-xs font-bold text-red-300">ผลโหวตปัจจุบัน</p>
              {Object.entries(wwPlayers).filter(([, p]) => p.isAlive && p.role !== 'gm').map(([name, p]) => {
                const voteCount = Object.values(wwPlayers).filter(pp => pp.vote === name).reduce((acc, pp) => acc + (pp.role === 'mayor' ? 2 : 1), 0);
                return voteCount > 0 ? (
                  <div key={name} className="flex justify-between items-center p-sm bg-glass-dark/30 rounded-lg">
                    <span className="text-xs font-bold">{name}</span>
                    <span className="text-danger font-bold text-xs">{voteCount} โหวต</span>
                  </div>
                ) : null;
              })}
              <div className="flex gap-sm">
                <button className="btn btn-danger flex-1 py-md font-bold" onClick={resolveVotes}>✅ อนุมัติผลโหวต</button>
                <button className="btn btn-glass flex-1 py-md font-bold" onClick={gmSkipVote}>⏭️ ข้าม</button>
              </div>
            </div>
          )}

          {/* Standby Controls */}
          {phase === 'standby' && (
            <div className="space-y-sm border-t border-glass pt-md">
              <button className="btn btn-primary w-full py-md font-bold" onClick={startNextNight}>🌙 เริ่มคืนถัดไป</button>
              <div className="flex gap-sm">
                <button className="btn btn-glass flex-1 py-sm text-xs font-bold" onClick={() => announceWinner('villager')}>🏘️ ชาวบ้านชนะ</button>
                <button className="btn btn-glass flex-1 py-sm text-xs font-bold" onClick={() => announceWinner('werewolf')}>🐺 หมาป่าชนะ</button>
                <button className="btn btn-glass flex-1 py-sm text-xs font-bold" onClick={() => announceWinner('independent')}>🎭 อิสระชนะ</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Player View */}
      {!isGM && (
        <>
          {/* Role Card */}
          <div className="glass-panel-werewolf p-lg flex items-center gap-md cursor-pointer" onClick={() => setShowRoleReveal(true)} style={{ borderLeft: `4px solid ${roleInfo?.color || '#666'}` }}>
            <span className="text-3xl">{roleInfo?.icon || '❓'}</span>
            <div className="flex-1">
              <p className="font-black" style={{ color: roleInfo?.color }}>{roleInfo?.name || 'ไม่ทราบ'}</p>
              <p className="text-[10px] text-secondary">{roleInfo?.description || ''}</p>
            </div>
            <Info size={16} className="text-secondary" />
          </div>

          {/* Wolf allies */}
          {WOLF_ROLES.includes(myRole) && (
            <div className="glass-panel-werewolf p-md border-danger/30 bg-danger/5">
              <p className="text-xs text-danger font-bold">🐺 เพื่อนหมาป่า: {Object.entries(wwPlayers).filter(([n, p]) => WOLF_ROLES.includes(p.role) && n !== userNickname && p.role !== 'gm').map(([n]) => n).join(', ') || 'ไม่มี'}</p>
            </div>
          )}

          {/* Seer Result */}
          {['seer', 'apprentice_seer', 'mystic_wolf', 'aura_seer'].includes(myRole) && wwData.privateData?.[userNickname]?.seerResult && (
            <div className={`glass-panel-werewolf p-md text-center ${wwData.privateData[userNickname].seerResult.isWolf ? 'border-danger/30 bg-danger/5' : 'border-success/30 bg-success/5'}`}>
              <p className="text-xs font-bold text-secondary mb-xs">🔮 ผลการส่อง</p>
              <p className="font-bold">
                {wwData.privateData[userNickname].seerResult.targetName} คือ{' '}
                <span className={wwData.privateData[userNickname].seerResult.isWolf ? 'text-danger' : 'text-success'}>
                  {wwData.privateData[userNickname].seerResult.isWolf ? '🐺 หมาป่า!' : '✅ ไม่ใช่หมาป่า'}
                </span>
              </p>
            </div>
          )}

          {/* Night: Action Panel */}
          {phase === 'night' && myIsAlive && (
            <div className="glass-panel-werewolf p-lg">
              {(() => {
                const cfg = ROLES[myRole];
                if (!cfg || cfg.actionPhase === 'none' || (cfg.actionPhase === 'firstNight' && dayCount > 1)) {
                  return (
                    <div className="text-center p-lg">
                      <div className="text-4xl mb-md animate-pulse">🌙</div>
                      <p className="text-secondary font-bold">กำลังหลับอยู่... ไม่ต้องทำอะไรในคืนนี้</p>
                    </div>
                  );
                }

                const isDone = !!nightActions[`${myRole}TargetDone`];
                if (isDone) {
                  return (
                    <div className="text-center p-lg">
                      <div className="text-4xl mb-md">✅</div>
                      <p className="text-success font-bold">ส่งการกระทำแล้ว รอ GM ประกาศผล</p>
                    </div>
                  );
                }

                // Show targets
                const targets = Object.entries(wwPlayers).filter(([name, p]) => {
                  if (!p.isAlive || p.role === 'gm') return false;
                  if (name === userNickname && myRole !== 'bodyguard') return false;
                  if (cfg.team === 'werewolf' && WOLF_ROLES.includes(p.role) && name !== userNickname) return false;
                  return true;
                });

                return (
                  <div className="space-y-md">
                    <p className="text-xs font-bold text-indigo-300">{cfg.icon} ถึงตาคุณแล้ว — เลือกเป้าหมาย:</p>
                    <div className="grid grid-cols-2 gap-sm">
                      {targets.map(([name]) => (
                        <button
                          key={name}
                          className={`p-md rounded-xl border flex-center flex-col gap-xs transition-all ${selectedTarget === name ? 'border-primary bg-primary/20 scale-95' : 'border-glass bg-glass-dark/30'}`}
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
                          <span className="font-bold text-sm">{name}</span>
                        </button>
                      ))}
                    </div>
                    <button className="btn btn-glass w-full py-sm text-xs font-bold" onClick={() => submitNightAction(myRole, 'skip')}>
                      ข้าม (ไม่ใช้พลัง)
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Night: Dead */}
          {phase === 'night' && !myIsAlive && (
            <div className="glass-panel-werewolf p-lg text-center opacity-60">
              <p className="text-danger font-bold">💀 คุณเสียชีวิตแล้ว — รอชมเกมต่อ</p>
            </div>
          )}

          {/* Day Panel */}
          {phase === 'day' && (
            <div className="glass-panel-werewolf p-lg text-center">
              {myIsAlive ? (
                myPlayerData?.status?.silenced ? (
                  <div>
                    <div className="text-3xl mb-md">🤐</div>
                    <p className="text-purple-400 font-bold">คุณถูกปิดปาก! ห้ามพูดหรือโหวตวันนี้</p>
                  </div>
                ) : myPlayerData?.status?.banned ? (
                  <div>
                    <div className="text-3xl mb-md">🚫</div>
                    <p className="text-secondary font-bold">คุณถูกแบน! ไม่มีสิทธิ์โหวตวันนี้</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-3xl mb-md">☀️</div>
                    <p className="text-orange-300 font-bold">คุยกันและค้นหาหมาป่า!</p>
                    <p className="text-secondary text-xs mt-sm">รอ GM เริ่มโหวต</p>
                  </div>
                )
              ) : (
                <p className="text-danger font-bold">💀 คุณเสียชีวิตแล้ว</p>
              )}
            </div>
          )}

          {/* Voting Panel */}
          {phase === 'voting' && (
            <div className="glass-panel-werewolf p-lg space-y-md">
              <p className="text-xs font-bold text-red-300 uppercase tracking-widest">🗳️ เลือกคนที่จะแขวนคอ</p>
              {myIsAlive && !myPlayerData?.status?.silenced && !myPlayerData?.status?.banned ? (
                <div className="grid grid-cols-2 gap-sm">
                  {Object.entries(wwPlayers).filter(([name, p]) => p.isAlive && p.role !== 'gm' && name !== userNickname).map(([name]) => {
                    const isSelected = myPlayerData?.vote === name;
                    const voteCount = Object.values(wwPlayers).filter(p => p.vote === name).length;
                    return (
                      <button
                        key={name}
                        onClick={() => castVote(name)}
                        className={`p-md rounded-xl border flex flex-col items-center gap-xs relative transition-all ${isSelected ? 'border-danger bg-danger/20 scale-95' : 'border-glass bg-glass-dark/30'}`}
                        disabled={!!myPlayerData?.vote}
                      >
                        <span className="font-bold text-sm">{name}</span>
                        {voteCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger rounded-full flex-center text-[10px] font-black">{voteCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-lg opacity-60">
                  <p className="text-danger font-bold">
                    {!myIsAlive ? '💀 วิญญาณไม่มีสิทธิ์โหวต' : myPlayerData?.status?.silenced ? '🤐 คุณถูกปิดปาก' : '🚫 คุณถูกแบน'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Standby */}
          {phase === 'standby' && (
            <div className="glass-panel-werewolf p-lg text-center">
              <div className="text-3xl mb-md">🎭</div>
              <p className="text-secondary font-bold">รอ GM เริ่มรอบต่อไป...</p>
            </div>
          )}
        </>
      )}

      {/* Player List Sidebar */}
      <div className="glass-panel-werewolf p-md">
        <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-sm">👥 ผู้เล่น</p>
        <div className="flex flex-wrap gap-xs">
          {Object.entries(wwPlayers).filter(([, p]) => p.role !== 'gm').map(([name, p]) => (
            <span key={name} className={`px-sm py-xs rounded-lg text-xs font-bold border ${!p.isAlive ? 'opacity-40 line-through border-glass text-secondary' : name === userNickname ? 'border-primary/40 text-primary bg-primary/10' : 'border-glass text-white'}`}>
              {!p.isAlive && '💀 '}{name}
              {isGM && WOLF_ROLES.includes(p.role) && <span className="text-danger ml-xs">🐺</span>}
            </span>
          ))}
        </div>
      </div>


      {/* Show Role button (non-GM) */}
      {!isGM && (
        <button className="btn btn-glass w-full py-sm text-xs font-bold" onClick={() => setShowRoleReveal(true)}>
          <Eye size={14} /> ดูบทบาทอีกครั้ง
        </button>
      )}

      {errorMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-danger/90 text-white px-lg py-sm rounded-xl text-sm font-bold shadow-xl animate-fade-in">
          {errorMsg}
        </div>
      )}
    </div>
  );
};

export default Werewolf;
