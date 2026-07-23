import { useEffect, useRef, useState } from 'react';
import { ref, onValue, onDisconnect, update, set, serverTimestamp, remove, get, OnDisconnect } from 'firebase/database';
import { db } from '../firebase';

const GRACE_PERIOD_MS = 600000;
const GRACE_PERIOD_PLAYING_MS = 900000;

export function useHostPromotedToast(): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const handler = () => { setShow(true); setTimeout(() => setShow(false), 4000); };
    window.addEventListener('partyhub:hostPromoted', handler);
    return () => window.removeEventListener('partyhub:hostPromoted', handler);
  }, []);
  return show;
}

export function usePresence(roomId: string, nickname: string, isHost: boolean): void {
  const visibilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOfflineDueToVisibilityRef = useRef(false);
  const kickedRef = useRef(false);
  const onDisconnectRefs = useRef<OnDisconnect[]>([]);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasBeenOnlineRef = useRef(false);

  useEffect(() => {
    if (!roomId || !nickname) return;

    kickedRef.current = false;
    hasBeenOnlineRef.current = false;

    const connectedRef = ref(db, '.info/connected');
    const playerRef = ref(db, `rooms/${roomId}/players/${nickname}`);
    const playerPresenceRef = ref(db, `rooms/${roomId}/players/${nickname}/online`);
    const playerLastSeenRef = ref(db, `rooms/${roomId}/players/${nickname}/lastSeen`);
    const hostDisconnectedRef = ref(db, `rooms/${roomId}/hostDisconnectedAt`);

    // Watch own player node — if deleted (kicked), stop all writes
    const unsubPlayer = onValue(playerRef, (snap) => {
      if (snap.exists()) {
        hasBeenOnlineRef.current = true;
      } else if (hasBeenOnlineRef.current) {
        kickedRef.current = true;
        onDisconnectRefs.current.forEach(od => {
          try { od.cancel(); } catch { /* ignore */ }
        });
        onDisconnectRefs.current = [];
      }
    });

    const unsubConnected = onValue(connectedRef, (snap) => {
      if (!snap.val() || kickedRef.current) return;

      // Cancel any previously registered onDisconnect handlers before re-registering
      onDisconnectRefs.current.forEach(od => { try { od.cancel(); } catch { /* ignore */ } });
      onDisconnectRefs.current = [];

      update(playerRef, {
        online: true,
        lastSeen: serverTimestamp()
      });

      const odPlayer = onDisconnect(playerPresenceRef);
      odPlayer.set(false);
      onDisconnectRefs.current.push(odPlayer);

      const odLastSeen = onDisconnect(playerLastSeenRef);
      odLastSeen.set(serverTimestamp());
      onDisconnectRefs.current.push(odLastSeen);

      if (isHost) {
        const odHost = onDisconnect(hostDisconnectedRef);
        odHost.set(serverTimestamp());
        onDisconnectRefs.current.push(odHost);

        update(ref(db, `rooms/${roomId}`), { hostDisconnectedAt: null });
      }
    });

    const handleBackground = () => {
      if (kickedRef.current) return;
      if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current);
      }
      visibilityTimerRef.current = setTimeout(() => {
        if (kickedRef.current) return;
        wasOfflineDueToVisibilityRef.current = true;
        update(playerRef, {
          online: false,
          lastSeen: Date.now()
        });
        if (isHost) {
          set(hostDisconnectedRef, Date.now());
        }
      }, 5000);
    };

    const handleForeground = () => {
      if (kickedRef.current) return;
      if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current);
        visibilityTimerRef.current = null;
      }
      if (wasOfflineDueToVisibilityRef.current) {
        wasOfflineDueToVisibilityRef.current = false;
        update(playerRef, {
          online: true,
          lastSeen: serverTimestamp()
        });
        if (isHost) {
          set(hostDisconnectedRef, null);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBackground();
      } else if (document.visibilityState === 'visible') {
        handleForeground();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleBackground);

    return () => {
      unsubPlayer();
      unsubConnected();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleBackground);
      if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current);
        visibilityTimerRef.current = null;
      }
      onDisconnectRefs.current.forEach(od => {
        try { od.cancel(); } catch { /* ignore */ }
      });
      onDisconnectRefs.current = [];
    };
  }, [roomId, nickname, isHost]);

  // Watch for host disconnection (non-host players) — attempt host transfer or delete room
  useEffect(() => {
    if (!roomId || !nickname || isHost) return;

    const hostDisconnectedRef = ref(db, `rooms/${roomId}/hostDisconnectedAt`);

    const unsubHost = onValue(hostDisconnectedRef, (snap) => {
      const disconnectedAt = snap.val();

      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }

      if (!disconnectedAt) return;

      const elapsed = Date.now() - disconnectedAt;
      const remaining = GRACE_PERIOD_MS - elapsed;

      const GM_GAMES = ['werewolf', 'twentyquestions'];

      const handleHostGone = async () => {
        // Stagger: only the first online player (sorted alphabetically) should attempt transfer
        // Others wait a bit and re-check to avoid race conditions
        const playersSnap = await get(ref(db, `rooms/${roomId}/players`));
        if (!playersSnap.exists()) {
          remove(ref(db, `rooms/${roomId}`));
          return;
        }

        const players = playersSnap.val();
        const onlinePlayers = Object.entries(players)
          .filter(([, p]: [string, Record<string, unknown>]) => p.online === true)
          .sort(([a], [b]) => a.localeCompare(b));

        if (onlinePlayers.length === 0) {
          remove(ref(db, `rooms/${roomId}`));
          return;
        }

        // Only the first online player (alphabetically) performs the transfer
        const [firstOnlineName] = onlinePlayers[0];
        if (firstOnlineName !== nickname) return;

        // Re-check hostDisconnectedAt (may have been cleared by another client)
        const hostStillGone = await get(ref(db, `rooms/${roomId}/hostDisconnectedAt`));
        if (!hostStillGone.val()) return;

        const roomSnap = await get(ref(db, `rooms/${roomId}`));
        if (!roomSnap.exists()) return;
        const room = roomSnap.val();

        // Games with a GM/moderator role — never transfer host mid-game,
        // just clear the disconnect flag so the host can reconnect as GM.
        if (GM_GAMES.includes(room.currentGame) && room.status === 'playing') {
          await update(ref(db, `rooms/${roomId}`), { hostDisconnectedAt: null });
          return;
        }

        const oldHost = room.host;
        const newHostName = firstOnlineName;

        // Perform atomic update for all changes to prevent race conditions or invalid states
        const updates: Record<string, unknown> = {};
        updates['host'] = newHostName;
        updates['hostDisconnectedAt'] = null;
        updates[`players/${newHostName}/isHost`] = true;
        if (oldHost && players[oldHost]) {
          updates[`players/${oldHost}/isHost`] = false;
        }

        await update(ref(db, `rooms/${roomId}`), updates);
        window.dispatchEvent(new CustomEvent('partyhub:hostPromoted'));
      };

      if (remaining <= 0) {
        handleHostGone();
      } else {
        cleanupTimerRef.current = setTimeout(handleHostGone, remaining);
      }
    });

    return () => {
      unsubHost();
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
    };
  }, [roomId, nickname, isHost]);
}

export function usePlayerCleanup(roomId: string): void {
  const cleanupTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const isPlayingRef = useRef(false);

  useEffect(() => {
    if (!roomId) return;

    const unsubStatus = onValue(ref(db, `rooms/${roomId}/status`), (snap) => {
      isPlayingRef.current = snap.val() === 'playing';
    });

    const unsubPlayers = onValue(ref(db, `rooms/${roomId}/players`), (snap) => {
      if (!snap.exists()) {
        remove(ref(db, `rooms/${roomId}`));
        return;
      }

      const players = snap.val();
      const gracePeriod = isPlayingRef.current ? GRACE_PERIOD_PLAYING_MS : GRACE_PERIOD_MS;
      const now = Date.now();

      Object.entries(players).forEach(([name, data]: [string, Record<string, unknown>]) => {
        if (data.online === false && data.lastSeen) {
          const elapsed = now - data.lastSeen;
          const remaining = gracePeriod - elapsed;

          if (!cleanupTimersRef.current[name]) {
            if (remaining <= 0) {
              remove(ref(db, `rooms/${roomId}/players/${name}`));
            } else {
              cleanupTimersRef.current[name] = setTimeout(() => {
                remove(ref(db, `rooms/${roomId}/players/${name}`));
                delete cleanupTimersRef.current[name];
              }, remaining);
            }
          }
        } else {
          if (cleanupTimersRef.current[name]) {
            clearTimeout(cleanupTimersRef.current[name]);
            delete cleanupTimersRef.current[name];
          }
        }
      });
    });

    return () => {
      unsubStatus();
      unsubPlayers();
      Object.values(cleanupTimersRef.current).forEach(clearTimeout);
      cleanupTimersRef.current = {};
    };
  }, [roomId]);
}
