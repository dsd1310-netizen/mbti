/**
 * 신살(神殺) 8종 — 도화살·역마살·화개살·양인살·괴강살·백호살·원진살·귀문관살.
 *
 * [신뢰도 참고] 도화/역마/화개는 "申子辰見酉為桃花" 식의 널리 알려진 고전 공식을 그대로
 * 옮긴 것(문헌 간 이견 없음). 양인살(음간 제외, 양간 5개 기준)도 표준적으로 통용되는 표.
 * 반면 괴강살 정확한 4개 60갑자, 백호살 정확한 7개 60갑자, 원진살/귀문관살의 정확한
 * 지지 쌍은 유파·문헌마다 미세한 차이가 있음 — 여기선 가장 흔히 인용되는 표준 조합을
 * 채택(계획안.md에 근거 기록). solarTerms 재검증 때처럼 "1차 사료 대조"는 어려운 영역.
 * (도화/역마/화개 판별용 삼합 그룹은 compatibility.ts의 SAMHAP_GROUPS와 같은 4그룹이지만,
 * 신살 전용 타깃 지지가 추가로 필요해 이 파일 안에 별도 테이블로 둠.)
 */

export type SinsalType = '도화살' | '역마살' | '화개살' | '양인살' | '괴강살' | '백호살' | '원진살' | '귀문관살';

export const SINSAL_INFO: Record<SinsalType, { emoji: string; desc: string }> = {
  '도화살': { emoji: '🌸', desc: '이성에게 매력적으로 비치는 기운 — 인기·사교성으로도 풀림' },
  '역마살': { emoji: '🐎', desc: '이동·변화의 기운 — 여행·무역·이직처럼 움직이는 일에 강함' },
  '화개살': { emoji: '🎭', desc: '예술·종교·학문의 기운 — 혼자만의 몰입과 재능으로 풀림' },
  '양인살': { emoji: '⚔️', desc: '칼날 같은 강한 기운 — 추진력과 결단력이 강한 대신 날카로움 주의' },
  '괴강살': { emoji: '👑', desc: '우두머리의 극강한 기운 — 큰 그릇이지만 기복이 클 수 있음' },
  '백호살': { emoji: '🐯', desc: '예측 못 할 강한 기운 — 특수한 재능·집중력으로 다스리면 강점' },
  '원진살': { emoji: '💢', desc: '서로 미묘하게 어긋나는 기운 — 가까운 관계에서 특히 두드러짐' },
  '귀문관살': { emoji: '🌀', desc: '생각이 많아지는 예민한 기운 — 몰입·직관력으로 잘 풀리기도 함' },
};

// 삼합 그룹별 도화/역마/화개 지지(고전 공식 "OO견OO위도화" 그대로 반영)
// [2026-08-21 수정] 화개 값이 그룹 간 뒤바뀌어 있던 버그 수정 — "OO견OO위화개"는 항상 그
// 삼합 그룹 자신의 고지(墓/庫) 지지를 가리킨다(寅午戌见戌·巳酉丑见丑·申子辰见辰·亥卯未见未,
// 이미 각 그룹의 branches에 포함된 멤버 중 하나). 기존 값은 1↔4그룹, 2↔3그룹이 서로 맞바뀌어
// 있었음(예: 인오술의 화개는 술(10)이어야 하는데 미(7)로 잘못 들어가 있었음).
const SAMHAP_SINSAL_TARGETS: { branches: number[]; dohwa: number; yeokma: number; hwagae: number }[] = [
  { branches: [2, 6, 10], dohwa: 3, yeokma: 8, hwagae: 10 },  // 인오술 → 묘/신/술
  { branches: [5, 9, 1], dohwa: 6, yeokma: 11, hwagae: 1 },   // 사유축 → 오/해/축
  { branches: [8, 0, 4], dohwa: 9, yeokma: 2, hwagae: 4 },    // 신자진 → 유/인/진
  { branches: [11, 3, 7], dohwa: 0, yeokma: 5, hwagae: 7 },   // 해묘미 → 자/사/미
];

// 일간(천간 인덱스) → 양인살 지지. 양간(갑·병·무·경·임)만 해당.
const YANGIN_BY_DAY_STEM: Record<number, number> = {
  0: 3,  // 갑 → 묘
  2: 6,  // 병 → 오
  4: 6,  // 무 → 오
  6: 9,  // 경 → 유
  8: 0,  // 임 → 자
};

// 괴강살 — 일주(일간+일지) 조합 4개(경진·임진·무술·경술)
const GOEGANG_ILJU: [number, number][] = [[6, 4], [8, 4], [4, 10], [6, 10]];

// 백호살 — 사주 8글자 중 이 60갑자 조합(간지 쌍)이 있으면 해당. 갑진·을미·병술·정축·무진·임술·계축.
const BAEKHO_GANJI: [number, number][] = [[0, 4], [1, 7], [2, 10], [3, 1], [4, 4], [8, 10], [9, 1]];

// 원진살 지지 쌍
const WONJIN_PAIRS: [number, number][] = [[0, 7], [1, 6], [2, 9], [3, 8], [4, 11], [5, 10]];
// 귀문관살 지지 쌍
const GWIMUNGWAN_PAIRS: [number, number][] = [[0, 9], [1, 6], [2, 7], [3, 8], [4, 11], [5, 10]];

function hasPair(branchIndices: number[], pairs: [number, number][]): boolean {
  for (let i = 0; i < branchIndices.length; i++) {
    for (let j = i + 1; j < branchIndices.length; j++) {
      const a = branchIndices[i], b = branchIndices[j];
      if (pairs.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) return true;
    }
  }
  return false;
}

export function getSinsal(params: {
  dayStemIdx: number;
  yearBranchIdx: number;
  monthBranchIdx: number;
  dayBranchIdx: number;
  hourBranchIdx: number | null;
}): SinsalType[] {
  const { dayStemIdx, yearBranchIdx, monthBranchIdx, dayBranchIdx, hourBranchIdx } = params;
  const allBranches = [yearBranchIdx, monthBranchIdx, dayBranchIdx, ...(hourBranchIdx !== null ? [hourBranchIdx] : [])];
  const result: SinsalType[] = [];

  // 도화/역마/화개 — 년지 또는 일지가 속한 삼합 그룹 기준으로 판별
  for (const refIdx of [yearBranchIdx, dayBranchIdx]) {
    const group = SAMHAP_SINSAL_TARGETS.find(g => g.branches.includes(refIdx));
    if (!group) continue;
    if (allBranches.includes(group.dohwa) && !result.includes('도화살')) result.push('도화살');
    if (allBranches.includes(group.yeokma) && !result.includes('역마살')) result.push('역마살');
    if (allBranches.includes(group.hwagae) && !result.includes('화개살')) result.push('화개살');
  }

  // 양인살
  if (YANGIN_BY_DAY_STEM[dayStemIdx] !== undefined && allBranches.includes(YANGIN_BY_DAY_STEM[dayStemIdx])) {
    result.push('양인살');
  }

  // 괴강살 (일주 기준)
  if (GOEGANG_ILJU.some(([s, b]) => s === dayStemIdx && b === dayBranchIdx)) {
    result.push('괴강살');
  }

  // 백호살 (8글자 중 해당 간지 조합이 있는지 — 일주는 이미 확정된 dayStemIdx/dayBranchIdx로 체크,
  // 연/월/시는 간지 쌍 정보가 없어 이번 범위에선 일주만 체크)
  if (BAEKHO_GANJI.some(([s, b]) => s === dayStemIdx && b === dayBranchIdx)) {
    result.push('백호살');
  }

  // 원진살 / 귀문관살 — 사주 지지들 중 임의의 두 조합
  if (hasPair(allBranches, WONJIN_PAIRS)) result.push('원진살');
  if (hasPair(allBranches, GWIMUNGWAN_PAIRS)) result.push('귀문관살');

  return result;
}
