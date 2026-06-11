// src/utils/cards.js

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const VALUES = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

// Slaves rankings: Spades > Hearts > Diamonds > Clubs
// But standard Thai Slaves sometimes uses: Spades (♠️) > Hearts (♥️) > Diamonds (♦️) > Clubs (♣️)
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
