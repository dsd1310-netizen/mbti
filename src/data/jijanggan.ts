/**
 * 지장간(支藏干) — 지지(地支) 12개가 각각 품고 있는 "숨은 천간" 데이터.
 * 여기(餘氣)·중기(中氣)·정기(正氣) 3단계로 구성(자·묘·유는 중기 없이 2단계).
 * 명리학에서 이견이 거의 없는 표준(월률분야) 데이터 — compatibility.ts와 동일하게
 * 지지 인덱스(0=자~11=해, sajuCalculator.ts의 EARTHLY_BRANCHES 순서) 기준 lookup table.
 */
import { HEAVENLY_STEMS } from '../utils/sajuCalculator';

export interface JijangganEntry {
  stemIdx: number;
  name: string;
  hanja: string;
  stage: '여기' | '중기' | '정기';
}

// 지지 인덱스 → 천간 인덱스 배열([여기, 중기?, 정기] 순서. 자/묘/유는 중기 없이 2개)
const JIJANGGAN_STEM_IDX: Record<number, number[]> = {
  0: [8, 9],       // 자(子): 임(여기)·계(정기)
  1: [9, 7, 5],    // 축(丑): 계(여기)·신(중기)·기(정기)
  2: [4, 2, 0],    // 인(寅): 무(여기)·병(중기)·갑(정기)
  3: [0, 1],       // 묘(卯): 갑(여기)·을(정기)
  4: [1, 9, 4],    // 진(辰): 을(여기)·계(중기)·무(정기)
  5: [4, 6, 2],    // 사(巳): 무(여기)·경(중기)·병(정기)
  6: [2, 5, 3],    // 오(午): 병(여기)·기(중기)·정(정기)
  7: [3, 1, 5],    // 미(未): 정(여기)·을(중기)·기(정기)
  8: [4, 8, 6],    // 신(申): 무(여기)·임(중기)·경(정기)
  9: [6, 7],       // 유(酉): 경(여기)·신(정기)
  10: [7, 3, 4],   // 술(戌): 신(여기)·정(중기)·무(정기)
  11: [4, 0, 8],   // 해(亥): 무(여기)·갑(중기)·임(정기)
};

const STAGE_LABELS: Record<number, JijangganEntry['stage']> = { 0: '여기', 1: '중기', 2: '정기' };

export function getJijanggan(branchIdx: number): JijangganEntry[] {
  const stemIdxList = JIJANGGAN_STEM_IDX[((branchIdx % 12) + 12) % 12];
  return stemIdxList.map((stemIdx, i) => {
    const stem = HEAVENLY_STEMS[stemIdx];
    // 2단계(여기/정기)인 지지는 마지막 자리가 정기
    const stage = stemIdxList.length === 2
      ? (i === 0 ? '여기' : '정기')
      : STAGE_LABELS[i];
    return { stemIdx, name: stem.name, hanja: stem.hanja, stage };
  });
}
