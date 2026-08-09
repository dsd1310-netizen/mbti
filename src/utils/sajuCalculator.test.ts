import { describe, it, expect } from 'vitest';
import { calculateSaju, calcDayPillar } from './sajuCalculator';

describe('calculateSaju — 실제 프로덕션 화면에서 확인한 기준값 회귀 테스트', () => {
  // 1995-09-27 / 오시 / 여성 — mobile-flow 실측(계획안.md 참고)에서 직접 확인한 값.
  const r = calculateSaju(1995, 9, 27, '오시', 'female', false);

  it('연주/월주/일주/시주가 실측값과 일치한다', () => {
    expect(r.yearPillar.text).toBe('을해');
    expect(r.monthPillar.text).toBe('을유');
    expect(r.dayPillar.text).toBe('신유');
    expect(r.hourPillar?.text).toBe('갑오');
  });

  it('오행 개수 합계는 (기둥 수 × 2)와 같다 — 시주 포함 시 8개', () => {
    const total = Object.values(r.elementCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(8);
  });
});

describe('calculateSaju — 대운 순행/역행 (계획안.md 7-K: 성별 무관 계산 버그 회귀 방지)', () => {
  // 월주(을유)에서 +1(순행)/-1(역행)씩 진행하는 방향이 성별에 따라 반대여야 한다.
  it('여성(음의 해 을해 → 순행)은 월주에서 정방향으로 진행한다: 을유→병술→정해→무자', () => {
    const r = calculateSaju(1995, 9, 27, '오시', 'female', false);
    expect(r.daeunList.slice(0, 3).map(d => d.stem + d.branch)).toEqual(['병술', '정해', '무자']);
  });

  it('남성(음의 해 을해 → 역행)은 월주에서 역방향으로 진행한다: 을유→갑신→계미→임오', () => {
    const r = calculateSaju(1995, 9, 27, '오시', 'male', false);
    expect(r.daeunList.slice(0, 3).map(d => d.stem + d.branch)).toEqual(['갑신', '계미', '임오']);
  });

  it('대운 시작 나이는 항상 1 이상의 정수다', () => {
    const female = calculateSaju(1995, 9, 27, '오시', 'female', false);
    const male = calculateSaju(1995, 9, 27, '오시', 'male', false);
    expect(Number.isInteger(female.daeunStartAge)).toBe(true);
    expect(female.daeunStartAge).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(male.daeunStartAge)).toBe(true);
    expect(male.daeunStartAge).toBeGreaterThanOrEqual(1);
  });
});

describe('calculateSaju — 연주(年柱) 입춘 경계 (baseYear=1984=갑자 공식 기반)', () => {
  it('입춘 이전(1월)에 태어나면 전년도 연주를 쓴다: 2000년 1월 → 1999년(己卯) 연주', () => {
    const r = calculateSaju(2000, 1, 15, '오시', 'female', false);
    expect(r.yearPillar.text).toBe('기묘');
  });

  it('입춘 이후가 확실한 시기(6월)에 태어나면 해당 연도 연주를 쓴다: 2000년 → 庚辰', () => {
    const r = calculateSaju(2000, 6, 15, '오시', 'female', false);
    expect(r.yearPillar.text).toBe('경진');
  });
});

describe('calculateSaju — 시간 관련 옵션', () => {
  it('hourUnknown=true면 시주가 null이고 오행 합계는 6개(3기둥)다', () => {
    const r = calculateSaju(1995, 9, 27, '오시', 'female', true);
    expect(r.hourPillar).toBeNull();
    const total = Object.values(r.elementCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(6);
  });

  it('야자시(23시대)는 일주만 다음 날로 이월된다', () => {
    const yajasi = calculateSaju(2000, 1, 1, '야자시', 'female', false);
    const nextDay = calcDayPillar(2000, 1, 2);
    expect(yajasi.dayPillar.text).toBe(nextDay.text);
  });

  it('정확한 시:분(23:30)을 직접 입력해도 야자시와 동일하게 일주가 이월된다', () => {
    const exact = calculateSaju(2000, 1, 1, '오시', 'female', false, 23, 30);
    const nextDay = calcDayPillar(2000, 1, 2);
    expect(exact.dayPillar.text).toBe(nextDay.text);
  });
});

describe('calcDayPillar — 기준점 및 주기성', () => {
  it('코드에 문서화된 기준일 2000-01-01은 戊午(무오)다', () => {
    expect(calcDayPillar(2000, 1, 1).text).toBe('무오');
  });

  it('60일이 지나면 정확히 같은 간지로 돌아온다(60갑자 주기)', () => {
    const base = new Date(2010, 5, 15);
    const later = new Date(base);
    later.setDate(later.getDate() + 60);
    const a = calcDayPillar(base.getFullYear(), base.getMonth() + 1, base.getDate());
    const b = calcDayPillar(later.getFullYear(), later.getMonth() + 1, later.getDate());
    expect(a.text).toBe(b.text);
  });

  it('하루가 지나면 천간/지지 인덱스가 정확히 1씩 증가한다(모듈러)', () => {
    const a = calcDayPillar(2010, 5, 15);
    const b = calcDayPillar(2010, 5, 16);
    expect(b.stemIdx).toBe((a.stemIdx + 1) % 10);
    expect(b.branchIdx).toBe((a.branchIdx + 1) % 12);
  });
});
