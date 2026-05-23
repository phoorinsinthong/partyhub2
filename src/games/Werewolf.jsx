import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, update, onValue, get } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { Moon, Sun, Eye, Shield, Skull, Users, Play, RefreshCw, CheckCircle2, XCircle, AlertCircle, Info, ChevronRight, Timer, Volume2, VolumeX, LogOut } from 'lucide-react';
import { recordWin } from '../components/Scoreboard';
import { recordPersonalWin, recordPersonalGame } from '../components/PersonalStats';
import { useGameLeave } from '../hooks/useGameLeave';
import LeaveConfirmModal from '../components/LeaveConfirmModal';

// ─── Role Configuration (30+ roles) ──────────────────────────────────────────

const ROLES = {
  // VILLAGER TEAM
  villager: { name: "ชาวบ้าน", icon: "🏘️", team: "villager", color: "#f59e0b", actionPhase: "none", description: "ไม่มีพลังพิเศษ โหวตไล่หมาป่าในตอนกลางวัน" },
  seer: { name: "เทพพยากรณ์", icon: "🔮", team: "villager", color: "#a78bfa", actionPhase: "nightly", actionType: "target", description: "ในแต่ละคืน เลือกตรวจผู้เล่น 1 คนว่าเป็นหมาป่าหรือไม่" },
  apprentice_seer: { name: "หมอดูฝึกหัด", icon: "👓", team: "villager", color: "#8b5cf6", actionPhase: "nightly", actionType: "target", description: "เป็นชาวบ้านจนกว่าหมอดูจริงจะตาย จึงจะได้รับพลังหมอดูมาแทน" },
  aura_seer: { name: "ผู้หยั่งรู้ออร่า", icon: "✨", team: "villager", color: "#c4b5fd", actionPhase: "nightly", actionType: "target", description: "ตื่นตอนกลางคืนเพื่อตรวจสอบว่าผู้เล่น 1 คนมีบทบาทพิเศษหรือไม่" },
  beholder: { name: "ผู้สังเกตการณ์", icon: "👁️", team: "villager", color: "#7c3aed", actionPhase: "none", description: "ลืมตาในคืนแรกเพื่อดูว่าใครคือหมอดู" },
  bodyguard: { name: "บอดี้การ์ด", icon: "🛡️", team: "villager", color: "#10b981", actionPhase: "nightly", actionType: "target", description: "ปกป้องผู้เล่น 1 คนต่อคืน (ห้ามป้องกันคนเดิมซ้ำติดกัน 2 คืน)" },
  cupid: { name: "กามเทพ", icon: "💘", team: "villager", color: "#f43f5e", actionPhase: "firstNight", actionType: "target2", description: "คืนแรกเลือก 2 คนให้เป็นคู่รัก หากตาย 1 คน อีกคนจะตายตาม" },
  diseased: { name: "ผู้ป่วย", icon: "🤒", team: "villager", color: "#84cc16", actionPhase: "none", description: "หากถูกหมาป่ากัด หมาป่าจะติดเชื้อและล่าใครไม่ได้ในคืนถัดไป" },
  drunk: { name: "คนเมา", icon: "🍺", team: "villager", color: "#fde047", actionPhase: "none", description: "ไม่รู้บทบาทที่แท้จริงจนกว่าจะถึงคืนที่ 3" },
  hunter: { name: "พรานป่า", icon: "🔫", team: "villager", color: "#ea580c", actionPhase: "none", description: "เมื่อตายสามารถลากผู้เล่นคนอื่นให้ตายตามไปด้วย 1 คน" },
  lycan: { name: "ลูกครึ่งหมาป่า", icon: "🐺", team: "villager", color: "#991b1b", actionPhase: "none", description: "เป็นชาวบ้าน แต่ถ้าหมอดูส่องจะเห็นเป็นหมาป่า" },
  mason: { name: "ช่างก่อสร้าง", icon: "🧱", team: "villager", color: "#9ca3af", actionPhase: "none", description: "ลืมตาคืนแรกเพื่อมองหาเพื่อน Mason ด้วยกัน" },
  mayor: { name: "นายกเทศมนตรี", icon: "🏵️", team: "villager", color: "#fcd34d", actionPhase: "none", description: "เสียงโหวตแขวนคอของคุณนับเป็น 2 เสียง" },
  old_hag: { name: "หญิงชรา", icon: "👵", team: "villager", color: "#4b5563", actionPhase: "nightly", actionType: "target", description: "แบนไม่ให้ผู้เล่น 1 คนมีสิทธิ์โหวตในวันถัดไป" },
  prince: { name: "เจ้าชาย", icon: "👑", team: "villager", color: "#fbbf24", actionPhase: "none", description: "หากถูกโหวตตาย จะรอดชีวิตจากการถูกแขวนคอ 1 ครั้ง" },
  spellcaster: { name: "ผู้ร่ายเวทย์", icon: "🤐", team: "villager", color: "#8b5cf6", actionPhase: "nightly", actionType: "target", description: "ปิดปากผู้เล่น 1 คนกลางคืน ทำให้ตอนเช้าห้ามพูดและห้ามออกเสียง" },
  tough_guy: { name: "จอมอึด", icon: "💪", team: "villager", color: "#b45309", actionPhase: "none", description: "ทนทานการกัดของหมาป่าได้ 1 วัน ค่อยไปขาดใจตายเอาในคืนถัดไป" },
  witch: { name: "แม่มด", icon: "🧹", team: "villager", color: "#d946ef", actionPhase: "nightly", actionType: "extra", description: "มียาชุบชีวิต 1 ขวด และยาพิษ 1 ขวด (ใช้อย่างละ 1 ครั้ง)" },

  // WEREWOLF TEAM
  werewolf: { name: "มนุษย์หมาป่า", icon: "🐺", team: "werewolf", color: "#ef4444", actionPhase: "nightly", actionType: "target", description: "ร่วมมือกับหมาป่าตัวอื่นโหวตล่าเหยื่อตอนกลางคืน" },
  alpha_wolf: { name: "จ่าฝูงหมาป่า", icon: "👑🐺", team: "werewolf", color: "#b91c1c", actionPhase: "nightly", actionType: "target", description: "ถ้าตาย ฝูงหมาป่าจะเสียขวัญไม่ออกล่าเหยื่อ 1 คืน" },
  dire_wolf: { name: "หมาป่าโลกันต์", icon: "🔥🐺", team: "werewolf", color: "#dc2626", actionPhase: "firstNight", actionType: "target", description: "คืนแรกสาบานตนคู่กับสหาย 1 คน หากสหายตาย คุณตายด้วย" },
  lone_wolf: { name: "หมาป่าเดียวดาย", icon: "👤🐺", team: "werewolf", color: "#7f1d1d", actionPhase: "nightly", actionType: "target", description: "ชนะก็ต่อเมื่อเป็นหมาป่าตัวสุดท้ายที่รอดชีวิต" },
  minion: { name: "สมุนหมาป่า", icon: "🦹", team: "werewolf", color: "#9f1239", actionPhase: "none", description: "รู้ว่าหมาป่าคือใคร ป่วนโหวต และทดสอบเป็นชาวบ้านให้หมอดูเห็น" },
  mystic_wolf: { name: "หมาป่าผู้หยั่งรู้", icon: "👁️🐺", team: "werewolf", color: "#4f46e5", actionPhase: "nightly", actionType: "target", description: "สามารถออกส่องบทบาทที่แท้จริงของผู้เล่น 1 คนได้เหมือนหมอดู" },
  sorceress: { name: "แม่มดแห่งความมืด", icon: "🔮🐺", team: "werewolf", color: "#6366f1", actionPhase: "nightly", actionType: "target", description: "ตื่นมาทายหาหมอดู (ส่องดูเพื่อหาว่าใครคือหมอดู)" },
  wolf_cub: { name: "ลูกหมาป่า", icon: "🐾🐺", team: "werewolf", color: "#f87171", actionPhase: "nightly", actionType: "target", description: "หากตาย คืนถัดไปหมาป่าจะโกรธแค้นและล่าเหยื่อได้ถึง 2 คน" },
  wolf_man: { name: "หมาป่ามนุษย์", icon: "🤵🐺", team: "werewolf", color: "#b91c1c", actionPhase: "nightly", actionType: "target", description: "ถ้าหมอดูส่อง จะเห็นคุณเป็นชาวบ้านธรรมดา" },

  // INDEPENDENT TEAM
  cursed: { name: "ผู้ต้องสาป", icon: "🧟", team: "independent", color: "#6b7280", actionPhase: "none", description: "เมื่อโดนหมาป่ากัดจะไม่ตาย แต่กลับกลายเป็น 1 ในฝูงหมาป่าแทน" },
  serial_killer: { name: "ฆาตกรต่อเนื่อง", icon: "🔪", team: "independent", color: "#dc2626", actionPhase: "nightly", actionType: "target", description: "ในแต่ละคืนตื่นมาลอบฆ่าใครก็ได้ ชนะเมื่อรอดเป็นคนสุดท้าย" },
  tanner: { name: "ยาจก", icon: "😤", team: "independent", color: "#ca8a04", actionPhase: "none", description: "ชนะเพียงคนเดียวเมื่อยุยงให้ทุกคนโหวตประหารตัวเองเอาไว้ได้" },
  vampire: { name: "แวมไพร์", icon: "🧛", team: "independent", color: "#9f1239", actionPhase: "nightly", actionType: "target", description: "กัดคืนละคน เหยื่อจะเป็นแวมไพร์ ชนะเมื่อมีจำนวนแวมไพร์เยอะที่สุด" },
  cult_leader: { name: "เจ้าลัทธิ", icon: "🛐", team: "independent", color: "#8b5cf6", actionPhase: "nightly", actionType: "target", description: "ดึงคนเข้าลัทธิคืนละ 1 คน ชนะทันทีเมื่อมีเพื่อนร่วมลัทธิทุกคน" },
};

const WOLF_ROLES = ["werewolf", "alpha_wolf", "dire_wolf", "lone_wolf", "mystic_wolf", "wolf_cub", "wolf_man"];

const ROLE_CATEGORIES = {
  villager: { name: "ฝ่ายชาวบ้าน", color: "#f59e0b" },
  werewolf: { name: "ฝ่ายหมาป่า", color: "#ef4444" },
  independent: { name: "อิสระ/อื่นๆ", color: "#8b5cf6" },
};

function checkWinCondition(playersData) {
  const alive = Object.entries(playersData).filter(([, p]) => p.isAlive && p.role !== 'gm');
  const wolves = alive.filter(([, p]) => WOLF_ROLES.includes(p.role));
  const nonWolves = alive.filter(([, p]) => !WOLF_ROLES.includes(p.role));

  // Serial killer wins alone when only they remain
  const serialKillers = alive.filter(([, p]) => p.role === 'serial_killer');
  if (serialKillers.length > 0 && alive.length === serialKillers.length) return 'independent';

  // Tanner win is event-driven (triggered on vote), not checked here

  // Vampire wins when they outnumber all others
  const vampires = alive.filter(([, p]) => p.role === 'vampire');
  if (vampires.length > 0 && vampires.length >= alive.length - vampires.length) return 'independent';

  // Cult leader wins when all alive are cult members — cult_leader converts via nightAction,
  // so GM must manually announce; skip auto-check here to avoid false positives

  if (wolves.length === 0) return 'villager';
  if (wolves.length >= nonWolves.length) return 'werewolf';
  return null;
}

// ─── Main Component ──────────────────────────────────────────────────────────

const Werewolf = ({ roomId, roomData, userNickname }) => {
  const navigate = useNavigate();
  const { requestLeave, confirmLeave, cancelLeave, showConfirm } = useGameLeave(roomId, userNickname);
  const isHost = roomData.host === userNickname;
  const gameData = roomData.gameData || {};
  const players = roomData.players || {};
  const playerNames = Object.keys(players);

  const wwData = gameData.wwData || {};
  const phase = wwData.phase || 'waiting';
  const dayCount = wwData.dayCount || 0;

  const myPlayerData = wwData.players?.[userNickname];
  const myRole = myPlayerData?.role || '';
  const myIsAlive = myPlayerData?.isAlive !== false;
  const isGM = isHost;
  const roleInfo = ROLES[myRole];

  const [selectedTarget, setSelectedTarget] = useState(null);
  const [selectedTargets, setSelectedTargets] = useState([]);
  const [showRoleReveal, setShowRoleReveal] = useState(false);
  const personalRecordedRef = useRef(false);
  const castVoteRef = useRef(false);
  const resolvingRef = useRef(false);
  const startVotingRef = useRef(false);
  const [showDeckSetup, setShowDeckSetup] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const safeUpdate = async (refPath, data) => {
    try {
      await update(ref(db, refPath), data);
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
      throw e;
    }
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
    const iWon = (winner === 'werewolf' && (myRoleResult === 'werewolf' || myRoleResult === 'minion')) ||
                 (winner === 'villager' && myRoleResult !== 'werewolf' && myRoleResult !== 'minion' && myRoleResult !== 'gm') ||
                 (winner === 'independent');
    recordPersonalGame('werewolf');
    if (iWon) recordPersonalWin('werewolf');
    if (isHost && winner) {
      const winningPlayers = Object.entries(wwPlayers)
        .filter(([, p]) => p.isAlive && p.role !== 'gm')
        .filter(([, p]) => {
          if (winner === 'werewolf') return p.role === 'werewolf' || p.role === 'minion';
          if (winner === 'villager') return p.role !== 'werewolf' && p.role !== 'minion';
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
    if (phase === 'night' && dayCount === 1 && !isGM && myRole) {
      setShowRoleReveal(true);
    }
  }, [phase, dayCount, isGM, myRole]);

  // ─── Game Actions ────────────────────────────────────────────────────────────

  const startGame = async () => {
    if (!isHost) return;
    const nonGMPlayers = playerNames.filter(n => n !== roomData.host);
    if (nonGMPlayers.length < 4) return;

    const deckCounts = wwData.deckCounts || {};
    let deck = [];
    for (const [role, count] of Object.entries(deckCounts)) {
      for (let i = 0; i < count; i++) deck.push(role);
    }

    if (deck.length === 0) {
      const count = nonGMPlayers.length;
      const wolfCount = count >= 7 ? 2 : 1;
      for (let i = 0; i < wolfCount; i++) deck.push('werewolf');
      if (count >= 4) deck.push('seer');
      if (count >= 5) deck.push('bodyguard');
      while (deck.length < count) deck.push('villager');
    }

    if (deck.length !== nonGMPlayers.length) {
      return;
    }

    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const shuffledPlayers = [...nonGMPlayers];
    for (let i = shuffledPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPlayers[i], shuffledPlayers[j]] = [shuffledPlayers[j], shuffledPlayers[i]];
    }
    const wwPlayers = {};
    shuffledPlayers.forEach((name, idx) => {
      wwPlayers[name] = { role: deck[idx], isAlive: true, vote: '', status: {} };
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
    if (['seer', 'apprentice_seer', 'mystic_wolf', 'aura_seer'].includes(actionKey) && targetId && targetId !== 'skip') {
      const seerEntry = Object.entries(wwData.players || {}).find(([, p]) => p.role === actionKey);
      if (seerEntry) {
        const [seerName] = seerEntry;
        const targetRole = wwData.players?.[targetId]?.role;
        const isWolf = (WOLF_ROLES.includes(targetRole) && targetRole !== 'wolf_man') || targetRole === 'lycan';
        updates[`privateData/${seerName}/seerResult`] = { targetName: targetId, isWolf, timestamp: Date.now() };
      }
    }

    await safeUpdate(`rooms/${roomId}/gameData/wwData`, updates);
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
      await safeUpdate(`rooms/${roomId}/gameData/wwData`, { nightActions: null });
      await safeUpdate(`rooms/${roomId}/gameData/wwData`, {
        phase: 'night',
        dayCount: dayCount + 1,
        nightActions: {},
        nightTurn: null,
        lastElimination: null,
        timerEnd: Date.now() + 120000,
      });
    } finally {
      startNextNightRef.current = false;
    }
  };

  const togglePlayerAlive = async (name, currentlyDead) => {
    if (!isHost) return;
    const toLive = currentlyDead;
    await safeUpdate(`rooms/${roomId}/gameData/wwData/players/${name}`, { isAlive: toLive });

    if (!toLive) {
      const p = wwData.players?.[name];
      if (p?.role === 'hunter') {
        await safeUpdate(`rooms/${roomId}/gameData/wwData`, { hunterPending: name });
      }
      if (wwData.lovers) {
        const { player1, player2 } = wwData.lovers;
        if (name === player1 && wwData.players?.[player2]?.isAlive) {
          await safeUpdate(`rooms/${roomId}/gameData/wwData/players/${player2}`, { isAlive: false });
        } else if (name === player2 && wwData.players?.[player1]?.isAlive) {
          await safeUpdate(`rooms/${roomId}/gameData/wwData/players/${player1}`, { isAlive: false });
        }
      }
    }

    // Check win
    try {
      const snap = await get(ref(db, `rooms/${roomId}/gameData/wwData/players`));
      const updatedPlayers = snap.val() || {};
      const winner = checkWinCondition(updatedPlayers);
      if (winner) {
        await safeUpdate(`rooms/${roomId}/gameData/wwData`, { phase: 'result', winnerTeam: winner });
      }
    } catch (e) {
      setErrorMsg('เกิดข้อผิดพลาด ลองอีกครั้ง');
      setTimeout(() => setErrorMsg(''), 3000);
    }
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
    const nonGMPlayers = playerNames.filter(n => n !== roomData.host);
    const deckCounts = wwData.deckCounts || {};
    const totalDeck = Object.values(deckCounts).reduce((a, b) => a + b, 0);

    return (
      <div className="flex flex-col gap-lg w-full animate-fade-in pb-20">
        <div className="glass-panel p-xl text-center">
          <div className="flex-center mb-md">
            <div className="p-lg bg-danger/20 rounded-full text-danger shadow-lg shadow-danger/10">
              <Skull size={48} />
            </div>
          </div>
          <h2 className="text-3xl font-black mb-sm">WEREWOLF</h2>
          <p className="text-secondary leading-relaxed">
            หมาป่ากำลังแฝงตัวอยู่ในหมู่ชาวบ้าน! ผู้ดำเนินเกม (GM) จะควบคุมทุกเฟส
          </p>
          {isHost && (
            <p className="text-primary font-bold mt-sm text-sm">🎭 คุณเป็นผู้ดำเนินเกม (GM)</p>
          )}
        </div>

        {/* Deck Setup (GM only) */}
        {isHost && (
          <div className="glass-panel p-lg">
            <div className="flex-between mb-md">
              <h4 className="font-black flex items-center gap-sm text-sm">
                🎴 จัดเตรียมการ์ด
                <span className={`px-sm py-xs rounded-lg text-xs font-bold ${totalDeck === nonGMPlayers.length ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                  {totalDeck}/{nonGMPlayers.length}
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
          <div className="glass-panel p-lg">
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
            disabled={nonGMPlayers.length < 4 || (totalDeck > 0 && totalDeck !== nonGMPlayers.length)}
          >
            {nonGMPlayers.length < 4
              ? `รอผู้เล่น (ต้องการอีก ${4 - nonGMPlayers.length} คน)`
              : totalDeck > 0 && totalDeck !== nonGMPlayers.length
                ? `จัดไพ่ไม่พอดี (${totalDeck}/${nonGMPlayers.length})`
                : '🎭 เริ่มเกม!'}
          </button>
        ) : (
          <div className="glass-panel p-md text-center border-primary/30">
            <p className="animate-pulse text-primary font-bold">รอ GM เริ่มเกม...</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Role Reveal Overlay ──────────────────────────────────────────────

  const RoleRevealOverlay = () => (
    <AnimatePresence>
      {showRoleReveal && roleInfo && !isGM && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          className="fixed inset-0 z-50 flex-center p-xl bg-black/90 backdrop-blur-xl"
          onClick={() => setShowRoleReveal(false)}
        >
          <div className="flex flex-col items-center gap-xl text-center">
            <p className="text-secondary font-bold tracking-[8px] uppercase">บทบาทของคุณ</p>
            <div className="w-40 h-40 bg-glass rounded-full flex-center text-7xl shadow-2xl border-4 border-white/20 relative">
              {roleInfo.icon}
              <div className="absolute -bottom-4 bg-white text-dark px-lg py-sm rounded-full font-black text-lg shadow-xl">
                {roleInfo.name}
              </div>
            </div>
            <p className="text-lg font-bold leading-relaxed max-w-xs mt-lg">{roleInfo.description}</p>
            {/* Wolf allies */}
            {WOLF_ROLES.includes(myRole) && (
              <div className="bg-danger/10 border border-danger/30 p-md rounded-xl">
                <p className="text-danger font-bold text-sm">🐺 เพื่อนหมาป่า:</p>
                <p className="text-white font-bold">
                  {Object.entries(wwData.players || {}).filter(([n, p]) => WOLF_ROLES.includes(p.role) && n !== userNickname).map(([n]) => n).join(', ') || 'คุณอยู่คนเดียว'}
                </p>
              </div>
            )}
            <button className="btn btn-glass px-xl py-md mt-md font-bold">แตะเพื่อเข้าสู่เกม</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ─── Render: Game Result ──────────────────────────────────────────────────────

  if (phase === 'result') {
    const winner = wwData.winnerTeam;
    const wwPlayers = wwData.players || {};

    return (
      <div className="flex flex-col gap-lg w-full animate-fade-in pb-20">
        {showConfirm && <LeaveConfirmModal onConfirm={confirmLeave} onCancel={cancelLeave} />}
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel p-xl text-center">
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

        <div className="glass-panel p-lg space-y-sm">
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

  return (
    <div className="flex flex-col gap-lg w-full animate-fade-in pb-32">
      <RoleRevealOverlay />

      {/* Phase Banner */}
      <div className={`glass-panel p-md flex justify-between items-center ${phaseBg}`}>
        <div className="flex items-center gap-md">
          {phase === 'night' ? <Moon className="text-indigo-400" size={20} /> : phase === 'day' ? <Sun className="text-orange-400" size={20} /> : <Users className="text-red-400" size={20} />}
          <div>
            <p className="font-black text-white">{phaseLabel}</p>
          </div>
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
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-md text-center border-danger/30 bg-danger/5">
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
        <div className="glass-panel p-lg space-y-lg border-warning/20">
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
                  let doneLabel = `→ ${chosenTarget === 'skip' ? 'ข้าม' : chosenTarget}`;
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
          <div className="glass-panel p-lg flex items-center gap-md cursor-pointer" onClick={() => setShowRoleReveal(true)} style={{ borderLeft: `4px solid ${roleInfo?.color || '#666'}` }}>
            <span className="text-3xl">{roleInfo?.icon || '❓'}</span>
            <div className="flex-1">
              <p className="font-black" style={{ color: roleInfo?.color }}>{roleInfo?.name || 'ไม่ทราบ'}</p>
              <p className="text-[10px] text-secondary">{roleInfo?.description || ''}</p>
            </div>
            <Info size={16} className="text-secondary" />
          </div>

          {/* Wolf allies */}
          {WOLF_ROLES.includes(myRole) && (
            <div className="glass-panel p-md border-danger/30 bg-danger/5">
              <p className="text-xs text-danger font-bold">🐺 เพื่อนหมาป่า: {Object.entries(wwPlayers).filter(([n, p]) => WOLF_ROLES.includes(p.role) && n !== userNickname && p.role !== 'gm').map(([n]) => n).join(', ') || 'ไม่มี'}</p>
            </div>
          )}

          {/* Seer Result */}
          {['seer', 'apprentice_seer', 'mystic_wolf', 'aura_seer'].includes(myRole) && wwData.privateData?.[userNickname]?.seerResult && (
            <div className={`glass-panel p-md text-center ${wwData.privateData[userNickname].seerResult.isWolf ? 'border-danger/30 bg-danger/5' : 'border-success/30 bg-success/5'}`}>
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
            <div className="glass-panel p-lg">
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
            <div className="glass-panel p-lg text-center opacity-60">
              <p className="text-danger font-bold">💀 คุณเสียชีวิตแล้ว — รอชมเกมต่อ</p>
            </div>
          )}

          {/* Day Panel */}
          {phase === 'day' && (
            <div className="glass-panel p-lg text-center">
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
            <div className="glass-panel p-lg space-y-md">
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
            <div className="glass-panel p-lg text-center">
              <div className="text-3xl mb-md">🎭</div>
              <p className="text-secondary font-bold">รอ GM เริ่มรอบต่อไป...</p>
            </div>
          )}
        </>
      )}

      {/* Player List Sidebar */}
      <div className="glass-panel p-md">
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
