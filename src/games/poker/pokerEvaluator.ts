// @ts-nocheck
export const evaluatePokerHand = (holeCards, communityCards) => {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) return { score: 0, name: "Invalid" };

  const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  
  // Sort cards descending by value
  const sortedCards = [...allCards].sort((a, b) => values[b.value] - values[a.value]);
  
  const valueCounts = {};
  const suitCounts = {};
  sortedCards.forEach(c => {
    const v = values[c.value];
    valueCounts[v] = (valueCounts[v] || 0) + 1;
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
  });

  // Helper for flush
  const getFlushSuit = () => Object.keys(suitCounts).find(s => suitCounts[s] >= 5);
  
  // Helper for straight
  const getStraightHigh = (cards) => {
    const uniqueValues = [...new Set(cards.map(c => values[c.value]))].sort((a, b) => b - a);
    if (uniqueValues.includes(14)) uniqueValues.push(1); // Ace can be 1

    for (let i = 0; i <= uniqueValues.length - 5; i++) {
      let isStraight = true;
      for (let j = 0; j < 4; j++) {
        if (uniqueValues[i + j] - 1 !== uniqueValues[i + j + 1]) {
          isStraight = false;
          break;
        }
      }
      if (isStraight) return uniqueValues[i];
    }
    return null;
  };

  const flushSuit = getFlushSuit();
  const flushCards = flushSuit ? sortedCards.filter(c => c.suit === flushSuit) : [];
  
  const straightFlushHigh = flushSuit ? getStraightHigh(flushCards) : null;
  
  const counts = Object.entries(valueCounts).map(([v, c]) => ({ value: parseInt(v), count: c })).sort((a, b) => b.count - a.count || b.value - a.value);
  
  const isFour = counts[0].count === 4;
  const isFullHouse = counts[0].count === 3 && counts.length > 1 && counts[1].count >= 2;
  const isFlush = !!flushSuit;
  const straightHigh = getStraightHigh(sortedCards);
  const isThree = counts[0].count === 3;
  const isTwoPair = counts[0].count === 2 && counts.length > 1 && counts[1].count === 2;
  const isPair = counts[0].count === 2;

  // Base score multiplier for hand types to ensure proper ranking
  // We use a base-15 system for kickers: (v1 * 15^4) + (v2 * 15^3) + ...
  const calcScore = (rank, kickers) => {
    let score = rank * 10000000000;
    for (let i = 0; i < 5; i++) {
      score += (kickers[i] || 0) * Math.pow(15, 4 - i);
    }
    return score;
  };

  if (straightFlushHigh) return { name: straightFlushHigh === 14 ? "Royal Flush" : "Straight Flush", score: calcScore(9, [straightFlushHigh]) };
  if (isFour) return { name: "Four of a Kind", score: calcScore(8, [counts[0].value, counts[1].value]) };
  if (isFullHouse) return { name: "Full House", score: calcScore(7, [counts[0].value, counts[1].value]) };
  if (isFlush) return { name: "Flush", score: calcScore(6, flushCards.slice(0, 5).map(c => values[c.value])) };
  if (straightHigh) return { name: "Straight", score: calcScore(5, [straightHigh]) };
  if (isThree) {
    const kickers = sortedCards.filter(c => values[c.value] !== counts[0].value).map(c => values[c.value]);
    return { name: "Three of a Kind", score: calcScore(4, [counts[0].value, kickers[0], kickers[1]]) };
  }
  if (isTwoPair) {
    const kickers = sortedCards.filter(c => values[c.value] !== counts[0].value && values[c.value] !== counts[1].value).map(c => values[c.value]);
    return { name: "Two Pair", score: calcScore(3, [counts[0].value, counts[1].value, kickers[0]]) };
  }
  if (isPair) {
    const kickers = sortedCards.filter(c => values[c.value] !== counts[0].value).map(c => values[c.value]);
    return { name: "Pair", score: calcScore(2, [counts[0].value, kickers[0], kickers[1], kickers[2]]) };
  }
  
  const kickers = sortedCards.slice(0, 5).map(c => values[c.value]);
  return { name: "High Card", score: calcScore(1, kickers) };
};
