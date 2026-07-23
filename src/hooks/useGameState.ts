// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, update, get } from 'firebase/database';
import { db } from '../firebase';
import { RoomData, GameState } from '../types/game';

export function useGameState<T extends GameState>(roomId: string | undefined) {
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }

    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(
      roomRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setRoomData(snapshot.val() as RoomData);
        } else {
          setRoomData(null);
        }
        setIsLoading(false);
      },
      (err) => {
        console.error('Firebase error:', err);
        setError('Failed to sync game state');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [roomId]);

  const updateGame = useCallback(
    async (updates: Partial<T>) => {
      if (!roomId) return false;
      try {
        await update(ref(db, `rooms/${roomId}/gameData`), updates);
        return true;
      } catch (err) {
        console.error('Failed to update game state', err);
        setError('Failed to update game state');
        return false;
      }
    },
    [roomId]
  );

  const updateRoom = useCallback(
    async (updates: Partial<RoomData>) => {
      if (!roomId) return false;
      try {
        await update(ref(db, `rooms/${roomId}`), updates);
        return true;
      } catch (err) {
        console.error('Failed to update room state', err);
        setError('Failed to update room state');
        return false;
      }
    },
    [roomId]
  );
  
  const updatePlayer = useCallback(
    async (nickname: string, updates: any) => {
        if (!roomId) return false;
        try {
            await update(ref(db, `rooms/${roomId}/players/${nickname}`), updates);
            return true;
        } catch (err) {
            console.error('Failed to update player', err);
            return false;
        }
    },
    [roomId]
  )

  const clearError = useCallback(() => setError(null), []);

  return {
    roomData,
    gameData: roomData?.gameData as T | undefined,
    isLoading,
    error,
    updateGame,
    updateRoom,
    updatePlayer,
    clearError,
  };
}
