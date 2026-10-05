export interface WordCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  words: string[];
}

export const WORD_CATEGORIES: WordCategory[] = [
  {
    id: 'easy',
    name: '쉬움 (일상 & 동물)',
    emoji: '🐶',
    description: '어린이부터 누구나 쉽게 그릴 수 있는 단어들',
    words: [
      '피자', '강아지', '고양이', '사과', '바나나', '아이스크림', '선풍기', '스마트폰',
      '자동차', '비행기', '자전거', '우산', '선글라스', '시계', '냉장고', '컴퓨터',
      '햄버거', '초밥', '치킨', '호랑이', '토끼', '곰인형', '펭귄', '문어',
      '무지개', '눈사람', '크리스마스 트리', '신발', '모자', '가방', '칫솔', '경찰차'
    ]
  },
  {
    id: 'movies_drama',
    name: '영화 & 애니 & 캐릭터',
    emoji: '🎬',
    description: '유명한 영화, 애니메이션, 캐릭터 단어',
    words: [
      '기생충', '오징어 게임', '아바타', '스파이더맨', '아이언맨', '겨울왕국 엘사', '피카츄',
      '짱구', '도라에몽', '토토로', '해리포터', '센과 치히로', '범죄도시 마동석', '스폰지밥',
      '신비아파트', '미니언즈', '타노스', '슈렉', '쿵푸팬더', '슬램덩크 강백호', '귀멸의 칼날'
    ]
  },
  {
    id: 'memes_internet',
    name: '밈 & 신조어 & 짤',
    emoji: '🔥',
    description: '인터넷 밈과 웃긴 상황 단어',
    words: [
      '너 T야?', '중꺾마', '킹받네', '폼 미쳤다', '월급루팡', '당근마켓 거래', '야근하는 직장인',
      '지하철 개찰구 삑', '배달의민족 리뷰 작성', '주식 떡락', '코인 떡상', '탕후루',
      '로또 1등 당첨', '제로투 댄스', '방탈출 실패', '붕어빵 틀', '영수증 버려주세요'
    ]
  },
  {
    id: 'kpop_food',
    name: '음식 & K-POP',
    emoji: '🍕',
    description: '맛있는 음식과 K-POP 연예계',
    words: [
      '떡볶이', '마라탕', '삼겹살 구이', '짜장면', '마카롱', '삼각김밥', '빙수', '소주',
      'BTS콘서트', '블랙핑크', '뉴진스 춤', '노래방 샤우팅', '아이돌 응원봉', '레드카펫',
      '무대 인사', '싸인회', '팬미팅', '버스킹', 'DJ 디제잉'
    ]
  },
  {
    id: 'hard',
    name: '매움 (추상적 & 고난도)',
    emoji: '🌶️',
    description: '그리기 까다롭고 웃긴 억지 추측 유발 단어',
    words: [
      '흑역사', '데자뷔', '짝사랑', '불면증', '월요병', '시공의 폭풍', '투명인간',
      '타임머신', '시공간 트위스트', '멘탈붕괴', '영혼 이탈', '자아 분열', '세계 평화',
      '착시 현상', '블랙홀', '초능력자', '기억상실증', '평행세계', '인공지능 딥러닝'
    ]
  }
];

export function getRandomWord(categoryId: string, customWords: string[] = []): string {
  if (categoryId === 'custom' && customWords.length > 0) {
    const idx = Math.floor(Math.random() * customWords.length);
    return customWords[idx];
  }
  
  const category = WORD_CATEGORIES.find(c => c.id === categoryId) || WORD_CATEGORIES[0];
  const allWords = categoryId === 'all' 
    ? WORD_CATEGORIES.flatMap(c => c.words)
    : category.words;
    
  const idx = Math.floor(Math.random() * allWords.length);
  return allWords[idx];
}

export function getRandomWords(count: number, categoryId: string, customWords: string[] = []): string[] {
  const wordsSet = new Set<string>();
  const category = WORD_CATEGORIES.find(c => c.id === categoryId) || WORD_CATEGORIES[0];
  let pool = categoryId === 'all'
    ? WORD_CATEGORIES.flatMap(c => c.words)
    : (categoryId === 'custom' && customWords.length > 0 ? customWords : category.words);

  if (pool.length === 0) {
    pool = WORD_CATEGORIES[0].words;
  }

  // Shuffle pool
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    wordsSet.add(shuffled[i]);
  }
  
  // Fill up if needed
  while (wordsSet.size < count) {
    const fallbackWord = WORD_CATEGORIES[0].words[Math.floor(Math.random() * WORD_CATEGORIES[0].words.length)];
    wordsSet.add(fallbackWord + (wordsSet.size + 1));
  }

  return Array.from(wordsSet);
}
