import { describe, it, expect } from 'vitest';
import { 
  calculatePokDeng, 
  calculateBlackjackScore, 
  analyzePlay, 
  validatePlay,
  Card,
  TableState,
  Suit,
  CardValue
} from './cards';

const makeCard = (value: CardValue, suit: Suit, valueRank = 1, suitRank = 1): Card => ({
  id: `${value}_of_${suit}`,
  value,
  suit,
  valueRank,
  suitRank,
});

describe('PokDeng Logic', () => {
  it('should calculate simple score', () => {
    const hand = [
      makeCard('3', 'spades'),
      makeCard('4', 'hearts')
    ];
    const result = calculatePokDeng(hand);
    expect(result.score).toBe(7);
    expect(result.deng).toBe(1);
    expect(result.type).toBe('Normal');
  });

  it('should detect Pok 9 with 2 cards', () => {
    const hand = [
      makeCard('4', 'spades'),
      makeCard('5', 'hearts')
    ];
    const result = calculatePokDeng(hand);
    expect(result.score).toBe(9);
    expect(result.type).toBe('Pok 9');
    expect(result.weight).toBe(19);
  });

  it('should detect 2-deng with same suit', () => {
    const hand = [
      makeCard('A', 'hearts'),
      makeCard('4', 'hearts')
    ];
    const result = calculatePokDeng(hand);
    expect(result.score).toBe(5);
    expect(result.deng).toBe(2);
  });

  it('should detect 3-deng with 3 cards same suit', () => {
    const hand = [
      makeCard('A', 'hearts'),
      makeCard('4', 'hearts'),
      makeCard('10', 'hearts')
    ];
    const result = calculatePokDeng(hand);
    expect(result.score).toBe(5);
    expect(result.deng).toBe(3);
  });

  it('should detect Tong (Three of a kind)', () => {
    const hand = [
      makeCard('3', 'spades'),
      makeCard('3', 'hearts'),
      makeCard('3', 'clubs')
    ];
    const result = calculatePokDeng(hand);
    expect(result.type).toBe('Tong (ตอง)');
    expect(result.deng).toBe(5);
    expect(result.weight).toBe(17);
  });

  it('should use deng as tiebreaker when weights are equal', () => {
    const sameSuitHand = [
      makeCard('A', 'hearts'),
      makeCard('4', 'hearts'),
      makeCard('10', 'hearts')
    ];
    const normalHand = [
      makeCard('A', 'hearts'),
      makeCard('4', 'spades'),
      makeCard('10', 'clubs')
    ];
    const sameSuitResult = calculatePokDeng(sameSuitHand);
    const normalResult = calculatePokDeng(normalHand);
    expect(sameSuitResult.score).toBe(normalResult.score);
    expect(sameSuitResult.deng).toBe(3);
    expect(normalResult.deng).toBe(1);
  });

  it('should detect Straight (3 consecutive cards)', () => {
    const hand = [
      makeCard('5', 'hearts'),
      makeCard('6', 'spades'),
      makeCard('7', 'clubs')
    ];
    const result = calculatePokDeng(hand);
    expect(result.type).toBe('Straight (เรียง)');
    expect(result.deng).toBe(3);
    expect(result.weight).toBe(15);
  });

  it('should detect Straight Flush', () => {
    const hand = [
      makeCard('5', 'hearts'),
      makeCard('6', 'hearts'),
      makeCard('7', 'hearts')
    ];
    const result = calculatePokDeng(hand);
    expect(result.type).toBe('Straight Flush (เรียงสี)');
    expect(result.deng).toBe(5);
    expect(result.weight).toBe(16);
  });
});

describe('Blackjack Logic', () => {
  it('should calculate simple hand', () => {
    const hand = [
      makeCard('10', 'spades'),
      makeCard('7', 'hearts')
    ];
    expect(calculateBlackjackScore(hand)).toBe(17);
  });

  it('should handle Ace as 11', () => {
    const hand = [
      makeCard('A', 'spades'),
      makeCard('9', 'hearts')
    ];
    expect(calculateBlackjackScore(hand)).toBe(20);
  });

  it('should handle Ace as 1 when busting', () => {
    const hand = [
      makeCard('A', 'spades'),
      makeCard('9', 'hearts'),
      makeCard('5', 'clubs')
    ];
    expect(calculateBlackjackScore(hand)).toBe(15);
  });
});

describe('Slaves Logic', () => {
  const settings = { enableBomb: true, allowStraight: true };

  it('should analyze single card', () => {
    const hand = [makeCard('3', 'clubs', 1, 1)];
    const play = analyzePlay(hand);
    expect(play?.type).toBe('single');
    expect(play?.count).toBe(1);
  });

  it('should analyze pair', () => {
    const hand = [
      makeCard('3', 'clubs', 1, 1),
      makeCard('3', 'spades', 1, 4)
    ];
    const play = analyzePlay(hand);
    expect(play?.type).toBe('pair');
    expect(play?.count).toBe(2);
  });

  it('should validate higher card beats lower card', () => {
    const lower: TableState = { cards: [makeCard('3', 'clubs', 1, 1)], type: { type: 'single', count: 1, highestCard: makeCard('3', 'clubs', 1, 1) }, highestCard: makeCard('3', 'clubs', 1, 1) };
    const higher = [makeCard('4', 'clubs', 2, 1)];
    
    expect(validatePlay(higher, lower, settings)).toBe(true);
  });

  it('should validate higher suit beats lower suit for same value', () => {
    const lower: TableState = { cards: [makeCard('3', 'clubs', 1, 1)], type: { type: 'single', count: 1, highestCard: makeCard('3', 'clubs', 1, 1) }, highestCard: makeCard('3', 'clubs', 1, 1) };
    const higher = [makeCard('3', 'spades', 1, 4)];
    
    expect(validatePlay(higher, lower, settings)).toBe(true);
  });

  it('should allow Bomb to beat single', () => {
    const lower: TableState = { cards: [makeCard('A', 'spades', 12, 4)], type: { type: 'single', count: 1, highestCard: makeCard('A', 'spades', 12, 4) }, highestCard: makeCard('A', 'spades', 12, 4) };
    const bomb = [
      makeCard('3', 'clubs', 1, 1),
      makeCard('3', 'diamonds', 1, 2),
      makeCard('3', 'hearts', 1, 3),
      makeCard('3', 'spades', 1, 4)
    ];

    expect(validatePlay(bomb, lower, settings)).toBe(true);
  });

  it('should NOT allow straight of different count to beat table straight', () => {
    const table3: TableState = {
      cards: [
        makeCard('3', 'clubs', 1, 1),
        makeCard('4', 'clubs', 2, 1),
        makeCard('5', 'clubs', 3, 1),
      ],
      type: { type: 'straight', count: 3, highestCard: makeCard('5', 'clubs', 3, 1) },
      highestCard: makeCard('5', 'clubs', 3, 1)
    };
    const straight4 = [
      makeCard('6', 'spades', 4, 4),
      makeCard('7', 'spades', 5, 4),
      makeCard('8', 'spades', 6, 4),
      makeCard('9', 'spades', 7, 4),
    ];

    expect(validatePlay(straight4, table3, settings)).toBe(false);
  });

  it('should allow straight of same count with higher card to beat table straight', () => {
    const table3: TableState = {
      cards: [
        makeCard('3', 'clubs', 1, 1),
        makeCard('4', 'clubs', 2, 1),
        makeCard('5', 'clubs', 3, 1),
      ],
      type: { type: 'straight', count: 3, highestCard: makeCard('5', 'clubs', 3, 1) },
      highestCard: makeCard('5', 'clubs', 3, 1)
    };
    const straight3Higher = [
      makeCard('6', 'spades', 4, 4),
      makeCard('7', 'spades', 5, 4),
      makeCard('8', 'spades', 6, 4),
    ];

    expect(validatePlay(straight3Higher, table3, settings)).toBe(true);
  });

  it('should NOT allow straight_flush of different count to beat table straight_flush', () => {
    const tableSF3: TableState = {
      cards: [
        makeCard('3', 'hearts', 1, 3),
        makeCard('4', 'hearts', 2, 3),
        makeCard('5', 'hearts', 3, 3),
      ],
      type: { type: 'straight_flush', count: 3, highestCard: makeCard('5', 'hearts', 3, 3) },
      highestCard: makeCard('5', 'hearts', 3, 3)
    };
    const sf4 = [
      makeCard('6', 'spades', 4, 4),
      makeCard('7', 'spades', 5, 4),
      makeCard('8', 'spades', 6, 4),
      makeCard('9', 'spades', 7, 4),
    ];

    expect(validatePlay(sf4, tableSF3, settings)).toBe(false);
  });
});
