import { describe, it, expect } from 'vitest';
import { 
  checkWinCondition, 
  handleDeathSideEffects, 
  resolveNightActions 
} from './werewolfLogic';

describe('Werewolf Win Conditions', () => {
  it('should award victory to Villagers when all Wolves are dead', () => {
    const players = {
      'Alice': { role: 'villager', isAlive: true },
      'Bob': { role: 'werewolf', isAlive: false },
      'Charlie': { role: 'seer', isAlive: true }
    };
    expect(checkWinCondition(players)).toBe('villager');
  });

  it('should award victory to Wolves when they outnumber Villagers', () => {
    const players = {
      'Alice': { role: 'villager', isAlive: true },
      'Bob': { role: 'werewolf', isAlive: true },
      'Charlie': { role: 'werewolf', isAlive: true }
    };
    expect(checkWinCondition(players)).toBe('werewolf');
  });

  it('should award victory to Serial Killer when they are the last one alive', () => {
    const players = {
      'Alice': { role: 'serial_killer', isAlive: true },
      'Bob': { role: 'villager', isAlive: false },
      'Charlie': { role: 'werewolf', isAlive: false }
    };
    expect(checkWinCondition(players)).toBe('independent');
  });
});

describe('Werewolf Role Abilities (TDD)', () => {
  describe('Cupid & Lovers', () => {
    it('should kill the other lover when one dies', () => {
      const players = {
        'Alice': { role: 'villager', isAlive: true },
        'Bob': { role: 'villager', isAlive: true },
        'Charlie': { role: 'villager', isAlive: true }
      };
      const gameState = {
        players,
        lovers: { player1: 'Alice', player2: 'Bob' }
      };

      const result = handleDeathSideEffects('Alice', gameState);
      expect(result.players['Alice'].isAlive).toBe(false);
      expect(result.players['Bob'].isAlive).toBe(false); 
    });
  });

  describe('Bodyguard', () => {
    it('should protect a target from being killed by werewolves', () => {
      const players = {
        'Alice': { role: 'villager', isAlive: true },
        'Bob': { role: 'bodyguard', isAlive: true }
      };
      const nightActions = {
        werewolfTarget: 'Alice',
        bodyguardTarget: 'Alice'
      };
      const gameState = { players };

      const result = resolveNightActions(nightActions, gameState);
      expect(result.players['Alice'].isAlive).toBe(true); 
      expect(result.finalEliminated).toBe(null);
    });
  });

  describe('Witch', () => {
    it('should heal a target targeted by werewolves', () => {
      const players = {
        'Alice': { role: 'villager', isAlive: true },
        'Wolf': { role: 'werewolf', isAlive: true }
      };
      const nightActions = {
        werewolfTarget: 'Alice',
        witchHealTarget: 'Alice'
      };
      const gameState = { players };

      const result = resolveNightActions(nightActions, gameState);
      expect(result.players['Alice'].isAlive).toBe(true);
    });

    it('should poison a target', () => {
      const players = {
        'Alice': { role: 'villager', isAlive: true },
        'Bob': { role: 'villager', isAlive: true }
      };
      const nightActions = {
        witchPoisonTarget: 'Bob'
      };
      const gameState = { players };

      const result = resolveNightActions(nightActions, gameState);
      expect(result.players['Bob'].isAlive).toBe(false);
      expect(result.finalEliminated).toContain('Bob');
    });
  });

  describe('Spellcaster', () => {
    it('should silence a target', () => {
      const players = {
        'Alice': { role: 'villager', isAlive: true }
      };
      const nightActions = {
        spellcasterTarget: 'Alice'
      };
      const gameState = { players };

      const result = resolveNightActions(nightActions, gameState);
      expect(result.players['Alice'].status.silenced).toBe(true);
    });
  });

  describe('Hunter', () => {
    it('should set hunterPending when hunter dies', () => {
      const players = {
        'Alice': { role: 'hunter', isAlive: true },
        'Bob': { role: 'villager', isAlive: true }
      };
      const gameState = { players };

      const result = handleDeathSideEffects('Alice', gameState);
      expect(result.players['Alice'].isAlive).toBe(false);
      expect(result.hunterPending).toBe('Alice');
    });
  });
});
