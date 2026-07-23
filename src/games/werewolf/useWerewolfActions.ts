import { useWerewolf } from './WerewolfContext';
import { useGame } from '../../contexts/GameContext';
import { handleDeathSideEffects, WOLF_ROLES } from './werewolfLogic';

export const useWerewolfActions = () => {
  const { roomId, userNickname } = useGame();
  const { wwData, isGM, safeUpdate } = useWerewolf();

  const togglePlayerAlive = async (name: string, currentlyDead: boolean) => {
    if (!isGM) return;
    const toLive = currentlyDead;
    
    let updatedPlayers = { ...(wwData.players || {}) };
    let hunterPending = wwData.hunterPending || null;

    if (!toLive) {
      const result = handleDeathSideEffects(name, { 
        players: updatedPlayers, 
        lovers: wwData.lovers, 
        hunterPending
      });
      updatedPlayers = result.players;
      hunterPending = result.hunterPending;

      await safeUpdate(`rooms/${roomId}/gameData/wwData`, { 
        players: updatedPlayers,
        hunterPending,
        lastElimination: { playerName: name, reason: 'gm_kill' }
      });
    } else {
      updatedPlayers[name].isAlive = true;
      updatedPlayers[name].status = {};
      await safeUpdate(`rooms/${roomId}/gameData/wwData/players`, updatedPlayers);
    }
  };

  const updatePlayerRole = async (name: string, newRole: string) => {
    if (!isGM) return;
    await safeUpdate(`rooms/${roomId}/gameData/wwData/players/${name}/role`, newRole);
  };

  const clearSeerResults = async () => {
    if (!isGM) return;
    await safeUpdate(`rooms/${roomId}/gameData/wwData`, { lastSeerResult: null });
  };

  const resolveNightToDay = async () => {
    if (!isGM) return;
    await safeUpdate(`rooms/${roomId}/gameData/wwData`, {
      phase: 'day',
      nightTurn: null,
      timerEnd: Date.now() + 180000,
    });
  };

  const gmSubmitForRole = async (actionKey: string, targetId: string) => {
    if (!isGM) return;
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

    if (['seer', 'apprentice_seer', 'mystic_wolf', 'aura_seer'].includes(actionKey) && targetId && targetId !== 'skip') {
      const targetRole = wwData.players?.[targetId]?.role;
      const isWolf = (WOLF_ROLES.includes(targetRole) && targetRole !== 'wolf_man') || targetRole === 'lycan';
      updates['lastSeerResult'] = { targetName: targetId, isWolf };
    }

    await safeUpdate(`rooms/${roomId}/gameData/wwData`, updates);
  };

  const submitNightAction = async (role: string, targetId: string, extraData: any = null) => {
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
  };

  const announceWinner = async (team: string) => {
    if (!isGM) return;
    await safeUpdate(`rooms/${roomId}/gameData/wwData`, { phase: 'result', winnerTeam: team });
  };

  const resetToLobby = async () => {
    if (!isGM) return;
    await safeUpdate(`rooms/${roomId}`, { status: 'waiting', gameData: null });
  };

  const startNextNight = async () => {
    if (!isGM) return;
    await safeUpdate(`rooms/${roomId}/gameData/wwData`, {
      phase: 'night',
      dayCount: (wwData.dayCount || 1) + 1,
      nightActions: {},
      nightTurn: null,
      timerEnd: null
    });
  };

  const startVotingPhase = async () => {
    if (!isGM) return;
    const updates: Record<string, any> = { phase: 'voting', timerEnd: Date.now() + 180000 };
    const wwPlayers = wwData.players || {};
    for (const name of Object.keys(wwPlayers)) {
      updates[`players/${name}/vote`] = '';
    }
    await safeUpdate(`rooms/${roomId}/gameData/wwData`, updates);
  };

  const castVote = async (targetName: string) => {
    const wwPlayers = wwData.players || {};
    const me = wwPlayers[userNickname || ''];
    if (!me?.isAlive || me?.status?.silenced || me?.status?.banned) return;
    await safeUpdate(`rooms/${roomId}/gameData/wwData/players/${userNickname}`, { vote: targetName });
  };

  const resolveVotes = async () => {
    if (!isGM) return;
    const wwPlayers = wwData.players || {};
    const voteTally: Record<string, number> = {};
    Object.entries(wwPlayers).forEach(([name, p]: [string, any]) => {
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

    const updates: Record<string, any> = {};
    if (topName) {
      const target = wwPlayers[topName];
      if (target?.role === 'prince' && !target?.status?.princeUsed) {
        updates[`players/${topName}/status/princeUsed`] = true;
        updates['lastElimination'] = { playerName: topName, playerRole: target.role, reason: 'prince_saved' };
      } else {
        updates[`players/${topName}/isAlive`] = false;
        updates['lastElimination'] = { playerName: topName, playerRole: target?.role, reason: 'vote' };
        if (target?.role === 'hunter') updates['hunterPending'] = topName;
        
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
    Object.keys(wwPlayers).forEach(name => { updates[`players/${name}/vote`] = ''; });
    Object.keys(wwPlayers).forEach(name => {
      if (wwPlayers[name]?.status?.silenced) updates[`players/${name}/status/silenced`] = null;
      if (wwPlayers[name]?.status?.banned) updates[`players/${name}/status/banned`] = null;
    });

    await safeUpdate(`rooms/${roomId}/gameData/wwData`, updates);
    // win condition logic needs to be refactored, but this is a good start
  };

  const gmSkipVote = async () => {
    if (!isGM) return;
    const updates: Record<string, any> = { phase: 'standby', timerEnd: null, lastElimination: { playerName: null, reason: 'skipped' } };
    const wwPlayers = wwData.players || {};
    Object.keys(wwPlayers).forEach(name => { updates[`players/${name}/vote`] = ''; });
    await safeUpdate(`rooms/${roomId}/gameData/wwData`, updates);
  };

  return {
    togglePlayerAlive,
    updatePlayerRole,
    clearSeerResults,
    resolveNightToDay,
    gmSubmitForRole,
    submitNightAction,
    announceWinner,
    resetToLobby,
    startNextNight,
    startVotingPhase,
    castVote,
    resolveVotes,
    gmSkipVote
  };
};
