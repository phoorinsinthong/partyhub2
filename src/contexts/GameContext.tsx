// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ref, onValue, off, DatabaseReference } from 'firebase/database';
import { db } from '../firebase';

export interface Player {
  name: string;
  avatar?: string;
  avatarColor?: string;
  isHost?: boolean;
  joinedAt?: number;
  lastActive?: number;
  [key: string]: any;
}

export interface RoomData {
  status: 'waiting' | 'playing' | 'finished';
  currentGame: string;
  host: string;
  players: Record<string, Player>;
  gameData?: any;
  [key: string]: any;
}

interface GameContextType {
  roomId: string | null;
  roomData: RoomData | null;
  userNickname: string | null;
  isHost: boolean;
  isLoading: boolean;
  error: string | null;
  setRoomId: (id: string | null) => void;
  setUserNickname: (name: string | null) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userNickname, setUserNickname] = useState<string | null>(localStorage.getItem('nickname'));
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHost = roomData?.host === userNickname;

  useEffect(() => {
    if (!roomId) {
      if (roomData !== null) setTimeout(() => setRoomData(null), 0);
      if (isLoading) setTimeout(() => setIsLoading(false), 0);
      return;
    }

    const roomRef = ref(db, `rooms/${roomId}`);
    
    const unsubscribe = onValue(roomRef, (snapshot) => {
      setTimeout(() => {
        if (snapshot.exists()) {
          setRoomData(snapshot.val() as RoomData);
          setError(null);
        } else {
          setRoomData(null);
          setError('Room not found');
        }
        setIsLoading(false);
      }, 0);
    }, (err) => {
      console.error('Firebase sync error:', err);
      setError('Connection lost');
      setIsLoading(false);
    });

    return () => {
      off(roomRef);
    };
  }, [roomId]);

  const updateRoomId = (id: string | null) => {
    if (id !== roomId) {
      setRoomId(id);
      if (id) setIsLoading(true);
    }
  };

  const value = {
    roomId,
    roomData,
    userNickname,
    isHost,
    isLoading,
    error,
    setRoomId: updateRoomId,
    setUserNickname
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
