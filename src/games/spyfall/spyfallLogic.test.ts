import { describe, it, expect } from 'vitest';
import { generateInitialState, checkVoteResult, Player } from './spyfallLogic';

describe('Spyfall Logic', () => {
  describe('generateInitialState', () => {
    it('should correctly assign roles including one spy', () => {
      const players = ['Alice', 'Bob', 'Charlie'];
      const pool = [{ n: 'Hospital', r: ['Doctor', 'Nurse'] }];
      
      const state = generateInitialState(players, pool, 'Health', 8, false);
      
      expect(state.status).toBe('playing');
      expect(state.targetPlace).toBe('Hospital');
      expect(state.allPlaces).toContain('Hospital');
      
      const playerRoles = Object.values(state.players);
      const spies = playerRoles.filter(p => p.isSpy);
      const civilians = playerRoles.filter(p => !p.isSpy && !p.isAccomplice);
      const accomplices = playerRoles.filter(p => p.isAccomplice);

      expect(spies.length).toBe(1);
      expect(civilians.length).toBe(2);
      expect(accomplices.length).toBe(0);
      expect(spies[0].role).toBe('Spy');
      expect(spies[0].place).toBe('');
      expect(civilians[0].place).toBe('Hospital');
    });

    it('should assign an accomplice if enabled and >= 4 players', () => {
      const players = ['Alice', 'Bob', 'Charlie', 'David'];
      const pool = [{ n: 'School', r: ['Teacher', 'Student', 'Janitor'] }];
      
      const state = generateInitialState(players, pool, 'Education', 8, true);
      
      const playerRoles = Object.values(state.players);
      const spies = playerRoles.filter(p => p.isSpy);
      const accomplices = playerRoles.filter(p => p.isAccomplice);

      expect(spies.length).toBe(1);
      expect(accomplices.length).toBe(1);
      expect(accomplices[0].spyName).toBe(Object.keys(state.players).find(k => state.players[k].isSpy));
    });
  });

  describe('checkVoteResult', () => {
    it('should return null if not everyone has voted', () => {
      const players: Record<string, Player> = {
        'Alice': { isSpy: true, votedFor: 'Bob' } as Player,
        'Bob': { isSpy: false, votedFor: '' } as Player
      };
      
      const result = checkVoteResult(players, 2);
      expect(result).toBeNull();
    });

    it('should award civilians win if majority votes for spy', () => {
      const players: Record<string, Player> = {
        'Alice': { isSpy: true, votedFor: 'Bob' } as Player,
        'Bob': { isSpy: false, votedFor: 'Alice' } as Player,
        'Charlie': { isSpy: false, votedFor: 'Alice' } as Player,
      };
      
      const result = checkVoteResult(players, 3);
      expect(result).toEqual({ winner: 'Civilians', forcedSpy: false });
    });

    it('should force spy to guess if civilians fail to get majority on spy', () => {
      const players: Record<string, Player> = {
        'Alice': { isSpy: true, votedFor: 'Bob' } as Player,
        'Bob': { isSpy: false, votedFor: 'Charlie' } as Player,
        'Charlie': { isSpy: false, votedFor: 'Bob' } as Player,
      };
      
      const result = checkVoteResult(players, 3);
      expect(result).toEqual({ winner: null, forcedSpy: true });
    });
  });
});
