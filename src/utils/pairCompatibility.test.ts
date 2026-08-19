import { describe, it, expect } from 'vitest';
import { comparePillars, GWIIN_TYPE_META, STEM_RELATION_LABEL, StemRelationType, getGwiinScore, PairCompatibilityResult } from './pairCompatibility';
import { calculateSaju } from './sajuCalculator';

describe('귀인지도(GWIIN_TYPE_META) — StemRelationType 6종 전부 라벨이 있다', () => {
  const allTypes: StemRelationType[] = ['same', 'a-generates-b', 'b-generates-a', 'a-controls-b', 'b-controls-a', 'neutral'];

  it('GWIIN_TYPE_META와 STEM_RELATION_LABEL 둘 다 6종 전부를 다룬다', () => {
    for (const t of allTypes) {
      expect(GWIIN_TYPE_META[t]).toBeDefined();
      expect(STEM_RELATION_LABEL[t]).toBeDefined();
    }
  });

  it('귀인지도 노드에 필요한 emoji/label/color가 전부 채워져 있다', () => {
    for (const t of allTypes) {
      expect(GWIIN_TYPE_META[t].label.length).toBeGreaterThan(0);
      expect(GWIIN_TYPE_META[t].emoji.length).toBeGreaterThan(0);
      expect(GWIIN_TYPE_META[t].color).toMatch(/^#/);
    }
  });
});

describe('comparePillars → GWIIN_TYPE_META 연동 — 실제 사주 조합으로 검증', () => {
  // 계획안.md/sajuCalculator.test.ts에서 이미 검증된 기준값 재사용:
  // 1995-09-27(여, 오시) 일주=신유(신=금), 2000-01-01 일주=무오(무=토).
  // 토생금(土生金) — 토(B)가 금(A)을 생하므로 A 입장에서는 "상대가 나를 생함" = 귀인이어야 한다.
  it('금(1995-09-27)과 토(2000-01-01)를 비교하면 "상대가 나를 생함"(치트키)으로 판정된다', () => {
    const sajuA = calculateSaju(1995, 9, 27, '오시', 'female', false);
    const sajuB = calculateSaju(2000, 1, 1, '오시', 'female', true);
    const rel = comparePillars(sajuA, sajuB);
    expect(rel.dayStemRelation).toBe('b-generates-a');
    expect(GWIIN_TYPE_META[rel.dayStemRelation].label).toBe('치트키');
  });

  it('같은 사람끼리 비교하면 같은 오행(비화) — "평행이론"으로 판정된다', () => {
    const saju = calculateSaju(1995, 9, 27, '오시', 'female', false);
    const rel = comparePillars(saju, saju);
    expect(rel.dayStemRelation).toBe('same');
    expect(GWIIN_TYPE_META[rel.dayStemRelation].label).toBe('평행이론');
  });
});

describe('getGwiinScore — 5~99 범위의 재미용 궁합 점수', () => {
  it('모든 조합에서 5~99 사이 정수를 반환한다', () => {
    const allStemTypes: StemRelationType[] = ['same', 'a-generates-b', 'b-generates-a', 'a-controls-b', 'b-controls-a', 'neutral'];
    const allBranchCombos: PairCompatibilityResult['dayBranchRelations'][] = [
      [], ['육합'], ['삼합'], ['충'], ['형'], ['파'], ['해'], ['삼합', '육합'],
    ];
    for (const stem of allStemTypes) {
      for (const branches of allBranchCombos) {
        const score = getGwiinScore({ dayStemRelation: stem, dayBranchRelations: branches });
        expect(Number.isInteger(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(5);
        expect(score).toBeLessThanOrEqual(99);
      }
    }
  });

  it('"상대가 나를 생함" + 육합은 "충"보다 훨씬 높은 점수를 받는다', () => {
    const best = getGwiinScore({ dayStemRelation: 'b-generates-a', dayBranchRelations: ['육합'] });
    const worst = getGwiinScore({ dayStemRelation: 'b-controls-a', dayBranchRelations: ['충'] });
    expect(best).toBeGreaterThan(worst);
  });

  it('금(1995-09-27)과 토(2000-01-01) 조합의 실제 점수가 계산된다', () => {
    const sajuA = calculateSaju(1995, 9, 27, '오시', 'female', false);
    const sajuB = calculateSaju(2000, 1, 1, '오시', 'female', true);
    const rel = comparePillars(sajuA, sajuB);
    const score = getGwiinScore(rel);
    expect(score).toBeGreaterThanOrEqual(5);
    expect(score).toBeLessThanOrEqual(99);
  });
});
