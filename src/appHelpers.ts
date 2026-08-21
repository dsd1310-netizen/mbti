/**
 * App.tsx가 쓰는 모듈 스코프 헬퍼(캐시 키 함수, 이스케이프/캔버스 유틸, 고정 카피 데이터) 모음.
 * React 컴포넌트나 훅에 의존하지 않는 순수 함수/상수만 담는다. (2026-08-07 App.tsx 리팩터링,
 * 계획안.md 참고 — 파일을 나누기 전에 있던 주석은 대부분 그대로 옮겨왔다.)
 */
import { FormData, PillarKey } from './appTypes';
import { AiCategoryKey, CategoryUserAnswer } from './utils/geminiApi';
import { TarotCard } from './data/tarotCards';
import { QuestionableCategory } from './data/categoryQuestions';

// 클라우드 동기화(Firebase)는 실제로 필요할 때(로그인 여부 확인/로그인 시도)만 동적으로 불러온다.
// Firebase SDK가 번들 크기를 크게 키우기 때문에(약 260KB→1MB), 로그인 기능을 쓰지 않는
// 대다수 사용자의 초기 로딩 속도에 영향이 가지 않도록 하기 위함.
let cloudSyncModulePromise: Promise<typeof import('./utils/cloudSync')> | null = null;
export function loadCloudSync() {
  if (!cloudSyncModulePromise) cloudSyncModulePromise = import('./utils/cloudSync');
  return cloudSyncModulePromise;
}

// 동적 import(코드 스플리팅된 청크) 실패를 계산 오류와 구분하기 위한 판별 함수 — 지하철 등
// 네트워크가 순간적으로 끊기거나, 탭을 오래 열어둔 사이 새 배포가 나가 브라우저가 기억하는
// 청크 해시가 서버에서 사라졌을 때 이 형태의 에러 메시지가 뜬다(브라우저마다 문구는 조금씩
// 다르지만 공통적으로 "fetch"/"dynamically imported module"/"module script" 키워드를 포함).
// 계획안.md 7-AU 참고 — main.tsx의 vite:preloadError 자동 새로고침과 짝을 이루는 방어 로직.
export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /dynamically imported module|Failed to fetch|Importing a module script failed|Load failed/i.test(msg);
}

export const MBTI_LIST = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];

export const ELEMENT_LABELS: Record<string, { ko: string; emoji: string; cls: string }> = {
  wood:  { ko: '목(木)', emoji: '🌳', cls: 'element-wood' },
  fire:  { ko: '화(火)', emoji: '🔥', cls: 'element-fire' },
  earth: { ko: '토(土)', emoji: '⛰️', cls: 'element-earth' },
  metal: { ko: '금(金)', emoji: '💎', cls: 'element-metal' },
  water: { ko: '수(水)', emoji: '🌊', cls: 'element-water' },
};

export const LOADING_MESSAGES = [
  '만세력 데이터베이스 접속 중...',
  '절기(節氣) 기준 월주 정밀 연산 중...',
  '60갑자 일진 대조 완료, 시주 산출 중...',
  '나풀이가 사주 × MBTI 첫인상을 살피는 중...',
  '오행 밸런스 분석 중...',
  '당신만의 명리 리포트를 완성하는 중...',
];

// AI 해석 4개 카테고리 탭에 쓰이는 고정 카피
export const CATEGORY_TAB_META: Record<AiCategoryKey, {
  paneTitle: string; factBombTitle: string; bookmarkCategory: string; bookmarkTitle: string; generateLabel: string; introText: string;
}> = {
  personality: {
    paneTitle: '🌟 사주 오행 × MBTI 융합 성격 원리',
    factBombTitle: '🔥 사주 × MBTI 뼈 때리는 팩폭 한줄평',
    bookmarkCategory: '성격 분석',
    bookmarkTitle: 'MBTI 성격 분석',
    generateLabel: '🌟 성격 진단 생성하기',
    introText: '타고난 성격과 본질이 궁금하다면 나풀이 팩폭 분석을 받아보세요.',
  },
  career: {
    paneTitle: '💼 직업적 적성 & 업무 스타일 원리',
    factBombTitle: '🔥 뼈 때리는 일적 팩폭 한줄평',
    bookmarkCategory: '커리어 분석',
    bookmarkTitle: '커리어 & 직무 적성',
    generateLabel: '💼 커리어 분석 생성하기',
    introText: '직업적 적성과 업무 스타일이 궁금하다면 나풀이 팩폭 분석을 받아보세요.',
  },
  romance: {
    paneTitle: '💖 사랑, 연애 & 인간관계 패턴',
    factBombTitle: '🔥 뼈 때리는 연애 팩폭 한줄평',
    bookmarkCategory: '연애 분석',
    bookmarkTitle: '사랑 & 관계 패턴',
    generateLabel: '💖 연애 분석 생성하기',
    introText: '연애 스타일과 인간관계 패턴이 궁금하다면 나풀이 팩폭 분석을 받아보세요.',
  },
  wealth: {
    paneTitle: '💰 재물 축적 & 돈 새는 지출 구멍',
    factBombTitle: '🔥 뼈 때리는 재물 팩폭 한줄평',
    bookmarkCategory: '재물 분석',
    bookmarkTitle: '재물 & 소비 성향',
    generateLabel: '💰 재물 분석 생성하기',
    introText: '재물운과 소비 습관이 궁금하다면 나풀이 팩폭 분석을 받아보세요.',
  },
};

export function isQuestionableCategory(cat: AiCategoryKey): cat is QuestionableCategory {
  return cat === 'career' || cat === 'romance' || cat === 'wealth';
}

// HTML 문자열 삽입 지점(PDF document.write 등)에 쓰이는 이스케이프 헬퍼.
// 이름 등 사용자 입력값, AI 생성 텍스트, (다이어리 불러오기로 주입 가능한) 캐시된 문자열은
// 전부 신뢰할 수 없는 입력으로 간주해 반드시 이 함수를 거쳐야 함.
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 이스케이프 후 줄바꿈을 <br>로 변환 (AI 텍스트를 <p> 안에 그대로 넣을 때 사용)
export function escapeHtmlBreaks(str: string): string {
  return escapeHtml(str).replace(/\n/g, '<br>');
}

// 캔버스에 텍스트를 최대 너비 기준으로 줄바꿈 (공백 단위 우선, 안 되면 글자 단위)
export function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// 공유 카드(handleDownloadPersonaCard)에서 오늘의 타로 이미지를 canvas에 그리기 전 로드용.
// 실패해도(파일 누락 등) 호출부가 .catch(() => null)로 받아 기존 이모지 방식으로 조용히 대체.
export function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지 로드 실패: ${src}`));
    img.src = src;
  });
}

// birthBranch/hourUnknown을 반드시 포함해야 함 — 시간에 따라 elementCounts/sipsin(십신)이 달라져,
// 이름+생년월일만으로 키를 구성하면 시간만 바꿔 재제출했을 때 이전 시간 기준 캐시가 잘못 재사용됨.
export type CacheKeyBase = { name: string; birthYear: string; birthMonth: string; birthDay: string; birthBranch: string; hourUnknown: boolean };

export function baseKeyId(f: CacheKeyBase): string {
  return `${f.name}_${f.birthYear}${f.birthMonth}${f.birthDay}_${f.hourUnknown ? 'unknown' : f.birthBranch}`;
}

export function fengShuiCacheKey(f: CacheKeyBase): string {
  return `saju_fengshui_${baseKeyId(f)}`;
}
export function unseCacheKey(f: CacheKeyBase, year: number): string {
  return `saju_unse_${baseKeyId(f)}_${year}`;
}
export function categoryCacheKey(f: CacheKeyBase, mbti: string, category: AiCategoryKey, answers?: CategoryUserAnswer[]): string {
  const answerSuffix = answers && answers.length > 0 ? `_${answers.map(a => a.answer).join('|')}` : '';
  return `saju_category_${category}_${baseKeyId(f)}_${mbti}${answerSuffix}`;
}
export function prescriptionsCacheKey(f: CacheKeyBase, mbti: string): string {
  return `saju_prescriptions_${baseKeyId(f)}_${mbti}`;
}
export function aiIntroCacheKey(f: CacheKeyBase, mbti: string): string {
  return `saju_aiintro_${baseKeyId(f)}_${mbti}`;
}
export function elementSummaryCacheKey(f: CacheKeyBase): string {
  return `saju_elementsummary_${baseKeyId(f)}`;
}
export function compatSummaryCacheKey(f: CacheKeyBase): string {
  return `saju_compatsummary_${baseKeyId(f)}`;
}
export function categoryDeepCacheKey(f: CacheKeyBase, mbti: string, category: AiCategoryKey, answers?: CategoryUserAnswer[]): string {
  const answerSuffix = answers && answers.length > 0 ? `_${answers.map(a => a.answer).join('|')}` : '';
  return `saju_category_${category}_${baseKeyId(f)}_${mbti}${answerSuffix}_deep`;
}
export function fengShuiDeepCacheKey(f: CacheKeyBase): string {
  return `saju_fengshui_${baseKeyId(f)}_deep`;
}
export function unseDeepCacheKey(f: CacheKeyBase, year: number): string {
  return `saju_unse_${baseKeyId(f)}_${year}_deep`;
}
export function elementSummaryDeepCacheKey(f: CacheKeyBase): string {
  return `saju_elementsummary_${baseKeyId(f)}_deep`;
}
export function compatSummaryDeepCacheKey(f: CacheKeyBase): string {
  return `saju_compatsummary_${baseKeyId(f)}_deep`;
}

// [2026-08-06] 심화해석 계열은 실패 시 폴백 문구("...지금은 불러올 수 없습니다...")가
// 실제 콘텐츠인 것처럼 캐시되던 버그가 있었음(geminiApi.ts throwOnFailure로 향후 재발은 막음).
// 다만 그 수정 이전에 이미 localStorage에 저장된 사용자의 기존 캐시는 여전히 이 문구를 담고
// 있을 수 있어, 캐시를 읽을 때 이 패턴이면 "생성 안 됨"으로 취급해 버튼이 다시 뜨게 함.
export function isStaleDeepFallbackText(text: string | null): boolean {
  return !!text && text.endsWith('지금은 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.');
}
export function pillarCacheKey(f: CacheKeyBase, key: PillarKey): string {
  return `saju_pillar_${key}_${baseKeyId(f)}`;
}
// 나풀이의 방 — 사용자가 고른 방 꾸미기(4종 중 1개, 1~4)를 사람별로 기억.
// 하우징 모드로 확장될 것을 염두에 두고 사람별 저장 컨벤션(baseKeyId)을 미리 맞춰둠.
export function roomVariantCacheKey(f: CacheKeyBase): string {
  return `saju_roomvariant_${baseKeyId(f)}`;
}
// 서양점성술은 출생 도시(좌표)에 따라 하우스·어센던트가 달라지므로 baseKeyId에 도시명을 추가로 반영.
// baseKeyId의 birthBranch는 2시간 단위 시진까지만 구분하지만, 정확한 시:분 입력 시
// 어센던트는 분 단위로 계속 이동하므로 exactTime을 추가로 반영해 캐시가 섞이지 않게 함.
export function astrologyCacheKey(f: FormData, city: string): string {
  const exactTime = f.useExactTime && !f.hourUnknown ? `_${f.exactHour}:${f.exactMinute}` : '';
  return `saju_astrology_${baseKeyId(f)}_${city}${exactTime}`;
}
export function astrologyDeepCacheKey(f: FormData, city: string): string {
  return `${astrologyCacheKey(f, city)}_deep`;
}
// 행성/하우스 개별 클릭 심화해설 캐시 — placementKey는 "planet_sun" / "house_4"처럼 구분되는 값.
export function astroPlacementCacheKey(f: FormData, city: string, placementKey: string): string {
  return `${astrologyCacheKey(f, city)}_${placementKey}`;
}
export function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "오늘의 타로" 카드 비주얼(8-2) — 실제 카드 이미지 자산 없이, 수트(4원소)별 그라디언트·강조색으로
// 카드다운 느낌을 냄. 메이저 아르카나는 이 앱 전체 테마와 맞춘 보라/골드 톤.
// "오늘의 타로" 카드 비주얼(8-2/8-3) — 수트(4원소)별 강조색·짙은색·글로우 세트.
// .persona-card 공통 프레임(App.css)에 CSS 커스텀 프로퍼티로 꽂아 넣어 메달리온 스타일을 만듦.
export function tarotCardTheme(card: TarotCard): { accent: string; accentDark: string; glow: string } {
  if (card.arcana === 'major') {
    return { accent: '#a78bfa', accentDark: '#4c1d95', glow: 'rgba(167, 139, 250, 0.5)' };
  }
  switch (card.suit) {
    case 'wands': return { accent: '#fb923c', accentDark: '#9a3412', glow: 'rgba(251, 146, 60, 0.5)' };
    case 'cups': return { accent: '#60a5fa', accentDark: '#1e40af', glow: 'rgba(96, 165, 250, 0.5)' };
    case 'swords': return { accent: '#cbd5e1', accentDark: '#475569', glow: 'rgba(203, 213, 225, 0.4)' };
    case 'pentacles': return { accent: '#4ade80', accentDark: '#166534', glow: 'rgba(74, 222, 128, 0.5)' };
    default: return { accent: '#a78bfa', accentDark: '#4c1d95', glow: 'rgba(167, 139, 250, 0.5)' };
  }
}
export function dailyFortuneCacheKey(f: CacheKeyBase, dateStr: string): string {
  return `saju_daily_${baseKeyId(f)}_${dateStr}`;
}
export function transitCacheKey(f: FormData, city: string, dateStr: string): string {
  return `saju_transit_${astrologyCacheKey(f, city)}_${dateStr}`;
}
export function tarotCacheKey(f: CacheKeyBase, dateStr: string): string {
  return `saju_tarot_${baseKeyId(f)}_${dateStr}`;
}
export function pairCompatCacheKey(f: CacheKeyBase, partnerName: string, partnerBirthYear: string, partnerBirthMonth: string, partnerBirthDay: string, partnerGender: string): string {
  return `saju_paircompat_${baseKeyId(f)}_${partnerName}_${partnerBirthYear}${partnerBirthMonth}${partnerBirthDay}_${partnerGender}`;
}

// 8-1: "이전에 비교한 상대" 이력 — 본인(f) 기준으로 지금까지 비교해본 상대 목록을 별도로 기록해둬서,
// 매번 새로 폼을 입력하지 않고도 예전 결과를 바로 다시 볼 수 있게 함(캐시 자체는 이미 상대별로
// 분리돼 있었지만, "무슨 상대를 봤었는지" 목록을 보여줄 데가 없었음).
export interface PairCompatHistoryEntry {
  partnerName: string;
  partnerBirthYear: string;
  partnerBirthMonth: string;
  partnerBirthDay: string;
  partnerGender: string;
  comparedAt: number;
}
export function pairCompatHistoryKey(f: CacheKeyBase): string {
  return `saju_paircompat_history_${baseKeyId(f)}`;
}
export function getPairCompatHistory(f: CacheKeyBase): PairCompatHistoryEntry[] {
  try {
    const raw = localStorage.getItem(pairCompatHistoryKey(f));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
export function addPairCompatHistoryEntry(f: CacheKeyBase, entry: Omit<PairCompatHistoryEntry, 'comparedAt'>): void {
  const existing = getPairCompatHistory(f).filter(e =>
    !(e.partnerName === entry.partnerName && e.partnerBirthYear === entry.partnerBirthYear
      && e.partnerBirthMonth === entry.partnerBirthMonth && e.partnerBirthDay === entry.partnerBirthDay
      && e.partnerGender === entry.partnerGender)
  );
  const next = [{ ...entry, comparedAt: Date.now() }, ...existing].slice(0, 10); // 최근 10명까지만 보관
  localStorage.setItem(pairCompatHistoryKey(f), JSON.stringify(next));
}

// AI 후속질문(채팅) — 카테고리와 무관하게 "AI 해석" 탭 전체에서 하나의 대화를 공유.
// 화면에는 최근 CHAT_DISPLAY_LIMIT개까지만 보관하고, 실제 API 호출 시에는 그중에서도
// 최근 CHAT_CONTEXT_TURNS턴만 다시 프롬프트에 실어 보내 토큰 소모가 무한정 늘지 않게 함.
export function chatCacheKey(f: CacheKeyBase): string {
  return `saju_chat_${baseKeyId(f)}`;
}
export const CHAT_DISPLAY_LIMIT = 20; // 메시지 개수(10턴) — 화면·로컬 저장 상한
export const CHAT_CONTEXT_TURNS = 4;  // AI에 다시 실어 보내는 최근 턴 수

// 나와 닮은 인물 AI 매칭카드 — 한번 생성되면 다른 카테고리와 동일하게 캐시.
export function archetypeCacheKey(f: CacheKeyBase, mbti: string): string {
  return `saju_archetype_${baseKeyId(f)}_${mbti}`;
}

// [2026-08-07] 위 캐시 키들(baseKeyId 기반)은 상대방·도시·날짜 조합마다 새로 생기며 만료 로직이
// 없어, 여러 인물/시각을 시도해본 사용자는 localStorage 저장 공간이 소진될 수 있음. 북마크·다이어리
// 스냅샷·온보딩 등 사용자 데이터는 정리 대상에서 제외하고, 콘텐츠 캐시만 비상시 비워냄.
export const PRUNABLE_CACHE_PREFIXES = [
  'saju_fengshui_', 'saju_unse_', 'saju_category_', 'saju_prescriptions_', 'saju_aiintro_',
  'saju_elementsummary_', 'saju_compatsummary_', 'saju_pillar_', 'saju_astrology_', 'saju_daily_',
  'saju_tarot_', 'saju_transit_', 'saju_paircompat_', 'saju_chat_', 'saju_archetype_',
];

// localStorage.setItem이 저장 공간 부족(QuotaExceededError)으로 실패하면, 위 콘텐츠 캐시 키를
// 최대 50개까지 지우고 한 번 재시도한다. 그래도 실패하면 캐싱만 포기하고 조용히 넘어간다 —
// 이미 생성된 텍스트는 caller 쪽에서 state로 화면에 반영되므로 캐싱 실패가 곧 기능 실패는 아니다.
export function setCachedItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    return;
  } catch {
    const victims: string[] = [];
    for (let i = 0; i < localStorage.length && victims.length < 50; i++) {
      const k = localStorage.key(i);
      if (k && k !== key && PRUNABLE_CACHE_PREFIXES.some(p => k.startsWith(p))) victims.push(k);
    }
    victims.forEach(k => localStorage.removeItem(k));
    try {
      localStorage.setItem(key, value);
    } catch {
      // 정리 후에도 실패 — 캐싱은 포기
    }
  }
}

// Gemini API 키는 클라이언트에 절대 노출하지 않고 서버리스 프록시(api/gemini.ts)에서만 보관합니다.
// 아래 값은 실제 키가 아니라, 기존 코드 전반의 `if (!GEMINI_API_KEY)` 활성화 여부 검사를
// 그대로 유지하기 위한 하위 호환용 상수이며 geminiApi.ts의 저수준 함수에서는 사용하지 않습니다.
// ⚠️ 이 값은 항상 truthy인 리터럴 상수라서 파일 전체의 `if (!GEMINI_API_KEY)` / `{!GEMINI_API_KEY && ...}`
// 분기(예: 아래 "AI 비활성화" 안내 UI)는 전부 도달 불가능한 죽은 코드입니다 — 서버 쪽 실제 키
// 누락 여부(GEMINI_API_KEY 환경변수)는 이 상수와 무관하며, api/gemini.ts가 매 호출마다
// 개별적으로 확인합니다(CONFIG_MISSING 에러로 응답). "키 없음"을 감지하는 살아있는 체크로
// 오인해 여기에 실제 감지 로직을 추가하려 하지 마세요.
export const GEMINI_API_KEY = 'server-managed';

// [2026-08-07] 궁합 초대 링크 — 이 앱은 결과별 고유 URL이 없는 순수 프론트엔드 SPA라 카카오
// 공유 카드 링크가 항상 사이트 첫 화면으로만 연결됐음(7-A-2에서 "보류"로 남겼던 부분). "정밀 궁합"만
// 범위를 좁혀서: 내 생년월일을 URL에 담아 보내면, 링크를 연 상대방은 자기 정보만 입력하고
// 바로 나와의 궁합 결과를 보게 됨(계획안.md 7-AI 참고). 정밀궁합 상대방 입력 폼이 애초에
// 이름/생년월일/성별만 받으므로(출생시각은 안 씀) 그 4개 필드만 담으면 충분함.
export interface CompatInvite {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  gender: string;
}

/** URL 쿼리 파라미터로 쓸 수 있도록 base64로 인코딩. 이름+생년월일이 그대로 들어가므로
 * 평문은 아니지만 암호화는 아님 — 애초에 상대방에게 직접 전달하려는 정보이므로 그 이상의
 * 기밀성은 필요하지 않다고 판단(계획안.md 참고). */
export function encodeCompatInvite(invite: CompatInvite): string {
  return btoa(encodeURIComponent(JSON.stringify(invite)));
}

/** 손상되었거나 형식이 안 맞는 값이 들어와도 앱이 죽지 않도록 안전하게 파싱. */
export function decodeCompatInvite(raw: string): CompatInvite | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(raw)));
    if (
      parsed && typeof parsed === 'object' &&
      typeof parsed.name === 'string' && parsed.name.trim() &&
      typeof parsed.birthYear === 'string' && typeof parsed.birthMonth === 'string' && typeof parsed.birthDay === 'string' &&
      (parsed.gender === 'male' || parsed.gender === 'female')
    ) {
      return parsed as CompatInvite;
    }
    return null;
  } catch {
    return null;
  }
}
