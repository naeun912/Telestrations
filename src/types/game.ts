export type GameMode = 'ONLINE' | 'PASS_AND_PLAY';

export type StepType = 'WORD' | 'DRAWING' | 'GUESS';

export interface BookletStep {
  stepIndex: number;
  type: StepType;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  // content is secret word or guess text if WORD/GUESS, or base64 canvas image if DRAWING
  content: string;
}

export interface Booklet {
  id: string; // unique ID
  originalOwnerId: string;
  originalOwnerName: string;
  originalWord: string;
  steps: BookletStep[];
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  hasSubmittedCurrentStep: boolean;
}

export interface RoomSettings {
  category: string;
  timeLimit: number; // seconds per drawing/guessing turn (e.g. 60)
  customWords: string[];
}

export type GamePhase = 'LOBBY' | 'PASS_DEVICE_SHIELD' | 'PLAYING' | 'REVEAL';

export interface RoomState {
  roomId: string;
  mode: GameMode;
  hostId: string;
  players: Player[];
  settings: RoomSettings;
  phase: GamePhase;
  currentRound: number; // 1-based
  totalRounds: number;
  // Booklets array indexed by player sequence
  booklets: Booklet[];
  // For Pass & Play mode: index of current active player
  passAndPlayCurrentPlayerIndex: number;
  // Time remaining in current round
  timeLeft: number;
  // Voting tally on booklets: bookletId -> { funny: number, best: number, twist: number }
  votes: Record<string, { funny: number; best: number; twist: number }>;
}
