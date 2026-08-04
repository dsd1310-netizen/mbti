/**
 * 서양 고전점성술(홀사인 하우스 시스템) 계산 엔진
 *
 * 참고자료: 고전점성술_기초시트.pdf(백아, astro.vg), William Lilly의 Christian Astrology(1647)
 * 행성 위치 계산: astronomy-engine (지구중심/apparent 좌표 사용 — 자세한 검증 내역은 계획안.md 7-L-3 참고)
 * 하우스 시스템: 홀사인(Whole Sign) — 어센던트가 속한 별자리를 1하우스로 삼아 순서대로 배정
 */

import * as Astronomy from 'astronomy-engine';

// ─── 별자리 (12궁) ────────────────────────────────────────────
export interface ZodiacSignInfo {
  name: string;
  hanja: string;
  element: 'fire' | 'earth' | 'air' | 'water';
  elementKo: string;
  modality: '활동궁' | '고정궁' | '변통궁';
  gender: '남자' | '여자';
  ruler: string;
  keywords: string[];
  bodyPart: string;
}

export const ZODIAC_SIGNS: ZodiacSignInfo[] = [
  { name: '양자리', hanja: '牡羊', element: 'fire', elementKo: '불', modality: '활동궁', gender: '남자', ruler: '화성', keywords: ['개척', '시작', '용기'], bodyPart: '머리, 얼굴' },
  { name: '황소자리', hanja: '金牛', element: 'earth', elementKo: '흙', modality: '고정궁', gender: '여자', ruler: '금성', keywords: ['안정', '물질', '소유'], bodyPart: '목, 목소리' },
  { name: '쌍둥이자리', hanja: '雙子', element: 'air', elementKo: '공기', modality: '변통궁', gender: '남자', ruler: '수성', keywords: ['소통', '호기심', '다재다능'], bodyPart: '팔, 손' },
  { name: '게자리', hanja: '巨蟹', element: 'water', elementKo: '물', modality: '활동궁', gender: '여자', ruler: '달', keywords: ['보호', '감정', '가정'], bodyPart: '가슴, 위' },
  { name: '사자자리', hanja: '獅子', element: 'fire', elementKo: '불', modality: '고정궁', gender: '남자', ruler: '태양', keywords: ['창조', '자신감', '리더십'], bodyPart: '심장, 등' },
  { name: '처녀자리', hanja: '處女', element: 'earth', elementKo: '흙', modality: '변통궁', gender: '여자', ruler: '수성', keywords: ['분석', '디테일', '완벽주의'], bodyPart: '소화기관' },
  { name: '천칭자리', hanja: '天秤', element: 'air', elementKo: '공기', modality: '활동궁', gender: '남자', ruler: '금성', keywords: ['균형', '관계', '조화'], bodyPart: '신장, 허리' },
  { name: '전갈자리', hanja: '天蝎', element: 'water', elementKo: '물', modality: '고정궁', gender: '여자', ruler: '화성', keywords: ['변화', '깊이', '재생'], bodyPart: '생식기' },
  { name: '사수자리', hanja: '人馬', element: 'fire', elementKo: '불', modality: '변통궁', gender: '남자', ruler: '목성', keywords: ['긍정', '탐험', '철학'], bodyPart: '허벅지, 간' },
  { name: '염소자리', hanja: '磨羯', element: 'earth', elementKo: '흙', modality: '활동궁', gender: '여자', ruler: '토성', keywords: ['야망', '책임', '성취'], bodyPart: '무릎, 뼈' },
  { name: '물병자리', hanja: '寶甁', element: 'air', elementKo: '공기', modality: '고정궁', gender: '남자', ruler: '토성', keywords: ['독특함', '고집', '원칙'], bodyPart: '발목, 순환계' },
  { name: '물고기자리', hanja: '雙魚', element: 'water', elementKo: '물', modality: '변통궁', gender: '여자', ruler: '목성', keywords: ['공감', '영성', '상상력'], bodyPart: '발, 림프계' },
];

// ─── 행성 (7전통행성) ─────────────────────────────────────────
export type PlanetKey = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

export interface PlanetInfo {
  key: PlanetKey;
  name: string;
  emoji: string;
  benefic: '중립~길' | '중성' | '소길성' | '소흉성' | '대길성' | '대흉성';
  goodMeaning: string;
  badMeaning: string;
  person: string;
  joyHouseIndex: number; // 0-indexed (9H → 8)
}

export const PLANETS: PlanetInfo[] = [
  { key: 'sun', name: '태양', emoji: '☉', benefic: '중립~길', goodMeaning: '자아실현, 명예, 생명력, 권위, 리더십, 자신감', badMeaning: '자만, 독재적, 과시, 오만, 나르시시즘', person: '아버지, 남편, 왕, 상사', joyHouseIndex: 8 },
  { key: 'moon', name: '달', emoji: '☽', benefic: '중립~길', goodMeaning: '감정, 보육, 돌봄, 직관, 공감, 상상력, 이동', badMeaning: '변덕, 예민, 의존적, 불안정, 감정기복', person: '어머니, 대중, 부인, 아이', joyHouseIndex: 2 },
  { key: 'mercury', name: '수성', emoji: '☿', benefic: '중성', goodMeaning: '소통, 지성, 언어, 학습력, 논리, 재주, 상업', badMeaning: '산만, 피상적, 거짓말, 교활함, 잔머리', person: '메신저, 형제, 상인, 학생', joyHouseIndex: 0 },
  { key: 'venus', name: '금성', emoji: '♀', benefic: '소길성', goodMeaning: '사랑, 미, 예술, 연애, 조화, 매력, 즐거움', badMeaning: '게으름, 사치, 방종, 허영, 질투, 나태', person: '연인, 예술가', joyHouseIndex: 4 },
  { key: 'mars', name: '화성', emoji: '♂', benefic: '소흉성', goodMeaning: '행동력, 도전정신, 용기, 열정, 추진력, 결단력', badMeaning: '폭력, 충동, 사고, 분노, 공격성, 파괴', person: '군인, 운동선수', joyHouseIndex: 5 },
  { key: 'jupiter', name: '목성', emoji: '♃', benefic: '대길성', goodMeaning: '확장, 행운, 지혜, 관대함, 성장, 철학, 풍요', badMeaning: '과도함, 낭비, 오만, 방만, 무절제, 허세', person: '스승, 성직자, 법관, 자식', joyHouseIndex: 10 },
  { key: 'saturn', name: '토성', emoji: '♄', benefic: '대흉성', goodMeaning: '책임감, 인내, 구조, 성숙, 현실감, 규율, 지구력', badMeaning: '제한, 지연, 장애물, 억압, 우울, 고립, 냉담', person: '노인, 권위자', joyHouseIndex: 11 },
];

// ─── 본질적 품위 (도머사일/익절테이션/디트리먼트/폴) ───────────
// 별자리 인덱스(0=양자리~11=물고기자리) 기준
export type DignityType = 'domicile' | 'exaltation' | 'detriment' | 'fall';
const DIGNITY_TABLE: Record<PlanetKey, { domicile: number[]; exaltation: number[]; detriment: number[]; fall: number[] }> = {
  sun: { domicile: [4], exaltation: [0], detriment: [10], fall: [6] },
  moon: { domicile: [3], exaltation: [1], detriment: [9], fall: [7] },
  mercury: { domicile: [2, 5], exaltation: [5], detriment: [8, 11], fall: [11] },
  venus: { domicile: [1, 6], exaltation: [11], detriment: [7, 0], fall: [5] },
  mars: { domicile: [0, 7], exaltation: [9], detriment: [6, 1], fall: [3] },
  jupiter: { domicile: [8, 11], exaltation: [3], detriment: [2, 5], fall: [9] },
  saturn: { domicile: [9, 10], exaltation: [6], detriment: [3, 4], fall: [0] },
};

export function getDignity(planet: PlanetKey, signIndex: number): DignityType | null {
  const table = DIGNITY_TABLE[planet];
  if (table.domicile.includes(signIndex)) return 'domicile';
  if (table.exaltation.includes(signIndex)) return 'exaltation';
  if (table.detriment.includes(signIndex)) return 'detriment';
  if (table.fall.includes(signIndex)) return 'fall';
  return null;
}

export const DIGNITY_LABEL: Record<DignityType, string> = {
  domicile: '도머사일(자기 별자리, 강함)',
  exaltation: '익절테이션(격상, 강함)',
  detriment: '디트리먼트(불리, 약함)',
  fall: '폴(추락, 약함)',
};

// ─── 하우스 (1H~12H, 홀사인 시스템) ────────────────────────────
export interface HouseInfo {
  meaning: string;
  strength: '앵귤러(매우 강함)' | '석시던트(보통)' | '케이던트(약함)';
  favorability: '길한 하우스' | '흉한 하우스' | null;
}

export const HOUSES: HouseInfo[] = [
  { meaning: '자아, 정체성, 외모', strength: '앵귤러(매우 강함)', favorability: null },
  { meaning: '재산', strength: '석시던트(보통)', favorability: null },
  { meaning: '소통, 형제, 짧은 여행, 유년시절', strength: '케이던트(약함)', favorability: null },
  { meaning: '가족, 가정, 뿌리, 부동산', strength: '앵귤러(매우 강함)', favorability: null },
  { meaning: '창조, 연애, 자녀, 취미', strength: '석시던트(보통)', favorability: '길한 하우스' },
  { meaning: '일, 질병, 고용인, 애완동물', strength: '케이던트(약함)', favorability: '흉한 하우스' },
  { meaning: '결혼, 파트너십, 공개된 적', strength: '앵귤러(매우 강함)', favorability: null },
  { meaning: '타인의 재산, 불로소득, 유산, 죽음', strength: '석시던트(보통)', favorability: '흉한 하우스' },
  { meaning: '철학, 종교, 교육, 외국, 해외', strength: '케이던트(약함)', favorability: null },
  { meaning: '직업, 명성, 커리어, 사회적 지위', strength: '앵귤러(매우 강함)', favorability: null },
  { meaning: '친구, 단체, 커뮤니티, 희망', strength: '석시던트(보통)', favorability: '길한 하우스' },
  { meaning: '비밀, 감옥(격리된 공간), 영성', strength: '케이던트(약함)', favorability: '흉한 하우스' },
];

// ─── 애스펙트 (5대 프톨레마이오스 애스펙트) ────────────────────
export type AspectType = '컨정션' | '섹스타일' | '스퀘어' | '트라인' | '어포지션';
const ASPECT_ANGLES: { type: AspectType; angle: number; nature: '길각' | '흉각' | '중립' }[] = [
  { type: '컨정션', angle: 0, nature: '중립' },
  { type: '섹스타일', angle: 60, nature: '길각' },
  { type: '스퀘어', angle: 90, nature: '흉각' },
  { type: '트라인', angle: 120, nature: '길각' },
  { type: '어포지션', angle: 180, nature: '흉각' },
];
const ASPECT_ORB = 6; // 도(度) — 고전점성술 통용 오브를 단순화해 균일 적용

// ─── 주요 한국 도시 좌표 ────────────────────────────────────────
export interface CityInfo { name: string; lat: number; lon: number }
export const KOREAN_CITIES: CityInfo[] = [
  { name: '서울', lat: 37.5665, lon: 126.9780 },
  { name: '부산', lat: 35.1796, lon: 129.0756 },
  { name: '대구', lat: 35.8714, lon: 128.6014 },
  { name: '인천', lat: 37.4563, lon: 126.7052 },
  { name: '광주', lat: 35.1595, lon: 126.8526 },
  { name: '대전', lat: 36.3504, lon: 127.3845 },
  { name: '울산', lat: 35.5384, lon: 129.3114 },
  { name: '세종', lat: 36.4800, lon: 127.2890 },
  { name: '수원', lat: 37.2636, lon: 127.0286 },
  { name: '성남', lat: 37.4201, lon: 127.1262 },
  { name: '고양', lat: 37.6584, lon: 126.8320 },
  { name: '용인', lat: 37.2411, lon: 127.1776 },
  { name: '부천', lat: 37.5035, lon: 126.7660 },
  { name: '안산', lat: 37.3219, lon: 126.8309 },
  { name: '안양', lat: 37.3943, lon: 126.9568 },
  { name: '화성', lat: 37.1996, lon: 126.8319 },
  { name: '평택', lat: 36.9921, lon: 127.1129 },
  { name: '남양주', lat: 37.6360, lon: 127.2165 },
  { name: '춘천', lat: 37.8813, lon: 127.7298 },
  { name: '원주', lat: 37.3422, lon: 127.9202 },
  { name: '강릉', lat: 37.7519, lon: 128.8761 },
  { name: '청주', lat: 36.6424, lon: 127.4890 },
  { name: '충주', lat: 36.9910, lon: 127.9259 },
  { name: '천안', lat: 36.8151, lon: 127.1139 },
  { name: '전주', lat: 35.8242, lon: 127.1480 },
  { name: '군산', lat: 35.9676, lon: 126.7369 },
  { name: '익산', lat: 35.9483, lon: 126.9575 },
  { name: '목포', lat: 34.8118, lon: 126.3922 },
  { name: '여수', lat: 34.7604, lon: 127.6622 },
  { name: '순천', lat: 34.9506, lon: 127.4874 },
  { name: '광양', lat: 34.9407, lon: 127.6958 },
  { name: '나주', lat: 35.0160, lon: 126.7107 },
  { name: '포항', lat: 36.0190, lon: 129.3435 },
  { name: '경주', lat: 35.8562, lon: 129.2247 },
  { name: '안동', lat: 36.5684, lon: 128.7294 },
  { name: '구미', lat: 36.1195, lon: 128.3446 },
  { name: '창원', lat: 35.2278, lon: 128.6811 },
  { name: '진주', lat: 35.1800, lon: 128.1076 },
  { name: '김해', lat: 35.2285, lon: 128.8894 },
  { name: '제주', lat: 33.4996, lon: 126.5312 },
  { name: '서귀포', lat: 33.2540, lon: 126.5600 },
];

// ─── 한국 서머타임(하절기 표준시) 보정 ──────────────────────────
// 1987~1988년만 정확한 기간을 확인해 보정. 1948~1960년대 간헐적 시행 기록은
// 연도별 정확한 일자를 신뢰성 있게 확인할 방법이 없어 이번 범위에서는 미보정(계획안.md 7-L-4 참고).
const KNOWN_DST_PERIODS = [
  { start: [1987, 5, 10], end: [1987, 10, 11] },
  { start: [1988, 5, 8], end: [1988, 10, 9] },
] as const;

function isKnownDstDate(year: number, month: number, day: number): boolean {
  const t = year * 10000 + month * 100 + day;
  return KNOWN_DST_PERIODS.some(({ start, end }) => {
    const s = start[0] * 10000 + start[1] * 100 + start[2];
    const e = end[0] * 10000 + end[1] * 100 + end[2];
    return t >= s && t <= e;
  });
}

/** 한국 표준시(KST, 서머타임 기간엔 KDT) 기준 출생 시각을 UTC Date로 변환 */
function toUtcDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  const utcOffsetHours = isKnownDstDate(year, month, day) ? 10 : 9;
  return new Date(Date.UTC(year, month - 1, day, hour - utcOffsetHours, minute));
}

// ─── 계산 결과 타입 ─────────────────────────────────────────────
export interface PlanetPlacement {
  key: PlanetKey;
  longitude: number;      // 0~360 지구중심 황경
  signIndex: number;      // 0~11
  signDegree: number;     // 0~30 (사인 내 도수)
  houseIndex: number;     // 0~11 (0=1하우스)
  dignity: DignityType | null;
}

export interface AspectResult {
  a: PlanetKey;
  b: PlanetKey;
  type: AspectType;
  nature: '길각' | '흉각' | '중립';
  exactAngle: number;
  orb: number; // 정확한 각도와의 오차
}

export interface AstrologyResult {
  ascendantLongitude: number;
  ascendantSignIndex: number;
  ascendantDegree: number;
  houseSignIndexes: number[]; // 12개, [0]=1하우스가 위치한 별자리 인덱스
  planets: PlanetPlacement[];
  isDayChart: boolean; // 섹트: true=주간 출생, false=야간 출생
  aspects: AspectResult[];
  dstApplied: boolean;
  timeConfidence: 'exact' | 'approximate' | 'unknown';
}

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function signOf(longitude: number): { signIndex: number; signDegree: number } {
  const norm = normalizeDeg(longitude);
  const signIndex = Math.floor(norm / 30) % 12;
  const signDegree = norm - signIndex * 30;
  return { signIndex, signDegree };
}

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

function angularDiff(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
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
  const aspects: AspectResult[] = [];
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
