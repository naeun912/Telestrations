import wordData from '../../shared/words.json';

export interface WordCategory {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  words: string[];
}

export const WORD_CATEGORIES: WordCategory[] = wordData.categories.map((c) => ({
  id: c.id,
  name: c.name,
  emoji: c.emoji,
  desc: c.desc,
  words: c.words
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean),
}));

export const TOTAL_WORD_COUNT = WORD_CATEGORIES.reduce((sum, c) => sum + c.words.length, 0);

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const allWords = (): string[] => WORD_CATEGORIES.flatMap((c) => c.words);

function poolFor(categoryId: string, customWords: string[]): string[] {
  if (categoryId === 'custom') return customWords;
  if (categoryId === 'all') return allWords();
  return (WORD_CATEGORIES.find((c) => c.id === categoryId) ?? WORD_CATEGORIES[0]).words;
}

/** 제시어 카드 한 장(6단어)을 뽑는다. used 에 든 단어는 다른 플레이어와 겹치지 않게 피한다. */
export function dealCard(categoryId: string, customWords: string[], used: Set<string>): string[] {
  const pool = shuffle(poolFor(categoryId, customWords).filter((w) => !used.has(w)));
  const card = pool.slice(0, 6);
  if (card.length < 6) {
    const filler = shuffle(allWords().filter((w) => !card.includes(w)));
    card.push(...filler.slice(0, 6 - card.length));
  }
  card.forEach((w) => used.add(w));
  return card;
}

export function parseCustomWords(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,\n]/)
        .map((w) => w.trim().slice(0, 20))
        .filter(Boolean),
    ),
  ).slice(0, 200);
}
