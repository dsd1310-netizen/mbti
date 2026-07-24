/**
 * 정밀 사주(四柱) 계산 엔진
 * - 연주(年柱): 갑자(甲子)부터 60갑자 순환, 절기 입춘 기준
 * - 월주(月柱): 24절기 정밀 데이터 기반 (solarTerms.ts)
 * - 일주(日柱): 기준일(2000-01-01 = 戊午) 기반 적산일수 계산
 * - 시주(時柱): 일간에 따른 시간두법(時間頭法)
 */

import { getMonthBranchIdx, SOLAR_TERMS } from '../data/solarTerms';

// ─── 천간(天干) ───────────────────────────────────────────────
export const HEAVENLY_STEMS = [
  { name: '갑', hanja: '甲', element: 'wood', yinYang: 'yang' },
  { name: '을', hanja: '乙', element: 'wood', yinYang: 'yin' },
  { name: '병', hanja: '丙', element: 'fire', yinYang: 'yang' },
  { name: '정', hanja: '丁', element: 'fire', yinYang: 'yin' },
  { name: '무', hanja: '戊', element: 'earth', yinYang: 'yang' },
  { name: '기', hanja: '己', element: 'earth', yinYang: 'yin' },
  { name: '경', hanja: '庚', element: 'metal', yinYang: 'yang' },
  { name: '신', hanja: '辛', element: 'metal', yinYang: 'yin' },
  { name: '임', hanja: '壬', element: 'water', yinYang: 'yang' },
  { name: '계', hanja: '癸', element: 'water', yinYang: 'yin' },
];

// ─── 지지(地支) ───────────────────────────────────────────────
export const EARTHLY_BRANCHES = [
  { name: '자', hanja: '子', element: 'water', animal: '쥐', yinYang: 'yang' },
  { name: '축', hanja: '丑', element: 'earth', animal: '소', yinYang: 'yin' },
  { name: '인', hanja: '寅', element: 'wood', animal: '호랑이', yinYang: 'yang' },
  { name: '묘', hanja: '卯', element: 'wood', animal: '토끼', yinYang: 'yin' },
  { name: '진', hanja: '辰', element: 'earth', animal: '용', yinYang: 'yang' },
  { name: '사', hanja: '巳', element: 'fire', animal: '뱀', yinYang: 'yin' },
  { name: '오', hanja: '午', element: 'fire', animal: '말', yinYang: 'yang' },
  { name: '미', hanja: '未', element: 'earth', animal: '양', yinYang: 'yin' },
  { name: '신', hanja: '申', element: 'metal', animal: '원숭이', yinYang: 'yang' },
  { name: '유', hanja: '酉', element: 'metal', animal: '닭', yinYang: 'yin' },
  { name: '술', hanja: '戌', element: 'earth', animal: '개', yinYang: 'yang' },
  { name: '해', hanja: '亥', element: 'water', animal: '돼지', yinYang: 'yin' },
];

// ─── 시간대 (12시진) ──────────────────────────────────────────
export const HOUR_BRANCHES = [
  { id: '자시', name: '자시 (子時)', time: '23:00 ~ 01:00', branchIdx: 0, animal: '쥐', desc: '깊은 수(水)기운, 비밀스러운 기획력과 영민한 지혜' },
  { id: '축시', name: '축시 (丑時)', time: '01:00 ~ 03:00', branchIdx: 1, animal: '소', desc: '묵직한 토(土)기운, 끈기와 인내로 내실을 쌓는 대기만성형' },
  { id: '인시', name: '인시 (寅時)', time: '03:00 ~ 05:00', branchIdx: 2, animal: '호랑이', desc: '강렬한 목(木)기운, 세상을 향해 솟구치는 개척 정신과 카리스마' },
  { id: '묘시', name: '묘시 (卯時)', time: '05:00 ~ 07:00', branchIdx: 3, animal: '토끼', desc: '화사한 목(木)기운, 감각적인 예술성과 사교적 포용력' },
  { id: '진시', name: '진시 (辰時)', time: '07:00 ~ 09:00', branchIdx: 4, animal: '용', desc: '변화무쌍한 토(土)기운, 거대한 비전과 스케일 큰 도전' },
  { id: '사시', name: '사시 (巳時)', time: '09:00 ~ 11:00', branchIdx: 5, animal: '뱀', desc: '뜨거운 화(火)기운, 비상한 두뇌 회전과 정밀한 분석력' },
  { id: '오시', name: '오시 (午時)', time: '11:00 ~ 13:00', branchIdx: 6, animal: '말', desc: '절정의 화(火)기운, 화려한 스포트라이트와 열정적인 질주' },
  { id: '미시', name: '미시 (未時)', time: '13:00 ~ 15:00', branchIdx: 7, animal: '양', desc: '온화한 토(土)기운, 따뜻한 공감 능력과 조직의 평화 중재' },
  { id: '신시', name: '신시 (申時)', time: '15:00 ~ 17:00', branchIdx: 8, animal: '원숭이', desc: '날카로운 금(金)기운, 재치 있는 순발력과 다재다능 멀티태스킹' },
  { id: '유시', name: '유시 (酉時)', time: '17:00 ~ 19:00', branchIdx: 9, animal: '닭', desc: '단단한 금(金)기운, 프로페셔널한 결단력과 완벽주의' },
  { id: '술시', name: '술시 (戌時)', time: '19:00 ~ 21:00', branchIdx: 10, animal: '개', desc: '단단한 토(土)기운, 철저한 의리와 내 사람을 지키는 책임감' },
  { id: '해시', name: '해시 (亥時)', time: '21:00 ~ 23:00', branchIdx: 11, animal: '돼지', desc: '포용의 수(水)기운, 복을 끌어당기는 너그러움과 넉넉한 그릇' },
];

// ─── 오행 매핑 ────────────────────────────────────────────────
const ELEMENT_MAP: Record<string, string> = {
  '갑': 'wood', '을': 'wood', '인': 'wood', '묘': 'wood',
  '병': 'fire', '정': 'fire', '사': 'fire', '오': 'fire',
  '무': 'earth', '기': 'earth', '진': 'earth', '술': 'earth', '축': 'earth', '미': 'earth',
  '경': 'metal', '신': 'metal', '유': 'metal',
  '임': 'water', '계': 'water', '해': 'water', '자': 'water',
};

export interface Pillar {
  stemIdx: number;
  branchIdx: number;
  stem: string;
  branch: string;
  stemHanja: string;
  branchHanja: string;
  element: string;
  text: string;
  hanjaText: string;
}

export interface ElementCounts {
  wood: number;
  fire: number;
  earth: number;
  metal: number;
  water: number;
}

export interface SajuResult {
  yearPillar: Pillar;
  monthPillar: Pillar;
  dayPillar: Pillar;
  hourPillar: Pillar;
  elementCounts: ElementCounts;
  dayStem: string;
  dayBranch: string;
  dayStemElement: string;
}

function makePillar(stemIdx: number, branchIdx: number): Pillar {
  const sIdx = ((stemIdx % 10) + 10) % 10;
  const bIdx = ((branchIdx % 12) + 12) % 12;
  const stem = HEAVENLY_STEMS[sIdx];
  const branch = EARTHLY_BRANCHES[bIdx];
  return {
    stemIdx: sIdx,
    branchIdx: bIdx,
    stem: stem.name,
    branch: branch.name,
    stemHanja: stem.hanja,
    branchHanja: branch.hanja,
    element: stem.element,
    text: `${stem.name}${branch.name}`,
    hanjaText: `${stem.hanja}${branch.hanja}`,
  };
}

/**
 * 연주(年柱) 계산
 * 기준: 1984년 = 갑자(甲子年), 천간 0, 지지 0
 * 입춘(立春) 이전 출생자는 전년도 연주를 사용
 */
function calcYearPillar(year: number, month: number, day: number, hour: number, minute: number): Pillar {
  let effectiveYear = year;

  // 입춘 절기 데이터 확인 (termIdx=1 = 입춘, 2월절)
  const yearData = SOLAR_TERMS[year];
  if (yearData && yearData[1]) {
    const chunEntry = yearData[1]; // 입춘 [day, hour, minute]
    // 2월이고 입춘 이전이라면 전년도
    const chunMinutes = chunEntry[0] * 1440 + chunEntry[1] * 60 + chunEntry[2];
    if (month === 1 || (month === 2 && (day * 1440 + hour * 60 + minute) < chunMinutes)) {
      effectiveYear = year - 1;
    }
  } else {
    // 데이터 없으면 입춘을 대략 2월 4일로 처리
    if (month === 1 || (month === 2 && day < 4)) {
      effectiveYear = year - 1;
    }
  }

  const baseYear = 1984; // 갑자년
  const diff = effectiveYear - baseYear;
  const stemIdx = ((diff % 10) + 10) % 10;
  const branchIdx = ((diff % 12) + 12) % 12;
  return makePillar(stemIdx, branchIdx);
}

/**
 * 월주(月柱) 계산
 * - 절기 기준으로 월 결정 (solarTerms.ts 데이터 활용)
 * - 월간두법(月干頭法): 연간에 따라 인월(寅月)의 천간이 결정됨
 *   갑·기년 → 병인월 시작 (stemIdx=2)
 *   을·경년 → 무인월 시작 (stemIdx=4)
 *   병·신년 → 경인월 시작 (stemIdx=6)
 *   정·임년 → 임인월 시작 (stemIdx=8)
 *   무·계년 → 갑인월 시작 (stemIdx=0)
 */
function calcMonthPillar(year: number, month: number, day: number, hour: number, minute: number, yearStemIdx: number): Pillar {
  // 절기 기준 월 지지 인덱스
  const monthBranchIdx = getMonthBranchIdx(year, month, day, hour, minute);

  // 월간두법 (인월=지지인덱스2 기준, 갑·기년=병(2))
  const monthStemBaseTable = [2, 4, 6, 8, 0, 2, 4, 6, 8, 0]; // 갑~계년의 인월 천간
  const inMonthStemBase = monthStemBaseTable[yearStemIdx];
  
  // 인월(branchIdx=2)을 기준으로 오프셋 계산
  // 인월(2), 묘월(3), 진월(4), 사월(5), 오월(6), 미월(7), 신월(8), 유월(9), 술월(10), 해월(11), 자월(0), 축월(1)
  const branchOrder = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1]; // 인월부터 순서
  const offset = branchOrder.indexOf(monthBranchIdx);
  const monthStemIdx = (inMonthStemBase + offset) % 10;

  return makePillar(monthStemIdx, monthBranchIdx);
}

/**
 * 일주(日柱) 계산
 * 기준: 2000년 1월 1일 = 戊午일 (천간 4=무, 지지 6=오)
 */
function calcDayPillar(year: number, month: number, day: number): Pillar {
  const target = new Date(year, month - 1, day);
  const ref = new Date(2000, 0, 1);
  const diffDays = Math.round((target.getTime() - ref.getTime()) / 86400000);
  const stemIdx = ((4 + diffDays) % 10 + 10) % 10;
  const branchIdx = ((6 + diffDays) % 12 + 12) % 12;
  return makePillar(stemIdx, branchIdx);
}

/**
 * 시주(時柱) 계산
 * 시간두법(時干頭法):
 *   갑·기일 → 갑자시 시작 (stemIdx=0)
 *   을·경일 → 병자시 시작 (stemIdx=2)
 *   병·신일 → 무자시 시작 (stemIdx=4)
 *   정·임일 → 경자시 시작 (stemIdx=6)
 *   무·계일 → 임자시 시작 (stemIdx=8)
 */
function calcHourPillar(hourBranchIdx: number, dayStemIdx: number): Pillar {
  const hourStemBaseTable = [0, 2, 4, 6, 8, 0, 2, 4, 6, 8];
  const base = hourStemBaseTable[dayStemIdx];
  const stemIdx = (base + hourBranchIdx) % 10;
  return makePillar(stemIdx, hourBranchIdx);
}

/**
 * 오행 개수 계산
 */
function calcElementCounts(pillars: Pillar[]): ElementCounts {
  const counts: ElementCounts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  pillars.forEach(p => {
    const stemEl = ELEMENT_MAP[p.stem];
    const branchEl = ELEMENT_MAP[p.branch];
    if (stemEl) counts[stemEl as keyof ElementCounts]++;
    if (branchEl) counts[branchEl as keyof ElementCounts]++;
  });
  return counts;
}

/**
 * 메인 사주 계산 함수
 */
export function calculateSaju(
  year: number,
  month: number,
  day: number,
  hourBranchId: string,
): SajuResult {
  const hourBranch = HOUR_BRANCHES.find(h => h.id === hourBranchId) ?? HOUR_BRANCHES[6];
  const hourBranchIdx = hourBranch.branchIdx;

  // 시주 중간 시각으로 계산
  // 자시는 23시~1시 → 0시로 계산
  const calcHour = hourBranchIdx === 0 ? 0 : (hourBranchIdx * 2 - 1);
  const calcMinute = 0;

  const yearPillar = calcYearPillar(year, month, day, calcHour, calcMinute);
  const monthPillar = calcMonthPillar(year, month, day, calcHour, calcMinute, yearPillar.stemIdx);
  const dayPillar = calcDayPillar(year, month, day);
  const hourPillar = calcHourPillar(hourBranchIdx, dayPillar.stemIdx);

  const elementCounts = calcElementCounts([yearPillar, monthPillar, dayPillar, hourPillar]);

  return {
    yearPillar,
    monthPillar,
    dayPillar,
    hourPillar,
    elementCounts,
    dayStem: dayPillar.stem,
    dayBranch: dayPillar.branch,
    dayStemElement: dayPillar.element,
  };
}
