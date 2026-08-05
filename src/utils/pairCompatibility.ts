/**
 * 실제 두 사람의 사주를 비교하는 정밀 궁합 계산.
 * 기존 "궁합" 탭의 띠(일지) 기반 정적 관계와 달리, 두 사람이 각각 입력한 생년월일로
 * 산출한 실제 일주(일간+일지)를 서로 비교한다.
 */
import { ELEMENT_CONTROLS, ELEMENT_GENERATES, ElementCounts, SajuResult } from './sajuCalculator';
import { getBranchRelations } from '../data/compatibility';

export type BranchRelationType = '삼합' | '육합' | '충' | '형' | '파' | '해';
export type StemRelationType = 'same' | 'a-generates-b' | 'b-generates-a' | 'a-controls-b' | 'b-controls-a' | 'neutral';

export const STEM_RELATION_LABEL: Record<StemRelationType, string> = {
  'same': '같은 오행(비화) — 기질이 비슷해 편안하지만, 서로 자극이 부족할 수 있음',
  'a-generates-b': '내가 상대를 생(生)하는 관계 — 내가 상대를 챙기고 밀어주는 흐름',
  'b-generates-a': '상대가 나를 생(生)하는 관계 — 상대에게 도움과 지지를 받는 흐름',
  'a-controls-b': '내가 상대를 극(剋)하는 관계 — 내가 상대를 이끌거나 부딪힐 수 있는 흐름',
  'b-controls-a': '상대가 나를 극(剋)하는 관계 — 상대에게 통제받거나 자극받는 흐름',
  'neutral': '직접적인 상생상극 관계 없음',
};

export interface PairCompatibilityResult {
  dayBranchRelations: BranchRelationType[]; // 동시에 여러 관계가 성립할 수 있음(드묾)
  dayStemRelation: StemRelationType;
  dayStemElementA: string;
  dayStemElementB: string;
  /** A에게는 부족하고(0개) B에게는 풍부한(2개 이상) 오행 — 서로 보완되는 지점 */
  aNeedsFromB: string[];
  bNeedsFromA: string[];
}

function getDayBranchRelations(branchIdxA: number, branchIdxB: number): BranchRelationType[] {
  const rel = getBranchRelations(branchIdxA);
  const types: BranchRelationType[] = [];
  if (rel.samhapPartners.some(p => p.branchIdx === branchIdxB)) types.push('삼합');
  if (rel.yukhapPartner?.branchIdx === branchIdxB) types.push('육합');
  if (rel.chungPartner?.branchIdx === branchIdxB) types.push('충');
  if (rel.hyeongPartners.some(p => p.branchIdx === branchIdxB)) types.push('형');
  if (rel.paPartner?.branchIdx === branchIdxB) types.push('파');
  if (rel.haePartner?.branchIdx === branchIdxB) types.push('해');
  return types;
}

function getStemRelation(elementA: string, elementB: string): StemRelationType {
  if (elementA === elementB) return 'same';
  if (ELEMENT_GENERATES[elementA] === elementB) return 'a-generates-b';
  if (ELEMENT_GENERATES[elementB] === elementA) return 'b-generates-a';
  if (ELEMENT_CONTROLS[elementA] === elementB) return 'a-controls-b';
  if (ELEMENT_CONTROLS[elementB] === elementA) return 'b-controls-a';
  return 'neutral';
}

function findComplementary(from: ElementCounts, to: ElementCounts): string[] {
  return (Object.keys(from) as (keyof ElementCounts)[]).filter(el => from[el] === 0 && to[el] >= 2);
}

export function comparePillars(sajuA: SajuResult, sajuB: SajuResult): PairCompatibilityResult {
  return {
    dayBranchRelations: getDayBranchRelations(sajuA.dayPillar.branchIdx, sajuB.dayPillar.branchIdx),
    dayStemRelation: getStemRelation(sajuA.dayStemElement, sajuB.dayStemElement),
    dayStemElementA: sajuA.dayStemElement,
    dayStemElementB: sajuB.dayStemElement,
    aNeedsFromB: findComplementary(sajuA.elementCounts, sajuB.elementCounts),
    bNeedsFromA: findComplementary(sajuB.elementCounts, sajuA.elementCounts),
  };
}
