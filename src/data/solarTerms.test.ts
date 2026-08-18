import { describe, it, expect } from 'vitest';
import { SOLAR_TERMS } from './solarTerms';

describe('SOLAR_TERMS — 한국천문연구원(KASI) 공식 발표치 대조 회귀 테스트', () => {
  // 기존 하드코딩 테이블(동추원만세력 출처 주장)이 astronomy-engine 전수 검증에서
  // 1092건 중 899건(82%)이 60분 이상, 23건이 10시간 이상 어긋나 있던 게 발견되어
  // scripts/generateSolarTerms.ts로 전면 재생성했음. 아래 값들은 KASI가 실제로 공식
  // 발표한 절기 시각(astro.kasi.re.kr 달력자료)과 직접 대조해 확인한 것 — 재생성
  // 스크립트나 데이터가 다시 깨지면 이 테스트가 잡아낸다.
  it('2024년 경칩은 KASI 공식 발표치(3/5 11:23 KST)와 1분 이내로 일치한다', () => {
    const [day, hour, minute] = SOLAR_TERMS[2024][2];
    expect(day).toBe(5);
    expect(hour).toBe(11);
    expect(Math.abs(minute - 23)).toBeLessThanOrEqual(1);
  });

  it('2028년 소한은 KASI 공식 발표치(1/6 4:55 KST)와 1분 이내로 일치한다', () => {
    const [day, hour, minute] = SOLAR_TERMS[2028][0];
    expect(day).toBe(6);
    expect(hour).toBe(4);
    expect(Math.abs(minute - 55)).toBeLessThanOrEqual(1);
  });

  it('2028년 백로는 KASI 공식 발표치(9/7 11:22 KST)와 1분 이내로 일치한다', () => {
    const [day, hour, minute] = SOLAR_TERMS[2028][8];
    expect(day).toBe(7);
    expect(hour).toBe(11);
    expect(Math.abs(minute - 22)).toBeLessThanOrEqual(1);
  });

  it('2025년 백로는 KASI 공식 발표치(9/7 17:52 KST)와 1분 이내로 일치한다', () => {
    const [day, hour, minute] = SOLAR_TERMS[2025][8];
    expect(day).toBe(7);
    expect(hour).toBe(17);
    expect(Math.abs(minute - 52)).toBeLessThanOrEqual(1);
  });

  it('데이터는 1900~2100년을 모두 포함한다', () => {
    expect(SOLAR_TERMS[1900]).toBeDefined();
    expect(SOLAR_TERMS[2100]).toBeDefined();
    expect(SOLAR_TERMS[1930]).toBeDefined();
    expect(SOLAR_TERMS[2031]).toBeDefined();
  });
});
