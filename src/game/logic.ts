import { StepType } from '../types/game';

/**
 * 텔레스트레이션 공식 규칙 (인원수 N)
 *
 * - 짝수: 1라운드에 "자기 스케치북"의 제시어를 직접 그린다. 총 N라운드.
 * - 홀수: 제시어를 적은 스케치북을 그리지 않고 바로 옆 사람에게 넘긴다.
 *         옆 사람이 1라운드에 그림을 그린다. 총 N-1라운드.
 * 어느 쪽이든 마지막 페이지는 '추측(글)'이고, 스케치북은 원래 주인에게 돌아온다.
 */
export const isOdd = (n: number): boolean => n % 2 === 1;

export const totalRoundsFor = (n: number): number => (isOdd(n) ? n - 1 : n);

/** 홀수 라운드 = 그림, 짝수 라운드 = 추측 */
export const stepTypeFor = (round: number): Exclude<StepType, 'WORD'> =>
  round % 2 === 1 ? 'DRAWING' : 'GUESS';

/** playerIndex 가 round 라운드에 들고 있는 스케치북(=주인) 번호 */
export const bookletIndexFor = (playerIndex: number, round: number, n: number): number =>
  (((playerIndex - (round - 1) - (isOdd(n) ? 1 : 0)) % n) + n) % n;

export const normalizeAnswer = (s: string): string =>
  s.toLowerCase().replace(/[\s.,!?~'"“”‘’·\-_]/g, '');
