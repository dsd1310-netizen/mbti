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
// 자시(子時, 23:00~01:00)는 자정을 걸쳐 있어 야자시(23시대, 전날 밤)와 조자시(0시대, 당일 새벽)로
// 나뉜다 — 지지(자)는 둘 다 같지만 일주(日柱) 계산 시 야자시는 다음 날로 이월되어야 함(아래 calculateSaju 참고).
export const HOUR_BRANCHES = [
  { id: '야자시', name: '야자시 (子時 초)', time: '23:00 ~ 24:00', branchIdx: 0, animal: '쥐', desc: '깊은 수(水)기운, 비밀스러운 기획력과 영민한 지혜 — 다음 날로 일주가 이월되는 심야 시간대' },
  { id: '자시', name: '자시 (子時 말)', time: '00:00 ~ 01:00', branchIdx: 0, animal: '쥐', desc: '깊은 수(水)기운, 비밀스러운 기획력과 영민한 지혜' },
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

/**
 * 정확한 출생 시각(시)이 주어졌을 때, 대응하는 HOUR_BRANCHES id를 반환.
 * 캐시 키·시주 표시 등 기존 12시진 선택 기반 코드와의 호환을 위해 사용.
 */
export function hourBranchIdFromExactTime(hour: number): string {
  if (hour === 23) return '야자시';
  const branchIdx = Math.floor((hour + 1) / 2) % 12;
  return HOUR_BRANCHES.find(h => h.branchIdx === branchIdx && h.id !== '야자시')?.id ?? '오시';
}

// ─── 오행 매핑 ────────────────────────────────────────────────
const ELEMENT_MAP: Record<string, string> = {
  '갑': 'wood', '을': 'wood', '인': 'wood', '묘': 'wood',
  '병': 'fire', '정': 'fire', '사': 'fire', '오': 'fire',
  '무': 'earth', '기': 'earth', '진': 'earth', '술': 'earth', '축': 'earth', '미': 'earth',
  '경': 'metal', '신': 'metal', '유': 'metal',
  '임': 'water', '계': 'water', '해': 'water', '자': 'water',
};

type SolarTermEntry = [number, number, number];

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

// ─── 십신(十神) ───────────────────────────────────────────────
export type SipsinType =
  | '비견' | '겁재' | '식신' | '상관' | '편재' | '정재' | '편관' | '정관' | '편인' | '정인';

// 오행 상생(내가 생하는 대상): 목→화→토→금→수→목
const ELEMENT_GENERATES: Record<string, string> = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
// 오행 상극(내가 극하는 대상): 목→토→수→화→금→목
const ELEMENT_CONTROLS: Record<string, string> = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };

// 십신 판별 시 지장간 정기(正氣)의 음양이 지지 명목 음양과 반대인 지지 (자·사·오·해)
const SIPSIN_BRANCH_YINYANG_FLIP = new Set([0, 5, 6, 11]);

function resolveSipsin(dayElement: string, dayYinYang: string, targetElement: string, targetYinYang: string): SipsinType {
  const sameYinYang = dayYinYang === targetYinYang;
  if (targetElement === dayElement) return sameYinYang ? '비견' : '겁재';
  if (ELEMENT_GENERATES[dayElement] === targetElement) return sameYinYang ? '식신' : '상관';
  if (ELEMENT_CONTROLS[dayElement] === targetElement) return sameYinYang ? '편재' : '정재';
  if (ELEMENT_CONTROLS[targetElement] === dayElement) return sameYinYang ? '편관' : '정관';
  return sameYinYang ? '편인' : '정인'; // ELEMENT_GENERATES[targetElement] === dayElement
}

export interface SipsinProfile {
  yearStem: SipsinType;
  yearBranch: SipsinType;
  monthStem: SipsinType;
  monthBranch: SipsinType;
  dayBranch: SipsinType;
  hourStem: SipsinType | null;
  hourBranch: SipsinType | null;
  counts: Partial<Record<SipsinType, number>>;
}

function calcSipsin(
  dayStemIdx: number,
  yearPillar: Pillar,
  monthPillar: Pillar,
  dayPillar: Pillar,
  hourPillar: Pillar | null,
): SipsinProfile {
  const dayStem = HEAVENLY_STEMS[dayStemIdx];
  const { element: dayElement, yinYang: dayYinYang } = dayStem;

  const stemSipsin = (stemIdx: number): SipsinType => {
    const s = HEAVENLY_STEMS[stemIdx];
    return resolveSipsin(dayElement, dayYinYang, s.element, s.yinYang);
  };
  const branchSipsin = (branchIdx: number): SipsinType => {
    const b = EARTHLY_BRANCHES[branchIdx];
    const yinYang = SIPSIN_BRANCH_YINYANG_FLIP.has(branchIdx) ? (b.yinYang === 'yang' ? 'yin' : 'yang') : b.yinYang;
    return resolveSipsin(dayElement, dayYinYang, b.element, yinYang);
  };

  const yearStem = stemSipsin(yearPillar.stemIdx);
  const yearBranch = branchSipsin(yearPillar.branchIdx);
  const monthStem = stemSipsin(monthPillar.stemIdx);
  const monthBranch = branchSipsin(monthPillar.branchIdx);
  const dayBranch = branchSipsin(dayPillar.branchIdx);
  const hourStem = hourPillar ? stemSipsin(hourPillar.stemIdx) : null;
  const hourBranch = hourPillar ? branchSipsin(hourPillar.branchIdx) : null;

  const all = [yearStem, yearBranch, monthStem, monthBranch, dayBranch, hourStem, hourBranch]
    .filter((s): s is SipsinType => s !== null);
  const counts: Partial<Record<SipsinType, number>> = {};
  all.forEach(s => { counts[s] = (counts[s] ?? 0) + 1; });

  return { yearStem, yearBranch, monthStem, monthBranch, dayBranch, hourStem, hourBranch, counts };
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
export function calcDayPillar(year: number, month: number, day: number): Pillar {
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

export interface DaeunEntry {
  age: number;
  stem: string;
  branch: string;
  stemHanja: string;
  branchHanja: string;
  element: string;
}

export interface SeunEntry {
  year: number;
  stem: string;
  branch: string;
  stemHanja: string;
  branchHanja: string;
  element: string;
}

export interface SajuResult {
  yearPillar: Pillar;
  monthPillar: Pillar;
  dayPillar: Pillar;
  hourPillar: Pillar | null;
  hourUnknown: boolean;
  elementCounts: ElementCounts;
  dayStem: string;
  dayBranch: string;
  dayStemElement: string;
  daeunStartAge: number;
  daeunList: DaeunEntry[];
  seunList: SeunEntry[];
  sipsin: SipsinProfile;
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
 * 대운(大運) 계산 로직
 * - 성별 (gender: 'male' | 'female')
 * - 연간 음양 판단 (연주 천간의 음양)
 * - 양남음녀 (남자 + 양의 해 / 여자 + 음의 해) -> 순행 (출생일 다음 절기까지 일수 계산)
 * - 음남양녀 (남자 + 음의 해 / 여자 + 양의 해) -> 역행 (출생일 이전 절기까지 일수 계산)
 * - 대운수 = 일수 / 3 (나머지 2일 이상 반올림 또는 버림/올림 명리학 규격상 3으로 나눈 몫으로 진입 연령 지정)
 */
export function calculateDaeun(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  gender: string,
  yearPillar: Pillar,
  monthPillar: Pillar
): { daeunStartAge: number; daeunList: DaeunEntry[] } {
  // 연간의 음양 확인
  const isYangYear = HEAVENLY_STEMS[yearPillar.stemIdx].yinYang === 'yang';
  const isMale = gender === 'male';

  // 순행 여부 결정
  // 양남음녀: 남성이면서 양의 해이거나, 여성이면서 음의 해 -> 순행
  // 음남양녀: 남성이면서 음의 해이거나, 여성이면서 양의 해 -> 역행
  const isForward = (isMale && isYangYear) || (!isMale && !isYangYear);

  // 대운수 산출 (일수 계산)
  let diffDays = 3; // 기본값 3세 대운
  const birthDate = new Date(year, month - 1, day, hour, minute);

  const yearData = SOLAR_TERMS[year];
  if (yearData) {
    const currentMonthTermIdx = month - 1; // 0~11
    
    let targetTermDate: Date;
    if (isForward) {
      // 다음 절기 (현재 월의 절기 또는 다음 절기)
      // 현재 태어난 시각이 현재 월의 절기보다 뒤라면, 다음 달의 절기를 타겟팅함
      const currentTermEntry = yearData[currentMonthTermIdx];
      const currentTermDate = new Date(year, month - 1, currentTermEntry[0], currentTermEntry[1], currentTermEntry[2]);
      
      if (birthDate >= currentTermDate) {
        // 다음 절기로 넘어감
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const nextYearData = SOLAR_TERMS[nextYear];
        const nextTermEntry = nextYearData ? nextYearData[nextMonth - 1] : [4, 18, 0] as SolarTermEntry;
        targetTermDate = new Date(nextYear, nextMonth - 1, nextTermEntry[0], nextTermEntry[1], nextTermEntry[2]);
      } else {
        targetTermDate = currentTermDate;
      }
    } else {
      // 이전 절기
      const currentTermEntry = yearData[currentMonthTermIdx];
      const currentTermDate = new Date(year, month - 1, currentTermEntry[0], currentTermEntry[1], currentTermEntry[2]);
      
      if (birthDate < currentTermDate) {
        // 이전 달의 절기로 넘어감
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prevYearData = SOLAR_TERMS[prevYear];
        const prevTermEntry = prevYearData ? prevYearData[prevMonth - 1] : [4, 18, 0] as SolarTermEntry;
        targetTermDate = new Date(prevYear, prevMonth - 1, prevTermEntry[0], prevTermEntry[1], prevTermEntry[2]);
      } else {
        targetTermDate = currentTermDate;
      }
    }

    const msDiff = Math.abs(birthDate.getTime() - targetTermDate.getTime());
    const calculatedDays = msDiff / (1000 * 60 * 60 * 24);
    diffDays = Math.max(1, Math.round(calculatedDays));
  }

  // 대운 시작 나이 (3으로 나눔, 최소 1)
  const daeunStartAge = Math.max(1, Math.round(diffDays / 3));

  // 월주 간지 기준으로 대운 리스트 전개
  const daeunList: DaeunEntry[] = [];
  let currentStemIdx = monthPillar.stemIdx;
  let currentBranchIdx = monthPillar.branchIdx;

  for (let i = 1; i <= 10; i++) {
    if (isForward) {
      currentStemIdx = (currentStemIdx + 1) % 10;
      currentBranchIdx = (currentBranchIdx + 1) % 12;
    } else {
      currentStemIdx = (currentStemIdx - 1 + 10) % 10;
      currentBranchIdx = (currentBranchIdx - 1 + 12) % 12;
    }

    const stem = HEAVENLY_STEMS[currentStemIdx];
    const branch = EARTHLY_BRANCHES[currentBranchIdx];

    daeunList.push({
      age: daeunStartAge + (i - 1) * 10,
      stem: stem.name,
      branch: branch.name,
      stemHanja: stem.hanja,
      branchHanja: branch.hanja,
      element: stem.element,
    });
  }

  return { daeunStartAge, daeunList };
}

/**
 * 세운(歲運) 계산 로직
 * - 현재 연도 기준 ±5년 계산
 */
export function calculateSeun(baseYear: number): SeunEntry[] {
  const startYear = baseYear - 5;
  const seunList: SeunEntry[] = [];

  for (let i = 0; i < 11; i++) {
    const currentYear = startYear + i;
    
    // 1984년 갑자년(stem=0, branch=0) 기준 계산
    const diff = currentYear - 1984;
    const stemIdx = ((diff % 10) + 10) % 10;
    const branchIdx = ((diff % 12) + 12) % 12;

    const stem = HEAVENLY_STEMS[stemIdx];
    const branch = EARTHLY_BRANCHES[branchIdx];

    seunList.push({
      year: currentYear,
      stem: stem.name,
      branch: branch.name,
      stemHanja: stem.hanja,
      branchHanja: branch.hanja,
      element: stem.element,
    });
  }

  return seunList;
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
  gender: string = 'female',
  hourUnknown: boolean = false,
  exactHour: number = -1,
  exactMinute: number = 0
): SajuResult {
  // 자시(23:00~01:00) 야자시/조자시 판정 및 시주 시각 보정
  let calcHour = exactHour;
  let calcMinute = exactMinute;
  let hourBranchIdx: number;

  if (calcHour !== -1 && !hourUnknown) {
    // 정확한 시:분이 주어지면 12시진 버튼 선택과 무관하게 그 시각으로 직접 시진 지지를 산출
    hourBranchIdx = calcHour === 23 ? 0 : Math.floor((calcHour + 1) / 2) % 12;
  } else {
    const hourBranch = HOUR_BRANCHES.find(h => h.id === hourBranchId) ?? HOUR_BRANCHES.find(h => h.id === '오시')!;
    hourBranchIdx = hourBranch.branchIdx;
    const isYajasi = hourBranch.id === '야자시';
    // 시간을 모르면 절기/대운 계산에 중립적인 정오(12시)를 기준값으로 사용
    calcHour = hourUnknown ? 12 : (isYajasi ? 23 : (hourBranchIdx === 0 ? 0 : (hourBranchIdx * 2 - 1)));
    calcMinute = 0;
  }

  // 야자시(23:00~24:00) 보정: 일주(日柱)만 다음 날로 이월. 연주/월주는 절기 판정을 위해
  // 실제 출생 시각(원래 날짜의 23시대) 그대로 사용해야 하므로 별도로 날짜를 분리해서 계산한다.
  let dayPillarYear = year;
  let dayPillarMonth = month;
  let dayPillarDay = day;
  if (calcHour === 23) {
    const tempDate = new Date(year, month - 1, day);
    tempDate.setDate(tempDate.getDate() + 1);
    dayPillarYear = tempDate.getFullYear();
    dayPillarMonth = tempDate.getMonth() + 1;
    dayPillarDay = tempDate.getDate();
  }

  const yearPillar = calcYearPillar(year, month, day, calcHour, calcMinute);
  const monthPillar = calcMonthPillar(year, month, day, calcHour, calcMinute, yearPillar.stemIdx);
  const dayPillar = calcDayPillar(dayPillarYear, dayPillarMonth, dayPillarDay);
  const hourPillar = hourUnknown ? null : calcHourPillar(hourBranchIdx, dayPillar.stemIdx);

  const elementCounts = calcElementCounts(
    hourPillar ? [yearPillar, monthPillar, dayPillar, hourPillar] : [yearPillar, monthPillar, dayPillar]
  );

  // 대운/세운 산출 (시간을 모르면 절기 대운수 계산은 정오 기준으로 근사)
  const { daeunStartAge, daeunList } = calculateDaeun(
    year,
    month,
    day,
    hourUnknown ? 12 : (calcHour === -1 ? 12 : calcHour),
    calcMinute,
    gender,
    yearPillar,
    monthPillar
  );

  const seunList = calculateSeun(new Date().getFullYear());

  const sipsin = calcSipsin(dayPillar.stemIdx, yearPillar, monthPillar, dayPillar, hourPillar);

  return {
    yearPillar,
    monthPillar,
    dayPillar,
    hourPillar,
    hourUnknown,
    elementCounts,
    dayStem: dayPillar.stem,
    dayBranch: dayPillar.branch,
    dayStemElement: dayPillar.element,
    daeunStartAge,
    daeunList,
    seunList,
    sipsin,
  };
}
