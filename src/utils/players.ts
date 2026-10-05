export const PLAYER_COLORS = [
  '#ff5a5f',
  '#ff9f1c',
  '#ffd23f',
  '#2ec4b6',
  '#3a86ff',
  '#8b5cf6',
  '#ff7eb6',
  '#7bd389',
  '#c77d4b',
  '#5ad1ff',
];

export const playerColor = (index: number): string => PLAYER_COLORS[index % PLAYER_COLORS.length];

export const AVATARS = [
  '🐶', '🐱', '🦊', '🐸', '🦄', '🐼', '🐯', '🐙',
  '🦖', '🐧', '🦁', '🐰', '🐨', '🦉', '🐝', '🍕',
];

export const randomAvatar = (): string => AVATARS[Math.floor(Math.random() * AVATARS.length)];

const LS_PROFILE = 'tele_profile';

export interface StoredProfile {
  playerId: string;
  name: string;
  avatar: string;
  roomId: string | null;
}

function makeId(): string {
  return (crypto.randomUUID?.() ?? `p${Date.now()}${Math.random().toString(36).slice(2)}`).slice(0, 36);
}

export function loadProfile(): StoredProfile {
  try {
    const raw = sessionStorage.getItem(LS_PROFILE);
    if (raw) return JSON.parse(raw) as StoredProfile;
  } catch {
    /* ignore */
  }
  return { playerId: makeId(), name: '', avatar: randomAvatar(), roomId: null };
}

export function saveProfile(p: StoredProfile): void {
  try {
    sessionStorage.setItem(LS_PROFILE, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
