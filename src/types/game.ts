export type StepType = 'WORD' | 'DRAWING' | 'GUESS';

export interface BookletStep {
  type: StepType;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  /** WORD / GUESS: 텍스트, DRAWING: 이미지 data URL (빈 문자열이면 시간 초과로 미제출) */
  content: string;
}

export interface Booklet {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  steps: BookletStep[];
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
}

export interface Settings {
  category: string;
  drawTime: number;
  guessTime: number;
  customWords: string[];
}

export type ReactionType = 'funny' | 'art' | 'twist';
/** key = `${bookletId}:${stepIndex}` → 반응 종류별 투표자 id 목록 */
export type Reactions = Record<string, Record<ReactionType, string[]>>;

export interface RevealPos {
  /** 보고 있는 스케치북 번호. booklets.length 이면 최종 결과 화면 */
  b: number;
  /** 현재 펼친 페이지 번호 */
  s: number;
}

/* ---------- 온라인 ---------- */
export type OnlinePhase = 'LOBBY' | 'WORD_PICK' | 'PLAYING' | 'REVEAL';

export interface OnlinePlayer extends Player {
  connected: boolean;
  submitted: boolean;
}

export interface OnlineState {
  roomId: string;
  phase: OnlinePhase;
  hostId: string;
  players: OnlinePlayer[];
  settings: Settings;
  round: number;
  totalRounds: number;
  deadline: number;
  serverTime: number;
  youId: string;
  reveal: RevealPos;
  reactions: Reactions;
  card?: string[];
  picked?: boolean;
}

export interface Task {
  round: number;
  type: 'DRAWING' | 'GUESS';
  text: string | null;
  image: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  category: 'easy',
  drawTime: 60,
  guessTime: 30,
  customWords: [],
};

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;
