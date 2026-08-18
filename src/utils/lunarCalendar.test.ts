import { describe, it, expect } from 'vitest';
import { getLunarDayOfMonth, isSohnEobsNeunNal } from './lunarCalendar';

describe('getLunarDayOfMonth — 실제로 잘 알려진 음력 날짜(설날·추석)로 검증', () => {
  // 설날(음력 1월 1일) 6개 연도 — scripts/generateNewMoons.ts 생성 시 이미 대조 확인한 값과 동일.
  it('2020~2025년 설날은 전부 음력 1일이다', () => {
    expect(getLunarDayOfMonth(2020, 1, 25)).toBe(1);
    expect(getLunarDayOfMonth(2021, 2, 12)).toBe(1);
    expect(getLunarDayOfMonth(2022, 2, 1)).toBe(1);
    expect(getLunarDayOfMonth(2023, 1, 22)).toBe(1);
    expect(getLunarDayOfMonth(2024, 2, 10)).toBe(1);
    expect(getLunarDayOfMonth(2025, 1, 29)).toBe(1);
  });

  // 추석(음력 8월 15일) — 설날과 다른 계절대 값으로 교차 검증.
  it('2023년/2024년 추석은 음력 15일이다', () => {
    expect(getLunarDayOfMonth(2023, 9, 29)).toBe(15);
    expect(getLunarDayOfMonth(2024, 9, 17)).toBe(15);
  });

  it('신월 당일부터 하루씩 지날 때마다 음력 일자가 정확히 1씩 늘어난다', () => {
    expect(getLunarDayOfMonth(2024, 2, 10)).toBe(1);
    expect(getLunarDayOfMonth(2024, 2, 11)).toBe(2);
    expect(getLunarDayOfMonth(2024, 2, 18)).toBe(9);
    expect(getLunarDayOfMonth(2024, 2, 19)).toBe(10);
  });
});

describe('isSohnEobsNeunNal — 음력 끝자리 9·0 판정', () => {
  it('설날(음력 1일)은 손없는날이 아니다', () => {
    expect(isSohnEobsNeunNal(2024, 2, 10)).toBe(false);
  });

  it('설날+8일(음력 9일)/+9일(음력 10일)은 손없는날이다', () => {
    expect(isSohnEobsNeunNal(2024, 2, 18)).toBe(true);
    expect(isSohnEobsNeunNal(2024, 2, 19)).toBe(true);
  });

  it('추석(음력 15일)은 손없는날이 아니다', () => {
    expect(isSohnEobsNeunNal(2024, 9, 17)).toBe(false);
  });
});
