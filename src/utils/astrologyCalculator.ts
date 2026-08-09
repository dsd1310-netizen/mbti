/**
 * 서양 고전점성술(홀사인 하우스 시스템) 계산 엔진
 *
 * 참고자료: 고전점성술_기초시트.pdf(백아, astro.vg), William Lilly의 Christian Astrology(1647)
 * 행성 위치 계산: astronomy-engine (지구중심/apparent 좌표 사용 — 자세한 검증 내역은 계획안.md 7-L-3 참고)
 * 하우스 시스템: 홀사인(Whole Sign) — 어센던트가 속한 별자리를 1하우스로 삼아 순서대로 배정
 *
 * astronomy-engine은 번들에서 약 119KB를 차지해(계획안.md 7-AS 참고), 이 파일을 정적 import하면
 * 그 무게가 앱 최초 로딩 경로에 그대로 실린다. 그래서 순수 데이터/타입(별자리·행성·하우스·도시
 * 좌표 등, 초기 화면 렌더링에 필요)은 astrologyData.ts로 분리해뒀고, 여기 있는 실제 계산 함수는
 * App.tsx에서 항상 동적 import(폼 제출 시점에만 로드)로 불러온다.
 */

import * as Astronomy from 'astronomy-engine';
import {
  PlanetKey, PlanetPlacement, AstrologyResult, TransitAspect, TransitNatalPoint,
  PLANETS, ASPECT_ANGLES, ASPECT_ORB, TRANSIT_PLANETS,
  getDignity, normalizeDeg, signOf, angularDiff, toUtcDate, isKnownDstDate,
} from './astrologyData';

export * from './astrologyData';

/** 지구중심(geocentric) 황경 계산 — 행성별로 astronomy-engine의 올바른 API를 골라 사용 (계획안.md 7-L-3 참고) */
function getGeocentricLongitude(planet: PlanetKey, date: Date): number {
  switch (planet) {
    case 'sun':
      return normalizeDeg(Astronomy.SunPosition(date).elon);
    case 'moon':
      return normalizeDeg(Astronomy.EclipticGeoMoon(date).lon);
    default: {
      const bodyMap: Record<Exclude<PlanetKey, 'sun' | 'moon'>, Astronomy.Body> = {
        mercury: Astronomy.Body.Mercury,
        venus: Astronomy.Body.Venus,
        mars: Astronomy.Body.Mars,
        jupiter: Astronomy.Body.Jupiter,
        saturn: Astronomy.Body.Saturn,
      };
      const vec = Astronomy.GeoVector(bodyMap[planet as Exclude<PlanetKey, 'sun' | 'moon'>], date, true);
      return normalizeDeg(Astronomy.Ecliptic(vec).elon);
    }
  }
}

/** 어센던트(상승점) 황경 계산 — 검증된 구면삼각법 공식 (계획안.md 7-L-3 참고) */
function calculateAscendant(date: Date, lat: number, lon: number): number {
  const astroTime = Astronomy.MakeTime(date);
  const gastHours = Astronomy.SiderealTime(astroTime);
  const obliquity = Astronomy.e_tilt(astroTime).tobl;
  const ramc = normalizeDeg(gastHours * 15 + lon);

  const latR = (lat * Math.PI) / 180;
  const epsR = (obliquity * Math.PI) / 180;
  const ramcR = (ramc * Math.PI) / 180;

  const denom = Math.sin(epsR) * Math.tan(latR) + Math.cos(epsR) * Math.sin(ramcR);
  const ascRad = Math.atan2(Math.cos(ramcR), -denom);
  return normalizeDeg((ascRad * 180) / Math.PI);
}

/**
 * 서양 고전점성술(홀사인 하우스) 계산 메인 함수
 * @param timeConfidence 'exact'=정확한 시:분 입력, 'approximate'=12시진 대표값, 'unknown'=출생시간 모름(정오로 근사)
 */
export function calculateAstrology(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  lat: number,
  lon: number,
  timeConfidence: 'exact' | 'approximate' | 'unknown' = 'approximate',
): AstrologyResult {
  const dstApplied = isKnownDstDate(year, month, day);
  const date = toUtcDate(year, month, day, hour, minute);

  const ascendantLongitude = calculateAscendant(date, lat, lon);
  const { signIndex: ascendantSignIndex, signDegree: ascendantDegree } = signOf(ascendantLongitude);

  // 홀사인: 어센던트가 속한 별자리 = 1하우스, 이후 순서대로 배정
  const houseSignIndexes = Array.from({ length: 12 }, (_, i) => (ascendantSignIndex + i) % 12);

  const planetLongitudes: Record<PlanetKey, number> = {} as any;
  const planets: PlanetPlacement[] = PLANETS.map(p => {
    const longitude = getGeocentricLongitude(p.key, date);
    planetLongitudes[p.key] = longitude;
    const { signIndex, signDegree } = signOf(longitude);
    // 홀사인에서 하우스 인덱스 = (행성 별자리 인덱스 - 어센던트 별자리 인덱스) mod 12
    const houseIndex = (signIndex - ascendantSignIndex + 12) % 12;
    return {
      key: p.key,
      longitude,
      signIndex,
      signDegree,
      houseIndex,
      dignity: getDignity(p.key, signIndex),
    };
  });

  // 섹트: 태양이 7~12하우스(지평선 위)면 주간, 1~6하우스(지평선 아래)면 야간
  const sunHouseIndex = planets.find(p => p.key === 'sun')!.houseIndex;
  const isDayChart = sunHouseIndex >= 6;

  // 애스펙트 (5대 프톨레마이오스 애스펙트, 균일 오브 적용)
  const aspects: AstrologyResult['aspects'] = [];
  for (let i = 0; i < PLANETS.length; i++) {
    for (let j = i + 1; j < PLANETS.length; j++) {
      const a = PLANETS[i].key;
      const b = PLANETS[j].key;
      const diff = angularDiff(planetLongitudes[a], planetLongitudes[b]);
      for (const { type, angle, nature } of ASPECT_ANGLES) {
        const orb = Math.abs(diff - angle);
        if (orb <= ASPECT_ORB) {
          aspects.push({ a, b, type, nature, exactAngle: diff, orb });
          break;
        }
      }
    }
  }

  return {
    ascendantLongitude,
    ascendantSignIndex,
    ascendantDegree,
    houseSignIndexes,
    planets,
    isDayChart,
    aspects,
    dstApplied,
    timeConfidence,
  };
}

/** 오늘(또는 지정 시각)의 실제 행성 위치를 네이탈 차트의 태양·달·어센던트와 비교해 애스펙트를 구함 */
export function calculateTodayTransits(natal: AstrologyResult, now: Date = new Date()): TransitAspect[] {
  const natalSun = natal.planets.find(p => p.key === 'sun')!;
  const natalMoon = natal.planets.find(p => p.key === 'moon')!;
  const natalPoints: { key: TransitNatalPoint; longitude: number }[] = [
    { key: 'sun', longitude: natalSun.longitude },
    { key: 'moon', longitude: natalMoon.longitude },
    { key: 'ascendant', longitude: natal.ascendantLongitude },
  ];

  const results: TransitAspect[] = [];
  for (const tKey of TRANSIT_PLANETS) {
    const tLon = getGeocentricLongitude(tKey, now);
    for (const np of natalPoints) {
      const diff = angularDiff(tLon, np.longitude);
      for (const { type, angle, nature } of ASPECT_ANGLES) {
        const orb = Math.abs(diff - angle);
        if (orb <= ASPECT_ORB) {
          results.push({ transitPlanet: tKey, natalPoint: np.key, type, nature, orb });
          break;
        }
      }
    }
  }
  return results;
}
