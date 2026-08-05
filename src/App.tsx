import { useState, useEffect, useCallback } from 'react';
import './App.css';
import heroImage from './assets/hero.png';
import { calculateSaju, calcDayPillar, HOUR_BRANCHES, EARTHLY_BRANCHES, hourBranchIdFromExactTime, Pillar, SajuResult } from './utils/sajuCalculator';
import {
  generateSajuIntro, SajuIntro,
  generateCategoryInterpretation, AiCategoryKey, CategoryInterpretation, CategoryUserAnswer,
  generatePrescriptions,
  generateFengShuiInterpretation,
  generateFortuneInterpretation,
  generateDailyFortune, DailyFortune,
  generateElementSummaryInterpretation,
  generateCompatibilitySummaryInterpretation,
  generatePillarInterpretation,
  generateCategoryDeepInterpretation,
  generateFengShuiDeepInterpretation,
  generateFortuneDeepInterpretation,
  generateElementSummaryDeepInterpretation,
  generateCompatibilitySummaryDeepInterpretation,
  generateAstrologyInterpretation, generateAstrologyDeepInterpretation, AstrologyInterpretation,
  generateTransitInterpretation, DailyTransitFortune,
  generateTarotInterpretation,
  generatePairCompatibilityInterpretation,
} from './utils/geminiApi';
import { MBTI_DATA } from './data/mbtiTypes';
import { getBranchRelations } from './data/compatibility';
import { ELEMENT_INTERPRETATIONS } from './data/elementTypes';
import { CATEGORY_QUESTIONS, QuestionableCategory } from './data/categoryQuestions';
import { calculateAstrology, calculateTodayTransits, KOREAN_CITIES, ZODIAC_SIGNS, PLANETS, HOUSES, DIGNITY_LABEL, AstrologyResult } from './utils/astrologyCalculator';
import { drawDailyTarotCard } from './data/tarotCards';
import { comparePillars, PairCompatibilityResult } from './utils/pairCompatibility';
import { isNativePlatform, isDailyNotificationEnabled, enableDailyNotification, disableDailyNotification } from './utils/notifications';
import type { User } from 'firebase/auth';

// 클라우드 동기화(Firebase)는 실제로 필요할 때(로그인 여부 확인/로그인 시도)만 동적으로 불러온다.
// Firebase SDK가 번들 크기를 크게 키우기 때문에(약 260KB→1MB), 로그인 기능을 쓰지 않는
// 대다수 사용자의 초기 로딩 속도에 영향이 가지 않도록 하기 위함.
let cloudSyncModulePromise: Promise<typeof import('./utils/cloudSync')> | null = null;
function loadCloudSync() {
  if (!cloudSyncModulePromise) cloudSyncModulePromise = import('./utils/cloudSync');
  return cloudSyncModulePromise;
}

// ─── 나풀이 심볼 (크리스탈볼 속 별) — 헤더 로고에 사용 ────────────────────
function NapuliMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="napuliBallGrad" cx="36%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#c9adff" />
          <stop offset="55%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#4c2889" />
        </radialGradient>
        <linearGradient id="napuliStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe577" />
          <stop offset="100%" stopColor="#f5c842" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="46" r="32" fill="url(#napuliBallGrad)" />
      <ellipse cx="38" cy="31" rx="8" ry="5" fill="#ffffff" opacity="0.32" transform="rotate(-18 38 31)" />
      <path d="M50 26 L54.5 41.5 L70 46 L54.5 50.5 L50 66 L45.5 50.5 L30 46 L45.5 41.5 Z" fill="url(#napuliStarGrad)" />
      <circle cx="50" cy="46" r="4.2" fill="#fffbe8" />
    </svg>
  );
}

// ─── 타입 ────────────────────────────────────────
interface FormData {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthBranch: string;
  hourUnknown: boolean;
  useExactTime: boolean;
  exactHour: string;
  exactMinute: string;
  birthCity: string;
  gender: string;
  mbti: string;
}
interface AppResult {
  formData: FormData;
  sajuResult: SajuResult;
  hourBranch: typeof HOUR_BRANCHES[0];
  aiIntro: SajuIntro | null;
  astrologyResult: AstrologyResult;
  astrologyTimeConfidence: 'exact' | 'approximate' | 'unknown';
}
interface Bookmark {
  id: number;
  category: string;
  title: string;
  content: string;
  date: string;
  snapshot?: FormData; // 저장 당시의 입력값 — 전체 결과 화면으로 되돌아갈 때 사용
}
type Step = 'input' | 'loading' | 'result' | 'bookmarks';
type PillarKey = 'year' | 'month' | 'day' | 'hour';

const MBTI_LIST = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];

const ELEMENT_LABELS: Record<string, { ko: string; emoji: string; cls: string }> = {
  wood:  { ko: '목(木)', emoji: '🌳', cls: 'element-wood' },
  fire:  { ko: '화(火)', emoji: '🔥', cls: 'element-fire' },
  earth: { ko: '토(土)', emoji: '⛰️', cls: 'element-earth' },
  metal: { ko: '금(金)', emoji: '💎', cls: 'element-metal' },
  water: { ko: '수(水)', emoji: '🌊', cls: 'element-water' },
};

const LOADING_MESSAGES = [
  '만세력 데이터베이스 접속 중...',
  '절기(節氣) 기준 월주 정밀 연산 중...',
  '60갑자 일진 대조 완료, 시주 산출 중...',
  '나풀이가 사주 × MBTI 첫인상을 살피는 중...',
  '오행 밸런스 분석 중...',
  '당신만의 명리 리포트를 완성하는 중...',
];

// AI 해석 4개 카테고리 탭에 쓰이는 고정 카피
const CATEGORY_TAB_META: Record<AiCategoryKey, {
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

function isQuestionableCategory(cat: AiCategoryKey): cat is QuestionableCategory {
  return cat === 'career' || cat === 'romance' || cat === 'wealth';
}

// HTML 문자열 삽입 지점(PDF document.write 등)에 쓰이는 이스케이프 헬퍼.
// 이름 등 사용자 입력값, AI 생성 텍스트, (다이어리 불러오기로 주입 가능한) 캐시된 문자열은
// 전부 신뢰할 수 없는 입력으로 간주해 반드시 이 함수를 거쳐야 함.
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 이스케이프 후 줄바꿈을 <br>로 변환 (AI 텍스트를 <p> 안에 그대로 넣을 때 사용)
function escapeHtmlBreaks(str: string): string {
  return escapeHtml(str).replace(/\n/g, '<br>');
}

// 캔버스에 텍스트를 최대 너비 기준으로 줄바꿈 (공백 단위 우선, 안 되면 글자 단위)
function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

// birthBranch/hourUnknown을 반드시 포함해야 함 — 시간에 따라 elementCounts/sipsin(십신)이 달라져,
// 이름+생년월일만으로 키를 구성하면 시간만 바꿔 재제출했을 때 이전 시간 기준 캐시가 잘못 재사용됨.
type CacheKeyBase = { name: string; birthYear: string; birthMonth: string; birthDay: string; birthBranch: string; hourUnknown: boolean };

function baseKeyId(f: CacheKeyBase): string {
  return `${f.name}_${f.birthYear}${f.birthMonth}${f.birthDay}_${f.hourUnknown ? 'unknown' : f.birthBranch}`;
}

function fengShuiCacheKey(f: CacheKeyBase): string {
  return `saju_fengshui_${baseKeyId(f)}`;
}
function unseCacheKey(f: CacheKeyBase, year: number): string {
  return `saju_unse_${baseKeyId(f)}_${year}`;
}
function categoryCacheKey(f: CacheKeyBase, mbti: string, category: AiCategoryKey, answers?: CategoryUserAnswer[]): string {
  const answerSuffix = answers && answers.length > 0 ? `_${answers.map(a => a.answer).join('|')}` : '';
  return `saju_category_${category}_${baseKeyId(f)}_${mbti}${answerSuffix}`;
}
function prescriptionsCacheKey(f: CacheKeyBase, mbti: string): string {
  return `saju_prescriptions_${baseKeyId(f)}_${mbti}`;
}
function aiIntroCacheKey(f: CacheKeyBase, mbti: string): string {
  return `saju_aiintro_${baseKeyId(f)}_${mbti}`;
}
function elementSummaryCacheKey(f: CacheKeyBase): string {
  return `saju_elementsummary_${baseKeyId(f)}`;
}
function compatSummaryCacheKey(f: CacheKeyBase): string {
  return `saju_compatsummary_${baseKeyId(f)}`;
}
function categoryDeepCacheKey(f: CacheKeyBase, mbti: string, category: AiCategoryKey, answers?: CategoryUserAnswer[]): string {
  const answerSuffix = answers && answers.length > 0 ? `_${answers.map(a => a.answer).join('|')}` : '';
  return `saju_category_${category}_${baseKeyId(f)}_${mbti}${answerSuffix}_deep`;
}
function fengShuiDeepCacheKey(f: CacheKeyBase): string {
  return `saju_fengshui_${baseKeyId(f)}_deep`;
}
function unseDeepCacheKey(f: CacheKeyBase, year: number): string {
  return `saju_unse_${baseKeyId(f)}_${year}_deep`;
}
function elementSummaryDeepCacheKey(f: CacheKeyBase): string {
  return `saju_elementsummary_${baseKeyId(f)}_deep`;
}
function compatSummaryDeepCacheKey(f: CacheKeyBase): string {
  return `saju_compatsummary_${baseKeyId(f)}_deep`;
}
function pillarCacheKey(f: CacheKeyBase, key: PillarKey): string {
  return `saju_pillar_${key}_${baseKeyId(f)}`;
}
// 서양점성술은 출생 도시(좌표)에 따라 하우스·어센던트가 달라지므로 baseKeyId에 도시명을 추가로 반영.
// baseKeyId의 birthBranch는 2시간 단위 시진까지만 구분하지만, 정확한 시:분 입력 시
// 어센던트는 분 단위로 계속 이동하므로 exactTime을 추가로 반영해 캐시가 섞이지 않게 함.
function astrologyCacheKey(f: FormData, city: string): string {
  const exactTime = f.useExactTime && !f.hourUnknown ? `_${f.exactHour}:${f.exactMinute}` : '';
  return `saju_astrology_${baseKeyId(f)}_${city}${exactTime}`;
}
function astrologyDeepCacheKey(f: FormData, city: string): string {
  return `${astrologyCacheKey(f, city)}_deep`;
}
function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dailyFortuneCacheKey(f: CacheKeyBase, dateStr: string): string {
  return `saju_daily_${baseKeyId(f)}_${dateStr}`;
}
function transitCacheKey(f: FormData, city: string, dateStr: string): string {
  return `saju_transit_${astrologyCacheKey(f, city)}_${dateStr}`;
}
function tarotCacheKey(f: CacheKeyBase, dateStr: string): string {
  return `saju_tarot_${baseKeyId(f)}_${dateStr}`;
}
function pairCompatCacheKey(f: CacheKeyBase, partnerName: string, partnerBirthYear: string, partnerBirthMonth: string, partnerBirthDay: string, partnerGender: string): string {
  return `saju_paircompat_${baseKeyId(f)}_${partnerName}_${partnerBirthYear}${partnerBirthMonth}${partnerBirthDay}_${partnerGender}`;
}

// Gemini API 키는 클라이언트에 절대 노출하지 않고 서버리스 프록시(api/gemini.ts)에서만 보관합니다.
// 아래 값은 실제 키가 아니라, 기존 코드 전반의 `if (!GEMINI_API_KEY)` 활성화 여부 검사를
// 그대로 유지하기 위한 하위 호환용 상수이며 geminiApi.ts의 저수준 함수에서는 사용하지 않습니다.
const GEMINI_API_KEY = 'server-managed';

// ─── 앱 컴포넌트 ──────────────────────────────────
export default function App() {
  const [step, setStep] = useState<Step>('input');
  const [activeSection, setActiveSection] = useState<'today' | 'saju' | 'astrology'>('saju');
  const [activeSajuTab, setActiveSajuTab] = useState<'fortune' | 'ai' | 'compat' | 'fengshui'>('fortune');
  const [activeTab, setActiveTab] = useState<'personality' | 'career' | 'romance' | 'wealth' | 'prescriptions'>('personality');
  // 🔔 매일 알림(네이티브 앱 전용) — 웹 버전에서는 UI 자체를 노출하지 않음
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => isDailyNotificationEnabled());
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    birthYear: '1995',
    birthMonth: '09',
    birthDay: '27',
    birthBranch: '오시',
    hourUnknown: false,
    useExactTime: false,
    exactHour: '',
    exactMinute: '',
    birthCity: '서울',
    gender: 'female',
    mbti: 'ENTP',
  });
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [result, setResult] = useState<AppResult | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [diaryDetail, setDiaryDetail] = useState<Bookmark | null>(null);
  // 클라우드 동기화(선택 기능) — 로그인하지 않아도 위 bookmarks/localStorage만으로 완전히 동작함
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cloudSyncLoading, setCloudSyncLoading] = useState(false);
  const [cloudSyncAvailable, setCloudSyncAvailable] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [introError, setIntroError] = useState<string | null>(null);
  const [selectedModal, setSelectedModal] = useState<{ title: string; content: string; extra?: string } | null>(null);

  // AI 해석 4개 카테고리 + 처방전 (탭 진입 시 버튼으로 개별 생성)
  const [categoryData, setCategoryData] = useState<Partial<Record<AiCategoryKey, CategoryInterpretation>>>({});
  const [categoryLoading, setCategoryLoading] = useState<Partial<Record<AiCategoryKey, boolean>>>({});
  const [prescriptionsData, setPrescriptionsData] = useState<string[] | null>(null);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);

  // 커리어/연애/재물 생성 전 개인화 질문 답변 (선택 사항, [질문1 답, 질문2 답])
  const [categoryAnswers, setCategoryAnswers] = useState<Partial<Record<QuestionableCategory, [string?, string?]>>>({});

  // 사주 4기둥 클릭 시 AI 심층 해설
  const [pillarModal, setPillarModal] = useState<{ key: PillarKey; label: string; hanjaText: string; koreanText: string; staticDesc?: string } | null>(null);
  const [pillarAiData, setPillarAiData] = useState<Partial<Record<PillarKey, string>>>({});
  const [pillarAiLoading, setPillarAiLoading] = useState(false);

  const [fengShuiText, setFengShuiText] = useState<string | null>(null);
  const [fengShuiLoading, setFengShuiLoading] = useState(false);
  const [unseText, setUnseText] = useState<string | null>(null);
  const [unseLoading, setUnseLoading] = useState(false);
  const [elementSummaryText, setElementSummaryText] = useState<string | null>(null);
  const [elementSummaryLoading, setElementSummaryLoading] = useState(false);
  const [compatSummaryText, setCompatSummaryText] = useState<string | null>(null);
  const [compatSummaryLoading, setCompatSummaryLoading] = useState(false);
  const [dailyFortuneData, setDailyFortuneData] = useState<DailyFortune | null>(null);
  const [dailyFortuneLoading, setDailyFortuneLoading] = useState(false);

  // 심화해석(🔍 십신·MBTI 상세 근거, 3배 이상 분량) — 8개 섹션 공통, "_deep" 캐시로 별도 저장
  const [categoryDeepData, setCategoryDeepData] = useState<Partial<Record<AiCategoryKey, string>>>({});
  const [categoryDeepLoading, setCategoryDeepLoading] = useState<Partial<Record<AiCategoryKey, boolean>>>({});
  const [fengShuiDeepText, setFengShuiDeepText] = useState<string | null>(null);
  const [fengShuiDeepLoading, setFengShuiDeepLoading] = useState(false);
  const [unseDeepText, setUnseDeepText] = useState<string | null>(null);
  const [unseDeepLoading, setUnseDeepLoading] = useState(false);
  const [elementSummaryDeepText, setElementSummaryDeepText] = useState<string | null>(null);
  const [elementSummaryDeepLoading, setElementSummaryDeepLoading] = useState(false);
  const [compatSummaryDeepText, setCompatSummaryDeepText] = useState<string | null>(null);
  const [compatSummaryDeepLoading, setCompatSummaryDeepLoading] = useState(false);

  // 🪐 별자리(서양 고전점성술) AI 해설
  const [astrologyData, setAstrologyData] = useState<AstrologyInterpretation | null>(null);
  const [astrologyLoading, setAstrologyLoading] = useState(false);
  const [astrologyDeepText, setAstrologyDeepText] = useState<string | null>(null);
  const [astrologyDeepLoading, setAstrologyDeepLoading] = useState(false);

  // 🔮 오늘의 트랜짓 운세
  const [transitData, setTransitData] = useState<DailyTransitFortune | null>(null);
  const [transitLoading, setTransitLoading] = useState(false);

  // 🃏 오늘의 타로
  const [tarotData, setTarotData] = useState<string | null>(null);
  const [tarotLoading, setTarotLoading] = useState(false);

  // 💑 정밀 궁합(실제 2인 비교) — 상대방 정보 입력
  const [partnerFormOpen, setPartnerFormOpen] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [partnerBirthYear, setPartnerBirthYear] = useState('');
  const [partnerBirthMonth, setPartnerBirthMonth] = useState('');
  const [partnerBirthDay, setPartnerBirthDay] = useState('');
  const [partnerGender, setPartnerGender] = useState('female');
  const [pairSajuB, setPairSajuB] = useState<SajuResult | null>(null);
  const [pairCompare, setPairCompare] = useState<PairCompatibilityResult | null>(null);
  const [pairCompatText, setPairCompatText] = useState<string | null>(null);
  const [pairCompatLoading, setPairCompatLoading] = useState(false);

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [imageCardGenerating, setImageCardGenerating] = useState(false);

  useEffect(() => {
    const savedBm = localStorage.getItem('saju_bookmarks');
    if (savedBm) { try { setBookmarks(JSON.parse(savedBm)); } catch {} }
  }, []);

  // 클라우드 동기화(선택 기능): 로그인 상태 구독 + 로그인 시 로컬↔클라우드 다이어리 기록 병합
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    loadCloudSync().then(mod => {
      setCloudSyncAvailable(mod.cloudSyncAvailable);
      unsubscribe = mod.subscribeToAuthState(async (user) => {
        setCurrentUser(user);
        if (!user) return;
        setCloudSyncLoading(true);
        try {
          const cloud = await mod.fetchCloudBookmarks<Bookmark>(user.uid);
          // 로컬 기록은 클라우드 fetch가 끝난 "직후"(가능한 한 병합 직전)에 다시 읽는다 —
          // fetch를 기다리는 동안 addBookmark/removeBookmark가 로컬에 새로 반영한 변경을
          // 오래된 스냅샷으로 덮어써버리는 경합을 줄이기 위함.
          const localRaw = localStorage.getItem('saju_bookmarks');
          const local: Bookmark[] = localRaw ? JSON.parse(localRaw) : [];
          const merged = mod.mergeBookmarks(local, cloud);
          setBookmarks(merged);
          localStorage.setItem('saju_bookmarks', JSON.stringify(merged));
          await mod.pushBookmarksToCloud(user.uid, merged);
        } catch (err) {
          console.warn('클라우드 동기화 실패:', err);
          showToast('클라우드 동기화에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
          setCloudSyncLoading(false);
        }
      });
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const handleToggleNotifications = async () => {
    setNotificationsLoading(true);
    try {
      if (notificationsEnabled) {
        await disableDailyNotification();
        setNotificationsEnabled(false);
        showToast('매일 알림을 껐어요');
      } else {
        const granted = await enableDailyNotification();
        setNotificationsEnabled(granted);
        showToast(granted ? '매일 오전 9시에 알려드릴게요 🔔' : '알림 권한이 허용되지 않았어요');
      }
    } catch (err: any) {
      showToast(`알림 설정 실패: ${err?.message ?? '알 수 없는 오류'}`);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      const mod = await loadCloudSync();
      await mod.signInWithGoogle();
      showToast('로그인되었습니다 ☁️');
    } catch (err: any) {
      showToast(`로그인 실패: ${err?.message ?? '알 수 없는 오류'}`);
    }
  };

  const handleSignOut = async () => {
    const mod = await loadCloudSync();
    await mod.signOutUser();
    showToast('로그아웃되었습니다');
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    const ok = window.confirm('계정과 클라우드에 저장된 기록을 영구적으로 삭제합니다. 이 기기의 로컬 다이어리 기록은 남아있지만, 계정 자체는 되돌릴 수 없습니다. 계속할까요?');
    if (!ok) return;
    setCloudSyncLoading(true);
    try {
      const mod = await loadCloudSync();
      await mod.deleteAccount(currentUser);
      showToast('계정이 삭제되었습니다');
    } catch (err: any) {
      showToast(`계정 삭제 실패: ${err?.message ?? '알 수 없는 오류'}`);
    } finally {
      setCloudSyncLoading(false);
    }
  };

  // 풍수 수리 가이드 / 운세 해설 캐시 로드
  useEffect(() => {
    if (!result) { setFengShuiText(null); setUnseText(null); setFengShuiDeepText(null); setUnseDeepText(null); return; }
    setFengShuiText(localStorage.getItem(fengShuiCacheKey(result.formData)));
    setUnseText(localStorage.getItem(unseCacheKey(result.formData, new Date().getFullYear())));
    setFengShuiDeepText(localStorage.getItem(fengShuiDeepCacheKey(result.formData)));
    setUnseDeepText(localStorage.getItem(unseDeepCacheKey(result.formData, new Date().getFullYear())));
  }, [result]);

  // AI 해석 4개 카테고리 + 처방전 캐시 로드
  useEffect(() => {
    if (!result) { setCategoryData({}); setCategoryDeepData({}); setPrescriptionsData(null); return; }
    const loaded: Partial<Record<AiCategoryKey, CategoryInterpretation>> = {};
    const loadedDeep: Partial<Record<AiCategoryKey, string>> = {};
    (['personality', 'career', 'romance', 'wealth'] as AiCategoryKey[]).forEach(cat => {
      const cached = localStorage.getItem(categoryCacheKey(result.formData, result.formData.mbti, cat));
      if (cached) { try { loaded[cat] = JSON.parse(cached); } catch {} }
      const cachedDeep = localStorage.getItem(categoryDeepCacheKey(result.formData, result.formData.mbti, cat));
      if (cachedDeep) loadedDeep[cat] = cachedDeep;
    });
    setCategoryData(loaded);
    setCategoryDeepData(loadedDeep);

    const cachedPrescriptions = localStorage.getItem(prescriptionsCacheKey(result.formData, result.formData.mbti));
    if (cachedPrescriptions) {
      try { setPrescriptionsData(JSON.parse(cachedPrescriptions)); } catch { setPrescriptionsData(null); }
    } else {
      setPrescriptionsData(null);
    }
  }, [result]);

  // 오행/궁합 종합 해설 캐시 로드
  useEffect(() => {
    if (!result) { setElementSummaryText(null); setCompatSummaryText(null); setElementSummaryDeepText(null); setCompatSummaryDeepText(null); return; }
    setElementSummaryText(localStorage.getItem(elementSummaryCacheKey(result.formData)));
    setCompatSummaryText(localStorage.getItem(compatSummaryCacheKey(result.formData)));
    setElementSummaryDeepText(localStorage.getItem(elementSummaryDeepCacheKey(result.formData)));
    setCompatSummaryDeepText(localStorage.getItem(compatSummaryDeepCacheKey(result.formData)));
  }, [result]);

  // 🪐 별자리(서양점성술) AI 해설 캐시 로드
  useEffect(() => {
    if (!result) { setAstrologyData(null); setAstrologyDeepText(null); return; }
    const cached = localStorage.getItem(astrologyCacheKey(result.formData, result.formData.birthCity));
    if (cached) { try { setAstrologyData(JSON.parse(cached)); } catch { setAstrologyData(null); } }
    else { setAstrologyData(null); }
    setAstrologyDeepText(localStorage.getItem(astrologyDeepCacheKey(result.formData, result.formData.birthCity)));
  }, [result]);

  // 오늘의 나풀이(데일리 운세) 캐시 로드 (오늘 날짜 기준)
  useEffect(() => {
    if (!result) { setDailyFortuneData(null); return; }
    const cached = localStorage.getItem(dailyFortuneCacheKey(result.formData, todayDateStr()));
    if (cached) { try { setDailyFortuneData(JSON.parse(cached)); } catch { setDailyFortuneData(null); } }
    else { setDailyFortuneData(null); }
  }, [result]);

  // 🔮 오늘의 트랜짓 운세 캐시 로드 (오늘 날짜 기준)
  useEffect(() => {
    if (!result) { setTransitData(null); return; }
    const cached = localStorage.getItem(transitCacheKey(result.formData, result.formData.birthCity, todayDateStr()));
    if (cached) { try { setTransitData(JSON.parse(cached)); } catch { setTransitData(null); } }
    else { setTransitData(null); }
  }, [result]);

  // 🃏 오늘의 타로 캐시 로드 (오늘 날짜 기준)
  useEffect(() => {
    if (!result) { setTarotData(null); return; }
    setTarotData(localStorage.getItem(tarotCacheKey(result.formData, todayDateStr())));
  }, [result]);

  // 사주 4기둥 AI 심층 해설 캐시 로드
  useEffect(() => {
    if (!result) { setPillarAiData({}); return; }
    const loaded: Partial<Record<PillarKey, string>> = {};
    (['year', 'month', 'day', 'hour'] as PillarKey[]).forEach(k => {
      const cached = localStorage.getItem(pillarCacheKey(result.formData, k));
      if (cached) loaded[k] = cached;
    });
    setPillarAiData(loaded);
  }, [result]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // 카테고리(성격/커리어/연애/재물) AI 심층 분석 생성
  // answers: 커리어/연애/재물에 한해 사용자가 개인화 질문에 답했다면 전달 (건너뛰면 undefined)
  const handleGenerateCategory = async (category: AiCategoryKey, answers?: CategoryUserAnswer[]): Promise<CategoryInterpretation | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setCategoryLoading(prev => ({ ...prev, [category]: true }));
    try {
      const data = await generateCategoryInterpretation(
        GEMINI_API_KEY,
        result.formData.name,
        result.formData.gender,
        result.formData.mbti,
        result.sajuResult,
        category,
        answers,
      );
      setCategoryData(prev => ({ ...prev, [category]: data }));
      localStorage.setItem(categoryCacheKey(result.formData, result.formData.mbti, category, answers), JSON.stringify(data));
      return data;
    } catch (err: any) {
      showToast(`${CATEGORY_TAB_META[category].bookmarkCategory} 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setCategoryLoading(prev => ({ ...prev, [category]: false }));
    }
  };

  // 카테고리 심화해석(🔍 더보기) 생성 — 십신·MBTI 상세 근거로 3배 이상 분량
  const handleGenerateCategoryDeep = async (category: AiCategoryKey, answers?: CategoryUserAnswer[]): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setCategoryDeepLoading(prev => ({ ...prev, [category]: true }));
    try {
      const text = await generateCategoryDeepInterpretation(
        GEMINI_API_KEY,
        result.formData.name,
        result.formData.gender,
        result.formData.mbti,
        result.sajuResult,
        category,
        answers,
      );
      setCategoryDeepData(prev => ({ ...prev, [category]: text }));
      localStorage.setItem(categoryDeepCacheKey(result.formData, result.formData.mbti, category, answers), text);
      return text;
    } catch (err: any) {
      showToast(`${CATEGORY_TAB_META[category].bookmarkCategory} 심화해석 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setCategoryDeepLoading(prev => ({ ...prev, [category]: false }));
    }
  };

  // 카테고리별 사용자 답변 목록 조합 (짧은 해석/심화해석 생성 시 공통으로 사용)
  const getAnsweredForCategory = (cat: AiCategoryKey): CategoryUserAnswer[] | undefined => {
    if (!isQuestionableCategory(cat)) return undefined;
    const qs = CATEGORY_QUESTIONS[cat];
    const ans = categoryAnswers[cat] ?? [undefined, undefined];
    const answered: CategoryUserAnswer[] = qs
      .map((q, qIdx) => ({ question: q.question, answer: ans[qIdx] }))
      .filter((a): a is CategoryUserAnswer => !!a.answer);
    return answered.length > 0 ? answered : undefined;
  };

  // 3대 실천 처방전 생성
  const handleGeneratePrescriptions = async (): Promise<string[] | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setPrescriptionsLoading(true);
    try {
      const data = await generatePrescriptions(
        GEMINI_API_KEY,
        result.formData.name,
        result.formData.gender,
        result.formData.mbti,
        result.sajuResult,
      );
      setPrescriptionsData(data);
      localStorage.setItem(prescriptionsCacheKey(result.formData, result.formData.mbti), JSON.stringify(data));
      return data;
    } catch (err: any) {
      showToast(`처방전 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setPrescriptionsLoading(false);
    }
  };

  // 풍수 수리 가이드 AI 생성 (이름+생년월일 기준 캐싱)
  const handleGenerateFengShui = async (): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setFengShuiLoading(true);
    try {
      const text = await generateFengShuiInterpretation(
        GEMINI_API_KEY,
        result.formData.name,
        result.formData.birthYear,
        result.formData.birthMonth,
        result.formData.birthDay,
        result.sajuResult.elementCounts,
      );
      setFengShuiText(text);
      localStorage.setItem(fengShuiCacheKey(result.formData), text);
      return text;
    } catch (err: any) {
      showToast(`풍수 가이드 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setFengShuiLoading(false);
    }
  };

  // 풍수 가이드 심화해석(🔍 더보기) 생성
  const handleGenerateFengShuiDeep = async (): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setFengShuiDeepLoading(true);
    try {
      const text = await generateFengShuiDeepInterpretation(
        GEMINI_API_KEY,
        result.formData.name,
        result.formData.birthYear,
        result.formData.birthMonth,
        result.formData.birthDay,
        result.sajuResult,
      );
      setFengShuiDeepText(text);
      localStorage.setItem(fengShuiDeepCacheKey(result.formData), text);
      return text;
    } catch (err: any) {
      showToast(`풍수 심화해석 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setFengShuiDeepLoading(false);
    }
  };

  // 운세(현재 대운 + 최근 3개년 세운) 해설 AI 생성 (연도 기준 캐싱)
  const handleGenerateUnse = async (): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    const nowYear = new Date().getFullYear();
    const daeunIdx = result.sajuResult.daeunList.reduce(
      (acc, entry, idx) => (entry.age <= currentAge ? idx : acc), -1
    );
    const daeun = result.sajuResult.daeunList[daeunIdx] ?? result.sajuResult.daeunList[0];
    const seunEntries = result.sajuResult.seunList
      .filter(s => s.year >= nowYear - 1 && s.year <= nowYear + 1)
      .map(s => ({ year: s.year, ganji: `${s.stem}${s.branch}`, hanja: `${s.stemHanja}${s.branchHanja}`, isCurrent: s.year === nowYear }));

    setUnseLoading(true);
    try {
      const text = await generateFortuneInterpretation(
        GEMINI_API_KEY,
        result.formData.name,
        result.sajuResult.dayStem,
        daeun.age,
        `${daeun.stem}${daeun.branch}`,
        `${daeun.stemHanja}${daeun.branchHanja}`,
        seunEntries,
      );
      setUnseText(text);
      localStorage.setItem(unseCacheKey(result.formData, nowYear), text);
      return text;
    } catch (err: any) {
      showToast(`운세 해설 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setUnseLoading(false);
    }
  };

  // 운세 흐름 심화해석(🔍 더보기) 생성
  const handleGenerateUnseDeep = async (): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    const nowYear = new Date().getFullYear();
    const daeunIdx = result.sajuResult.daeunList.reduce(
      (acc, entry, idx) => (entry.age <= currentAge ? idx : acc), -1
    );
    const daeun = result.sajuResult.daeunList[daeunIdx] ?? result.sajuResult.daeunList[0];
    const seunEntries = result.sajuResult.seunList
      .filter(s => s.year >= nowYear - 1 && s.year <= nowYear + 1)
      .map(s => ({ year: s.year, ganji: `${s.stem}${s.branch}`, hanja: `${s.stemHanja}${s.branchHanja}`, isCurrent: s.year === nowYear }));

    setUnseDeepLoading(true);
    try {
      const text = await generateFortuneDeepInterpretation(
        GEMINI_API_KEY,
        result.formData.name,
        result.sajuResult.dayStem,
        daeun.age,
        `${daeun.stem}${daeun.branch}`,
        `${daeun.stemHanja}${daeun.branchHanja}`,
        seunEntries,
        result.sajuResult,
      );
      setUnseDeepText(text);
      localStorage.setItem(unseDeepCacheKey(result.formData, nowYear), text);
      return text;
    } catch (err: any) {
      showToast(`운세 심화해석 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setUnseDeepLoading(false);
    }
  };

  // 오행 종합 해설 AI 생성
  const handleGenerateElementSummary = async (): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setElementSummaryLoading(true);
    try {
      const text = await generateElementSummaryInterpretation(GEMINI_API_KEY, result.formData.name, result.sajuResult.elementCounts);
      setElementSummaryText(text);
      localStorage.setItem(elementSummaryCacheKey(result.formData), text);
      return text;
    } catch (err: any) {
      showToast(`오행 종합 해설 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setElementSummaryLoading(false);
    }
  };

  // 오행 종합 심화해석(🔍 더보기) 생성
  const handleGenerateElementSummaryDeep = async (): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setElementSummaryDeepLoading(true);
    try {
      const text = await generateElementSummaryDeepInterpretation(GEMINI_API_KEY, result.formData.name, result.sajuResult);
      setElementSummaryDeepText(text);
      localStorage.setItem(elementSummaryDeepCacheKey(result.formData), text);
      return text;
    } catch (err: any) {
      showToast(`오행 종합 심화해석 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setElementSummaryDeepLoading(false);
    }
  };

  // 궁합 종합 해설 AI 생성
  const handleGenerateCompatSummary = async (): Promise<string | null> => {
    if (!result || !dayBranchRelations) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setCompatSummaryLoading(true);
    try {
      const text = await generateCompatibilitySummaryInterpretation(GEMINI_API_KEY, result.formData.name, {
        dayBranchAnimal,
        dayBranchHanja: result.sajuResult.dayPillar.branchHanja,
        samhap: dayBranchRelations.samhapPartners.map(p => `${p.animal}띠`),
        yukhap: dayBranchRelations.yukhapPartner ? `${dayBranchRelations.yukhapPartner.animal}띠` : null,
        chung: dayBranchRelations.chungPartner ? `${dayBranchRelations.chungPartner.animal}띠` : null,
        hyeong: dayBranchRelations.hyeongPartners.map(p => `${p.animal}띠`),
        pa: dayBranchRelations.paPartner ? `${dayBranchRelations.paPartner.animal}띠` : null,
        hae: dayBranchRelations.haePartner ? `${dayBranchRelations.haePartner.animal}띠` : null,
      });
      setCompatSummaryText(text);
      localStorage.setItem(compatSummaryCacheKey(result.formData), text);
      return text;
    } catch (err: any) {
      showToast(`궁합 종합 해설 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setCompatSummaryLoading(false);
    }
  };

  // 궁합 종합 심화해석(🔍 더보기) 생성
  const handleGenerateCompatSummaryDeep = async (): Promise<string | null> => {
    if (!result || !dayBranchRelations) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setCompatSummaryDeepLoading(true);
    try {
      const text = await generateCompatibilitySummaryDeepInterpretation(GEMINI_API_KEY, result.formData.name, {
        dayBranchAnimal,
        dayBranchHanja: result.sajuResult.dayPillar.branchHanja,
        samhap: dayBranchRelations.samhapPartners.map(p => `${p.animal}띠`),
        yukhap: dayBranchRelations.yukhapPartner ? `${dayBranchRelations.yukhapPartner.animal}띠` : null,
        chung: dayBranchRelations.chungPartner ? `${dayBranchRelations.chungPartner.animal}띠` : null,
        hyeong: dayBranchRelations.hyeongPartners.map(p => `${p.animal}띠`),
        pa: dayBranchRelations.paPartner ? `${dayBranchRelations.paPartner.animal}띠` : null,
        hae: dayBranchRelations.haePartner ? `${dayBranchRelations.haePartner.animal}띠` : null,
      }, result.sajuResult);
      setCompatSummaryDeepText(text);
      localStorage.setItem(compatSummaryDeepCacheKey(result.formData), text);
      return text;
    } catch (err: any) {
      showToast(`궁합 종합 심화해석 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setCompatSummaryDeepLoading(false);
    }
  };

  // 🪐 별자리(서양점성술) AI 종합 해설 생성
  const handleGenerateAstrology = async (): Promise<AstrologyInterpretation | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setAstrologyLoading(true);
    try {
      const data = await generateAstrologyInterpretation(GEMINI_API_KEY, result.formData.name, result.formData.gender, result.astrologyResult);
      setAstrologyData(data);
      localStorage.setItem(astrologyCacheKey(result.formData, result.formData.birthCity), JSON.stringify(data));
      return data;
    } catch (err: any) {
      showToast(`별자리 해설 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setAstrologyLoading(false);
    }
  };

  // 🪐 별자리(서양점성술) 심화해석 생성
  const handleGenerateAstrologyDeep = async (): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setAstrologyDeepLoading(true);
    try {
      const text = await generateAstrologyDeepInterpretation(GEMINI_API_KEY, result.formData.name, result.formData.gender, result.astrologyResult);
      setAstrologyDeepText(text);
      localStorage.setItem(astrologyDeepCacheKey(result.formData, result.formData.birthCity), text);
      return text;
    } catch (err: any) {
      showToast(`별자리 심화해석 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setAstrologyDeepLoading(false);
    }
  };

  // 🔮 오늘의 트랜짓 운세 생성 — 오늘 실제 하늘의 행성 위치를 네이탈 차트와 비교
  const handleGenerateTransit = async (): Promise<DailyTransitFortune | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setTransitLoading(true);
    try {
      const transits = calculateTodayTransits(result.astrologyResult);
      const data = await generateTransitInterpretation(GEMINI_API_KEY, result.formData.name, result.formData.gender, result.astrologyResult, transits);
      setTransitData(data);
      const dateStr = todayDateStr();
      localStorage.setItem(transitCacheKey(result.formData, result.formData.birthCity, dateStr), JSON.stringify(data));
      return data;
    } catch (err: any) {
      showToast(`오늘의 트랜짓 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setTransitLoading(false);
    }
  };

  // 🃏 오늘의 타로 — 이름+생년월일+오늘 날짜로 결정론적 카드 뽑기(같은 날 다시 눌러도 같은 카드)
  const handleGenerateTarot = async (): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setTarotLoading(true);
    try {
      const dateStr = todayDateStr();
      const seed = `${result.formData.name}_${result.formData.birthYear}${result.formData.birthMonth}${result.formData.birthDay}_${dateStr}`;
      const { card, reversed } = drawDailyTarotCard(seed);
      const text = await generateTarotInterpretation(GEMINI_API_KEY, result.formData.name, result.formData.gender, result.formData.mbti, card, reversed);
      setTarotData(text);
      localStorage.setItem(tarotCacheKey(result.formData, dateStr), text);
      addBookmark('오늘의 타로', `${dateStr} 오늘의 타로 · ${card.name}(${reversed ? '역방향' : '정방향'})`, text);
      return text;
    } catch (err: any) {
      showToast(`오늘의 타로 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setTarotLoading(false);
    }
  };

  // 💑 정밀 궁합(실제 2인 비교) — 상대방 생년월일로 실제 사주를 산출해 비교
  const handleComparePair = async () => {
    if (!result) return;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    if (!partnerName.trim()) { showToast('상대방 이름을 입력해 주세요!'); return; }
    const py = parseInt(partnerBirthYear);
    const pm = parseInt(partnerBirthMonth);
    const pd = parseInt(partnerBirthDay);
    if (!py || !pm || !pd) { showToast('상대방 생년월일을 모두 입력해 주세요!'); return; }
    const parsedDate = new Date(py, pm - 1, pd);
    const isRealDate = parsedDate.getFullYear() === py && parsedDate.getMonth() === pm - 1 && parsedDate.getDate() === pd;
    if (!isRealDate) { showToast('상대방의 생년월일이 존재하지 않는 날짜예요. 다시 확인해 주세요!'); return; }

    setPairCompatLoading(true);
    try {
      const sajuB = calculateSaju(py, pm, pd, '오시', partnerGender, true);
      const compare = comparePillars(result.sajuResult, sajuB);
      setPairSajuB(sajuB);
      setPairCompare(compare);

      // 같은 상대와 이미 비교해본 적 있으면 캐시를 재사용(API 재호출 없이 바로 표시)
      const cacheKey = pairCompatCacheKey(result.formData, partnerName, partnerBirthYear, partnerBirthMonth, partnerBirthDay, partnerGender);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed?.text) {
            setPairCompatText(parsed.text);
            return;
          }
        } catch { /* 캐시 파싱 실패 시 새로 생성 */ }
      }

      const text = await generatePairCompatibilityInterpretation(
        GEMINI_API_KEY,
        result.formData.name, result.formData.gender, result.sajuResult,
        partnerName, partnerGender, sajuB,
        compare,
      );
      setPairCompatText(text);
      localStorage.setItem(
        pairCompatCacheKey(result.formData, partnerName, partnerBirthYear, partnerBirthMonth, partnerBirthDay, partnerGender),
        JSON.stringify({ text, sajuB, compare }),
      );
      addBookmark('정밀 궁합', `${result.formData.name}님 × ${partnerName}님 정밀 궁합`, text);
    } catch (err: any) {
      showToast(`정밀 궁합 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
    } finally {
      setPairCompatLoading(false);
    }
  };

  // 오늘의 나풀이(데일리 운세) 생성 — 일주와 오늘 일진의 관계를 바탕으로 한 짧은 오늘의 한마디 + 팩폭 한줄
  const handleGenerateDailyFortune = async (): Promise<DailyFortune | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setDailyFortuneLoading(true);
    try {
      const today = new Date();
      const todayPillar = calcDayPillar(today.getFullYear(), today.getMonth() + 1, today.getDate());
      const todayAnimal = EARTHLY_BRANCHES[todayPillar.branchIdx].animal;
      const data = await generateDailyFortune(
        GEMINI_API_KEY,
        result.formData.name,
        result.sajuResult.dayStem,
        result.sajuResult.dayStemElement,
        todayPillar.text,
        todayPillar.hanjaText,
        todayAnimal,
      );
      setDailyFortuneData(data);
      const dateStr = todayDateStr();
      localStorage.setItem(dailyFortuneCacheKey(result.formData, dateStr), JSON.stringify(data));
      addBookmark('오늘의 나풀이', `${dateStr} 오늘의 나풀이`, `${data.analysis}\n\n${data.factBomb}`);
      return data;
    } catch (err: any) {
      showToast(`오늘의 나풀이 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setDailyFortuneLoading(false);
    }
  };

  // 사주 4기둥 클릭 → AI 심층 해설 모달 열기
  const handlePillarClick = (key: PillarKey, label: string, pillar: Pillar, staticDesc?: string) => {
    setSelectedModal(null);
    setPillarModal({ key, label, hanjaText: pillar.hanjaText, koreanText: pillar.text, staticDesc });
  };

  const handleGeneratePillarAi = async (): Promise<string | null> => {
    if (!result || !pillarModal) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setPillarAiLoading(true);
    try {
      const text = await generatePillarInterpretation(
        GEMINI_API_KEY,
        result.formData.name,
        result.formData.mbti,
        pillarModal.label,
        pillarModal.koreanText,
        pillarModal.hanjaText,
        pillarModal.staticDesc || `${pillarModal.label}은 사주원국을 구성하는 중요한 기둥입니다.`,
      );
      setPillarAiData(prev => ({ ...prev, [pillarModal.key]: text }));
      localStorage.setItem(pillarCacheKey(result.formData, pillarModal.key), text);
      return text;
    } catch (err: any) {
      showToast(`기둥 해설 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setPillarAiLoading(false);
    }
  };

  // 카카오톡 결과 공유 기능
  const handleKakaoShare = async () => {
    const KAKAO_APP_KEY = import.meta.env.VITE_KAKAO_JS_KEY as string;

    if (!KAKAO_APP_KEY) {
      showToast('카카오 앱 키가 설정되어 있지 않습니다. VITE_KAKAO_JS_KEY 환경 변수를 확인해주세요.');
      return;
    }

    if (!result) {
      showToast('공유할 분석 결과가 없습니다.');
      return;
    }

    // 공유 카드의 팩폭 문구를 위해 성격 분석이 아직 없으면 먼저 생성
    let personality = categoryData.personality;
    if (!personality) {
      showToast('공유용 팩폭 문구를 생성하는 중...');
      personality = await handleGenerateCategory('personality') ?? undefined;
    }
    if (!personality) {
      showToast('공유용 팩폭 문구 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    // ── SDK 로드 대기 ────────────────────────────────
    let Kakao = (window as any).Kakao;

    if (!Kakao) {
      try {
        await new Promise<void>((resolve, reject) => {
          if ((window as any).Kakao) { resolve(); return; }

          const existing = document.querySelector<HTMLScriptElement>('script[src*="kakao_js_sdk"]');
          const target = existing ?? (() => {
            const s = document.createElement('script');
            s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
            s.async = true;
            document.head.appendChild(s);
            return s;
          })();

          target.addEventListener('load', () => resolve(), { once: true });
          target.addEventListener('error', () => reject(new Error('Kakao SDK load error')), { once: true });

          // 스크립트의 load/error 이벤트가 이미 지나가버린 뒤 뒤늦게 리스너를 붙인 경우를 대비한 폴링 백업
          const pollStart = Date.now();
          const poll = setInterval(() => {
            if ((window as any).Kakao) {
              clearInterval(poll);
              resolve();
            } else if (Date.now() - pollStart > 5000) {
              clearInterval(poll);
              reject(new Error('Kakao SDK 로드 타임아웃'));
            }
          }, 100);
        });
        Kakao = (window as any).Kakao;
      } catch (err) {
        console.error('Failed to load Kakao SDK dynamically:', err);
        showToast('카카오 SDK 로드 실패. 네트워크/광고 차단기를 확인해주세요.');
        return;
      }
    }

    if (!Kakao) {
      showToast('카카오톡 SDK 로드에 실패했습니다. 네트워크 환경 또는 광고 차단 프로그램을 확인해주세요.');
      return;
    }

    // ── 초기화 (중복 방지) ───────────────────────────
    if (!Kakao.isInitialized()) {
      try {
        Kakao.init(KAKAO_APP_KEY);
      } catch (err) {
        console.error('Kakao init error:', err);
        showToast('카카오 SDK 초기화에 실패했습니다. 앱 키를 확인해주세요.');
        return;
      }
    }

    // ── 공유 URL 결정 ─────────────────────────────────
    // localhost 환경에서는 카카오 공유가 동작하지 않습니다.
    // 카카오 개발자 콘솔에 등록된 배포 도메인 URL을 사용해야 합니다.
    const shareUrl = window.location.href.includes('localhost')
      ? 'https://mbti-delta-red.vercel.app/'
      : window.location.href;

    // ── 공유 실행 ────────────────────────────────────
    try {
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `🔮 나풀이 | ${result.formData.name}님의 ${result.formData.mbti} 사주 팩폭 결과`,
          description: personality.factBomb,
          imageUrl: new URL(heroImage, window.location.origin).href,
          link: {
            mobileWebUrl: shareUrl,
            webUrl: shareUrl,
          },
        },
        buttons: [
          {
            title: '나도 분석해보기 🔮',
            link: {
              mobileWebUrl: shareUrl,
              webUrl: shareUrl,
            },
          },
        ],
      });
    } catch (err: any) {
      console.error('Kakao Share error:', err);
      showToast(`카카오 공유 오류: ${err?.message ?? '알 수 없는 오류'}. 카카오 앱 도메인 등록을 확인해주세요.`);
    }
  };

  // 인스타 스토리용 세로형(9:16) 결과 이미지 카드 생성 + 다운로드/공유
  const handleDownloadImageCard = async () => {
    if (!result) return;

    let personality = categoryData.personality;
    if (!personality) {
      showToast('이미지 카드용 팩폭 문구를 생성하는 중...');
      personality = await handleGenerateCategory('personality') ?? undefined;
    }
    if (!personality) {
      showToast('이미지 카드 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    setImageCardGenerating(true);
    try {
      const W = 1080;
      const H = 1920;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('캔버스를 생성할 수 없습니다.');

      // 배경 그라데이션
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#1a0b2e');
      bgGrad.addColorStop(0.55, '#0f0620');
      bgGrad.addColorStop(1, '#050510');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // 별자리 장식 — 점들을 선으로 이어 별자리처럼 표현
      const constellationStars = [
        { x: W * 0.12, y: H * 0.05 }, { x: W * 0.22, y: H * 0.09 }, { x: W * 0.15, y: H * 0.14 },
        { x: W * 0.85, y: H * 0.06 }, { x: W * 0.93, y: H * 0.11 }, { x: W * 0.80, y: H * 0.15 },
        { x: W * 0.08, y: H * 0.62 }, { x: W * 0.14, y: H * 0.68 },
        { x: W * 0.90, y: H * 0.60 }, { x: W * 0.84, y: H * 0.66 },
      ];
      ctx.save();
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.4)';
      ctx.lineWidth = 1.2;
      const constellationLinks: [number, number][] = [[0, 1], [1, 2], [3, 4], [4, 5], [6, 7], [8, 9]];
      constellationLinks.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(constellationStars[a].x, constellationStars[a].y);
        ctx.lineTo(constellationStars[b].x, constellationStars[b].y);
        ctx.stroke();
      });
      constellationStars.forEach(s => {
        ctx.fillStyle = '#ffe577';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // 은은한 별 장식 (배경 전체 흩뿌림)
      ctx.save();
      for (let i = 0; i < 60; i++) {
        ctx.globalAlpha = Math.random() * 0.5 + 0.1;
        ctx.fillStyle = '#f5c842';
        ctx.beginPath();
        ctx.arc(Math.random() * W, Math.random() * H * 0.65, Math.random() * 2 + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.textAlign = 'center';
      const fontStack = '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

      // 상단 워터마크
      ctx.fillStyle = 'rgba(245, 200, 66, 0.85)';
      ctx.font = `600 32px ${fontStack}`;
      ctx.fillText('🔮 나풀이 · 사주 × MBTI 분석', W / 2, 170);

      // 이름 + MBTI
      ctx.fillStyle = '#f0eeff';
      ctx.font = `800 66px ${fontStack}`;
      ctx.fillText(`${result.formData.name} · ${result.formData.mbti}`, W / 2, 290);

      // MBTI 유형 이모지 원형 배지
      const badgeCx = W / 2;
      const badgeCy = 445;
      const badgeR = 92;
      const badgeGrad = ctx.createRadialGradient(badgeCx - 25, badgeCy - 30, 10, badgeCx, badgeCy, badgeR);
      badgeGrad.addColorStop(0, '#c9adff');
      badgeGrad.addColorStop(0.55, '#8b5cf6');
      badgeGrad.addColorStop(1, '#4c2889');
      ctx.save();
      ctx.shadowColor = 'rgba(139, 92, 246, 0.55)';
      ctx.shadowBlur = 40;
      ctx.fillStyle = badgeGrad;
      ctx.beginPath();
      ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.font = `400 88px ${fontStack}`;
      ctx.fillText(MBTI_DATA[result.formData.mbti]?.emoji ?? '✨', badgeCx, badgeCy + 32);

      // 일주(日柱) 한자 — 사주 정체성 대표 표기
      ctx.fillStyle = '#f5c842';
      ctx.font = `900 130px "Noto Serif KR", serif`;
      ctx.fillText(result.sajuResult.dayPillar.hanjaText, W / 2, 700);
      ctx.fillStyle = 'rgba(240, 238, 255, 0.6)';
      ctx.font = `400 28px ${fontStack}`;
      ctx.fillText(`일주(日柱) · ${result.sajuResult.dayPillar.text}`, W / 2, 745);

      // 팩폭 한줄평 — 은은한 테두리 카드 프레임 안에 배치
      ctx.font = `600 44px ${fontStack}`;
      const lines = wrapCanvasText(ctx, personality.factBomb, W - 200);
      const lineHeight = 62;
      const boxPaddingY = 56;
      const boxTop = 810;
      const boxHeight = lines.length * lineHeight + boxPaddingY * 2 - 16;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(245, 200, 66, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      (ctx as any).roundRect(80, boxTop, W - 160, boxHeight, 24);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#f0eeff';
      let y = boxTop + boxPaddingY + 32;
      lines.forEach(line => {
        ctx.fillText(line, W / 2, y);
        y += lineHeight;
      });

      // 하단 브랜딩
      ctx.fillStyle = 'rgba(240, 238, 255, 0.4)';
      ctx.font = `400 26px ${fontStack}`;
      ctx.fillText('mbti-delta-red.vercel.app', W / 2, H - 100);

      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('이미지 생성에 실패했습니다.');

      const fileName = `${result.formData.name}_사주카드.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: '나풀이 사주 × MBTI 카드' });
          return;
        } catch {
          // 공유 취소/실패 시 다운로드로 대체
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast(`이미지 카드 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
    } finally {
      setImageCardGenerating(false);
    }
  };

  // 보고서형 PDF 파일 다운로드 기능 (인쇄 친화적 팝업 출력 창)
  // PDF 저장은 "버튼 눌러야 생성" 원칙의 예외로, 아직 생성되지 않은 AI 콘텐츠를 전부 자동 생성한 뒤 포함합니다.
  const handleDownloadPDF = async () => {
    if (!result) return;
    setPdfGenerating(true);
    try {
      const categoriesForPdf: Partial<Record<AiCategoryKey, CategoryInterpretation>> = { ...categoryData };
      const categoriesDeepForPdf: Partial<Record<AiCategoryKey, string>> = { ...categoryDeepData };
      for (const cat of ['personality', 'career', 'romance', 'wealth'] as AiCategoryKey[]) {
        if (!categoriesForPdf[cat] && GEMINI_API_KEY) {
          categoriesForPdf[cat] = await handleGenerateCategory(cat, getAnsweredForCategory(cat)) ?? undefined;
        }
        if (!categoriesDeepForPdf[cat] && GEMINI_API_KEY) {
          categoriesDeepForPdf[cat] = await handleGenerateCategoryDeep(cat, getAnsweredForCategory(cat)) ?? undefined;
        }
      }
      const prescriptionsForPdf = prescriptionsData || (GEMINI_API_KEY ? await handleGeneratePrescriptions() : null);
      const elementSummaryForPdf = elementSummaryText || (GEMINI_API_KEY ? await handleGenerateElementSummary() : null);
      const compatSummaryForPdf = compatSummaryText || (GEMINI_API_KEY ? await handleGenerateCompatSummary() : null);
      const fengShuiForPdf = fengShuiText || (GEMINI_API_KEY ? await handleGenerateFengShui() : null);
      const unseForPdf = unseText || (GEMINI_API_KEY ? await handleGenerateUnse() : null);
      const elementSummaryDeepForPdf = elementSummaryDeepText || (GEMINI_API_KEY ? await handleGenerateElementSummaryDeep() : null);
      const compatSummaryDeepForPdf = compatSummaryDeepText || (GEMINI_API_KEY ? await handleGenerateCompatSummaryDeep() : null);
      const fengShuiDeepForPdf = fengShuiDeepText || (GEMINI_API_KEY ? await handleGenerateFengShuiDeep() : null);
      const unseDeepForPdf = unseDeepText || (GEMINI_API_KEY ? await handleGenerateUnseDeep() : null);
      const astrologyForPdf = astrologyData || (GEMINI_API_KEY ? await handleGenerateAstrology() : null);
      const astrologyDeepForPdf = astrologyDeepText || (GEMINI_API_KEY ? await handleGenerateAstrologyDeep() : null);

      // 사주 4기둥 AI 심층 해설도 자동 생성
      const pillarDefs: { key: PillarKey; label: string; pillar: Pillar; staticDesc: string }[] = [
        { key: 'year', label: '연주 (年柱)', pillar: result.sajuResult.yearPillar, staticDesc: '연주는 조상과 초년운을 상징하는 기둥입니다.' },
        { key: 'month', label: '월주 (月柱)', pillar: result.sajuResult.monthPillar, staticDesc: '월주는 부모와 청년운을 상징하는 기둥입니다.' },
        { key: 'day', label: '일주 (日柱)', pillar: result.sajuResult.dayPillar, staticDesc: '일주는 본인의 본질과 배우자운을 상징하는 기둥입니다.' },
        ...(result.sajuResult.hourPillar
          ? [{ key: 'hour' as PillarKey, label: '시주 (時柱)', pillar: result.sajuResult.hourPillar, staticDesc: result.hourBranch.desc }]
          : []),
      ];
      const pillarAiForPdf: Partial<Record<PillarKey, string>> = { ...pillarAiData };
      if (GEMINI_API_KEY) {
        for (const def of pillarDefs) {
          if (!pillarAiForPdf[def.key]) {
            try {
              const text = await generatePillarInterpretation(
                GEMINI_API_KEY, result.formData.name, result.formData.mbti,
                def.label, def.pillar.text, def.pillar.hanjaText, def.staticDesc,
              );
              pillarAiForPdf[def.key] = text;
              setPillarAiData(prev => ({ ...prev, [def.key]: text }));
              localStorage.setItem(pillarCacheKey(result.formData, def.key), text);
            } catch {
              // 개별 기둥 해설 실패는 무시하고 나머지 리포트는 계속 진행
            }
          }
        }
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showToast('팝업 차단이 설정되어 있습니다. 팝업을 허용해 주세요.');
        return;
      }

      const saju = result.sajuResult;
      const intro = result.aiIntro;

      let aiContentHtml = '';
      if (intro) {
        const categoryBlocks: { icon: string; title: string; data?: CategoryInterpretation; deepData?: string }[] = [
          { icon: '🌟', title: '성격 진단', data: categoriesForPdf.personality, deepData: categoriesDeepForPdf.personality },
          { icon: '💼', title: '커리어 & 재물', data: categoriesForPdf.career, deepData: categoriesDeepForPdf.career },
          { icon: '💖', title: '연애 & 인간관계', data: categoriesForPdf.romance, deepData: categoriesDeepForPdf.romance },
          { icon: '💰', title: '재물 & 지출', data: categoriesForPdf.wealth, deepData: categoriesDeepForPdf.wealth },
        ];
        aiContentHtml = `
          <div class="report-section">
            <h2>🔮 나풀이 융합 분석: ${escapeHtml(intro.title)}</h2>
            <p class="lead-note"><em>${escapeHtml(intro.jungianNote)}</em></p>

            <div class="report-block">
              <h3>🧭 쉬운 사주원국 해설</h3>
              <p>${escapeHtml(intro.sajuExplanation)}</p>
            </div>

            ${categoryBlocks.map(b => b.data ? `
              <div class="report-block">
                <h3>${b.icon} ${b.title}</h3>
                <p>${escapeHtml(b.data.analysis)}</p>
                <p class="fact-bomb"><strong>🔥 뼈 때리는 팩폭:</strong> ${escapeHtml(b.data.factBomb)}</p>
                <p class="lucky-item"><strong>🍀 럭키/상극:</strong> ${escapeHtml(b.data.luckyItem)}</p>
                ${b.deepData ? `<h3>🔍 심화해석</h3><p>${escapeHtmlBreaks(b.deepData)}</p>` : ''}
              </div>
            ` : '').join('')}

            ${prescriptionsForPdf ? `
              <div class="report-block">
                <h3>🎯 3대 실천 처방전</h3>
                <ul>
                  ${prescriptionsForPdf.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `;
      }

      let mbtiCardHtml = '';
      if (mbtiInfo) {
        mbtiCardHtml = `
          <div class="report-section">
            <h2>🧠 MBTI 유형카드</h2>
            <div class="report-block">
              <h3>${mbtiInfo.emoji} ${escapeHtml(result.formData.mbti)} · ${mbtiInfo.nickname}</h3>
              <p>${escapeHtml(mbtiInfo.coreTrait)}</p>
              <p class="lucky-item">⭐ 일간(${saju.dayStem}) 기운과 만나면 ${ELEMENT_LABELS[saju.dayStemElement].ko}의 기질이 더해져 ${mbtiInfo.nickname} 특유의 성향이 한층 더 입체적으로 발현됩니다.</p>
            </div>
          </div>
        `;
      }

      const daeunListStr = saju.daeunList
        .map((d, idx) => `${d.stemHanja}${d.branchHanja}(${d.stem}${d.branch}) ${d.age}세~${idx === currentDaeunIdx ? ' [현재]' : ''}`)
        .join(' · ');
      const seunListStr = saju.seunList
        .map(s => `${s.year}년 ${s.stemHanja}${s.branchHanja}(${s.stem}${s.branch})${s.year === currentYear ? ' [올해]' : ''}`)
        .join(' · ');

      const fortuneHtml = `
        <div class="report-section">
          <h2>🌌 대운(大運) · 세운(歲運) 흐름표</h2>
          <div class="report-block">
            <h3>대운 (${saju.daeunStartAge}세부터 10년 주기)</h3>
            <p>${daeunListStr}</p>
          </div>
          <div class="report-block">
            <h3>세운 (${currentYear - 5}년 ~ ${currentYear + 5}년)</h3>
            <p>${seunListStr}</p>
          </div>
        </div>
      `;

      let compatHtml = '';
      if (dayBranchRelations) {
        const tagStr = (items: { animal: string; hanja: string }[]) =>
          items.length > 0 ? items.map(p => `${p.animal}띠(${p.hanja})`).join(', ') : '해당 없음';
        compatHtml = `
          <div class="report-section">
            <h2>💑 궁합 조합표 (일지 기준)</h2>
            <div class="report-block">
              <p>당신의 일지(日支)는 ${saju.dayPillar.branchHanja}(${saju.dayPillar.branch}·${dayBranchAnimal}띠)입니다.</p>
              <p>💞 삼합(베스트 궁합)${dayBranchRelations.samhapElement ? ` · ${dayBranchRelations.samhapElement}국` : ''}: ${tagStr(dayBranchRelations.samhapPartners)}</p>
              <p>🤝 육합(찰떡 궁합): ${dayBranchRelations.yukhapPartner ? `${dayBranchRelations.yukhapPartner.animal}띠(${dayBranchRelations.yukhapPartner.hanja})` : '해당 없음'}</p>
              <p>⚡ 충(갈등 주의): ${dayBranchRelations.chungPartner ? `${dayBranchRelations.chungPartner.animal}띠(${dayBranchRelations.chungPartner.hanja})` : '해당 없음'}</p>
              <p>⚠️ 형(스트레스 주의): ${tagStr(dayBranchRelations.hyeongPartners)}</p>
              <p>💔 파(틀어짐 주의): ${dayBranchRelations.paPartner ? `${dayBranchRelations.paPartner.animal}띠(${dayBranchRelations.paPartner.hanja})` : '해당 없음'}</p>
              <p>🥀 해(은근한 마찰): ${dayBranchRelations.haePartner ? `${dayBranchRelations.haePartner.animal}띠(${dayBranchRelations.haePartner.hanja})` : '해당 없음'}</p>
            </div>
            ${compatSummaryForPdf ? `<div class="report-block"><h3>💬 궁합 종합 해설</h3><p>${escapeHtmlBreaks(compatSummaryForPdf)}</p></div>` : ''}
            ${compatSummaryDeepForPdf ? `<div class="report-block"><h3>🔍 궁합 종합 심화해설</h3><p>${escapeHtmlBreaks(compatSummaryDeepForPdf)}</p></div>` : ''}
          </div>
        `;
      }

      const elementSummaryHtml = elementSummaryForPdf
        ? `
          <div class="report-section">
            <h2>🌿 오행 종합 해설</h2>
            <div class="report-block"><p>${escapeHtmlBreaks(elementSummaryForPdf)}</p></div>
            ${elementSummaryDeepForPdf ? `<div class="report-block"><h3>🔍 심화해설</h3><p>${escapeHtmlBreaks(elementSummaryDeepForPdf)}</p></div>` : ''}
          </div>
        `
        : '';

      const pillarHtml = Object.keys(pillarAiForPdf).length > 0
        ? `
          <div class="report-section">
            <h2>🧭 사주 4기둥 나풀이 심층 해설</h2>
            ${pillarDefs.map(def => pillarAiForPdf[def.key] ? `
              <div class="report-block">
                <h3>${def.label} · ${def.pillar.hanjaText}(${def.pillar.text})</h3>
                <p>${escapeHtmlBreaks(pillarAiForPdf[def.key]!)}</p>
              </div>
            ` : '').join('')}
          </div>
        `
        : '';

      const unseHtml = unseForPdf
        ? `
          <div class="report-section">
            <h2>🔮 나풀이 운세 해설</h2>
            <div class="report-block"><p>${escapeHtmlBreaks(unseForPdf)}</p></div>
            ${unseDeepForPdf ? `<div class="report-block"><h3>🔍 심화해설</h3><p>${escapeHtmlBreaks(unseDeepForPdf)}</p></div>` : ''}
          </div>
        `
        : '';

      const fengShuiHtml = fengShuiForPdf
        ? `
          <div class="report-section">
            <h2>🏡 풍수 수리 가이드</h2>
            <div class="report-block"><p>${escapeHtmlBreaks(fengShuiForPdf)}</p></div>
            ${fengShuiDeepForPdf ? `<div class="report-block"><h3>🔍 심화해설</h3><p>${escapeHtmlBreaks(fengShuiDeepForPdf)}</p></div>` : ''}
          </div>
        `
        : '';

      const astro = result.astrologyResult;
      const ascSign = ZODIAC_SIGNS[astro.ascendantSignIndex];
      const planetRows = astro.planets.map(p => {
        const info = PLANETS.find(x => x.key === p.key)!;
        const sign = ZODIAC_SIGNS[p.signIndex];
        return `<li>${info.emoji} ${info.name}: ${sign.name} ${p.signDegree.toFixed(1)}° · ${p.houseIndex + 1}하우스${p.dignity ? ` · ${DIGNITY_LABEL[p.dignity]}` : ''}</li>`;
      }).join('');
      const houseRows = astro.houseSignIndexes.map((signIdx, i) => `<li>${i + 1}H(${HOUSES[i].meaning}): ${ZODIAC_SIGNS[signIdx].name}</li>`).join('');
      const aspectRows = astro.aspects.length > 0
        ? astro.aspects.map(a => {
          const infoA = PLANETS.find(x => x.key === a.a)!;
          const infoB = PLANETS.find(x => x.key === a.b)!;
          return `<li>${infoA.name} — ${infoB.name}: ${a.type} (${a.nature}, 오차 ${a.orb.toFixed(1)}°)</li>`;
        }).join('')
        : '<li>해당 없음</li>';

      const astrologyHtml = `
        <div class="report-section">
          <h2>🪐 서양 고전점성술 (홀사인)</h2>
          <div class="report-block">
            <h3>어센던트(상승궁): ${ascSign.name} ${astro.ascendantDegree.toFixed(1)}°</h3>
            <p>${astro.isDayChart ? '☀️ 주간 출생 — 목성이 더 길하고, 토성의 흉함이 덜해요.' : '🌙 야간 출생 — 금성이 더 길하고, 화성의 흉함이 더해요.'}</p>
          </div>
          <div class="report-block">
            <h3>7행성 배치</h3>
            <ul>${planetRows}</ul>
          </div>
          <div class="report-block">
            <h3>12하우스 배치 (홀사인)</h3>
            <ul>${houseRows}</ul>
          </div>
          <div class="report-block">
            <h3>주요 애스펙트</h3>
            <ul>${aspectRows}</ul>
          </div>
          ${astrologyForPdf ? `
            <div class="report-block">
              <h3>🔮 나풀이 별자리 종합 해설</h3>
              <p>${escapeHtml(astrologyForPdf.analysis)}</p>
              <p class="fact-bomb"><strong>🔥 뼈 때리는 팩폭:</strong> ${escapeHtml(astrologyForPdf.factBomb)}</p>
              <p class="lucky-item"><strong>🍀 럭키/상극:</strong> ${escapeHtml(astrologyForPdf.luckyItem)}</p>
            </div>
          ` : ''}
          ${astrologyDeepForPdf ? `<div class="report-block"><h3>🔍 심화해설</h3><p>${escapeHtmlBreaks(astrologyDeepForPdf)}</p></div>` : ''}
        </div>
      `;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>나풀이 | ${escapeHtml(result.formData.name)}님의 사주 MBTI 분석 보고서</title>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
              color: #333;
              line-height: 1.6;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              text-align: center;
              font-size: 24px;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
              margin-bottom: 30px;
            }
            .meta-table, .saju-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .meta-table th, .meta-table td, .saju-table th, .saju-table td {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: center;
            }
            .meta-table th, .saju-table th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            .saju-pillar {
              font-weight: bold;
              font-size: 18px;
              color: #000;
            }
            .report-section {
              margin-top: 30px;
            }
            .report-block {
              margin-bottom: 25px;
              padding-bottom: 15px;
              border-bottom: 1px dashed #ddd;
            }
            .report-block h3 {
              font-size: 16px;
              color: #111;
              margin-bottom: 10px;
              border-left: 4px solid #4f46e5;
              padding-left: 10px;
            }
            .fact-bomb {
              background-color: #fffbeb;
              border: 1px solid #fef3c7;
              padding: 10px;
              border-radius: 6px;
              color: #b45309;
              font-size: 13px;
            }
            .lucky-item {
              color: #059669;
              font-size: 13px;
              margin-top: 5px;
            }
            .lead-note {
              color: #666;
              font-size: 14px;
              margin-bottom: 20px;
              background: #f9fafb;
              padding: 10px;
              border-radius: 6px;
            }
            ul {
              padding-left: 20px;
            }
            li {
              margin-bottom: 8px;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>🔮 나풀이 · 사주 × MBTI 종합 보고서</h1>

          <table class="meta-table">
            <tr>
              <th>이름</th>
              <td>${escapeHtml(result.formData.name)}</td>
              <th>성별</th>
              <td>${result.formData.gender === 'male' ? '남성' : '여성'}</td>
              <th>MBTI</th>
              <td>${escapeHtml(result.formData.mbti)}</td>
            </tr>
            <tr>
              <th>생년월일</th>
              <td colspan="2">${escapeHtml(result.formData.birthYear)}년 ${escapeHtml(result.formData.birthMonth)}월 ${escapeHtml(result.formData.birthDay)}일</td>
              <th>태어난 시간</th>
              <td colspan="2">${saju.hourPillar ? `${result.hourBranch.name} (${result.hourBranch.time})` : '모름'}</td>
            </tr>
          </table>

          <h2>🧭 사주원국 명식</h2>
          <table class="saju-table">
            <tr>
              <th>구분</th>
              ${saju.hourPillar ? '<th>시주 (時柱)</th>' : ''}
              <th>일주 (日柱)</th>
              <th>월주 (月柱)</th>
              <th>연주 (年柱)</th>
            </tr>
            <tr class="saju-pillar">
              <td>천간 (天干)</td>
              ${saju.hourPillar ? `<td>${saju.hourPillar.hanjaText[0]}</td>` : ''}
              <td>${saju.dayPillar.hanjaText[0]}</td>
              <td>${saju.monthPillar.hanjaText[0]}</td>
              <td>${saju.yearPillar.hanjaText[0]}</td>
            </tr>
            <tr class="saju-pillar">
              <td>지지 (地支)</td>
              ${saju.hourPillar ? `<td>${saju.hourPillar.hanjaText[1]}</td>` : ''}
              <td>${saju.dayPillar.hanjaText[1]}</td>
              <td>${saju.monthPillar.hanjaText[1]}</td>
              <td>${saju.yearPillar.hanjaText[1]}</td>
            </tr>
            <tr>
              <td>한글</td>
              ${saju.hourPillar ? `<td>${saju.hourPillar.text}</td>` : ''}
              <td>${saju.dayPillar.text}</td>
              <td>${saju.monthPillar.text}</td>
              <td>${saju.yearPillar.text}</td>
            </tr>
          </table>

          <h2>🌿 오행 분포</h2>
          <table class="meta-table">
            <tr>
              <th>목(木)</th>
              <th>화(火)</th>
              <th>토(土)</th>
              <th>금(金)</th>
              <th>수(水)</th>
            </tr>
            <tr>
              <td>${saju.elementCounts.wood}개</td>
              <td>${saju.elementCounts.fire}개</td>
              <td>${saju.elementCounts.earth}개</td>
              <td>${saju.elementCounts.metal}개</td>
              <td>${saju.elementCounts.water}개</td>
            </tr>
          </table>

          ${mbtiCardHtml}
          ${elementSummaryHtml}
          ${fortuneHtml}
          ${compatHtml}
          ${aiContentHtml}
          ${pillarHtml}
          ${unseHtml}
          ${fengShuiHtml}
          ${astrologyHtml}

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } catch (err: any) {
      showToast(`PDF 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
    } finally {
      setPdfGenerating(false);
    }
  };

  // 나풀이 다이어리 (구 보관함) — 문구 저장 시 그 순간의 입력값(snapshot)도 함께 저장해
  // 나중에 다이어리에서 그 사람의 전체 결과 화면으로 되돌아갈 수 있도록 함
  const addBookmark = useCallback((category: string, title: string, content: string) => {
    const bm: Bookmark = {
      id: Date.now() * 1000 + Math.floor(Math.random() * 1000), category, title, content,
      date: new Date().toLocaleDateString('ko-KR'),
      snapshot: result ? { ...result.formData } : undefined,
    };
    const updated = [bm, ...bookmarks];
    setBookmarks(updated);
    localStorage.setItem('saju_bookmarks', JSON.stringify(updated));
    if (currentUser) {
      const uid = currentUser.uid;
      loadCloudSync().then(mod => mod.pushBookmarksToCloud(uid, updated)).catch(err => console.warn('클라우드 저장 실패:', err));
    }
    showToast(`"${title.slice(0, 15)}..." 다이어리에 저장됨 📌`);
  }, [bookmarks, result, currentUser]);

  const removeBookmark = useCallback((id: number) => {
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    localStorage.setItem('saju_bookmarks', JSON.stringify(updated));
    if (currentUser) {
      const uid = currentUser.uid;
      loadCloudSync().then(mod => mod.pushBookmarksToCloud(uid, updated)).catch(err => console.warn('클라우드 저장 실패:', err));
    }
  }, [bookmarks, currentUser]);

  // 다이어리 항목의 snapshot으로 그 사람의 전체 결과 화면으로 되돌아가기
  // (일반 제출과 동일한 로딩 경로를 그대로 재사용 — 캐시된 AI 콘텐츠는 로딩 useEffect가 자동으로 복원함)
  const handleLoadDiarySnapshot = (bm: Bookmark) => {
    if (!bm.snapshot) return;
    setFormData(bm.snapshot);
    setDiaryDetail(null);
    setStep('loading');
    setLoadingIdx(0);
    setIntroError(null);
  };

  // 내 기록 내보내기 — localStorage의 saju_ 접두어 데이터를 전부 JSON 파일로 다운로드
  const handleExportDiary = () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('saju_')) {
        data[key] = localStorage.getItem(key) ?? '';
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `나풀이_기록_${todayDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('내 기록을 파일로 내보냈어요 📁');
  };

  // 내 기록 불러오기 — 내보낸 JSON 파일을 다시 localStorage에 씀 (다른 기기 간 수동 이전용)
  const handleImportDiary = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) throw new Error('올바른 나풀이 기록 파일이 아니에요.');
      let count = 0;
      for (const [key, value] of Object.entries(parsed)) {
        if (key.startsWith('saju_') && typeof value === 'string') {
          localStorage.setItem(key, value);
          count++;
        }
      }
      const savedBm = localStorage.getItem('saju_bookmarks');
      if (savedBm) { try { setBookmarks(JSON.parse(savedBm)); } catch {} }
      showToast(`${count}개 항목을 불러왔어요 📥`);
    } catch (err: any) {
      showToast(`불러오기 실패: ${err?.message ?? '파일을 확인해 주세요.'}`);
    }
  };

  // 폼 변경
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // 제출
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { showToast('이름을 입력해 주세요!'); return; }

    // 연/월/일 각 필드는 브라우저 min/max로 개별 범위는 걸러지지만, "2월 30일" 같은 교차 필드 impossible date는
    // 걸러지지 않아 new Date()가 조용히 다른 날짜로 롤오버시킴 — 여기서 실제 존재하는 날짜인지 재확인.
    const year = parseInt(formData.birthYear);
    const month = parseInt(formData.birthMonth);
    const day = parseInt(formData.birthDay);
    if (!year || !month || !day) {
      showToast('생년월일을 모두 입력해 주세요!');
      return;
    }
    const parsedDate = new Date(year, month - 1, day);
    const isRealDate = parsedDate.getFullYear() === year && parsedDate.getMonth() === month - 1 && parsedDate.getDate() === day;
    if (!isRealDate) {
      showToast('존재하지 않는 날짜예요. 생년월일을 다시 확인해 주세요!');
      return;
    }

    // 정확한 시:분 입력을 쓰는 경우, 범위 검증 + 대응하는 12시진 id를 미리 구해서
    // 기존 캐시 키/표시 로직(birthBranch 기반)과의 호환을 맞춰둔다.
    if (formData.useExactTime && !formData.hourUnknown) {
      const exactHourNum = parseInt(formData.exactHour);
      const exactMinuteNum = formData.exactMinute === '' ? 0 : parseInt(formData.exactMinute);
      if (Number.isNaN(exactHourNum) || exactHourNum < 0 || exactHourNum > 23 || Number.isNaN(exactMinuteNum) || exactMinuteNum < 0 || exactMinuteNum > 59) {
        showToast('정확한 출생 시각을 시 0~23, 분 0~59 범위로 입력해 주세요!');
        return;
      }
      setFormData(prev => ({ ...prev, birthBranch: hourBranchIdFromExactTime(exactHourNum) }));
    }

    setStep('loading');
    setLoadingIdx(0);
    setIntroError(null);
  };

  // 로딩 → 계산 및 AI 요청 (타이틀 + 쉬운 사주풀이만 자동 생성)
  useEffect(() => {
    if (step !== 'loading') return;

    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx++;
      if (msgIdx < LOADING_MESSAGES.length) setLoadingIdx(msgIdx);
    }, 900);

    const run = async () => {
      const year = parseInt(formData.birthYear) || 1995;
      const month = parseInt(formData.birthMonth) || 9;
      const day = parseInt(formData.birthDay) || 27;
      const hourBranch = HOUR_BRANCHES.find(h => h.id === formData.birthBranch) ?? HOUR_BRANCHES.find(h => h.id === '오시')!;

      // 사주 계산 (잘못된 날짜 입력 시 예외가 발생할 수 있어 방어)
      let sajuResult: SajuResult;
      let astrologyResult: AstrologyResult;
      let astrologyTimeConfidence: 'exact' | 'approximate' | 'unknown';
      try {
        const exactHourNum = formData.useExactTime && !formData.hourUnknown ? parseInt(formData.exactHour) : -1;
        const exactMinuteNum = formData.useExactTime && !formData.hourUnknown ? (parseInt(formData.exactMinute) || 0) : 0;
        sajuResult = calculateSaju(year, month, day, formData.birthBranch, formData.gender, formData.hourUnknown, exactHourNum, exactMinuteNum);

        // 서양점성술은 12시진 근사와 무관하게 실제 시:분이 필요 — 정확도에 따라 timeConfidence로 구분해 UI에 안내
        let astroHour: number;
        let astroMinute: number;
        if (formData.hourUnknown) {
          astroHour = 12; astroMinute = 0; astrologyTimeConfidence = 'unknown';
        } else if (formData.useExactTime) {
          astroHour = exactHourNum; astroMinute = exactMinuteNum; astrologyTimeConfidence = 'exact';
        } else {
          const isYajasi = hourBranch.id === '야자시';
          astroHour = isYajasi ? 23 : (hourBranch.branchIdx === 0 ? 0 : hourBranch.branchIdx * 2 - 1);
          astroMinute = 0;
          astrologyTimeConfidence = 'approximate';
        }
        const city = KOREAN_CITIES.find(c => c.name === formData.birthCity) ?? KOREAN_CITIES[0];
        astrologyResult = calculateAstrology(year, month, day, astroHour, astroMinute, city.lat, city.lon, astrologyTimeConfidence);
      } catch (err) {
        clearInterval(msgInterval);
        showToast('생년월일 입력값이 올바르지 않습니다. 날짜를 다시 확인해 주세요.');
        setStep('input');
        return;
      }

      let aiIntro: SajuIntro | null = null;
      let errMsg: string | null = null;

      // Gemini AI 첫인상(타이틀+사주풀이) — 이름+생년월일+시간+MBTI 기준으로 캐싱해,
      // 다이어리에서 같은 사람을 다시 볼 때마다 새로 생성하지 않도록 함
      const introCacheKey = aiIntroCacheKey(formData, formData.mbti);
      const cachedIntro = localStorage.getItem(introCacheKey);
      if (cachedIntro) {
        try { aiIntro = JSON.parse(cachedIntro); } catch { aiIntro = null; }
      }

      if (!aiIntro && GEMINI_API_KEY) {
        try {
          aiIntro = await generateSajuIntro(
            GEMINI_API_KEY,
            formData.name,
            formData.gender,
            formData.mbti,
            sajuResult,
            formData.birthYear,
            formData.birthMonth,
            formData.birthDay,
            formData.hourUnknown ? '시간 모름' : hourBranch.name,
          );
          localStorage.setItem(introCacheKey, JSON.stringify(aiIntro));
        } catch (err: any) {
          errMsg = err?.message ?? '나풀이 해석 오류가 발생했습니다.';
        }
      }

      clearInterval(msgInterval);
      setResult({ formData: { ...formData }, sajuResult, hourBranch, aiIntro, astrologyResult, astrologyTimeConfidence });
      setIntroError(errMsg);
      setStep('result');
    };

    // 최소 1.5초 로딩 후 실행
    const timer = setTimeout(run, 1500);
    return () => { clearInterval(msgInterval); clearTimeout(timer); };
    // formData는 로딩 중 변경되지 않지만(제출 시점에 고정), 이 effect가 실제로 읽는 값이라
    // 의존성 배열에 명시 — 로딩 중 재실행은 없음(참조가 바뀌지 않으므로).
  }, [step, formData]);

  const handleReset = () => {
    setStep('input');
    setResult(null);
    setIntroError(null);
    setActiveSection('saju');
    setActiveSajuTab('fortune');
    setActiveTab('personality');
    setCategoryAnswers({});
  };

  // MBTI 유형카드 / 궁합 조합표 / 대운·세운 표에 쓰이는 파생 데이터
  const mbtiInfo = result ? MBTI_DATA[result.formData.mbti] : null;
  const dayBranchRelations = result ? getBranchRelations(result.sajuResult.dayPillar.branchIdx) : null;
  const dayBranchAnimal = result ? EARTHLY_BRANCHES[result.sajuResult.dayPillar.branchIdx].animal : '';
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentAge = (() => {
    if (!result) return 0;
    const birthYearNum = parseInt(result.formData.birthYear);
    const birthMonthNum = parseInt(result.formData.birthMonth);
    const birthDayNum = parseInt(result.formData.birthDay);
    let age = currentYear - birthYearNum;
    const hasHadBirthdayThisYear =
      today.getMonth() + 1 > birthMonthNum ||
      (today.getMonth() + 1 === birthMonthNum && today.getDate() >= birthDayNum);
    if (!hasHadBirthdayThisYear) age -= 1;
    return age;
  })();
  const currentDaeunIdx = result
    ? result.sajuResult.daeunList.reduce((acc, entry, idx) => (entry.age <= currentAge ? idx : acc), -1)
    : -1;

  // 오행 강함/부족 판정 (개인 맞춤 해설용)
  const elementEntries = result ? Object.entries(result.sajuResult.elementCounts) : [];
  const elementMaxCount = elementEntries.length ? Math.max(...elementEntries.map(([, c]) => c)) : 0;
  const dominantElements = elementMaxCount > 0 ? elementEntries.filter(([, c]) => c === elementMaxCount).map(([el]) => el) : [];
  const deficientElements = elementEntries.filter(([, c]) => c === 0).map(([el]) => el);

  // ── 렌더 ─────────────────────────────────────────
  return (
    <div className="app-wrapper">
      {/* 배경 */}
      <div className="stars-bg" />
      <div className="nebula-glow nebula-1" />
      <div className="nebula-glow nebula-2" />
      <div className="nebula-glow nebula-3" />

      {/* 헤더 */}
      <header className="header">
        <div className="header-inner">
          <div className="header-logo" onClick={handleReset}>
            <div className="logo-icon">
              <NapuliMark size={26} />
            </div>
            <span className="logo-text">나풀이</span>
            <span className="logo-badge">사주 × MBTI 정밀 만세력 엔진</span>
          </div>
          <div className="header-actions">
            <button className="btn-bookmark-header" onClick={() => setStep('bookmarks')}>
              📔 다이어리 ({bookmarks.length})
            </button>
            {step === 'result' && (
              <button className="btn-reset" onClick={handleReset}>↺ 다시 하기</button>
            )}
          </div>
        </div>
      </header>

      {/* 토스트 */}
      {toastMsg && <div className="toast" role="status" aria-live="polite">✨ {toastMsg}</div>}

      {/* 모달 (시주 정적 정보 등 범용) */}
      {selectedModal && (
        <div className="modal-overlay" onClick={() => setSelectedModal(null)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-label={selectedModal.title} onClick={e => e.stopPropagation()}>
            <button className="modal-close" aria-label="닫기" onClick={() => setSelectedModal(null)}>✕</button>
            <div style={{ marginBottom: 20 }}>
              <div className="section-label">상세 해석</div>
              <div className="section-title">{selectedModal.title}</div>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 16 }}>
              {selectedModal.content}
            </div>
            {selectedModal.extra && (
              <div style={{
                background: 'rgba(245, 200, 66, 0.06)',
                border: '1px solid rgba(245, 200, 66, 0.15)',
                borderRadius: 12,
                padding: '14px 16px',
                fontSize: 13,
                color: 'var(--gold)',
                lineHeight: 1.7,
                marginBottom: 20,
              }}>
                ⚡ {selectedModal.extra}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn-gold"
                style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                onClick={() => {
                  addBookmark('저장된 해석', selectedModal.title, selectedModal.content);
                  setSelectedModal(null);
                }}
              >
                🔖 다이어리에 저장
              </button>
              <button className="btn-secondary" onClick={() => setSelectedModal(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 (사주 4기둥 AI 심층 해설) */}
      {pillarModal && (
        <div className="modal-overlay" onClick={() => setPillarModal(null)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-label={pillarModal.label} onClick={e => e.stopPropagation()}>
            <button className="modal-close" aria-label="닫기" onClick={() => setPillarModal(null)}>✕</button>
            <div style={{ marginBottom: 20 }}>
              <div className="section-label">{pillarModal.label}</div>
              <div className="section-title">{pillarModal.hanjaText} ({pillarModal.koreanText})</div>
            </div>
            {pillarModal.staticDesc && (
              <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 16 }}>
                {pillarModal.staticDesc}
              </div>
            )}
            {pillarAiData[pillarModal.key] ? (
              <>
                <div className="deep-analysis-text" style={{ marginBottom: 16 }}>
                  {pillarAiData[pillarModal.key]}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn-gold"
                    style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                    onClick={() => {
                      addBookmark('사주 기둥 해설', pillarModal.label, pillarAiData[pillarModal.key]!);
                      setPillarModal(null);
                    }}
                  >
                    🔖 다이어리에 저장
                  </button>
                  <button className="btn-secondary" onClick={() => setPillarModal(null)}>닫기</button>
                </div>
              </>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
                  이 기둥이 당신과 MBTI에 어떤 의미인지 나풀이가 심층 해설해드려요.
                </p>
                <button
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleGeneratePillarAi}
                  disabled={pillarAiLoading}
                >
                  {pillarAiLoading ? <span>✨ 생성 중...</span> : <span>🔮 나풀이 심층 해설 생성하기</span>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 모달 (나풀이 다이어리 상세보기) */}
      {diaryDetail && (
        <div className="modal-overlay" onClick={() => setDiaryDetail(null)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-label={diaryDetail.title} onClick={e => e.stopPropagation()}>
            <button className="modal-close" aria-label="닫기" onClick={() => setDiaryDetail(null)}>✕</button>
            <div style={{ marginBottom: 16 }}>
              <div className="section-label">{diaryDetail.category} · {diaryDetail.date}</div>
              <div className="section-title">{diaryDetail.title}</div>
            </div>
            <div className="deep-analysis-text" style={{ whiteSpace: 'pre-wrap', marginBottom: 20 }}>
              {diaryDetail.content}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {diaryDetail.snapshot && (
                <button
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => handleLoadDiarySnapshot(diaryDetail)}
                >
                  🔮 {diaryDetail.snapshot.name}님의 전체 결과 다시 보기
                </button>
              )}
              <button className="btn-secondary" onClick={() => setDiaryDetail(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 메인 */}
      <main className="main-container">

        {/* ── 입력 화면 ───────────────────────────── */}
        {step === 'input' && (
          <div className="animate-fade-in">
            {/* 히어로 */}
            <div className="hero">
              <div className="hero-badge">
                <span className="hero-badge-dot" />
                정밀 만세력 알고리즘 × 나풀이 융합
              </div>
              <h1 className="hero-title">
                별자리가 새긴<br />
                <span className="hero-title-accent">나의 사주 명식</span>
              </h1>
              <p className="hero-desc">
                절기(節氣) 기준 정밀 만세력으로 사주원국을 산출하고,<br />
                나풀이가 MBTI와 융합 분석해 드립니다.
              </p>
            </div>

            {/* 입력 폼 */}
            <form onSubmit={handleSubmit} className="glass-card space-y-6 animate-slide-up">

              {/* 이름 + MBTI */}
              <div className="grid-2">
                <div>
                  <label className="form-label">👤 이름 (또는 닉네임)</label>
                  <input
                    className="form-input"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="예: 홍길동"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">🧠 MBTI 유형</label>
                  <select className="form-select" name="mbti" value={formData.mbti} onChange={handleChange}>
                    {MBTI_LIST.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* 생년월일 + 성별 */}
              <div>
                <label className="form-label">📅 생년월일 (양력 기준)</label>
                <div className="grid-3">
                  <input
                    className="form-input"
                    type="number"
                    name="birthYear"
                    value={formData.birthYear}
                    onChange={handleChange}
                    placeholder="연도 (예: 1995)"
                    min="1930" max="2030"
                  />
                  <input
                    className="form-input"
                    type="number"
                    name="birthMonth"
                    value={formData.birthMonth}
                    onChange={handleChange}
                    placeholder="월"
                    min="1" max="12"
                    style={{ textAlign: 'center' }}
                  />
                  <input
                    className="form-input"
                    type="number"
                    name="birthDay"
                    value={formData.birthDay}
                    onChange={handleChange}
                    placeholder="일"
                    min="1" max="31"
                    style={{ textAlign: 'center' }}
                  />
                </div>
                {(() => {
                  const y = parseInt(formData.birthYear);
                  return !Number.isNaN(y) && y >= 1930 && y < 1940 ? (
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                      ⚠️ 1940년 이전 출생자는 절기 정밀 데이터가 없어 근사값으로 계산돼요. 절기 경계에 가까운 날짜라면 오차가 있을 수 있어요.
                    </p>
                  ) : null;
                })()}
              </div>

              {/* 성별 */}
              <div>
                <label className="form-label">⚧ 성별</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[{ val: 'female', label: '🌸 여성' }, { val: 'male', label: '🌊 남성' }].map(g => (
                    <button
                      key={g.val}
                      type="button"
                      className={`hour-btn ${formData.gender === g.val ? 'selected' : ''}`}
                      style={{ flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', padding: '12px' }}
                      onClick={() => setFormData(prev => ({ ...prev, gender: g.val }))}
                    >
                      <span className="hour-btn-name">{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 태어난 시간 */}
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ margin: 0 }}>🕐 태어난 시간 (시주 계산용)</label>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>시주(時柱) 정밀 연산</span>
                </div>
                <label
                  className="flex items-center"
                  style={{ gap: 8, marginBottom: 10, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={formData.hourUnknown}
                    onChange={(e) => setFormData(prev => ({ ...prev, hourUnknown: e.target.checked, useExactTime: e.target.checked ? false : prev.useExactTime }))}
                  />
                  태어난 시간을 모릅니다 (연·월·일주 3기둥으로만 풀이해요)
                </label>
                <label
                  className="flex items-center"
                  style={{ gap: 8, marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)', cursor: formData.hourUnknown ? 'not-allowed' : 'pointer', opacity: formData.hourUnknown ? 0.4 : 1 }}
                >
                  <input
                    type="checkbox"
                    checked={formData.useExactTime}
                    disabled={formData.hourUnknown}
                    onChange={(e) => setFormData(prev => ({ ...prev, useExactTime: e.target.checked }))}
                  />
                  정확한 시:분으로 입력할게요 (더 정밀한 시주 계산, 야자시/조자시 자동 판별)
                </label>
                {formData.useExactTime && !formData.hourUnknown ? (
                  <div className="grid-3" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 4 }}>
                    <input
                      className="form-input"
                      type="number"
                      name="exactHour"
                      value={formData.exactHour}
                      onChange={handleChange}
                      placeholder="시 (0~23)"
                      min="0" max="23"
                      style={{ textAlign: 'center' }}
                    />
                    <input
                      className="form-input"
                      type="number"
                      name="exactMinute"
                      value={formData.exactMinute}
                      onChange={handleChange}
                      placeholder="분 (0~59)"
                      min="0" max="59"
                      style={{ textAlign: 'center' }}
                    />
                  </div>
                ) : (
                <div className="hour-grid" style={formData.hourUnknown ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
                  {HOUR_BRANCHES.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      disabled={formData.hourUnknown}
                      className={`hour-btn ${formData.birthBranch === b.id ? 'selected' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, birthBranch: b.id }))}
                    >
                      <div className="flex items-center justify-between">
                        <span className="hour-btn-name">{b.name}</span>
                        <span className="hour-btn-animal">{b.animal}</span>
                      </div>
                      <span className="hour-btn-time">{b.time}</span>
                    </button>
                  ))}
                </div>
                )}
              </div>

              {/* 출생 도시 (서양 고전점성술 하우스·어센던트 계산용) */}
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ margin: 0 }}>🌌 태어난 도시</label>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>별자리 하우스·어센던트 계산용</span>
                </div>
                <select
                  className="form-select"
                  name="birthCity"
                  value={formData.birthCity}
                  onChange={handleChange}
                >
                  {KOREAN_CITIES.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                  목록에 없는 지역이면 가장 가까운 도시를 선택해 주세요.
                </p>
              </div>

              {/* 제출 버튼 */}
              <button type="submit" className="btn-primary">
                <span>✨</span>
                <span>정밀 만세력 × 나풀이 분석 시작</span>
                <span>→</span>
              </button>
            </form>

            <p style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
              🔮 나풀이의 모든 해석은 재미와 자기 이해를 위한 참고용 콘텐츠이며, 의학적·법률적·재정적 조언을 대체하지 않아요.
              <br />
              <a href="/privacy.html" style={{ color: 'var(--purple-light)' }}>개인정보처리방침</a>
              {' · '}
              <a href="/terms.html" style={{ color: 'var(--purple-light)' }}>이용약관</a>
            </p>
          </div>
        )}

        {/* ── 로딩 화면 ───────────────────────────── */}
        {step === 'loading' && (
          <div className="loading-screen animate-fade-in">
            <div className="loading-orb">
              <div className="orb-ring-1" />
              <div className="orb-ring-2" />
              <div className="orb-ring-3" />
              <div className="orb-center">🌌</div>
            </div>
            <div>
              <h2 className="loading-title">사주원국 정밀 연산 중</h2>
              <p className="loading-status" style={{ marginTop: 8 }}>
                {LOADING_MESSAGES[loadingIdx]}
              </p>
            </div>
            <div className="loading-progress">
              <div className="loading-bar" />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', opacity: 0.6 }}>
              절기(節氣) 기준 정밀 계산 중입니다...
            </p>
          </div>
        )}

        {/* ── 결과 화면 ───────────────────────────── */}
        {step === 'result' && result && (
          <div className="animate-fade-in space-y-6" style={{ paddingTop: 32 }}>
            {/* 프로필 배너 */}
            <div className="profile-banner animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="profile-avatar">
                  {result.formData.name[0] || '?'}
                </div>
                <div className="profile-info">
                  <div className="profile-badge-row">
                    <span className="profile-mbti-badge">{result.formData.mbti}</span>
                    <span className="profile-score-badge">✦ 정밀 만세력 산출 완료</span>
                  </div>
                  <div className="profile-name">{result.formData.name} 님의 명리 리포트</div>
                  <div className="profile-birth">
                    {result.formData.birthYear}년 {result.formData.birthMonth}월 {result.formData.birthDay}일 · {result.sajuResult.hourPillar ? result.hourBranch.name : '시간 모름'}
                  </div>
                </div>
              </div>
              <div className="profile-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {result.aiIntro && (
                  <>
                    <button
                      className="btn-gold"
                      onClick={() => addBookmark('종합 프로필', `${result.formData.name} · ${result.formData.mbti}`, `${result.aiIntro!.jungianNote}\n\n${result.aiIntro!.sajuExplanation}`)}
                    >
                      🔖 결과 저장
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: '10px 14px', fontSize: '13px' }}
                      onClick={handleDownloadPDF}
                      disabled={pdfGenerating}
                    >
                      {pdfGenerating ? '⏳ PDF 생성 중...' : '📄 PDF 저장'}
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: '10px 14px', fontSize: '13px', background: '#fee500', color: '#000', border: 'none' }}
                      onClick={handleKakaoShare}
                    >
                      💬 카톡 공유
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: '10px 14px', fontSize: '13px' }}
                      onClick={handleDownloadImageCard}
                      disabled={imageCardGenerating}
                    >
                      {imageCardGenerating ? '⏳ 카드 생성 중...' : '📸 이미지 카드 저장'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 사주원국 */}
            <div className="glass-card animate-slide-up-delay-1">
              <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                <div>
                  <div className="section-label">🧭 정통 만세력 계산 결과</div>
                  <div className="section-title">사주원국 (四柱原局)</div>
                </div>
                <span style={{
                  fontSize: 11, padding: '4px 12px', borderRadius: 20,
                  background: 'rgba(52, 211, 153, 0.1)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  color: '#34d399', fontWeight: 700,
                }}>절기 기준 정밀 산출</span>
              </div>
              <div className="pillar-grid">
                {([
                  { key: 'year' as PillarKey, label: '연주 (年柱)', pillar: result.sajuResult.yearPillar, cls: 'pillar-year', desc: '조상·초년운' },
                  { key: 'month' as PillarKey, label: '월주 (月柱)', pillar: result.sajuResult.monthPillar, cls: 'pillar-month', desc: '부모·청년운' },
                  { key: 'day' as PillarKey, label: '일주 (日柱)', pillar: result.sajuResult.dayPillar, cls: 'pillar-day', desc: '본인·본질 ★' },
                  ...(result.sajuResult.hourPillar
                    ? [{ key: 'hour' as PillarKey, label: '시주 (時柱)', pillar: result.sajuResult.hourPillar, cls: 'pillar-hour', desc: '자식·말년운' }]
                    : []),
                ]).map(({ key, label, pillar, cls, desc }) => (
                  <div
                    key={label}
                    className={`pillar-card ${cls}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handlePillarClick(key, label, pillar, key === 'hour' ? result.hourBranch.desc : undefined)}
                  >
                    <div className="pillar-label">{label}</div>
                    <div className="pillar-hanja">{pillar.hanjaText}</div>
                    <div className="pillar-korean">{pillar.text}</div>
                    <div className="pillar-desc">{desc}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 10, textAlign: 'center' }}>
                {result.sajuResult.hourPillar
                  ? '💡 각 기둥을 클릭하면 나풀이의 심층 해설을 볼 수 있어요'
                  : '💡 태어난 시간을 몰라 연·월·일주 3기둥으로 풀이했어요 · 각 기둥을 클릭하면 심층 해설을 볼 수 있어요'}
              </p>
              {/* 일간 설명 */}
              <div style={{
                marginTop: 16,
                padding: '14px 16px',
                background: 'rgba(245, 200, 66, 0.05)',
                border: '1px solid rgba(245, 200, 66, 0.15)',
                borderRadius: 14,
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
              }}>
                ⭐ <strong style={{ color: 'var(--gold)' }}>일간(日干) {result.sajuResult.dayStem}</strong>이 본인의 주체입니다.
                {' '}일주 <strong style={{ color: 'var(--text-primary)' }}>{result.sajuResult.dayPillar.hanjaText}({result.sajuResult.dayPillar.text})</strong>는
                당신의 본질적인 성격과 운명의 씨앗입니다.
              </div>
            </div>

            {/* 결과 화면 대분류 탭 */}
            <div className="tab-nav section-tab-nav" role="tablist" aria-label="결과 섹션">
              {[
                { id: 'today', label: '✨ 오늘' },
                { id: 'saju', label: '🔮 사주' },
                { id: 'astrology', label: '🪐 별자리' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeSection === t.id}
                  className={`tab-btn ${activeSection === t.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(t.id as any)}
                >
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* 🔮 사주 대분류 안의 서브탭(운세/해석/궁합/풍수) */}
            {activeSection === 'saju' && (
              <div className="tab-nav" role="tablist" aria-label="사주 세부 메뉴" style={{ marginBottom: 20 }}>
                {[
                  { id: 'fortune', label: '🌌 운세' },
                  { id: 'ai', label: '🔍 해석' },
                  { id: 'compat', label: '💑 궁합' },
                  { id: 'fengshui', label: '🏡 풍수' },
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={activeSajuTab === t.id}
                    className={`tab-btn ${activeSajuTab === t.id ? 'active' : ''}`}
                    onClick={() => setActiveSajuTab(t.id as any)}
                  >
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ✨ 오늘: 오늘의 나풀이 + 오늘의 타로 + 오늘의 트랜짓 — 매일 새로 보는 콘텐츠 3종을 한곳에 모음 */}
            {activeSection === 'today' && (
            <div className="space-y-6 animate-fade-in">

            {/* 매일 알림 (네이티브 앱 전용) */}
            {isNativePlatform() && (
              <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  🔔 {notificationsEnabled ? '매일 오전 9시에 알려드리고 있어요' : '매일 오전 9시에 오늘의 나풀이를 알림으로 받아보세요'}
                </div>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleToggleNotifications} disabled={notificationsLoading}>
                  {notificationsLoading ? '처리 중...' : notificationsEnabled ? '알림 끄기' : '알림 켜기'}
                </button>
              </div>
            )}

            {/* 오늘의 나풀이 (데일리 운세) */}
            <div className="glass-card-gold" style={{ padding: '20px 22px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div>
                  <div className="section-label">🌅 오늘의 나풀이</div>
                  <div className="section-title" style={{ fontSize: 16 }}>{todayDateStr()}</div>
                </div>
                {dailyFortuneData && (
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 11 }}
                    onClick={() => addBookmark('오늘의 나풀이', `${todayDateStr()} 오늘의 나풀이`, `${dailyFortuneData.analysis}\n\n${dailyFortuneData.factBomb}`)}
                  >
                    🔖 저장
                  </button>
                )}
              </div>
              {dailyFortuneData ? (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, margin: '0 0 14px' }}>
                    {dailyFortuneData.analysis}
                  </p>
                  <div className="fact-bomb-box">
                    <div className="fact-bomb-title">🔥 오늘의 팩폭 한줄</div>
                    <div className="fact-bomb-content">{dailyFortuneData.factBomb}</div>
                  </div>
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    오늘의 일진과 내 일주의 관계로, 오늘 하루 짧은 한마디를 나풀이가 들려드려요.
                  </p>
                  <button className="btn-primary" onClick={handleGenerateDailyFortune} disabled={dailyFortuneLoading}>
                    {dailyFortuneLoading ? <span>✨ 살펴보는 중...</span> : <span>🌅 오늘의 나풀이 보기</span>}
                  </button>
                </div>
              )}
            </div>

            {/* 오늘의 타로 (가벼운 재미 콘텐츠) */}
            <div className="glass-card" style={{ padding: '20px 22px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div>
                  <div className="section-label">🃏 오늘의 타로</div>
                  <div className="section-title" style={{ fontSize: 16 }}>가볍게 즐기는 오늘의 한마디</div>
                </div>
                {tarotData && (
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 11 }}
                    onClick={() => addBookmark('오늘의 타로', `${todayDateStr()} 오늘의 타로`, tarotData)}
                  >
                    🔖 저장
                  </button>
                )}
              </div>
              {tarotData ? (() => {
                const seed = `${result.formData.name}_${result.formData.birthYear}${result.formData.birthMonth}${result.formData.birthDay}_${todayDateStr()}`;
                const { card, reversed } = drawDailyTarotCard(seed);
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 28 }}>{card.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 15 }}>{card.name} ({reversed ? '역방향' : '정방향'})</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{card.nameEn}</div>
                      </div>
                    </div>
                    {card.tagline && (
                      <p style={{ fontSize: 12, color: 'var(--gold)', fontStyle: 'italic', margin: '0 0 10px' }}>
                        "{card.tagline}"
                      </p>
                    )}
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, margin: 0 }}>
                      {tarotData}
                    </p>
                  </>
                );
              })() : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    오늘의 카드를 한 장 뽑아봐요. 같은 날 다시 눌러도 같은 카드가 나와요.
                  </p>
                  <button className="btn-primary" onClick={handleGenerateTarot} disabled={tarotLoading}>
                    {tarotLoading ? <span>✨ 카드를 뽑는 중...</span> : <span>🃏 오늘의 타로 뽑기</span>}
                  </button>
                </div>
              )}
            </div>

            {/* 오늘의 트랜짓 (별자리 기반) */}
            <div className="glass-card-gold" style={{ padding: '20px 22px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div>
                  <div className="section-label">🔮 오늘의 트랜짓</div>
                  <div className="section-title" style={{ fontSize: 16 }}>오늘 하늘이 내 차트에 건네는 말</div>
                </div>
                {transitData && (
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 11 }}
                    onClick={() => addBookmark('오늘의 트랜짓', `${todayDateStr()} 오늘의 트랜짓`, `${transitData.analysis}\n\n${transitData.factBomb}`)}
                  >
                    🔖 저장
                  </button>
                )}
              </div>
              {transitData ? (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, margin: '0 0 14px' }}>
                    {transitData.analysis}
                  </p>
                  <div className="fact-bomb-box">
                    <div className="fact-bomb-title">🔥 오늘의 팩폭 한줄</div>
                    <div className="fact-bomb-content">{transitData.factBomb}</div>
                  </div>
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    오늘 실제 하늘의 행성이 내 출생 차트와 어떤 각도를 이루는지 살펴봐요. (별자리 탭에서 어센던트·행성 배치를 먼저 확인하면 더 잘 이해돼요)
                  </p>
                  <button className="btn-primary" onClick={handleGenerateTransit} disabled={transitLoading}>
                    {transitLoading ? <span>✨ 살펴보는 중...</span> : <span>🔮 오늘의 트랜짓 보기</span>}
                  </button>
                </div>
              )}
            </div>
            </div>
            )}

            {/* 🔮 사주 대분류: 운세 / 해석 / 궁합 / 풍수 (서브탭으로 전환) */}
            {activeSection === 'saju' && (<>

            {/* 운세: 오행 분포 + 시주 정보 + 대운/세운 */}
            {activeSajuTab === 'fortune' && (
            <div className="space-y-6 animate-fade-in">

            {/* 오행 분포 */}
            <div className="glass-card animate-slide-up-delay-2">
              <div className="section-label" style={{ marginBottom: 4 }}>🌿 오행 분포</div>
              <div className="section-title" style={{ marginBottom: 16 }}>오행(五行) 과부족 분석</div>
              <div className="element-grid">
                {Object.entries(result.sajuResult.elementCounts).map(([el, cnt]) => {
                  const info = ELEMENT_LABELS[el];
                  const isDominant = dominantElements.includes(el);
                  const isDeficient = cnt === 0;
                  return (
                    <div key={el} className={`element-card ${info.cls}`}>
                      <div className="element-icon">{info.emoji}</div>
                      <div className="element-name">{info.ko}</div>
                      <div className="element-count">{cnt}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>개</div>
                      {isDominant && <div className="element-badge element-badge-strong">강함</div>}
                      {isDeficient && <div className="element-badge element-badge-weak">부족</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, opacity: 0.8 }}>
                ※ 천간(天干) 4자 + 지지(地支) 4자, 총 8글자의 오행 분포입니다.
              </div>
              {(dominantElements.length > 0 || deficientElements.length > 0) && (
                <div className="element-interpretation">
                  {dominantElements.map(el => (
                    <p key={`strong-${el}`} className="element-interpretation-text">
                      ⭐ {ELEMENT_INTERPRETATIONS[el].strongDesc}
                    </p>
                  ))}
                  {deficientElements.map(el => (
                    <p key={`weak-${el}`} className="element-interpretation-text muted">
                      💭 {ELEMENT_INTERPRETATIONS[el].weakDesc}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* 오행 종합 해설 (AI) */}
            <div className="glass-card animate-slide-up-delay-2">
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div>
                  <div className="section-label">🔮 나풀이 오행 종합 해설</div>
                  <div className="section-title">오행 전체를 하나로 풀어보면</div>
                </div>
                {elementSummaryText && (
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 11 }}
                    onClick={() => addBookmark('오행 종합 해설', `${result.formData.name}님의 오행 종합 해설`, elementSummaryText)}
                  >
                    🔖 저장
                  </button>
                )}
              </div>
              {elementSummaryText ? (
                <>
                  <div className="deep-analysis-text">{elementSummaryText}</div>
                  <button
                    className="btn-secondary"
                    style={{ marginTop: 12, fontSize: 12 }}
                    onClick={handleGenerateElementSummary}
                    disabled={elementSummaryLoading}
                  >
                    {elementSummaryLoading ? '다시 생성 중...' : '🔄 다시 생성하기'}
                  </button>

                  {elementSummaryDeepText ? (
                    <div className="deep-dive-block">
                      <div className="deep-dive-block-header">
                        <div className="deep-dive-label">🔍 심화해석</div>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: 11 }}
                          onClick={() => addBookmark('오행 종합 심화 해설', `${result.formData.name}님의 오행 종합 심화 해설`, elementSummaryDeepText)}
                        >
                          🔖 저장
                        </button>
                      </div>
                      <div className="deep-analysis-text">{elementSummaryDeepText}</div>
                    </div>
                  ) : (
                    <button className="btn-deep-dive" onClick={handleGenerateElementSummaryDeep} disabled={elementSummaryDeepLoading}>
                      {elementSummaryDeepLoading ? '✨ 심화해석 생성 중...' : '🔍 심화해석 더보기'}
                    </button>
                  )}
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    오행 5개 수치를 하나로 종합해서, 나만의 균형/불균형 이야기를 나풀이가 만들어드려요.
                  </p>
                  <button className="btn-primary" onClick={handleGenerateElementSummary} disabled={elementSummaryLoading}>
                    {elementSummaryLoading ? <span>✨ 생성 중...</span> : <span>🔮 오행 종합 해설 생성하기</span>}
                  </button>
                </div>
              )}
            </div>

            {/* 시주 정보 (태어난 시간을 아는 경우에만 표시) */}
            {result.sajuResult.hourPillar && (
            <div
              className="glass-card animate-slide-up-delay-2"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedModal({
                title: result.hourBranch.name,
                content: result.hourBranch.desc,
                extra: `${result.hourBranch.time}에 태어난 분은 시주 ${result.sajuResult.hourPillar!.hanjaText}의 기운을 지닙니다. 이 시간대의 에너지는 당신의 잠재된 무의식적 역량과 말년 운을 결정합니다.`,
              })}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="section-label">🕐 시주 분석 · 클릭하여 상세 보기</div>
                  <div className="section-title">{result.hourBranch.name}</div>
                </div>
                <span style={{ fontSize: 28 }}>{result.hourBranch.animal === '쥐' ? '🐭' : result.hourBranch.animal === '소' ? '🐮' : result.hourBranch.animal === '호랑이' ? '🐯' : result.hourBranch.animal === '토끼' ? '🐰' : result.hourBranch.animal === '용' ? '🐲' : result.hourBranch.animal === '뱀' ? '🐍' : result.hourBranch.animal === '말' ? '🐴' : result.hourBranch.animal === '양' ? '🐑' : result.hourBranch.animal === '원숭이' ? '🐒' : result.hourBranch.animal === '닭' ? '🐓' : result.hourBranch.animal === '개' ? '🐕' : '🐷'}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 10 }}>
                {result.hourBranch.desc}
              </p>
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--purple-light)' }}>
                시주 간지: {result.sajuResult.hourPillar.hanjaText}({result.sajuResult.hourPillar.text}) · {result.hourBranch.time}
              </div>
            </div>
            )}

            {/* 대운/세운 표 */}
            <div className="glass-card animate-slide-up-delay-2">
              <div className="section-label" style={{ marginBottom: 4 }}>🌌 운의 흐름</div>
              <div className="section-title" style={{ marginBottom: 16 }}>대운(大運) · 세운(歲運) 흐름표</div>

              <div className="section-subtitle">
                대운 · {result.sajuResult.daeunStartAge}세부터 10년 주기로 진행 (현재 만 {currentAge}세 기준 하이라이트)
              </div>
              <div className="daeun-scroll">
                {result.sajuResult.daeunList.map((d, idx) => (
                  <div key={d.age} className={`daeun-card ${idx === currentDaeunIdx ? 'current' : ''}`}>
                    <div className="daeun-age">{d.age}세~</div>
                    <div className="daeun-hanja">{d.stemHanja}{d.branchHanja}</div>
                    <div className="daeun-kr">{d.stem}{d.branch}</div>
                  </div>
                ))}
              </div>

              <div className="section-subtitle" style={{ marginTop: 24 }}>
                세운 · {currentYear - 5}년 ~ {currentYear + 5}년 (올해 {currentYear}년 하이라이트)
              </div>
              <div className="daeun-scroll">
                {result.sajuResult.seunList.map(s => (
                  <div key={s.year} className={`daeun-card ${s.year === currentYear ? 'current' : ''}`}>
                    <div className="daeun-age">{s.year}</div>
                    <div className="daeun-hanja">{s.stemHanja}{s.branchHanja}</div>
                    <div className="daeun-kr">{s.stem}{s.branch}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 운세 해설 (현재 대운 + 최근 3개년 세운) */}
            <div className="glass-card animate-slide-up-delay-2">
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div>
                  <div className="section-label">🔮 나풀이 운세 해설</div>
                  <div className="section-title">대운/세운이 무슨 뜻인지 궁금하다면</div>
                </div>
                {unseText && (
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 11 }}
                    onClick={() => addBookmark('운세 해설', `${result.formData.name}님의 운세 해설`, unseText)}
                  >
                    🔖 저장
                  </button>
                )}
              </div>

              {unseText ? (
                <>
                  <div className="deep-analysis-text">{unseText}</div>
                  <button
                    className="btn-secondary"
                    style={{ marginTop: 12, fontSize: 12 }}
                    onClick={handleGenerateUnse}
                    disabled={unseLoading}
                  >
                    {unseLoading ? '다시 생성 중...' : '🔄 다시 생성하기'}
                  </button>

                  {unseDeepText ? (
                    <div className="deep-dive-block">
                      <div className="deep-dive-block-header">
                        <div className="deep-dive-label">🔍 심화해석</div>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: 11 }}
                          onClick={() => addBookmark('운세 심화 해설', `${result.formData.name}님의 운세 심화 해설`, unseDeepText)}
                        >
                          🔖 저장
                        </button>
                      </div>
                      <div className="deep-analysis-text">{unseDeepText}</div>
                    </div>
                  ) : (
                    <button className="btn-deep-dive" onClick={handleGenerateUnseDeep} disabled={unseDeepLoading}>
                      {unseDeepLoading ? '✨ 심화해석 생성 중...' : '🔍 심화해석 더보기'}
                    </button>
                  )}
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    대운/세운 간지를 그냥 보면 무슨 뜻인지 알기 어렵죠. 지금 대운과 최근 3개년 세운이 어떤 흐름인지 나풀이가 쉽게 풀어드려요.
                  </p>
                  <button className="btn-primary" onClick={handleGenerateUnse} disabled={unseLoading}>
                    {unseLoading ? (
                      <span>✨ 운세 해설 생성 중...</span>
                    ) : (
                      <span>🔮 운세 해설 생성하기</span>
                    )}
                  </button>
                </div>
              )}
            </div>

            </div>
            )}

            {/* 궁합 조합표 */}
            {activeSajuTab === 'compat' && dayBranchRelations && (
              <div className="space-y-6 animate-fade-in">
              <div className="glass-card animate-slide-up-delay-2">
                <div className="section-label" style={{ marginBottom: 4 }}>💑 궁합 가이드</div>
                <div className="section-title" style={{ marginBottom: 12 }}>궁합 조합표 (일지 기준)</div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
                  당신의 일지(日支)는{' '}
                  <strong style={{ color: 'var(--gold)' }}>
                    {result.sajuResult.dayPillar.branchHanja}({result.sajuResult.dayPillar.branch} · {dayBranchAnimal}띠)
                  </strong>
                  입니다. 상대방의 띠를 기준으로 한 궁합 경향은 아래와 같습니다.
                </p>
                <div className="compat-grid">
                  <div className="compat-block compat-good">
                    <div className="compat-block-title">
                      💞 삼합 (베스트 궁합){dayBranchRelations.samhapElement ? ` · ${dayBranchRelations.samhapElement}국` : ''}
                    </div>
                    <div className="compat-tags">
                      {dayBranchRelations.samhapPartners.length > 0
                        ? dayBranchRelations.samhapPartners.map(p => (
                          <span key={p.branchIdx} className="compat-tag">{p.animal}띠 ({p.hanja})</span>
                        ))
                        : <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>해당 없음</span>}
                    </div>
                  </div>
                  <div className="compat-block compat-good">
                    <div className="compat-block-title">🤝 육합 (찰떡 궁합)</div>
                    <div className="compat-tags">
                      {dayBranchRelations.yukhapPartner
                        ? <span className="compat-tag">{dayBranchRelations.yukhapPartner.animal}띠 ({dayBranchRelations.yukhapPartner.hanja})</span>
                        : <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>해당 없음</span>}
                    </div>
                  </div>
                  <div className="compat-block compat-bad">
                    <div className="compat-block-title">⚡ 충 (갈등 주의)</div>
                    <div className="compat-tags">
                      {dayBranchRelations.chungPartner
                        ? <span className="compat-tag bad">{dayBranchRelations.chungPartner.animal}띠 ({dayBranchRelations.chungPartner.hanja})</span>
                        : <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>해당 없음</span>}
                    </div>
                  </div>
                  <div className="compat-block compat-bad">
                    <div className="compat-block-title">⚠️ 형 (스트레스 주의)</div>
                    <div className="compat-tags">
                      {dayBranchRelations.hyeongPartners.map(p => (
                        <span key={p.branchIdx} className="compat-tag bad">{p.animal}띠 ({p.hanja})</span>
                      ))}
                    </div>
                  </div>
                  <div className="compat-block compat-bad">
                    <div className="compat-block-title">💔 파 (틀어짐 주의)</div>
                    <div className="compat-tags">
                      {dayBranchRelations.paPartner
                        ? <span className="compat-tag bad">{dayBranchRelations.paPartner.animal}띠 ({dayBranchRelations.paPartner.hanja})</span>
                        : <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>해당 없음</span>}
                    </div>
                  </div>
                  <div className="compat-block compat-bad">
                    <div className="compat-block-title">🥀 해 (은근한 마찰)</div>
                    <div className="compat-tags">
                      {dayBranchRelations.haePartner
                        ? <span className="compat-tag bad">{dayBranchRelations.haePartner.animal}띠 ({dayBranchRelations.haePartner.hanja})</span>
                        : <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>해당 없음</span>}
                    </div>
                  </div>
                </div>
                {dayBranchRelations.yukhapPartner && dayBranchRelations.paPartner
                  && dayBranchRelations.yukhapPartner.branchIdx === dayBranchRelations.paPartner.branchIdx && (
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
                    ℹ️ {dayBranchRelations.yukhapPartner.animal}띠는 육합이면서 동시에 파에도 해당하는 특수 조합이에요. 명리학적으로 실제로 그런 관계라, 평소엔 찰떡같이 잘 맞다가도 특정 상황에서만 유독 부딪히는 "애증" 궁합으로 이해하면 자연스러워요.
                  </p>
                )}
              </div>

              {/* 궁합 종합 해설 (AI) */}
              <div className="glass-card animate-slide-up-delay-2">
                <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                  <div>
                    <div className="section-label">🔮 나풀이 궁합 종합 해설</div>
                    <div className="section-title">한자 용어 없이 쉽게 풀어보면</div>
                  </div>
                  {compatSummaryText && (
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: 11 }}
                      onClick={() => addBookmark('궁합 종합 해설', `${result.formData.name}님의 궁합 종합 해설`, compatSummaryText)}
                    >
                      🔖 저장
                    </button>
                  )}
                </div>
                {compatSummaryText ? (
                  <>
                    <div className="deep-analysis-text">{compatSummaryText}</div>
                    <button
                      className="btn-secondary"
                      style={{ marginTop: 12, fontSize: 12 }}
                      onClick={handleGenerateCompatSummary}
                      disabled={compatSummaryLoading}
                    >
                      {compatSummaryLoading ? '다시 생성 중...' : '🔄 다시 생성하기'}
                    </button>

                    {compatSummaryDeepText ? (
                      <div className="deep-dive-block">
                        <div className="deep-dive-block-header">
                          <div className="deep-dive-label">🔍 심화해석</div>
                          <button
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 11 }}
                            onClick={() => addBookmark('궁합 종합 심화 해설', `${result.formData.name}님의 궁합 종합 심화 해설`, compatSummaryDeepText)}
                          >
                            🔖 저장
                          </button>
                        </div>
                        <div className="deep-analysis-text">{compatSummaryDeepText}</div>
                      </div>
                    ) : (
                      <button className="btn-deep-dive" onClick={handleGenerateCompatSummaryDeep} disabled={compatSummaryDeepLoading}>
                        {compatSummaryDeepLoading ? '✨ 심화해석 생성 중...' : '🔍 심화해석 더보기'}
                      </button>
                    )}
                  </>
                ) : (
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                      삼합/육합/충/형/파/해, 한자로 보면 어려운 궁합 결과를 나풀이가 이야기처럼 쉽게 풀어드려요.
                    </p>
                    <button className="btn-primary" onClick={handleGenerateCompatSummary} disabled={compatSummaryLoading}>
                      {compatSummaryLoading ? <span>✨ 생성 중...</span> : <span>🔮 궁합 종합 해설 생성하기</span>}
                    </button>
                  </div>
                )}
              </div>

              {/* 💑 정밀 궁합 (실제 두 사람 사주 비교) */}
              <div className="glass-card-gold animate-slide-up-delay-2">
                <div className="section-label">💑 정밀 궁합</div>
                <div className="section-title" style={{ marginBottom: 12 }}>상대방의 실제 생년월일로 두 사람 사주 비교</div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                  위의 띠 궁합은 일반적인 경향이고, 상대방의 실제 생년월일을 입력하면 두 사람의 진짜 일주(日柱)를 서로 비교한 정밀 궁합을 볼 수 있어요.
                </p>
                {!partnerFormOpen && !pairCompatText && (
                  <button className="btn-primary" onClick={() => setPartnerFormOpen(true)}>
                    + 상대방 입력하고 정밀 궁합 보기
                  </button>
                )}
                {partnerFormOpen && !pairCompatText && (
                  <div className="space-y-4">
                    <input
                      className="form-input"
                      type="text"
                      placeholder="상대방 이름 (또는 닉네임)"
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                    />
                    <div className="grid-3">
                      <input className="form-input" type="number" placeholder="연도" min="1930" max="2030" value={partnerBirthYear} onChange={(e) => setPartnerBirthYear(e.target.value)} />
                      <input className="form-input" type="number" placeholder="월" min="1" max="12" style={{ textAlign: 'center' }} value={partnerBirthMonth} onChange={(e) => setPartnerBirthMonth(e.target.value)} />
                      <input className="form-input" type="number" placeholder="일" min="1" max="31" style={{ textAlign: 'center' }} value={partnerBirthDay} onChange={(e) => setPartnerBirthDay(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[{ val: 'female', label: '🌸 여성' }, { val: 'male', label: '🌊 남성' }].map(g => (
                        <button
                          key={g.val}
                          type="button"
                          className={`hour-btn ${partnerGender === g.val ? 'selected' : ''}`}
                          style={{ flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', padding: '12px' }}
                          onClick={() => setPartnerGender(g.val)}
                        >
                          <span className="hour-btn-name">{g.label}</span>
                        </button>
                      ))}
                    </div>
                    <button className="btn-primary" onClick={handleComparePair} disabled={pairCompatLoading}>
                      {pairCompatLoading ? <span>✨ 비교하는 중...</span> : <span>💑 정밀 궁합 보기</span>}
                    </button>
                  </div>
                )}
                {pairCompatText && pairSajuB && pairCompare && (
                  <>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{result.formData.name}</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{result.sajuResult.dayPillar.hanjaText}({result.sajuResult.dayPillar.text})</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{partnerName}</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{pairSajuB.dayPillar.hanjaText}({pairSajuB.dayPillar.text})</div>
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 10 }}>
                      일지 관계: {pairCompare.dayBranchRelations.length > 0 ? pairCompare.dayBranchRelations.join(', ') : '해당 없음(무난)'}
                    </p>
                    <div className="deep-analysis-text">{pairCompatText}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 12 }}
                        onClick={() => addBookmark('정밀 궁합', `${result.formData.name}님 × ${partnerName}님 정밀 궁합`, pairCompatText)}
                      >
                        🔖 저장
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 12 }}
                        onClick={() => { setPairCompatText(null); setPairSajuB(null); setPairCompare(null); setPartnerFormOpen(true); }}
                      >
                        🔄 다른 상대와 다시 보기
                      </button>
                    </div>
                  </>
                )}
              </div>
              </div>
            )}

            {/* AI 해석 */}
            {activeSajuTab === 'ai' && (
            <div className="animate-slide-up-delay-3">
              <div className="section-label" style={{ marginBottom: 8 }}>🔮 나풀이 심층 해석</div>
              <div className="section-title" style={{ marginBottom: 16 }}>사주 × {result.formData.mbti} 융합 분석</div>

              {/* AI 키 없음 (내장 키 미설정 상태) */}
              {!GEMINI_API_KEY && !result.aiIntro && (
                <div className="no-api-notice">
                  <div className="no-api-notice-icon">🔑</div>
                  <div className="no-api-notice-title">현재 나풀이 해석 기능을 이용할 수 없어요</div>
                  <div className="no-api-notice-desc">
                    사주 계산 결과는 정상적으로 제공되지만, 나풀이 융합 해석은 잠시 후 다시 시도해 주세요.
                  </div>
                </div>
              )}

              {/* AI 오류 */}
              {introError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 16,
                  padding: 20,
                  fontSize: 13,
                  color: '#fca5a5',
                  lineHeight: 1.6,
                }}>
                  ⚠️ 나풀이 해석 오류: {introError}<br />
                  <span style={{ opacity: 0.7 }}>API 키를 확인하거나 잠시 후 다시 시도해 주세요.</span>
                </div>
              )}

              {/* AI 결과 */}
              {result.aiIntro && (
                <div className="space-y-4">
                  {/* 타이틀 카드 */}
                  <div className="glass-card-gold" style={{ textAlign: 'center', padding: '22px 24px' }}>
                    <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>
                      ✦ 나풀이가 뽑은 핵심 특성 ✦
                    </div>
                    <div style={{
                      fontFamily: '"Noto Serif KR", serif',
                      fontSize: 20,
                      fontWeight: 900,
                      color: 'var(--text-primary)',
                      marginBottom: 10,
                    }}>
                      {result.aiIntro.title}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {result.aiIntro.jungianNote}
                    </p>
                  </div>

                  {/* 사주원국 대중 친화적 해설 카드 */}
                  <div className="glass-card" style={{ padding: '20px', background: 'rgba(79, 70, 229, 0.05)', border: '1px solid rgba(79, 70, 229, 0.15)' }}>
                    <div style={{ fontSize: 12, color: 'var(--purple-light)', fontWeight: 700, marginBottom: 8 }}>
                      🧭 나풀이가 들려주는 쉬운 사주원국 풀이
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                      {result.aiIntro.sajuExplanation}
                    </p>
                  </div>

                  {/* 탭 네비게이션 */}
                  <div className="tab-nav" role="tablist" aria-label="나풀이 해석 카테고리">
                    {[
                      { id: 'personality', label: '🌟 성격 진단', icon: '🌶️' },
                      { id: 'career', label: '💼 커리어/재물', icon: '💼' },
                      { id: 'romance', label: '💖 연애/인간관계', icon: '💖' },
                      { id: 'wealth', label: '💰 재물/지출', icon: '💰' },
                      { id: 'prescriptions', label: '🎯 3대 실천 처방전', icon: '🎯' },
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === t.id}
                        className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(t.id as any)}
                      >
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* 탭 세부 내용 */}
                  <div className="glass-card main-tab-content">
                    {(['personality', 'career', 'romance', 'wealth'] as AiCategoryKey[]).map(cat => (
                      activeTab === cat && (
                        <div key={cat} className="tab-pane animate-fade-in space-y-4">
                          {cat === 'personality' && mbtiInfo && (
                            <div className="mbti-card">
                              <div className="mbti-card-emoji">{mbtiInfo.emoji}</div>
                              <div style={{ flex: 1 }}>
                                <div className="tab-pane-title" style={{ marginBottom: 6 }}>
                                  {result.formData.mbti} · {mbtiInfo.nickname}
                                </div>
                                <div className="mbti-card-tags">
                                  {mbtiInfo.keywords.map(k => <span key={k} className="compat-tag">#{k}</span>)}
                                </div>
                                <p className="mbti-card-trait">{mbtiInfo.coreTrait}</p>
                                <p className="mbti-card-synergy">
                                  ⭐ 일간 <strong style={{ color: 'var(--gold)' }}>
                                    {result.sajuResult.dayStem}({ELEMENT_LABELS[result.sajuResult.dayStemElement].ko})
                                  </strong> 기운과 만나면, {ELEMENT_LABELS[result.sajuResult.dayStemElement].emoji} {ELEMENT_LABELS[result.sajuResult.dayStemElement].ko}의 기질이 더해져 {mbtiInfo.nickname} 특유의 성향이 한층 더 입체적으로 발현됩니다.
                                </p>
                              </div>
                            </div>
                          )}
                          {categoryData[cat] ? (
                            <>
                              <div className="flex items-center justify-between">
                                <div className="tab-pane-title">{CATEGORY_TAB_META[cat].paneTitle}</div>
                                <button
                                  className="btn-secondary"
                                  style={{ padding: '6px 12px', fontSize: 11 }}
                                  onClick={() => addBookmark(
                                    CATEGORY_TAB_META[cat].bookmarkCategory,
                                    CATEGORY_TAB_META[cat].bookmarkTitle,
                                    `${categoryData[cat]!.analysis}\n\n${categoryData[cat]!.factBomb}\n\n${categoryData[cat]!.luckyItem}`
                                  )}
                                >
                                  🔖 저장
                                </button>
                              </div>
                              <div className="deep-analysis-text">
                                {categoryData[cat]!.analysis}
                              </div>
                              <div className="fact-bomb-box">
                                <div className="fact-bomb-title">{CATEGORY_TAB_META[cat].factBombTitle}</div>
                                <div className="fact-bomb-content">{categoryData[cat]!.factBomb}</div>
                              </div>
                              <div className="lucky-item-box">
                                {categoryData[cat]!.luckyItem}
                              </div>

                              {categoryDeepData[cat] ? (
                                <div className="deep-dive-block">
                                  <div className="deep-dive-block-header">
                                    <div className="deep-dive-label">🔍 심화해석</div>
                                    <button
                                      className="btn-secondary"
                                      style={{ padding: '6px 12px', fontSize: 11 }}
                                      onClick={() => addBookmark(
                                        `${CATEGORY_TAB_META[cat].bookmarkCategory} 심화`,
                                        `${CATEGORY_TAB_META[cat].bookmarkTitle} (심화해석)`,
                                        categoryDeepData[cat]!
                                      )}
                                    >
                                      🔖 저장
                                    </button>
                                  </div>
                                  <div className="deep-analysis-text">{categoryDeepData[cat]}</div>
                                </div>
                              ) : (
                                <button
                                  className="btn-deep-dive"
                                  onClick={() => handleGenerateCategoryDeep(cat, getAnsweredForCategory(cat))}
                                  disabled={!!categoryDeepLoading[cat]}
                                >
                                  {categoryDeepLoading[cat] ? '✨ 심화해석 생성 중...' : '🔍 심화해석 더보기'}
                                </button>
                              )}
                            </>
                          ) : (
                            <div>
                              <div className="tab-pane-title" style={{ marginBottom: 12 }}>{CATEGORY_TAB_META[cat].paneTitle}</div>
                              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                                {CATEGORY_TAB_META[cat].introText}
                              </p>

                              {isQuestionableCategory(cat) && (
                                <div style={{ marginBottom: 16 }}>
                                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                    💬 답변하면 나풀이가 내 상황에 맞춰 더 구체적으로 해석해줘요 (선택 사항, 안 골라도 돼요)
                                  </p>
                                  {CATEGORY_QUESTIONS[cat].map((q, qIdx) => (
                                    <div key={qIdx} style={{ marginBottom: 14 }}>
                                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                                        {q.question}
                                      </div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {q.options.map(opt => {
                                          const selected = categoryAnswers[cat]?.[qIdx] === opt.value;
                                          return (
                                            <button
                                              key={opt.value}
                                              type="button"
                                              className={`hour-btn ${selected ? 'selected' : ''}`}
                                              style={{ padding: '8px 12px', fontSize: 12, flex: 'none' }}
                                              onClick={() => setCategoryAnswers(prev => {
                                                const cur: [string?, string?] = prev[cat] ?? [undefined, undefined];
                                                const next: [string?, string?] = [cur[0], cur[1]];
                                                next[qIdx] = selected ? undefined : opt.value;
                                                return { ...prev, [cat]: next };
                                              })}
                                            >
                                              {opt.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <button
                                className="btn-primary"
                                onClick={() => handleGenerateCategory(cat, getAnsweredForCategory(cat))}
                                disabled={!!categoryLoading[cat]}
                              >
                                {categoryLoading[cat] ? <span>✨ 생성 중...</span> : <span>{CATEGORY_TAB_META[cat].generateLabel}</span>}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    ))}

                    {activeTab === 'prescriptions' && (
                      <div className="tab-pane animate-fade-in space-y-4">
                        {prescriptionsData ? (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="tab-pane-title">🎯 당신을 위한 맞춤형 3대 현실 실천 처방전</div>
                              <button
                                className="btn-secondary"
                                style={{ padding: '6px 12px', fontSize: 11 }}
                                onClick={() => addBookmark('처방전', '맞춤 3대 처방전', prescriptionsData.join('\n\n'))}
                              >
                                🔖 저장
                              </button>
                            </div>
                            <div className="space-y-3">
                              {prescriptionsData.map((rx, idx) => (
                                <div key={idx} className="prescription-card">
                                  <div className="prescription-text">{rx}</div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div>
                            <div className="tab-pane-title" style={{ marginBottom: 12 }}>🎯 3대 실천 처방전</div>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                              오행과 MBTI에 맞춘 현실적인 행동 지침을 나풀이가 만들어드려요.
                            </p>
                            <button className="btn-primary" onClick={handleGeneratePrescriptions} disabled={prescriptionsLoading}>
                              {prescriptionsLoading ? <span>✨ 생성 중...</span> : <span>🎯 처방전 생성하기</span>}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* 풍수 수리 가이드 */}
            {activeSajuTab === 'fengshui' && (
            <div className="glass-card animate-slide-up-delay-4">
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div>
                  <div className="section-label">🏡 풍수 인테리어</div>
                  <div className="section-title">풍수 수리 가이드</div>
                </div>
                {fengShuiText && (
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 11 }}
                    onClick={() => addBookmark('풍수 수리 가이드', `${result.formData.name}님의 풍수 가이드`, fengShuiText)}
                  >
                    🔖 저장
                  </button>
                )}
              </div>

              {fengShuiText ? (
                <>
                  <div className="deep-analysis-text">{fengShuiText}</div>
                  <button
                    className="btn-secondary"
                    style={{ marginTop: 12, fontSize: 12 }}
                    onClick={handleGenerateFengShui}
                    disabled={fengShuiLoading}
                  >
                    {fengShuiLoading ? '다시 생성 중...' : '🔄 다시 생성하기'}
                  </button>

                  {fengShuiDeepText ? (
                    <div className="deep-dive-block">
                      <div className="deep-dive-block-header">
                        <div className="deep-dive-label">🔍 심화해석</div>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: 11 }}
                          onClick={() => addBookmark('풍수 심화 가이드', `${result.formData.name}님의 풍수 심화 가이드`, fengShuiDeepText)}
                        >
                          🔖 저장
                        </button>
                      </div>
                      <div className="deep-analysis-text">{fengShuiDeepText}</div>
                    </div>
                  ) : (
                    <button className="btn-deep-dive" onClick={handleGenerateFengShuiDeep} disabled={fengShuiDeepLoading}>
                      {fengShuiDeepLoading ? '✨ 심화해석 생성 중...' : '🔍 심화해석 더보기'}
                    </button>
                  )}
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    사주 오행 분포를 바탕으로 나에게 맞는 행운의 색상 · 방위 · 인테리어 보완 팁을 나풀이가 만들어드려요.
                  </p>
                  <button className="btn-primary" onClick={handleGenerateFengShui} disabled={fengShuiLoading}>
                    {fengShuiLoading ? (
                      <span>✨ 풍수 가이드 생성 중...</span>
                    ) : (
                      <span>🏡 풍수 수리 가이드 생성하기</span>
                    )}
                  </button>
                </div>
              )}
            </div>
            )}

            </>)}

            {/* 🪐 별자리 (서양 고전점성술, 홀사인) */}
            {activeSection === 'astrology' && (
            <div className="space-y-6 animate-fade-in">
              <div className="glass-card-gold animate-slide-up-delay-2">
                <div className="section-label">🪐 서양 고전점성술</div>
                <div className="section-title" style={{ marginBottom: 12 }}>어센던트(상승궁)</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)', marginBottom: 6 }}>
                  {ZODIAC_SIGNS[result.astrologyResult.ascendantSignIndex].name} {result.astrologyResult.ascendantDegree.toFixed(1)}°
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {result.astrologyResult.isDayChart
                    ? '☀️ 주간 출생 — 목성이 더 길하고, 토성의 흉함이 덜해요.'
                    : '🌙 야간 출생 — 금성이 더 길하고, 화성의 흉함이 더해요.'}
                </p>
                {result.astrologyTimeConfidence !== 'exact' && (
                  <p style={{ fontSize: 11, color: 'var(--gold)', marginTop: 10, lineHeight: 1.6 }}>
                    ⚠️ {result.astrologyTimeConfidence === 'unknown'
                      ? '출생 시간을 몰라 정오로 근사 계산했어요. 하우스·어센던트는 참고만 해주세요.'
                      : '태어난 시간대의 대표 시각으로 근사 계산했어요. "정확한 시:분 입력"을 쓰면 하우스·어센던트가 더 정확해져요.'}
                  </p>
                )}
                {result.astrologyResult.dstApplied && (
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.6 }}>
                    ℹ️ 이 시기는 한국 서머타임(하절기 표준시)이 적용되어 계산에 반영했어요.
                  </p>
                )}
              </div>

              <div className="glass-card animate-slide-up-delay-2">
                <div className="section-label">🌟 행성 배치</div>
                <div className="section-title" style={{ marginBottom: 16 }}>7개 행성이 있는 자리</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.astrologyResult.planets.map(p => {
                    const info = PLANETS.find(x => x.key === p.key)!;
                    const sign = ZODIAC_SIGNS[p.signIndex];
                    return (
                      <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{info.emoji}</span>
                          <span style={{ fontWeight: 700 }}>{info.name}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13 }}>{sign.name} {p.signDegree.toFixed(1)}°</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {p.houseIndex + 1}하우스{p.dignity ? ` · ${DIGNITY_LABEL[p.dignity]}` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="glass-card animate-slide-up-delay-2">
                <div className="section-label">🏠 하우스 배치 (홀사인)</div>
                <div className="section-title" style={{ marginBottom: 16 }}>1~12하우스가 있는 별자리</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {result.astrologyResult.houseSignIndexes.map((signIdx, i) => (
                    <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{i + 1}H · {HOUSES[i].meaning}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{ZODIAC_SIGNS[signIdx].name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {result.astrologyResult.aspects.length > 0 && (
                <div className="glass-card animate-slide-up-delay-2">
                  <div className="section-label">⚡ 주요 애스펙트</div>
                  <div className="section-title" style={{ marginBottom: 16 }}>행성들의 각도 관계</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {result.astrologyResult.aspects.map((a, idx) => {
                      const infoA = PLANETS.find(x => x.key === a.a)!;
                      const infoB = PLANETS.find(x => x.key === a.b)!;
                      return (
                        <div key={idx} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', fontSize: 13 }}>
                          {infoA.emoji} {infoA.name} — {infoB.emoji} {infoB.name}: <strong>{a.type}</strong>
                          <span style={{ color: 'var(--text-secondary)' }}> ({a.nature}, 오차 {a.orb.toFixed(1)}°)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="glass-card animate-slide-up-delay-2">
                <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                  <div>
                    <div className="section-label">🔮 나풀이 별자리 종합 해설</div>
                    <div className="section-title">출생 차트가 말해주는 것</div>
                  </div>
                  {astrologyData && (
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: 11 }}
                      onClick={() => addBookmark('별자리 종합 해설', `${result.formData.name}님의 별자리 해설`, `${astrologyData.analysis}\n\n${astrologyData.factBomb}\n\n${astrologyData.luckyItem}`)}
                    >
                      🔖 저장
                    </button>
                  )}
                </div>

                {astrologyData ? (
                  <>
                    <div className="deep-analysis-text">{astrologyData.analysis}</div>
                    <div className="fact-bomb-box">
                      <div className="fact-bomb-title">🔥 뼈 때리는 팩폭 한줄평</div>
                      <div className="fact-bomb-content">{astrologyData.factBomb}</div>
                    </div>
                    <div className="lucky-item-box">
                      {astrologyData.luckyItem}
                    </div>
                    <button
                      className="btn-secondary"
                      style={{ marginTop: 12, fontSize: 12 }}
                      onClick={handleGenerateAstrology}
                      disabled={astrologyLoading}
                    >
                      {astrologyLoading ? '다시 생성 중...' : '🔄 다시 생성하기'}
                    </button>

                    {astrologyDeepText ? (
                      <div className="deep-dive-block">
                        <div className="deep-dive-block-header">
                          <div className="deep-dive-label">🔍 심화해석</div>
                          <button
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: 11 }}
                            onClick={() => addBookmark('별자리 심화 해설', `${result.formData.name}님의 별자리 심화 해설`, astrologyDeepText)}
                          >
                            🔖 저장
                          </button>
                        </div>
                        <div className="deep-analysis-text">{astrologyDeepText}</div>
                      </div>
                    ) : (
                      <button className="btn-deep-dive" onClick={handleGenerateAstrologyDeep} disabled={astrologyDeepLoading}>
                        {astrologyDeepLoading ? '✨ 심화해석 생성 중...' : '🔍 심화해석 더보기'}
                      </button>
                    )}
                  </>
                ) : (
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                      어센던트와 행성 배치를 바탕으로, 나풀이가 이 출생 차트를 종합 해설해드려요.
                    </p>
                    <button className="btn-primary" onClick={handleGenerateAstrology} disabled={astrologyLoading}>
                      {astrologyLoading ? <span>✨ 생성 중...</span> : <span>🪐 별자리 종합 해설 생성하기</span>}
                    </button>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* 다시 하기 버튼 */}
            <div style={{ paddingTop: 8 }}>
              <button className="btn-primary" onClick={handleReset}>
                🔄 새로운 사주 분석하기
              </button>
            </div>
          </div>
        )}

        {/* ── 나풀이 다이어리 화면 ─────────────────────────── */}
        {step === 'bookmarks' && (
          <div className="animate-fade-in" style={{ paddingTop: 32 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div className="section-label">📔 나풀이가 풀어온 기록</div>
                <div className="section-title">나풀이 다이어리</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }} onClick={handleExportDiary}>
                  ⬇ 내보내기
                </button>
                <label className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>
                  ⬆ 불러오기
                  <input type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportDiary} />
                </label>
                <button className="btn-secondary" onClick={() => setStep(result ? 'result' : 'input')}>← 돌아가기</button>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
              💡 항목을 클릭하면 전체 내용을 볼 수 있고, 기록 당시의 사람이면 전체 결과 화면으로도 되돌아갈 수 있어요.
            </p>

            {cloudSyncAvailable && (
              <div className="glass-card" style={{ padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                {currentUser ? (
                  <>
                    <div style={{ fontSize: 13 }}>
                      ☁️ <strong>{currentUser.email}</strong>로 기록이 자동 백업되고 있어요
                      {cloudSyncLoading && <span style={{ color: 'var(--text-secondary)' }}> · 동기화 중...</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleSignOut}>로그아웃</button>
                      <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, color: '#f87171', borderColor: 'rgba(248,113,113,0.4)' }} onClick={handleDeleteAccount}>계정 삭제</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      ☁️ 로그인하면 기기를 바꿔도 다이어리 기록이 그대로 유지돼요 (로그인 안 해도 지금처럼 계속 사용 가능해요)
                    </div>
                    <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleSignIn}>구글로 로그인</button>
                  </>
                )}
              </div>
            )}

            {bookmarks.length === 0 ? (
              <div className="bookmark-empty">
                <div className="bookmark-empty-icon">📔</div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>아직 쌓인 기록이 없어요</div>
                <div style={{ fontSize: 13 }}>결과 화면에서 마음에 드는 해석을 저장하면 여기 다이어리에 쌓여요!</div>
              </div>
            ) : (
              <div className="space-y-4">
                {bookmarks.map(bm => (
                  <div key={bm.id} className="bookmark-item" style={{ cursor: 'pointer' }} onClick={() => setDiaryDetail(bm)}>
                    <div style={{ flex: 1 }}>
                      <div className="bookmark-category">{bm.category}</div>
                      <div className="bookmark-title">{bm.title}</div>
                      <div className="bookmark-content">{bm.content}</div>
                      <div className="bookmark-date">{bm.date}</div>
                    </div>
                    <button className="btn-delete" aria-label="기록 삭제" onClick={(e) => { e.stopPropagation(); removeBookmark(bm.id); }}>🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
