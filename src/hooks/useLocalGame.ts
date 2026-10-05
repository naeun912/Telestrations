import { useCallback, useState } from 'react';
import { Booklet, Player, Reactions, ReactionType, RevealPos, Settings } from '../types/game';
import { dealCard } from '../data/words';
import { bookletIndexFor, stepTypeFor, totalRoundsFor } from '../game/logic';

export type LocalPhase = 'SHIELD' | 'PICK' | 'TURN' | 'REVEAL';

export interface LocalState {
  players: Player[];
  settings: Settings;
  cards: string[][];
  booklets: Booklet[];
  phase: LocalPhase;
  /** SHIELD 다음에 보여줄 단계 */
  shieldNext: 'PICK' | 'TURN';
  cursor: number;
  round: number;
  totalRounds: number;
  deadline: number;
  reveal: RevealPos;
  reactions: Reactions;
}

/** 한 기기로 돌려가며 하는 모드의 진행 상태 */
export function useLocalGame() {
  const [game, setGame] = useState<LocalState | null>(null);

  const start = useCallback((players: Player[], settings: Settings) => {
    const used = new Set<string>();
    const cards = players.map(() => dealCard(settings.category, settings.customWords, used));
    setGame({
      players,
      settings,
      cards,
      booklets: players.map((p, i) => ({
        id: `b${i}`,
        ownerId: p.id,
        ownerName: p.name,
        ownerAvatar: p.avatar,
        steps: [],
      })),
      phase: 'SHIELD',
      shieldNext: 'PICK',
      cursor: 0,
      round: 0,
      totalRounds: totalRoundsFor(players.length),
      deadline: 0,
      reveal: { b: 0, s: 0 },
      reactions: {},
    });
  }, []);

  /** "내 차례 시작" 버튼 */
  const ready = useCallback(() => {
    setGame((g) => {
      if (!g || g.phase !== 'SHIELD') return g;
      if (g.shieldNext === 'PICK') return { ...g, phase: 'PICK' };
      const secs = stepTypeFor(g.round) === 'DRAWING' ? g.settings.drawTime : g.settings.guessTime;
      return { ...g, phase: 'TURN', deadline: Date.now() + secs * 1000 };
    });
  }, []);

  const pick = useCallback((index: number) => {
    setGame((g) => {
      if (!g || g.phase !== 'PICK') return g;
      const me = g.players[g.cursor];
      const booklets = g.booklets.map((b, i) =>
        i === g.cursor
          ? {
              ...b,
              steps: [
                {
                  type: 'WORD' as const,
                  authorId: me.id,
                  authorName: me.name,
                  authorAvatar: me.avatar,
                  content: g.cards[g.cursor][index],
                },
              ],
            }
          : b,
      );
      if (g.cursor < g.players.length - 1) {
        return { ...g, booklets, phase: 'SHIELD', shieldNext: 'PICK', cursor: g.cursor + 1 };
      }
      return { ...g, booklets, phase: 'SHIELD', shieldNext: 'TURN', cursor: 0, round: 1 };
    });
  }, []);

  const submit = useCallback((content: string) => {
    setGame((g) => {
      if (!g || g.phase !== 'TURN') return g;
      const N = g.players.length;
      const me = g.players[g.cursor];
      const type = stepTypeFor(g.round);
      const target = bookletIndexFor(g.cursor, g.round, N);
      const value = type === 'GUESS' && !content.trim() ? '???' : content;
      const booklets = g.booklets.map((b, i) =>
        i === target
          ? {
              ...b,
              steps: [
                ...b.steps,
                { type, authorId: me.id, authorName: me.name, authorAvatar: me.avatar, content: value },
              ],
            }
          : b,
      );
      if (g.cursor < N - 1) return { ...g, booklets, phase: 'SHIELD', shieldNext: 'TURN', cursor: g.cursor + 1 };
      if (g.round < g.totalRounds) {
        return { ...g, booklets, phase: 'SHIELD', shieldNext: 'TURN', cursor: 0, round: g.round + 1 };
      }
      return { ...g, booklets, phase: 'REVEAL', reveal: { b: 0, s: 0 } };
    });
  }, []);

  const setReveal = useCallback((b: number, s: number) => {
    setGame((g) => (g ? { ...g, reveal: { b, s } } : g));
  }, []);

  /** 한 기기에서는 누가 눌렀는지 구분이 없으므로, 누를 때마다 박수처럼 +1 */
  const react = useCallback((key: string, type: ReactionType) => {
    setGame((g) => {
      if (!g) return g;
      const entry = g.reactions[key] ?? { funny: [], art: [], twist: [] };
      return {
        ...g,
        reactions: {
          ...g.reactions,
          [key]: { ...entry, [type]: [...entry[type], `local-${entry[type].length}`] },
        },
      };
    });
  }, []);

  const reset = useCallback(() => setGame(null), []);

  return { game, start, ready, pick, submit, setReveal, react, reset };
}
