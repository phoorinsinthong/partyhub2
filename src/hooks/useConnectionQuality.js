import { useState, useEffect, useRef } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';

export function useConnectionQuality() {
  const [quality, setQuality] = useState('good'); // 'good' | 'slow' | 'disconnected'
  const [latency, setLatency] = useState(null);
  const lastConnectedRef = useRef(Date.now());

  useEffect(() => {
    const connectedRef = ref(db, '.info/connected');
    const offsetRef = ref(db, '.info/serverTimeOffset');

    const unsubConnected = onValue(connectedRef, (snap) => {
      if (!snap.val()) {
        setQuality('disconnected');
      } else {
        const reconnectTime = Date.now() - lastConnectedRef.current;
        // If reconnect took > 5s, mark as slow briefly
        if (reconnectTime > 5000) {
          setQuality('slow');
          setTimeout(() => setQuality('good'), 5000);
        } else {
          setQuality('good');
        }
        lastConnectedRef.current = Date.now();
      }
    });

    // Use serverTimeOffset to estimate latency
    const unsubOffset = onValue(offsetRef, (snap) => {
      const offset = snap.val();
      if (offset !== null) {
        // offset is approximate one-way latency indicator
        const estimatedRtt = Math.abs(offset) < 50 ? Math.abs(offset) + 50 : Math.abs(offset);
        setLatency(Math.round(estimatedRtt));

        if (estimatedRtt > 2000) setQuality('slow');
        else if (estimatedRtt > 800) setQuality('slow');
      }
    });

    return () => {
      unsubConnected();
      unsubOffset();
    };
  }, []);

  return { quality, latency };
}
