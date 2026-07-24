export interface PlayerData {
  nickname: string;
  avatar: string;
  isHost?: boolean;
  score?: number;
  [key: string]: any; // Allow specific game data per player
}

export interface GameState {
  status: 'waiting' | 'setup' | 'playing' | 'finished';
  phase?: string;
  [key: string]: any; // Allow specific game data
}

export interface RoomData {
  currentGame: string;
  status: 'waiting' | 'playing' | 'finished';
  host: string;
  players: Record<string, PlayerData>;
  gameData?: GameState;
  createdAt?: number;
  updatedAt?: number;
}
