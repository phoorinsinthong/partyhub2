import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Reusable game timer hook.
 * Reads `timerEnd` from Firebase gameData and counts down.
 *
 * @param timerEnd - Unix timestamp when timer expires
 * @param onExpire - Callback when timer hits 0
 * @returns {{ timeLeft, formatTime, isUrgent, isExpired }}
 */
export function useGameTimer(timerEnd: number | null, onExpire: (() => void) | null = null) {
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!timerEnd) return 0;
    return Math.max(0, Math.floor((timerEnd - Date.now()) / 1000));
  });
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => { onExpireRef.current = onExpire; });

  useEffect(() => {
    if (!timerEnd) {
      setTimeout(() => {
        setTimeLeft(0);
      }, 0);
      expiredRef.current = false;
      return;
    }

    expiredRef.current = false;

    // Set initial time correctly when timerEnd changes
    const now = Date.now();
    const initialDiff = Math.max(0, Math.floor((timerEnd - now) / 1000));
    setTimeout(() => {
      setTimeLeft(initialDiff);
    }, 0);

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((timerEnd - now) / 1000));
      
      setTimeLeft(prev => {
        if (prev !== diff) return diff;
        return prev;
      });

      if (diff === 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(interval);
        onExpireRef.current?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerEnd]);

  const formatTime = useCallback((seconds = timeLeft) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  return {
    timeLeft,
    formatTime,
    isUrgent: timeLeft > 0 && timeLeft < 60,
    isExpired: timerEnd !== null && timeLeft === 0,
  };
}

/**
 * Timer duration presets for game settings.
 */
export const TIMER_PRESETS = {
  spyfall: [
    { label: '3 นาที', value: 3 },
    { label: '5 นาที', value: 5 },
    { label: '8 นาที', value: 8 },
    { label: '10 นาที', value: 10 },
    { label: '15 นาที', value: 15 },
  ],
  werewolf: {
    night: [
      { label: '1 นาที', value: 1 },
      { label: '2 นาที', value: 2 },
      { label: '3 นาที', value: 3 },
    ],
    day: [
      { label: '2 นาที', value: 2 },
      { label: '3 นาที', value: 3 },
      { label: '5 นาที', value: 5 },
    ],
  },
};
