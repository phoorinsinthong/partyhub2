// @ts-nocheck
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook สำหรับป้องกันหน้าจอดับ (Screen Wake Lock API)
 * ใช้ในหน้า GameRoom เพื่อให้ผู้เล่นวางมือถือทิ้งไว้ได้โดยที่จอไม่ดับ
 */
export function useWakeLock() {
  const [isSupported] = useState(() => typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  const [isLocked, setIsLocked] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    if (isSupported && !wakeLockRef.current) {
      try {
        const wakeLock = await navigator.wakeLock.request('screen');
        wakeLockRef.current = wakeLock;
        setIsLocked(true);

        wakeLock.addEventListener('release', () => {
          setIsLocked(false);
          wakeLockRef.current = null;
        });
      } catch (err) {
        console.warn(`[WakeLock] Failed to request wake lock:`, err);
      }
    }
  }, [isSupported]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsLocked(false);
      } catch (err) {
        console.warn(`[WakeLock] Failed to release wake lock:`, err);
      }
    }
  }, []);

  // Re-acquire lock if visibility changes (e.g. user minimized and came back)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [requestWakeLock, releaseWakeLock]);

  return { isSupported, isLocked, requestWakeLock, releaseWakeLock };
}
