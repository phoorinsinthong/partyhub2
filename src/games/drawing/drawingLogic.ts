// @ts-nocheck
/**
 * Drawing Game Logic Utilities
 */

import { DRAWING_WORDS_TYPED as DRAWING_WORDS } from './drawingData';

export const countSyllables = (word: string): number => {
  if (!word) return 0;
  // This is a simple approximation for Thai. Real Thai syllable counting is complex.
  // We count vowels and certain consonants as syllable boundaries.
  const matches = word.match(/[ะ-ูเ-ไ]/g);
  let count = matches ? matches.length : 1;
  // If no vowels found, it might be a short word like 'คน', 'รถ'
  if (count === 0 && word.length > 0) count = 1;
  return count;
};

export const getRandomWord = (difficulty: string = 'random'): { word: string, difficulty: string } => {
  if (difficulty === 'random') {
    const keys = Object.keys(DRAWING_WORDS);
    const key = keys[Math.floor(Math.random() * keys.length)];
    const words = DRAWING_WORDS[key as keyof typeof DRAWING_WORDS];
    return { word: words[Math.floor(Math.random() * words.length)], difficulty: key };
  }
  const words = DRAWING_WORDS[difficulty as keyof typeof DRAWING_WORDS] || DRAWING_WORDS.easy;
  return { word: words[Math.floor(Math.random() * words.length)], difficulty };
};

export const getMultipleRandomWords = (difficulties: string[], count: number = 3): { word: string, difficulty: string }[] => {
  const shuffled = [...difficulties].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((diff) => {
    const words = DRAWING_WORDS[diff as keyof typeof DRAWING_WORDS];
    return { word: words[Math.floor(Math.random() * words.length)], difficulty: diff };
  });
};

export const getWordChoicesFromDifficulty = (difficulty: string, count: number = 3): { word: string, difficulty: string }[] => {
  const words = DRAWING_WORDS[difficulty as keyof typeof DRAWING_WORDS] || DRAWING_WORDS.easy;
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(word => ({ word, difficulty }));
};
