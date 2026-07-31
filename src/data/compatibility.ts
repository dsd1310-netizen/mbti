/**
 * 일지(日支) 기준 지지(地支) 궁합 관계 데이터
 * 삼합(三合) · 육합(六合) · 충(沖) · 형(刑) · 파(破) · 해(害)
 */

import { EARTHLY_BRANCHES } from '../utils/sajuCalculator';

// 삼합 그룹: [지지 인덱스 3개, 국(局) 오행]
const SAMHAP_GROUPS: { branches: number[]; element: string }[] = [
  { branches: [2, 6, 10], element: '화(火)' },  // 인오술
  { branches: [5, 9, 1], element: '금(金)' },   // 사유축
  { branches: [8, 0, 4], element: '수(水)' },   // 신자진
  { branches: [11, 3, 7], element: '목(木)' },  // 해묘미
];

// 육합 짝
const YUKHAP_PAIRS: Record<number, number> = {
  0: 1, 1: 0,   // 자축
  2: 11, 11: 2, // 인해
  3: 10, 10: 3, // 묘술
  4: 9, 9: 4,   // 진유
  5: 8, 8: 5,   // 사신
  6: 7, 7: 6,   // 오미
};

// 충(沖)
const CHUNG_PAIRS: Record<number, number> = {
  0: 6, 6: 0,   // 자오
  1: 7, 7: 1,   // 축미
  2: 8, 8: 2,   // 인신
  3: 9, 9: 3,   // 묘유
  4: 10, 10: 4, // 진술
  5: 11, 11: 5, // 사해
};

// 형(刑) 그룹 (삼형 + 상형 + 자형)
const HYEONG_GROUPS: number[][] = [
  [2, 5, 8],   // 인사신 삼형
  [1, 10, 7],  // 축술미 삼형
  [0, 3],      // 자묘 상형
  [4], [6], [9], [11], // 진/오/유/해 자형
];

// 파(破)
const PA_PAIRS: Record<number, number> = {
  0: 9, 9: 0,   // 자유
  1: 4, 4: 1,   // 축진
  2: 11, 11: 2, // 인해
  3: 6, 6: 3,   // 묘오
  5: 8, 8: 5,   // 사신
  10: 7, 7: 10, // 술미
};

// 해(害)
const HAE_PAIRS: Record<number, number> = {
  0: 7, 7: 0,   // 자미
  1: 6, 6: 1,   // 축오
  2: 5, 5: 2,   // 인사
  3: 4, 4: 3,   // 묘진
  8: 11, 11: 8, // 신해
  9: 10, 10: 9, // 유술
};

export interface BranchRef {
  branchIdx: number;
  name: string;
  hanja: string;
  animal: string;
}

export interface BranchRelations {
  samhapPartners: BranchRef[];
  samhapElement: string | null;
  yukhapPartner: BranchRef | null;
  chungPartner: BranchRef | null;
  hyeongPartners: BranchRef[];
  paPartner: BranchRef | null;
  haePartner: BranchRef | null;
}

function toRef(idx: number): BranchRef {
  const b = EARTHLY_BRANCHES[idx];
  return { branchIdx: idx, name: b.name, hanja: b.hanja, animal: b.animal };
}

export function getBranchRelations(dayBranchIdx: number): BranchRelations {
  const samhapGroup = SAMHAP_GROUPS.find(g => g.branches.includes(dayBranchIdx));
  const samhapPartners = samhapGroup
    ? samhapGroup.branches.filter(b => b !== dayBranchIdx).map(toRef)
    : [];

  const yukhapIdx = YUKHAP_PAIRS[dayBranchIdx];
  const chungIdx = CHUNG_PAIRS[dayBranchIdx];
  const paIdx = PA_PAIRS[dayBranchIdx];
  const haeIdx = HAE_PAIRS[dayBranchIdx];

  const hyeongGroup = HYEONG_GROUPS.find(g => g.includes(dayBranchIdx)) ?? [];
  const othersInGroup = hyeongGroup.filter(b => b !== dayBranchIdx);
  // 자형(自刑) 그룹(진/오/유/해)은 그룹원이 자기 자신뿐이므로, 같은 지지를 형의 대상으로 표시
  const hyeongPartners = othersInGroup.length > 0
    ? othersInGroup.map(toRef)
    : [toRef(dayBranchIdx)];

  return {
    samhapPartners,
    samhapElement: samhapGroup?.element ?? null,
    yukhapPartner: yukhapIdx !== undefined ? toRef(yukhapIdx) : null,
    chungPartner: chungIdx !== undefined ? toRef(chungIdx) : null,
    hyeongPartners,
    paPartner: paIdx !== undefined ? toRef(paIdx) : null,
    haePartner: haeIdx !== undefined ? toRef(haeIdx) : null,
  };
}
