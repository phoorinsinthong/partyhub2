export interface PlayerData {
  nickname: string;
  avatar: string;
  isHost?: boolean;
  score?: number;
  online?: boolean;
  lastSeen?: number;
  role?: string;
  isAlive?: boolean;
  [key: string]: unknown;
}

export interface BaseGameState {
  status: 'waiting' | 'setup' | 'playing' | 'finished';
  phase?: string;
  timerEnd?: number | null;
  roundNumber?: number;
  winner?: string | null;
  [key: string]: unknown;
}

export interface WerewolfGameState extends BaseGameState {
  phase: 'night' | 'day_discussion' | 'day_voting' | 'ended';
  roles?: Record<string, string>;
  votes?: Record<string, string>;
  eliminated?: string[];
}

export interface SpyfallGameState extends BaseGameState {
  location?: string;
  spyNickname?: string;
  votes?: Record<string, string>;
}

export interface QuizGameState extends BaseGameState {
  currentQuestionIndex?: number;
  answers?: Record<string, number>;
  scores?: Record<string, number>;
}

export interface WordBombGameState extends BaseGameState {
  category?: string;
  currentTurnIndex?: number;
  turnOrder?: string[];
  lives?: Record<string, number>;
  usedCategories?: string[];
}

export interface DrawingGameState extends BaseGameState {
  drawerNickname?: string;
  secretWord?: string;
  guesses?: Record<string, string>;
}

export interface CardGameState extends BaseGameState {
  tableCards?: unknown[];
  currentTurn?: string;
  hands?: Record<string, unknown[]>;
}

export type SpecificGameState =
  | WerewolfGameState
  | SpyfallGameState
  | QuizGameState
  | WordBombGameState
  | DrawingGameState
  | CardGameState
  | BaseGameState;

export interface RoomData {
  currentGame: string;
  status: 'waiting' | 'playing' | 'finished';
  host: string;
  players: Record<string, PlayerData>;
  gameData?: SpecificGameState;
  createdAt?: number;
  updatedAt?: number;
  hostDisconnectedAt?: number | null;
}
