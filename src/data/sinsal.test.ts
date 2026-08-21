import { describe, it, expect } from 'vitest';
import { getSinsal } from './sinsal';

describe('getSinsal — 화개살 회귀 테스트 (그룹 간 화개 값이 뒤바뀌어 있던 버그, 2026-08-21 수정)', () => {
  // "OO견OO위화개"는 항상 그 삼합 그룹 자신의 고지(墓/庫) 지지를 가리킨다:
  // 寅午戌见戌·巳酉丑见丑·申子辰见辰·亥卯未见未. 수정 전에는 1↔4그룹, 2↔3그룹의 화개 값이
  // 서로 맞바뀌어 있었음(예: 인오술의 화개가 미(未)로 잘못 들어가 있었음, 정답은 술(戌)).

  it('인오술(寅午戌) 그룹 — 화개는 술(戌)이어야 하며, 옛 오류값 미(未)는 더 이상 화개로 취급되지 않는다', () => {
    const base = { dayStemIdx: 1, yearBranchIdx: 2, monthBranchIdx: 1, dayBranchIdx: 8 };
    const withOldWrongValue = getSinsal({ ...base, hourBranchIdx: 7 }); // 미(未) — 옛 버그값
    const withCorrectValue = getSinsal({ ...base, hourBranchIdx: 10 }); // 술(戌) — 정답
    expect(withOldWrongValue).not.toContain('화개살');
    expect(withCorrectValue).toContain('화개살');
  });

  it('사유축(巳酉丑) 그룹 — 화개는 축(丑)이어야 하며, 옛 오류값 진(辰)은 더 이상 화개로 취급되지 않는다', () => {
    // dayBranchIdx는 신자진(申子辰) 멤버(0/8/4)를 피해서 골랐다 — 그 그룹의 진(辰)짜리 화개
    // 검사(정답값 4)가 이 테스트가 검증하려는 사유축 그룹의 "옛 오류값 4" 케이스와 우연히
    // 겹쳐 오검출(false positive)을 낼 수 있기 때문(인오술 멤버 오(6)로 대체해 회피).
    const base = { dayStemIdx: 1, yearBranchIdx: 5, monthBranchIdx: 2, dayBranchIdx: 6 };
    const withOldWrongValue = getSinsal({ ...base, hourBranchIdx: 4 }); // 진(辰) — 옛 버그값
    const withCorrectValue = getSinsal({ ...base, hourBranchIdx: 1 }); // 축(丑) — 정답
    expect(withOldWrongValue).not.toContain('화개살');
    expect(withCorrectValue).toContain('화개살');
  });

  it('신자진(申子辰) 그룹 — 화개는 진(辰)이어야 하며, 옛 오류값 축(丑)은 더 이상 화개로 취급되지 않는다', () => {
    const base = { dayStemIdx: 1, yearBranchIdx: 8, monthBranchIdx: 2, dayBranchIdx: 3 };
    const withOldWrongValue = getSinsal({ ...base, hourBranchIdx: 1 }); // 축(丑) — 옛 버그값
    const withCorrectValue = getSinsal({ ...base, hourBranchIdx: 4 }); // 진(辰) — 정답
    expect(withOldWrongValue).not.toContain('화개살');
    expect(withCorrectValue).toContain('화개살');
  });

  it('해묘미(亥卯未) 그룹 — 화개는 미(未)이어야 하며, 옛 오류값 술(戌)은 더 이상 화개로 취급되지 않는다', () => {
    const base = { dayStemIdx: 1, yearBranchIdx: 11, monthBranchIdx: 2, dayBranchIdx: 5 };
    const withOldWrongValue = getSinsal({ ...base, hourBranchIdx: 10 }); // 술(戌) — 옛 버그값
    const withCorrectValue = getSinsal({ ...base, hourBranchIdx: 7 }); // 미(未) — 정답
    expect(withOldWrongValue).not.toContain('화개살');
    expect(withCorrectValue).toContain('화개살');
  });
});
