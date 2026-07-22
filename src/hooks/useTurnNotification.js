import { useEffect, useRef } from 'react';
import { feedback } from '../utils/feedback';

const TITLE_FLASH_INTERVAL = 1000;

export function useTurnNotification(isMyTurn, phase) {
  const flashIntervalRef = useRef(null);
  const originalTitleRef = useRef(document.title);
  const prevIsMyTurnRef = useRef(false);

  useEffect(() => {
    if (isMyTurn && !prevIsMyTurnRef.current && phase === 'playing') {
      feedback('newRound');

      if (document.hidden) {
        let showAlert = true;
        flashIntervalRef.current = setInterval(() => {
          document.title = showAlert ? '🔔 ถึงเทิร์นคุณแล้ว!' : originalTitleRef.current;
          showAlert = !showAlert;
        }, TITLE_FLASH_INTERVAL);
      }
    }

    prevIsMyTurnRef.current = isMyTurn;
  }, [isMyTurn, phase]);

  useEffect(() => {
    const originalTitle = originalTitleRef.current;
    const handleVisibility = () => {
      if (!document.hidden && flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
        flashIntervalRef.current = null;
        document.title = originalTitle;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (flashIntervalRef.current) {
        clearInterval(flashIntervalRef.current);
        document.title = originalTitle;
      }
    };
  }, []);
}
