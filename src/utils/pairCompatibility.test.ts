import { describe, it, expect } from 'vitest';
import { comparePillars, GWIIN_TYPE_META, STEM_RELATION_LABEL, StemRelationType } from './pairCompatibility';
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
  it('금(1995-09-27)과 토(2000-01-01)를 비교하면 "상대가 나를 생함"(귀인)으로 판정된다', () => {
    const sajuA = calculateSaju(1995, 9, 27, '오시', 'female', false);
    const sajuB = calculateSaju(2000, 1, 1, '오시', 'female', true);
    const rel = comparePillars(sajuA, sajuB);
    expect(rel.dayStemRelation).toBe('b-generates-a');
    expect(GWIIN_TYPE_META[rel.dayStemRelation].label).toBe('귀인');
  });

  it('같은 사람끼리 비교하면 같은 오행(비화) — "동료"로 판정된다', () => {
    const saju = calculateSaju(1995, 9, 27, '오시', 'female', false);
    const rel = comparePillars(saju, saju);
    expect(rel.dayStemRelation).toBe('same');
    expect(GWIIN_TYPE_META[rel.dayStemRelation].label).toBe('동료');
  });
});
