import { describe, it, expect } from 'vitest';
import { 
  calculatePokDeng, 
  calculateBlackjackScore, 
  analyzePlay, 
  validatePlay 
} from './cards';

describe('PokDeng Logic', () => {
  it('should calculate simple score', () => {
    const hand = [
      { value: '3', suit: 'spades' },
      { value: '4', suit: 'hearts' }
    ];
    const result = calculatePokDeng(hand);
    expect(result.score).toBe(7);
    expect(result.deng).toBe(1);
    expect(result.type).toBe('Normal');
  });

  it('should detect Pok 9 with 2 cards', () => {
    const hand = [
      { value: '4', suit: 'spades' },
      { value: '5', suit: 'hearts' }
    ];
    const result = calculatePokDeng(hand);
    expect(result.score).toBe(9);
    expect(result.type).toBe('Pok 9');
    expect(result.weight).toBe(19);
  });

  it('should detect 2-deng with same suit', () => {
    const hand = [
      { value: 'A', suit: 'hearts' },
      { value: '4', suit: 'hearts' }
    ];
    const result = calculatePokDeng(hand);
    expect(result.score).toBe(5);
    expect(result.deng).toBe(2);
  });

  it('should detect 3-deng with 3 cards same suit', () => {
    const hand = [
      { value: 'A', suit: 'hearts' },
      { value: '4', suit: 'hearts' },
      { value: '10', suit: 'hearts' }
    ];
    const result = calculatePokDeng(hand);
    expect(result.score).toBe(5);
    expect(result.deng).toBe(3);
  });

  it('should detect Tong (Three of a kind)', () => {
    const hand = [
      { value: '3', suit: 'spades' },
      { value: '3', suit: 'hearts' },
      { value: '3', suit: 'clubs' }
    ];
    const result = calculatePokDeng(hand);
    expect(result.type).toBe('Tong (ตอง)');
    expect(result.deng).toBe(5);
    expect(result.weight).toBe(17);
  });
});

describe('Blackjack Logic', () => {
  it('should calculate simple hand', () => {
    const hand = [
      { value: '10', suit: 'spades' },
      { value: '7', suit: 'hearts' }
    ];
    expect(calculateBlackjackScore(hand)).toBe(17);
  });

  it('should handle Ace as 11', () => {
    const hand = [
      { value: 'A', suit: 'spades' },
      { value: '9', suit: 'hearts' }
    ];
    expect(calculateBlackjackScore(hand)).toBe(20);
  });

  it('should handle Ace as 1 when busting', () => {
    const hand = [
      { value: 'A', suit: 'spades' },
      { value: '9', suit: 'hearts' },
      { value: '5', suit: 'clubs' }
    ];
    expect(calculateBlackjackScore(hand)).toBe(15);
  });
});

describe('Slaves Logic', () => {
  const settings = { enableBomb: true, allowStraight: true };

  it('should analyze single card', () => {
    const hand = [{ value: '3', suit: 'clubs', valueRank: 1, suitRank: 1 }];
    const play = analyzePlay(hand);
    expect(play.type).toBe('single');
    expect(play.count).toBe(1);
  });

  it('should analyze pair', () => {
    const hand = [
      { value: '3', suit: 'clubs', valueRank: 1, suitRank: 1 },
      { value: '3', suit: 'spades', valueRank: 1, suitRank: 4 }
    ];
    const play = analyzePlay(hand);
    expect(play.type).toBe('pair');
    expect(play.count).toBe(2);
  });

  it('should validate higher card beats lower card', () => {
    const lower = { cards: [{ value: '3', suit: 'clubs', valueRank: 1, suitRank: 1 }], type: { type: 'single', count: 1 }, highestCard: { valueRank: 1, suitRank: 1 } };
    const higher = [{ value: '4', suit: 'clubs', valueRank: 2, suitRank: 1 }];
    
    expect(validatePlay(higher, lower, settings)).toBe(true);
  });

  it('should validate higher suit beats lower suit for same value', () => {
    const lower = { cards: [{ value: '3', suit: 'clubs', valueRank: 1, suitRank: 1 }], type: { type: 'single', count: 1 }, highestCard: { valueRank: 1, suitRank: 1 } };
    const higher = [{ value: '3', suit: 'spades', valueRank: 1, suitRank: 4 }];
    
    expect(validatePlay(higher, lower, settings)).toBe(true);
  });

  it('should allow Bomb to beat single', () => {
    const lower = { cards: [{ value: 'A', suit: 'spades', valueRank: 12, suitRank: 4 }], type: { type: 'single', count: 1 }, highestCard: { valueRank: 12, suitRank: 4 } };
    const bomb = [
        { value: '3', suit: 'clubs', valueRank: 1, suitRank: 1 },
        { value: '3', suit: 'diamonds', valueRank: 1, suitRank: 2 },
        { value: '3', suit: 'hearts', valueRank: 1, suitRank: 3 },
        { value: '3', suit: 'spades', valueRank: 1, suitRank: 4 }
    ];
    
    expect(validatePlay(bomb, lower, settings)).toBe(true);
  });
});
