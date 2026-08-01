import { useState, useEffect, useCallback } from 'react';
import './App.css';
import heroImage from './assets/hero.png';
import { calculateSaju, HOUR_BRANCHES, EARTHLY_BRANCHES, Pillar, SajuResult } from './utils/sajuCalculator';
import {
  generateSajuIntro, SajuIntro,
  generateCategoryInterpretation, AiCategoryKey, CategoryInterpretation, CategoryUserAnswer,
  generatePrescriptions,
  generateFengShuiInterpretation,
  generateFortuneInterpretation,
  generateElementSummaryInterpretation,
  generateCompatibilitySummaryInterpretation,
  generatePillarInterpretation,
} from './utils/geminiApi';
import { MBTI_DATA } from './data/mbtiTypes';
import { getBranchRelations } from './data/compatibility';
import { ELEMENT_INTERPRETATIONS } from './data/elementTypes';
import { CATEGORY_QUESTIONS, QuestionableCategory } from './data/categoryQuestions';

// ─── 타입 ────────────────────────────────────────
interface FormData {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthBranch: string;
  gender: string;
  mbti: string;
}
interface AppResult {
  formData: FormData;
  sajuResult: SajuResult;
  hourBranch: typeof HOUR_BRANCHES[0];
  aiIntro: SajuIntro | null;
}
interface Bookmark {
  id: number;
  category: string;
  title: string;
  content: string;
  date: string;
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
  'Gemini AI에 사주 × MBTI 첫인상 요청 중...',
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
    introText: '타고난 성격과 본질이 궁금하다면 AI 팩폭 분석을 받아보세요.',
  },
  career: {
    paneTitle: '💼 직업적 적성 & 업무 스타일 원리',
    factBombTitle: '🔥 뼈 때리는 일적 팩폭 한줄평',
    bookmarkCategory: '커리어 분석',
    bookmarkTitle: '커리어 & 직무 적성',
    generateLabel: '💼 커리어 분석 생성하기',
    introText: '직업적 적성과 업무 스타일이 궁금하다면 AI 팩폭 분석을 받아보세요.',
  },
  romance: {
    paneTitle: '💖 사랑, 연애 & 인간관계 패턴',
    factBombTitle: '🔥 뼈 때리는 연애 팩폭 한줄평',
    bookmarkCategory: '연애 분석',
    bookmarkTitle: '사랑 & 관계 패턴',
    generateLabel: '💖 연애 분석 생성하기',
    introText: '연애 스타일과 인간관계 패턴이 궁금하다면 AI 팩폭 분석을 받아보세요.',
  },
  wealth: {
    paneTitle: '💰 재물 축적 & 돈 새는 지출 구멍',
    factBombTitle: '🔥 뼈 때리는 재물 팩폭 한줄평',
    bookmarkCategory: '재물 분석',
    bookmarkTitle: '재물 & 소비 성향',
    generateLabel: '💰 재물 분석 생성하기',
    introText: '재물운과 소비 습관이 궁금하다면 AI 팩폭 분석을 받아보세요.',
  },
};

function isQuestionableCategory(cat: AiCategoryKey): cat is QuestionableCategory {
  return cat === 'career' || cat === 'romance' || cat === 'wealth';
}

type CacheKeyBase = { name: string; birthYear: string; birthMonth: string; birthDay: string };

function fengShuiCacheKey(f: CacheKeyBase): string {
  return `saju_fengshui_${f.name}_${f.birthYear}${f.birthMonth}${f.birthDay}`;
}
function unseCacheKey(f: CacheKeyBase, year: number): string {
  return `saju_unse_${f.name}_${f.birthYear}${f.birthMonth}${f.birthDay}_${year}`;
}
function categoryCacheKey(f: CacheKeyBase, mbti: string, category: AiCategoryKey, answers?: CategoryUserAnswer[]): string {
  const answerSuffix = answers && answers.length > 0 ? `_${answers.map(a => a.answer).join('|')}` : '';
  return `saju_category_${category}_${f.name}_${f.birthYear}${f.birthMonth}${f.birthDay}_${mbti}${answerSuffix}`;
}
function prescriptionsCacheKey(f: CacheKeyBase, mbti: string): string {
  return `saju_prescriptions_${f.name}_${f.birthYear}${f.birthMonth}${f.birthDay}_${mbti}`;
}
function elementSummaryCacheKey(f: CacheKeyBase): string {
  return `saju_elementsummary_${f.name}_${f.birthYear}${f.birthMonth}${f.birthDay}`;
}
function compatSummaryCacheKey(f: CacheKeyBase): string {
  return `saju_compatsummary_${f.name}_${f.birthYear}${f.birthMonth}${f.birthDay}`;
}
function pillarCacheKey(f: CacheKeyBase, key: PillarKey): string {
  return `saju_pillar_${key}_${f.name}_${f.birthYear}${f.birthMonth}${f.birthDay}`;
}

// Gemini API 키는 사용자에게 노출/입력받지 않고 내장 키만 사용합니다.
const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string) || '';

// ─── 앱 컴포넌트 ──────────────────────────────────
export default function App() {
  const [step, setStep] = useState<Step>('input');
  const [activeSection, setActiveSection] = useState<'fortune' | 'mbti' | 'ai' | 'compat' | 'fengshui'>('fortune');
  const [activeTab, setActiveTab] = useState<'personality' | 'career' | 'romance' | 'wealth' | 'prescriptions'>('personality');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    birthYear: '1995',
    birthMonth: '09',
    birthDay: '27',
    birthBranch: '오시',
    gender: 'female',
    mbti: 'ENTP',
  });
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [result, setResult] = useState<AppResult | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
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

  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    const savedBm = localStorage.getItem('saju_bookmarks');
    if (savedBm) { try { setBookmarks(JSON.parse(savedBm)); } catch {} }
  }, []);

  // 풍수 수리 가이드 / 운세 해설 캐시 로드
  useEffect(() => {
    if (!result) { setFengShuiText(null); setUnseText(null); return; }
    setFengShuiText(localStorage.getItem(fengShuiCacheKey(result.formData)));
    setUnseText(localStorage.getItem(unseCacheKey(result.formData, new Date().getFullYear())));
  }, [result]);

  // AI 해석 4개 카테고리 + 처방전 캐시 로드
  useEffect(() => {
    if (!result) { setCategoryData({}); setPrescriptionsData(null); return; }
    const loaded: Partial<Record<AiCategoryKey, CategoryInterpretation>> = {};
    (['personality', 'career', 'romance', 'wealth'] as AiCategoryKey[]).forEach(cat => {
      const cached = localStorage.getItem(categoryCacheKey(result.formData, result.formData.mbti, cat));
      if (cached) { try { loaded[cat] = JSON.parse(cached); } catch {} }
    });
    setCategoryData(loaded);

    const cachedPrescriptions = localStorage.getItem(prescriptionsCacheKey(result.formData, result.formData.mbti));
    if (cachedPrescriptions) {
      try { setPrescriptionsData(JSON.parse(cachedPrescriptions)); } catch { setPrescriptionsData(null); }
    } else {
      setPrescriptionsData(null);
    }
  }, [result]);

  // 오행/궁합 종합 해설 캐시 로드
  useEffect(() => {
    if (!result) { setElementSummaryText(null); setCompatSummaryText(null); return; }
    setElementSummaryText(localStorage.getItem(elementSummaryCacheKey(result.formData)));
    setCompatSummaryText(localStorage.getItem(compatSummaryCacheKey(result.formData)));
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
      showToast('AI 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
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

  // 3대 실천 처방전 생성
  const handleGeneratePrescriptions = async (): Promise<string[] | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('AI 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
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
      showToast('AI 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
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

  // 운세(현재 대운 + 최근 3개년 세운) 해설 AI 생성 (연도 기준 캐싱)
  const handleGenerateUnse = async (): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('AI 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
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

  // 오행 종합 해설 AI 생성
  const handleGenerateElementSummary = async (): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('AI 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
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

  // 궁합 종합 해설 AI 생성
  const handleGenerateCompatSummary = async (): Promise<string | null> => {
    if (!result || !dayBranchRelations) return null;
    if (!GEMINI_API_KEY) {
      showToast('AI 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
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

  // 사주 4기둥 클릭 → AI 심층 해설 모달 열기
  const handlePillarClick = (key: PillarKey, label: string, pillar: Pillar, staticDesc?: string) => {
    setSelectedModal(null);
    setPillarModal({ key, label, hanjaText: pillar.hanjaText, koreanText: pillar.text, staticDesc });
  };

  const handleGeneratePillarAi = async (): Promise<string | null> => {
    if (!result || !pillarModal) return null;
    if (!GEMINI_API_KEY) {
      showToast('AI 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
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
          title: `🔮 ${result.formData.name}님의 ${result.formData.mbti} 사주 팩폭 결과`,
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

  // 보고서형 PDF 파일 다운로드 기능 (인쇄 친화적 팝업 출력 창)
  // PDF 저장은 "버튼 눌러야 생성" 원칙의 예외로, 아직 생성되지 않은 AI 콘텐츠를 전부 자동 생성한 뒤 포함합니다.
  const handleDownloadPDF = async () => {
    if (!result) return;
    setPdfGenerating(true);
    try {
      const categoriesForPdf: Partial<Record<AiCategoryKey, CategoryInterpretation>> = { ...categoryData };
      for (const cat of ['personality', 'career', 'romance', 'wealth'] as AiCategoryKey[]) {
        if (!categoriesForPdf[cat] && GEMINI_API_KEY) {
          categoriesForPdf[cat] = await handleGenerateCategory(cat) ?? undefined;
        }
      }
      const prescriptionsForPdf = prescriptionsData || (GEMINI_API_KEY ? await handleGeneratePrescriptions() : null);
      const elementSummaryForPdf = elementSummaryText || (GEMINI_API_KEY ? await handleGenerateElementSummary() : null);
      const compatSummaryForPdf = compatSummaryText || (GEMINI_API_KEY ? await handleGenerateCompatSummary() : null);
      const fengShuiForPdf = fengShuiText || (GEMINI_API_KEY ? await handleGenerateFengShui() : null);
      const unseForPdf = unseText || (GEMINI_API_KEY ? await handleGenerateUnse() : null);

      // 사주 4기둥 AI 심층 해설도 자동 생성
      const pillarDefs: { key: PillarKey; label: string; pillar: Pillar; staticDesc: string }[] = [
        { key: 'year', label: '연주 (年柱)', pillar: result.sajuResult.yearPillar, staticDesc: '연주는 조상과 초년운을 상징하는 기둥입니다.' },
        { key: 'month', label: '월주 (月柱)', pillar: result.sajuResult.monthPillar, staticDesc: '월주는 부모와 청년운을 상징하는 기둥입니다.' },
        { key: 'day', label: '일주 (日柱)', pillar: result.sajuResult.dayPillar, staticDesc: '일주는 본인의 본질과 배우자운을 상징하는 기둥입니다.' },
        { key: 'hour', label: '시주 (時柱)', pillar: result.sajuResult.hourPillar, staticDesc: result.hourBranch.desc },
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
        const categoryBlocks: { icon: string; title: string; data?: CategoryInterpretation }[] = [
          { icon: '🌟', title: '성격 진단', data: categoriesForPdf.personality },
          { icon: '💼', title: '커리어 & 재물', data: categoriesForPdf.career },
          { icon: '💖', title: '연애 & 인간관계', data: categoriesForPdf.romance },
          { icon: '💰', title: '재물 & 지출', data: categoriesForPdf.wealth },
        ];
        aiContentHtml = `
          <div class="report-section">
            <h2>🤖 AI 융합 분석: ${intro.title}</h2>
            <p class="lead-note"><em>${intro.jungianNote}</em></p>

            <div class="report-block">
              <h3>🧭 쉬운 사주원국 해설</h3>
              <p>${intro.sajuExplanation}</p>
            </div>

            ${categoryBlocks.map(b => b.data ? `
              <div class="report-block">
                <h3>${b.icon} ${b.title}</h3>
                <p>${b.data.analysis}</p>
                <p class="fact-bomb"><strong>🔥 뼈 때리는 팩폭:</strong> ${b.data.factBomb}</p>
                <p class="lucky-item"><strong>🍀 럭키/상극:</strong> ${b.data.luckyItem}</p>
              </div>
            ` : '').join('')}

            ${prescriptionsForPdf ? `
              <div class="report-block">
                <h3>🎯 3대 실천 처방전</h3>
                <ul>
                  ${prescriptionsForPdf.map(p => `<li>${p}</li>`).join('')}
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
              <h3>${mbtiInfo.emoji} ${result.formData.mbti} · ${mbtiInfo.nickname}</h3>
              <p>${mbtiInfo.coreTrait}</p>
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
            ${compatSummaryForPdf ? `<div class="report-block"><h3>💬 궁합 종합 해설</h3><p>${compatSummaryForPdf.replace(/\n/g, '<br>')}</p></div>` : ''}
          </div>
        `;
      }

      const elementSummaryHtml = elementSummaryForPdf
        ? `
          <div class="report-section">
            <h2>🌿 오행 종합 해설</h2>
            <div class="report-block"><p>${elementSummaryForPdf.replace(/\n/g, '<br>')}</p></div>
          </div>
        `
        : '';

      const pillarHtml = Object.keys(pillarAiForPdf).length > 0
        ? `
          <div class="report-section">
            <h2>🧭 사주 4기둥 AI 심층 해설</h2>
            ${pillarDefs.map(def => pillarAiForPdf[def.key] ? `
              <div class="report-block">
                <h3>${def.label} · ${def.pillar.hanjaText}(${def.pillar.text})</h3>
                <p>${pillarAiForPdf[def.key]}</p>
              </div>
            ` : '').join('')}
          </div>
        `
        : '';

      const unseHtml = unseForPdf
        ? `
          <div class="report-section">
            <h2>🔮 AI 운세 해설</h2>
            <div class="report-block"><p>${unseForPdf.replace(/\n/g, '<br>')}</p></div>
          </div>
        `
        : '';

      const fengShuiHtml = fengShuiForPdf
        ? `
          <div class="report-section">
            <h2>🏡 풍수 수리 가이드</h2>
            <div class="report-block"><p>${fengShuiForPdf.replace(/\n/g, '<br>')}</p></div>
          </div>
        `
        : '';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${result.formData.name}님의 사주 MBTI 분석 보고서</title>
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
          <h1>🔮 星命 사주 × MBTI 종합 보고서</h1>

          <table class="meta-table">
            <tr>
              <th>이름</th>
              <td>${result.formData.name}</td>
              <th>성별</th>
              <td>${result.formData.gender === 'male' ? '남성' : '여성'}</td>
              <th>MBTI</th>
              <td>${result.formData.mbti}</td>
            </tr>
            <tr>
              <th>생년월일</th>
              <td colspan="2">${result.formData.birthYear}년 ${result.formData.birthMonth}월 ${result.formData.birthDay}일</td>
              <th>태어난 시간</th>
              <td colspan="2">${result.hourBranch.name} (${result.hourBranch.time})</td>
            </tr>
          </table>

          <h2>🧭 사주원국 명식</h2>
          <table class="saju-table">
            <tr>
              <th>구분</th>
              <th>시주 (時柱)</th>
              <th>일주 (日柱)</th>
              <th>월주 (月柱)</th>
              <th>연주 (年柱)</th>
            </tr>
            <tr class="saju-pillar">
              <td>천간 (天干)</td>
              <td>${saju.hourPillar.hanjaText[0]}</td>
              <td>${saju.dayPillar.hanjaText[0]}</td>
              <td>${saju.monthPillar.hanjaText[0]}</td>
              <td>${saju.yearPillar.hanjaText[0]}</td>
            </tr>
            <tr class="saju-pillar">
              <td>지지 (地支)</td>
              <td>${saju.hourPillar.hanjaText[1]}</td>
              <td>${saju.dayPillar.hanjaText[1]}</td>
              <td>${saju.monthPillar.hanjaText[1]}</td>
              <td>${saju.yearPillar.hanjaText[1]}</td>
            </tr>
            <tr>
              <td>한글</td>
              <td>${saju.hourPillar.text}</td>
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

  // 북마크
  const addBookmark = useCallback((category: string, title: string, content: string) => {
    const bm: Bookmark = { id: Date.now(), category, title, content, date: new Date().toLocaleDateString('ko-KR') };
    const updated = [bm, ...bookmarks];
    setBookmarks(updated);
    localStorage.setItem('saju_bookmarks', JSON.stringify(updated));
    showToast(`"${title.slice(0, 15)}..." 보관함에 저장됨 📌`);
  }, [bookmarks]);

  const removeBookmark = useCallback((id: number) => {
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    localStorage.setItem('saju_bookmarks', JSON.stringify(updated));
  }, [bookmarks]);

  // 폼 변경
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // 제출
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { showToast('이름을 입력해 주세요!'); return; }
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
      const hourBranch = HOUR_BRANCHES.find(h => h.id === formData.birthBranch) ?? HOUR_BRANCHES[6];

      // 사주 계산 (잘못된 날짜 입력 시 예외가 발생할 수 있어 방어)
      let sajuResult: SajuResult;
      try {
        sajuResult = calculateSaju(year, month, day, formData.birthBranch, formData.gender);
      } catch (err) {
        clearInterval(msgInterval);
        showToast('생년월일 입력값이 올바르지 않습니다. 날짜를 다시 확인해 주세요.');
        setStep('input');
        return;
      }

      let aiIntro: SajuIntro | null = null;
      let errMsg: string | null = null;

      // Gemini AI 첫인상(타이틀+사주풀이) 생성 (내장 API 키 사용)
      if (GEMINI_API_KEY) {
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
            hourBranch.name,
          );
        } catch (err: any) {
          errMsg = err?.message ?? 'AI 해석 오류가 발생했습니다.';
        }
      }

      clearInterval(msgInterval);
      setResult({ formData: { ...formData }, sajuResult, hourBranch, aiIntro });
      setIntroError(errMsg);
      setStep('result');
    };

    // 최소 1.5초 로딩 후 실행
    const timer = setTimeout(run, 1500);
    return () => { clearInterval(msgInterval); clearTimeout(timer); };
  }, [step]);

  const handleReset = () => {
    setStep('input');
    setResult(null);
    setIntroError(null);
    setActiveSection('fortune');
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
            <div className="logo-icon">🌌</div>
            <span className="logo-text">星命 사주 × MBTI</span>
            <span className="logo-badge">정밀 만세력 엔진</span>
          </div>
          <div className="header-actions">
            <button className="btn-bookmark-header" onClick={() => setStep('bookmarks')}>
              🔖 보관함 ({bookmarks.length})
            </button>
            {step === 'result' && (
              <button className="btn-reset" onClick={handleReset}>↺ 다시 하기</button>
            )}
          </div>
        </div>
      </header>

      {/* 토스트 */}
      {toastMsg && <div className="toast">✨ {toastMsg}</div>}

      {/* 모달 (시주 정적 정보 등 범용) */}
      {selectedModal && (
        <div className="modal-overlay" onClick={() => setSelectedModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedModal(null)}>✕</button>
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
                🔖 보관함에 저장
              </button>
              <button className="btn-secondary" onClick={() => setSelectedModal(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 (사주 4기둥 AI 심층 해설) */}
      {pillarModal && (
        <div className="modal-overlay" onClick={() => setPillarModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPillarModal(null)}>✕</button>
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
                    🔖 보관함에 저장
                  </button>
                  <button className="btn-secondary" onClick={() => setPillarModal(null)}>닫기</button>
                </div>
              </>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
                  이 기둥이 당신과 MBTI에 어떤 의미인지 AI가 심층 해설해드려요.
                </p>
                <button
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleGeneratePillarAi}
                  disabled={pillarAiLoading}
                >
                  {pillarAiLoading ? <span>✨ 생성 중...</span> : <span>🔮 AI 심층 해설 생성하기</span>}
                </button>
              </div>
            )}
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
                정밀 만세력 알고리즘 × Gemini AI 융합
              </div>
              <h1 className="hero-title">
                별자리가 새긴<br />
                <span className="hero-title-accent">나의 사주 명식</span>
              </h1>
              <p className="hero-desc">
                절기(節氣) 기준 정밀 만세력으로 사주원국을 산출하고,<br />
                Google Gemini AI가 MBTI와 융합 분석해 드립니다.
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
                      <span className={`hour-btn-name ${formData.gender === g.val ? '' : ''}`}>{g.label}</span>
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
                <div className="hour-grid">
                  {HOUR_BRANCHES.map(b => (
                    <button
                      key={b.id}
                      type="button"
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
              </div>

              {/* 제출 버튼 */}
              <button type="submit" className="btn-primary">
                <span>✨</span>
                <span>정밀 만세력 × Gemini AI 분석 시작</span>
                <span>→</span>
              </button>
            </form>
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
                    {result.formData.birthYear}년 {result.formData.birthMonth}월 {result.formData.birthDay}일 · {result.hourBranch.name}
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
                {[
                  { key: 'year' as PillarKey, label: '연주 (年柱)', pillar: result.sajuResult.yearPillar, cls: 'pillar-year', desc: '조상·초년운' },
                  { key: 'month' as PillarKey, label: '월주 (月柱)', pillar: result.sajuResult.monthPillar, cls: 'pillar-month', desc: '부모·청년운' },
                  { key: 'day' as PillarKey, label: '일주 (日柱)', pillar: result.sajuResult.dayPillar, cls: 'pillar-day', desc: '본인·본질 ★' },
                  { key: 'hour' as PillarKey, label: '시주 (時柱)', pillar: result.sajuResult.hourPillar, cls: 'pillar-hour', desc: '자식·말년운' },
                ].map(({ key, label, pillar, cls, desc }) => (
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
                💡 각 기둥을 클릭하면 AI 심층 해설을 볼 수 있어요
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

            {/* 결과 화면 섹션 탭 */}
            <div className="tab-nav section-tab-nav">
              {[
                { id: 'fortune', label: '🌌 운세' },
                { id: 'mbti', label: '🧠 MBTI카드' },
                { id: 'ai', label: '🤖 AI해석' },
                { id: 'compat', label: '💑 궁합' },
                { id: 'fengshui', label: '🏡 풍수' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`tab-btn ${activeSection === t.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(t.id as any)}
                >
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* MBTI 유형카드 */}
            {activeSection === 'mbti' && mbtiInfo && (
              <div className="glass-card animate-slide-up-delay-1">
                <div className="section-label" style={{ marginBottom: 4 }}>🧠 MBTI 유형카드</div>
                <div className="section-title" style={{ marginBottom: 16 }}>
                  {result.formData.mbti} · {mbtiInfo.nickname}
                </div>
                <div className="mbti-card">
                  <div className="mbti-card-emoji">{mbtiInfo.emoji}</div>
                  <div style={{ flex: 1 }}>
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
              </div>
            )}

            {/* 운세: 오행 분포 + 시주 정보 + 대운/세운 */}
            {activeSection === 'fortune' && (
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
                  <div className="section-label">🔮 AI 오행 종합 해설</div>
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
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    오행 5개 수치를 하나로 종합해서, 나만의 균형/불균형 이야기를 AI가 만들어드려요.
                  </p>
                  <button className="btn-primary" onClick={handleGenerateElementSummary} disabled={elementSummaryLoading}>
                    {elementSummaryLoading ? <span>✨ 생성 중...</span> : <span>🔮 오행 종합 해설 생성하기</span>}
                  </button>
                </div>
              )}
            </div>

            {/* 시주 정보 */}
            <div
              className="glass-card animate-slide-up-delay-2"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedModal({
                title: result.hourBranch.name,
                content: result.hourBranch.desc,
                extra: `${result.hourBranch.time}에 태어난 분은 시주 ${result.sajuResult.hourPillar.hanjaText}의 기운을 지닙니다. 이 시간대의 에너지는 당신의 잠재된 무의식적 역량과 말년 운을 결정합니다.`,
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
                  <div className="section-label">🔮 AI 운세 해설</div>
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
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    대운/세운 간지를 그냥 보면 무슨 뜻인지 알기 어렵죠. 지금 대운과 최근 3개년 세운이 어떤 흐름인지 AI가 쉽게 풀어드려요.
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
            {activeSection === 'compat' && dayBranchRelations && (
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
              </div>

              {/* 궁합 종합 해설 (AI) */}
              <div className="glass-card animate-slide-up-delay-2">
                <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                  <div>
                    <div className="section-label">🔮 AI 궁합 종합 해설</div>
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
                  </>
                ) : (
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                      삼합/육합/충/형/파/해, 한자로 보면 어려운 궁합 결과를 AI가 이야기처럼 쉽게 풀어드려요.
                    </p>
                    <button className="btn-primary" onClick={handleGenerateCompatSummary} disabled={compatSummaryLoading}>
                      {compatSummaryLoading ? <span>✨ 생성 중...</span> : <span>🔮 궁합 종합 해설 생성하기</span>}
                    </button>
                  </div>
                )}
              </div>
              </div>
            )}

            {/* AI 해석 */}
            {activeSection === 'ai' && (
            <div className="animate-slide-up-delay-3">
              <div className="section-label" style={{ marginBottom: 8 }}>🤖 Gemini AI 심층 해석</div>
              <div className="section-title" style={{ marginBottom: 16 }}>사주 × {result.formData.mbti} 융합 분석</div>

              {/* AI 키 없음 (내장 키 미설정 상태) */}
              {!GEMINI_API_KEY && !result.aiIntro && (
                <div className="no-api-notice">
                  <div className="no-api-notice-icon">🔑</div>
                  <div className="no-api-notice-title">현재 AI 해석 기능을 이용할 수 없어요</div>
                  <div className="no-api-notice-desc">
                    사주 계산 결과는 정상적으로 제공되지만, AI 융합 해석은 잠시 후 다시 시도해 주세요.
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
                  ⚠️ AI 해석 오류: {introError}<br />
                  <span style={{ opacity: 0.7 }}>API 키를 확인하거나 잠시 후 다시 시도해 주세요.</span>
                </div>
              )}

              {/* AI 결과 */}
              {result.aiIntro && (
                <div className="space-y-4">
                  {/* 타이틀 카드 */}
                  <div className="glass-card-gold" style={{ textAlign: 'center', padding: '22px 24px' }}>
                    <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>
                      ✦ AI 선정 핵심 특성 ✦
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
                      🧭 AI가 들려주는 쉬운 사주원국 풀이
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                      {result.aiIntro.sajuExplanation}
                    </p>
                  </div>

                  {/* 탭 네비게이션 */}
                  <div className="tab-nav">
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
                                    💬 답변하면 AI가 내 상황에 맞춰 더 구체적으로 해석해줘요 (선택 사항, 안 골라도 돼요)
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
                                onClick={() => {
                                  if (isQuestionableCategory(cat)) {
                                    const qs = CATEGORY_QUESTIONS[cat];
                                    const ans = categoryAnswers[cat] ?? [undefined, undefined];
                                    const answered: CategoryUserAnswer[] = qs
                                      .map((q, qIdx) => ({ question: q.question, answer: ans[qIdx] }))
                                      .filter((a): a is CategoryUserAnswer => !!a.answer);
                                    handleGenerateCategory(cat, answered.length > 0 ? answered : undefined);
                                  } else {
                                    handleGenerateCategory(cat);
                                  }
                                }}
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
                              오행과 MBTI에 맞춘 현실적인 행동 지침을 AI가 만들어드려요.
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
            {activeSection === 'fengshui' && (
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
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    사주 오행 분포를 바탕으로 나에게 맞는 행운의 색상 · 방위 · 인테리어 보완 팁을 AI가 만들어드려요.
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

            {/* 다시 하기 버튼 */}
            <div style={{ paddingTop: 8 }}>
              <button className="btn-primary" onClick={handleReset}>
                🔄 새로운 사주 분석하기
              </button>
            </div>
          </div>
        )}

        {/* ── 보관함 화면 ─────────────────────────── */}
        {step === 'bookmarks' && (
          <div className="animate-fade-in" style={{ paddingTop: 32 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
              <div>
                <div className="section-label">🔖 저장된 해석</div>
                <div className="section-title">나의 보관함</div>
              </div>
              <button className="btn-secondary" onClick={() => setStep(result ? 'result' : 'input')}>← 돌아가기</button>
            </div>

            {bookmarks.length === 0 ? (
              <div className="bookmark-empty">
                <div className="bookmark-empty-icon">🔖</div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>저장된 해석이 없어요</div>
                <div style={{ fontSize: 13 }}>분석 결과에서 마음에 드는 해석을 저장해 보세요!</div>
              </div>
            ) : (
              <div className="space-y-4">
                {bookmarks.map(bm => (
                  <div key={bm.id} className="bookmark-item">
                    <div style={{ flex: 1 }}>
                      <div className="bookmark-category">{bm.category}</div>
                      <div className="bookmark-title">{bm.title}</div>
                      <div className="bookmark-content">{bm.content}</div>
                      <div className="bookmark-date">{bm.date}</div>
                    </div>
                    <button className="btn-delete" onClick={() => removeBookmark(bm.id)}>🗑</button>
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
