import { useState, useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';

export function useConnectionQuality() {
  const [quality, setQuality] = useState<'good' | 'slow' | 'disconnected'>('good');
  const [latency, setLatency] = useState<number | null>(null);
  const lastConnectedRef = useRef(0);

  useEffect(() => {
    lastConnectedRef.current = Date.now();
    const connectedRef = ref(db, '.info/connected');
    const offsetRef = ref(db, '.info/serverTimeOffset');

    const unsubConnected = onValue(connectedRef, (snap) => {
      if (!snap.val()) {
        setQuality('disconnected');
      } else {
        const reconnectTime = Date.now() - lastConnectedRef.current;
        if (reconnectTime > 5000) {
          setQuality('slow');
          setTimeout(() => setQuality('good'), 5000);
        } else {
          setQuality('good');
        }
        lastConnectedRef.current = Date.now();
      }
    });

    const unsubOffset = onValue(offsetRef, (snap) => {
      const offset = snap.val() as number | null;
      if (offset !== null) {
        const estimatedRtt = Math.abs(offset) < 50 ? Math.abs(offset) + 50 : Math.abs(offset);
        setLatency(Math.round(estimatedRtt));

        if (estimatedRtt > 800) setQuality('slow');
      }
    });

    return () => {
      unsubConnected();
      unsubOffset();
    };
  }, []);

  return { quality, latency };
}
