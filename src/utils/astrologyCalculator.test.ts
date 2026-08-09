import { describe, it, expect } from 'vitest';
import { calculateAstrology, calculateTodayTransits, getDignity, PLANETS } from './astrologyCalculator';

const SEOUL = { lat: 37.5665, lon: 126.9780 };

describe('calculateAstrology — 홀사인 하우스 구조적 불변식', () => {
  const r = calculateAstrology(1995, 9, 27, 11, 0, SEOUL.lat, SEOUL.lon, 'approximate');

  it('1하우스는 정의상 어센던트가 속한 별자리다', () => {
    expect(r.houseSignIndexes[0]).toBe(r.ascendantSignIndex);
  });

  it('12개 하우스는 12별자리를 정확히 한 번씩, 순서대로 담는다', () => {
    expect(r.houseSignIndexes).toHaveLength(12);
    expect(new Set(r.houseSignIndexes).size).toBe(12);
    for (let i = 1; i < 12; i++) {
      expect(r.houseSignIndexes[i]).toBe((r.houseSignIndexes[0] + i) % 12);
    }
  });

  it('모든 행성의 houseIndex는 houseSignIndexes와 별자리 기준으로 서로 일치한다', () => {
    for (const p of r.planets) {
      expect(r.houseSignIndexes[p.houseIndex]).toBe(p.signIndex);
    }
  });

  it('7개 전통행성이 전부 계산된다', () => {
    expect(r.planets).toHaveLength(PLANETS.length);
    expect(new Set(r.planets.map(p => p.key)).size).toBe(PLANETS.length);
  });

  it('isDayChart는 태양의 houseIndex(6 이상=지평선 위)와 일치한다', () => {
    const sun = r.planets.find(p => p.key === 'sun')!;
    expect(r.isDayChart).toBe(sun.houseIndex >= 6);
  });

  it('signDegree는 항상 0~30 범위다', () => {
    for (const p of r.planets) {
      expect(p.signDegree).toBeGreaterThanOrEqual(0);
      expect(p.signDegree).toBeLessThan(30);
    }
  });
});

describe('calculateAstrology — 위도 변화가 어센던트에 실제로 반영되는지', () => {
  it('같은 시각·경도라도 위도가 다르면 어센던트가 달라진다', () => {
    const low = calculateAstrology(2000, 6, 15, 12, 0, 1, 127, 'exact');
    const high = calculateAstrology(2000, 6, 15, 12, 0, 60, 127, 'exact');
    expect(low.ascendantLongitude).not.toBeCloseTo(high.ascendantLongitude, 1);
  });
});

describe('calculateAstrology — 한국 서머타임(DST) 보정 경계', () => {
  it('1987년 알려진 서머타임 기간 내부(6/1)는 dstApplied=true', () => {
    expect(calculateAstrology(1987, 6, 1, 12, 0, SEOUL.lat, SEOUL.lon).dstApplied).toBe(true);
  });

  it('1987년 서머타임 시작일(5/10)은 포함, 그 이전(4/1)은 미적용', () => {
    expect(calculateAstrology(1987, 5, 10, 12, 0, SEOUL.lat, SEOUL.lon).dstApplied).toBe(true);
    expect(calculateAstrology(1987, 4, 1, 12, 0, SEOUL.lat, SEOUL.lon).dstApplied).toBe(false);
  });

  it('1988년 서머타임 종료일(10/9)은 포함, 다음 날(10/10)은 미적용', () => {
    expect(calculateAstrology(1988, 10, 9, 12, 0, SEOUL.lat, SEOUL.lon).dstApplied).toBe(true);
    expect(calculateAstrology(1988, 10, 10, 12, 0, SEOUL.lat, SEOUL.lon).dstApplied).toBe(false);
  });

  it('서머타임 기간이 아닌 일반 연도는 dstApplied=false', () => {
    expect(calculateAstrology(1995, 9, 27, 11, 0, SEOUL.lat, SEOUL.lon).dstApplied).toBe(false);
  });
});

describe('getDignity — 본질적 품위 테이블 우선순위', () => {
  it('태양은 사자자리(4)에서 도머사일이다', () => {
    expect(getDignity('sun', 4)).toBe('domicile');
  });

  it('태양은 양자리(0)에서 익절테이션이다', () => {
    expect(getDignity('sun', 0)).toBe('exaltation');
  });

  it('태양은 물병자리(10)에서 디트리먼트다', () => {
    expect(getDignity('sun', 10)).toBe('detriment');
  });

  it('태양은 천칭자리(6)에서 폴이다', () => {
    expect(getDignity('sun', 6)).toBe('fall');
  });

  it('품위가 없는 조합은 null을 반환한다', () => {
    expect(getDignity('sun', 2)).toBeNull();
  });
});

describe('calculateTodayTransits — 자기 자신과의 자기일관성', () => {
  it('트랜짓 시각을 네이탈 출생 시각과 동일하게 주면 태양·달 모두 컨정션(orb≈0)이 나온다', () => {
    const year = 2000, month = 6, day = 15, hour = 12, minute = 0;
    const natal = calculateAstrology(year, month, day, hour, minute, SEOUL.lat, SEOUL.lon, 'exact');
    // calculateAstrology 내부의 KST→UTC 변환(비-DST 연도는 UTC-9)과 동일하게 맞춰 재구성.
    const sameInstant = new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
    const transits = calculateTodayTransits(natal, sameInstant);

    const sunSun = transits.find(t => t.transitPlanet === 'sun' && t.natalPoint === 'sun');
    const moonMoon = transits.find(t => t.transitPlanet === 'moon' && t.natalPoint === 'moon');
    expect(sunSun?.type).toBe('컨정션');
    expect(sunSun?.orb).toBeLessThan(0.1);
    expect(moonMoon?.type).toBe('컨정션');
    expect(moonMoon?.orb).toBeLessThan(0.1);
  });
});
