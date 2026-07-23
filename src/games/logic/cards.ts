// @ts-nocheck
// src/utils/cards.js

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const VALUES = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

// Slaves rankings: Spades > Hearts > Diamonds > Clubs
// Actually, in Thai Slaves (สลาฟ): โพดำ > โพแดง > ข้าวหลามตัด > ดอกจิก
export const SUIT_RANKS = {
  'spades': 4,
  'hearts': 3,
  'diamonds': 2,
  'clubs': 1,
};

// Slaves values: 2 is highest, 3 is lowest
export const VALUE_RANKS = {
  '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8,
  'J': 9, 'Q': 10, 'K': 11, 'A': 12, '2': 13
};

// Generate a standard 52-card deck
export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({
        id: `${value}_of_${suit}`,
        suit,
        value,
        suitRank: SUIT_RANKS[suit],
        valueRank: VALUE_RANKS[value],
      });
    }
  }
  return deck;
}

// Shuffle deck using Fisher-Yates algorithm
export function shuffleDeck(deck) {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

// Sort cards for Slaves (from lowest to highest)
export function sortCardsSlaves(cards) {
  return [...cards].sort((a, b) => {
    if (a.valueRank !== b.valueRank) {
      return a.valueRank - b.valueRank;
    }
    return a.suitRank - b.suitRank;
  });
}

// Calculate Blackjack score
export function calculateBlackjackScore(hand) {
  let score = 0;
  let aces = 0;

  for (const card of hand) {
    if (['J', 'Q', 'K'].includes(card.value)) {
      score += 10;
    } else if (card.value === 'A') {
      aces += 1;
      score += 11;
    } else {
      score += parseInt(card.value, 10);
    }
  }

  // Adjust for Aces if busted
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }

  return score;
}

// --- PokDeng Logic ---
export const calculatePokDeng = (cards) => {
  if (!cards || cards.length === 0) return { score: 0, deng: 1, type: 'Normal' };
  
  const getVal = (c) => {
    if (['10', 'J', 'Q', 'K'].includes(c.value)) return 0;
    if (c.value === 'A') return 1;
    return parseInt(c.value);
  };
  
  const total = cards.reduce((sum, c) => sum + getVal(c), 0);
  const score = total % 10;
  
  let deng = 1;
  let type = 'Normal';
  let weight = score; // Base weight; deng is used as tiebreaker when weights are equal

  // 2 Cards
  if (cards.length === 2) {
    const isSameSuit = cards[0].suit === cards[1].suit;
    const isSameVal = cards[0].value === cards[1].value;
    if (isSameSuit || isSameVal) deng = 2;
    
    if (score >= 8) {
      type = `Pok ${score}`;
      weight = score === 9 ? 19 : 18; // Pok 9 = 19, Pok 8 = 18
    }
  } 
  // 3 Cards
  else if (cards.length === 3) {
    const isSameSuit = cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
    const isTong = cards[0].value === cards[1].value && cards[1].value === cards[2].value;
    const isFace = ['J','Q','K'].includes(cards[0].value) && ['J','Q','K'].includes(cards[1].value) && ['J','Q','K'].includes(cards[2].value);
    
    // Straight detection
    const valueOrder = {'A':1, '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13};
    const sortedValues = cards.map(c => valueOrder[c.value]).sort((a,b) => a - b);
    
    let isStraight = false;
    // Check normal straight
    if (sortedValues[0] + 1 === sortedValues[1] && sortedValues[1] + 1 === sortedValues[2]) {
        isStraight = true;
    }
    // Check Q,K,A straight (12, 13, 1)
    if (sortedValues[0] === 1 && sortedValues[1] === 12 && sortedValues[2] === 13) {
        isStraight = true;
    }

    if (isTong) {
      return { score, deng: 5, type: 'Tong (ตอง)', weight: 17 };
    }
    if (isStraight && isSameSuit) {
      return { score, deng: 5, type: 'Straight Flush (เรียงสี)', weight: 16 };
    }
    if (isStraight) {
      return { score, deng: 3, type: 'Straight (เรียง)', weight: 15 };
    }
    if (isFace) {
      return { score, deng: 3, type: 'Sam Lueng (เซียน)', weight: 14 };
    }
    if (isSameSuit) {
      deng = 3;
    }
  }
  
  return { score, deng, type, weight };
};

// --- Slaves Logic ---
export const analyzePlay = (cards) => {
  if (!cards || cards.length === 0) return null;
  const sorted = sortCardsSlaves(cards);
  const highestCard = sorted[sorted.length - 1];

  const isSameValue = sorted.every(c => c.valueRank === sorted[0].valueRank);
  
  if (isSameValue) {
    if (cards.length === 1) return { type: 'single', highestCard, count: 1 };
    if (cards.length === 2) return { type: 'pair', highestCard, count: 2 };
    if (cards.length === 3) return { type: 'triple', highestCard, count: 3 };
    if (cards.length === 4) return { type: 'quad', highestCard, count: 4 };
  }

  if (cards.length >= 3) {
    let isStraight = true;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].valueRank + 1 !== sorted[i + 1].valueRank) {
        isStraight = false;
        break;
      }
    }
    const isFlush = sorted.every(c => c.suit === sorted[0].suit);
    if (isStraight) {
      return { 
        type: isFlush ? 'straight_flush' : 'straight', 
        highestCard, 
        count: cards.length 
      };
    }
  }

  return null;
};

export const validatePlay = (selectedCards, table, settings) => {
  const play = analyzePlay(selectedCards);
  if (!play) return false;

  if (!settings.allowStraight && (play.type === 'straight' || play.type === 'straight_flush')) {
    return false;
  }

  if (!table || table.cards.length === 0) return true;

  const isBomb = play.type === 'quad' || play.type === 'straight_flush';
  const tableIsBomb = table.type.type === 'quad' || table.type.type === 'straight_flush';

  if (settings.enableBomb && isBomb) {
    if (!tableIsBomb) {
      // Bomb beats non-bomb only if same count (straight_flush must match table count)
      if (play.type === 'quad') return true;
      // straight_flush bomb must match table count
      if (play.count !== table.type.count) return false;
      return true;
    }

    if (play.type === 'straight_flush' && table.type.type === 'quad') {
      if (play.count !== table.type.count) return false;
      return true;
    }
    if (play.type === 'quad' && table.type.type === 'straight_flush') return false;

    if (play.type === table.type.type) {
        if (play.count !== table.type.count) return false;

        if (play.highestCard.valueRank > table.highestCard.valueRank) return true;
        if (play.highestCard.valueRank === table.highestCard.valueRank) {
          return play.highestCard.suitRank > table.highestCard.suitRank;
        }
    }
    return false;
  }

  if (play.count !== table.type.count || play.type !== table.type.type) {
    return false;
  }

  if (play.highestCard.valueRank > table.highestCard.valueRank) return true;
  if (play.highestCard.valueRank === table.highestCard.valueRank) {
    return play.highestCard.suitRank > table.highestCard.suitRank;
  }

  return false;
};

// Get display symbol and color for suit
export function getSuitInfo(suit) {
  switch (suit) {
    case 'spades': return { symbol: '♠', color: 'text-stone-800', rawColor: '#292524' };
    case 'hearts': return { symbol: '♥', color: 'text-red-500', rawColor: '#ef4444' };
    case 'diamonds': return { symbol: '♦', color: 'text-red-500', rawColor: '#ef4444' };
    case 'clubs': return { symbol: '♣', color: 'text-stone-800', rawColor: '#292524' };
    default: return { symbol: '?', color: 'text-stone-500', rawColor: '#78716c' };
  }
}
