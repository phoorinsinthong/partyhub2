// @ts-nocheck
/**
 * Werewolf Game Logic Utilities
 */

export const WOLF_ROLES = ["werewolf", "alpha_wolf", "dire_wolf", "lone_wolf", "mystic_wolf", "wolf_cub", "wolf_man"];

/**
 * Checks for game win conditions
 * @param {Object} playersData - Map of player names to their data { role, isAlive }
 * @returns {string|null} 'villager', 'werewolf', 'independent', or null
 */
export function checkWinCondition(playersData) {
  const alive = Object.entries(playersData).filter(([, p]) => p.isAlive && p.role !== 'gm');
  const wolves = alive.filter(([, p]) => WOLF_ROLES.includes(p.role));
  const nonWolves = alive.filter(([, p]) => !WOLF_ROLES.includes(p.role));

  // Serial killer wins alone when only they remain
  const serialKillers = alive.filter(([, p]) => p.role === 'serial_killer');
  if (serialKillers.length > 0 && alive.length === serialKillers.length) return 'independent';

  // Vampire wins when they outnumber all others
  const vampires = alive.filter(([, p]) => p.role === 'vampire');
  if (vampires.length > 0 && vampires.length >= alive.length - vampires.length) return 'independent';

  if (wolves.length === 0) return 'villager';
  if (wolves.length >= nonWolves.length) return 'werewolf';
  
  return null;
}

/**
 * Handles death side effects (Lovers, Hunter, etc.)
 * @param {string} killedName - Name of the player who died
 * @param {Object} gameState - Current game state { players, lovers, ... }
 * @returns {Object} Updated players data and any pending actions (like hunter)
 */
export function handleDeathSideEffects(killedName, gameState) {
  const players = { ...gameState.players };
  const lovers = gameState.lovers;
  let hunterPending = gameState.hunterPending;

  // Mark killed player as dead
  if (players[killedName]) {
    players[killedName].isAlive = false;
    
    // Hunter trigger
    if (players[killedName].role === 'hunter') {
      hunterPending = killedName;
    }
  }

  // Lover death chain
  if (lovers) {
    const { player1, player2 } = lovers;
    if (killedName === player1 && players[player2]?.isAlive) {
      players[player2].isAlive = false;
      if (players[player2].role === 'hunter') hunterPending = player2;
    } else if (killedName === player2 && players[player1]?.isAlive) {
      players[player1].isAlive = false;
      if (players[player1].role === 'hunter') hunterPending = player1;
    }
  }

  return { players, hunterPending };
}

/**
 * Resolves night actions into player status updates and deaths
 * @param {Object} nightActions - Map of role actions
 * @param {Object} gameState - Current game state
 * @returns {Object} Updated state { players, finalEliminated, hunterPending }
 */
export function resolveNightActions(nightActions, gameState) {
  let { players, hunterPending } = { ...gameState, players: { ...gameState.players } };
  const killedByWolf = nightActions.werewolfTarget;
  const protectedByBodyguard = nightActions.bodyguardTarget;
  const witchHeal = nightActions.witchHealTarget;
  const witchPoison = nightActions.witchPoisonTarget;
  const spellcasterTarget = nightActions.spellcasterTarget;
  const oldHagTarget = nightActions.old_hagTarget;

  const killedTonight = new Set();

  // 1. Werewolf Kill vs Protections
  if (killedByWolf && killedByWolf !== 'skip') {
    const isSavedByBodyguard = killedByWolf === protectedByBodyguard;
    const isSavedByWitch = killedByWolf === witchHeal;
    
    if (!isSavedByBodyguard && !isSavedByWitch) {
      killedTonight.add(killedByWolf);
    }
  }

  // 2. Witch Poison
  if (witchPoison && witchPoison !== 'skip') {
    killedTonight.add(witchPoison);
  }

  // Apply deaths and side effects
  const killedList = Array.from(killedTonight);
  killedList.forEach(name => {
    const result = handleDeathSideEffects(name, { players, lovers: gameState.lovers, hunterPending });
    players = result.players;
    hunterPending = result.hunterPending;
  });

  // 3. Status Effects
  if (spellcasterTarget && spellcasterTarget !== 'skip') {
    if (players[spellcasterTarget]) {
      players[spellcasterTarget].status = { ...players[spellcasterTarget].status, silenced: true };
    }
  }
  if (oldHagTarget && oldHagTarget !== 'skip') {
    if (players[oldHagTarget]) {
      players[oldHagTarget].status = { ...players[oldHagTarget].status, banned: true };
    }
  }

  return { 
    players, 
    finalEliminated: killedList.length > 0 ? killedList : null,
    hunterPending 
  };
}
