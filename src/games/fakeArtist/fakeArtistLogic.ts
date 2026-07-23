// @ts-nocheck
import { WORD_CATEGORIES, ALL_WORDS } from './fakeArtistData';

export const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const countSyllables = (word: string): number => {
  if (!word) return 0;
  const matches = word.match(/[ะ-ูเ-ไ]/g);
  let count = matches ? matches.length : 1;
  if (count === 0 && word.length > 0) count = 1;
  return count;
};

export const getRandomWord = (category: string, usedWords: string[] = []): string => {
  let pool = category === 'random' ? ALL_WORDS : WORD_CATEGORIES[category as keyof typeof WORD_CATEGORIES]?.words || ALL_WORDS;
  
  // Filter out used words if possible
  const availableWords = pool.filter(w => !usedWords.includes(w));
  if (availableWords.length > 0) {
    pool = availableWords;
  }
  
  return pool[Math.floor(Math.random() * pool.length)];
};
