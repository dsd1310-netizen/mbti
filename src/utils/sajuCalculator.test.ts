import { describe, it, expect } from 'vitest';
import { calculateSaju, calcDayPillar, isInHistoricalUTC830Period, isHistoricalDstDate, historicalMinuteCorrection } from './sajuCalculator';
import { getJijanggan } from '../data/jijanggan';

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

describe('calculateSaju — 1954~1961년 UTC+8:30 표준시 보정', () => {
  // 1955-02-04 입춘은 23:17(KST 환산). 그 시절 실제 시계(UTC+8:30)로 22:55에 태어났다면
  // KST 환산 23:25로, 입춘을 넘긴 뒤라 1955년(을미) 연주 + 인월(寅月)이 맞다. 보정이
  // 없으면 22:55 그대로 23:17과 비교해 "입춘 전"으로 오판, 1954년(갑오) 연주가 나온다.
  it('1955-02-04 22:55(당시 UTC+8:30 시계) 출생자는 30분 보정 후 입춘을 넘겨 을미년/인월로 계산된다', () => {
    const r = calculateSaju(1955, 2, 4, '오시', 'female', false, 22, 55);
    expect(r.yearPillar.text).toBe('을미');
    expect(r.monthPillar.branchIdx).toBe(2); // 인(寅)
  });

  it('경계일 판정: 1961-08-09는 보정 대상이고 1961-08-10은 대상이 아니다', () => {
    expect(isInHistoricalUTC830Period(1961, 8, 9)).toBe(true);
    expect(isInHistoricalUTC830Period(1961, 8, 10)).toBe(false);
  });

  it('경계일 판정: 1954-03-21은 보정 대상이고 1954-03-20은 대상이 아니다', () => {
    expect(isInHistoricalUTC830Period(1954, 3, 21)).toBe(true);
    expect(isInHistoricalUTC830Period(1954, 3, 20)).toBe(false);
  });

  it('보정 대상 기간 밖(1965년)은 같은 상황이어도 30분 보정이 적용되지 않는다', () => {
    // 1965-02-04 입춘 9:46(KST). 09:30 출생은 보정 기간 밖이라 여전히 "입춘 전" → 1964년(갑진) 연주.
    const r = calculateSaju(1965, 2, 4, '오시', 'female', false, 9, 30);
    expect(r.yearPillar.text).toBe('갑진');
  });

  it('hourUnknown(시간 모름)이면 보정 기간 안이라도 30분 보정을 건너뛴다', () => {
    const known = calculateSaju(1955, 6, 15, '오시', 'female', false);
    const unknown = calculateSaju(1955, 6, 15, '오시', 'female', true);
    expect(unknown.yearPillar.text).toBe(known.yearPillar.text);
  });
});

describe('historicalMinuteCorrection — 서머타임 겹침까지 반영한 보정값', () => {
  it('평시(보정 대상 아닌 날)는 보정 없음(0분)', () => {
    expect(historicalMinuteCorrection(1995, 9, 27)).toBe(0);
  });

  it('1954~1961년 UTC+8:30 시기(서머타임 아닌 날)는 +30분', () => {
    expect(isHistoricalDstDate(1955, 2, 4)).toBe(false);
    expect(historicalMinuteCorrection(1955, 2, 4)).toBe(30);
  });

  it('1955~1960년 서머타임 기간은 UTC+8:30 기준에 +1시간이 겹쳐 UTC+9:30 — 보정은 -30분', () => {
    // 1957-07-15는 그해 서머타임 기간(5/5~9/22) 안이면서 동시에 UTC+8:30 시기(1954~1961) 안.
    expect(isInHistoricalUTC830Period(1957, 7, 15)).toBe(true);
    expect(isHistoricalDstDate(1957, 7, 15)).toBe(true);
    expect(historicalMinuteCorrection(1957, 7, 15)).toBe(-30);
  });

  it('1948~1951년 서머타임(UTC+9 기준 시기)은 UTC+10 — 보정은 -60분', () => {
    expect(historicalMinuteCorrection(1949, 7, 1)).toBe(-60);
  });

  it('1987~1988년 서머타임(이미 UTC+9로 복귀한 시기)도 UTC+10 — 보정은 -60분', () => {
    expect(historicalMinuteCorrection(1987, 6, 1)).toBe(-60);
    expect(historicalMinuteCorrection(1988, 6, 1)).toBe(-60);
  });

  it('서머타임 시작/종료 경계일은 포함, 그 하루 전/후는 미적용', () => {
    expect(isHistoricalDstDate(1960, 5, 1)).toBe(true);
    expect(isHistoricalDstDate(1960, 4, 30)).toBe(false);
    expect(isHistoricalDstDate(1960, 9, 18)).toBe(true);
    expect(isHistoricalDstDate(1960, 9, 19)).toBe(false);
  });
});

describe('calculateSaju — 1987년 서머타임 구간(그동안 미반영이던 케이스) 실제 반영 확인', () => {
  // historicalMinuteCorrection이 0이 아니면 calculateSaju 파이프라인에도 실제로 적용되는지
  // 야자시 이월 여부로 간접 확인 — 서머타임 -60분 보정이 없으면 23:05는 그대로 23시대(야자시,
  // 일주 다음날 이월)지만, 보정이 적용되면 22:05로 바뀌어 야자시가 아니게 된다.
  it('1987-06-01 23:05(서머타임 -60분 보정 후 22:05)는 야자시가 아니라 일주가 이월되지 않는다', () => {
    const r = calculateSaju(1987, 6, 1, '오시', 'female', false, 23, 5);
    const sameDay = calcDayPillar(1987, 6, 1);
    expect(r.dayPillar.text).toBe(sameDay.text);
  });

  it('서머타임 기간이 아닌 1986-06-01 23:05는 보정 없이 야자시로 처리돼 일주가 다음날로 이월된다', () => {
    const r = calculateSaju(1986, 6, 1, '오시', 'female', false, 23, 5);
    const nextDay = calcDayPillar(1986, 6, 2);
    expect(r.dayPillar.text).toBe(nextDay.text);
  });
});

describe('calculateSaju — 격국/신살/십신 분포/지장간 (계획안.md 격국·신살 추가 참고)', () => {
  // 1995-09-27 / 오시 / 여성 — 위 기준 케이스와 동일. 일간 辛, 월지 酉(왕지) → 지장간 정기는
  // 그대로 辛 자신이라 일간과 같은 오행/음양 → 비견 → 건록격. 모바일 실측 스크린샷으로 직접 확인.
  const r = calculateSaju(1995, 9, 27, '오시', 'female', false);

  it('월지가 왕지(酉)면 그 정기를 그대로 격의 기준으로 삼는다 — 건록격', () => {
    expect(r.gyeokguk.name).toBe('건록격');
    expect(r.gyeokguk.sipsin).toBe('비견');
  });

  it('신살 8종 중 도화살/역마살이 해당한다 (일지 酉가 속한 사유축 그룹 기준)', () => {
    expect(r.sinsal).toContain('도화살');
    expect(r.sinsal).toContain('역마살');
    expect(r.sinsal).not.toContain('양인살');
    expect(r.sinsal).not.toContain('괴강살');
  });

  it('십신 분포 개수 합계는 시주 포함 7자리(일간 제외)와 같다', () => {
    const total = Object.values(r.sipsin.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(7);
  });

  it('지장간(支藏干) — 酉(유)는 여기·정기 2단계(경·신)로 구성된다', () => {
    const hidden = getJijanggan(9); // EARTHLY_BRANCHES 인덱스 9 = 酉
    expect(hidden.map(h => h.name)).toEqual(['경', '신']);
    expect(hidden.map(h => h.stage)).toEqual(['여기', '정기']);
  });

  it('지장간 — 子(자)도 여기·정기 2단계(임·계)로 구성된다', () => {
    const hidden = getJijanggan(0);
    expect(hidden.map(h => h.name)).toEqual(['임', '계']);
  });

  it('지장간 — 辰(진)은 여기·중기·정기 3단계(을·계·무)로 구성된다', () => {
    const hidden = getJijanggan(4);
    expect(hidden.map(h => h.name)).toEqual(['을', '계', '무']);
    expect(hidden.map(h => h.stage)).toEqual(['여기', '중기', '정기']);
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
