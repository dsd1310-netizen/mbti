import { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import heroImage from './assets/hero.png';
import { calculateSaju, calcDayPillar, HOUR_BRANCHES, EARTHLY_BRANCHES, hourBranchIdFromExactTime, Pillar, SajuResult, SipsinType } from './utils/sajuCalculator';
import {
  generateSajuIntro, SajuIntro,
  generateCategoryInterpretation, AiCategoryKey, CategoryInterpretation, CategoryUserAnswer,
  generatePrescriptions,
  generateFengShuiInterpretation,
  generateFortuneInterpretation,
  generateDailyFortune, DailyFortune,
  generateElementSummaryInterpretation,
  generateSipsinSummaryInterpretation,
  generateGyeokgukInterpretation,
  generateCompatibilitySummaryInterpretation,
  generatePillarInterpretation,
  generateCategoryDeepInterpretation,
  generateFengShuiDeepInterpretation,
  generateFortuneDeepInterpretation,
  generateElementSummaryDeepInterpretation,
  generateSipsinSummaryDeepInterpretation,
  generateGyeokgukDeepInterpretation,
  generateCompatibilitySummaryDeepInterpretation,
  generateAstrologyInterpretation, generateAstrologyDeepInterpretation, AstrologyInterpretation,
  generatePlanetPlacementInterpretation, generateHousePlacementInterpretation,
  generateTransitInterpretation, DailyTransitFortune,
  generateTarotInterpretation,
  generatePairCompatibilityInterpretation,
  generateFollowUpAnswer, ChatMessage,
  generateArchetypeMatch, ArchetypeMatch,
} from './utils/geminiApi';
import { MBTI_DATA } from './data/mbtiTypes';
import { getBranchRelations } from './data/compatibility';
import { ELEMENT_INTERPRETATIONS } from './data/elementTypes';
import { getJijanggan } from './data/jijanggan';
import { SINSAL_INFO } from './data/sinsal';
import { GYEOKGUK_INFO } from './data/gyeokguk';
import { CATEGORY_QUESTIONS, QuestionableCategory } from './data/categoryQuestions';
// calculateAstrology/calculateTodayTransits(astronomy-engine 의존, 번들 119KB)는 정적 import하지 않고
// 실제로 필요한 시점(폼 제출/트랜짓 갱신)에 동적 import로 불러온다 — 초기 로딩 경로에서 제외하기 위함
// (계획안.md 7-AS 참고). 나머지는 순수 데이터/타입이라 초기 화면(도시 선택 등)에도 안전하게 정적 import.
import { KOREAN_CITIES, ZODIAC_SIGNS, PLANETS, HOUSES, DIGNITY_LABEL, AstrologyResult, PlanetKey } from './utils/astrologyData';
import { drawDailyTarotCard } from './data/tarotCards';
import { ARCHETYPE_FIGURES } from './data/archetypeFigures';
import { comparePillars, PairCompatibilityResult, GWIIN_TYPE_META, STEM_RELATION_LABEL, getGwiinScore } from './utils/pairCompatibility';
import { GwiinMap, GwiinMapNode } from './components/GwiinMap';
import { isNativePlatform, isDailyNotificationEnabled, enableDailyNotification, disableDailyNotification, getNotificationHour } from './utils/notifications';
import { recordTodayVisitAndGetStreak, getHighestTier, getEarnedTiers, STREAK_TIERS, EarnedTier } from './utils/streak';
import { trackResultViewAndMaybeRequestReview } from './utils/appReview';
import { DEPLOY_DOMAIN, DEPLOY_ORIGIN } from './deployConfig';
import { trackEvent } from './utils/analytics';
import type { User } from 'firebase/auth';
import { NapuliMark } from './components/NapuliMark';
import { PaywallOptions } from './components/PaywallOptions';
import { FormData, AppResult, Bookmark, Step, PillarKey, PdfSectionKey, PDF_SECTION_META, ONBOARDING_SEEN_KEY, GUIDE_LAST_SHOWN_KEY, GUIDE_DAILY_ENABLED_KEY, GUIDE_FEATURES, RESULT_HINT_SEEN_KEY } from './appTypes';
import {
  loadCloudSync, isChunkLoadError,
  MBTI_LIST, ELEMENT_LABELS, SIPSIN_INFO, LOADING_MESSAGES, CATEGORY_TAB_META, isQuestionableCategory,
  escapeHtml, escapeHtmlBreaks, wrapCanvasText, loadCanvasImage,
  fengShuiCacheKey, unseCacheKey, categoryCacheKey, prescriptionsCacheKey, aiIntroCacheKey,
  elementSummaryCacheKey, compatSummaryCacheKey, categoryDeepCacheKey, fengShuiDeepCacheKey,
  unseDeepCacheKey, elementSummaryDeepCacheKey, compatSummaryDeepCacheKey, isStaleDeepFallbackText,
  sipsinSummaryCacheKey, sipsinSummaryDeepCacheKey, gyeokgukSummaryCacheKey, gyeokgukSummaryDeepCacheKey,
  pillarCacheKey, astrologyCacheKey, astrologyDeepCacheKey, astroPlacementCacheKey, todayDateStr, tarotCardTheme,
  dailyFortuneCacheKey, transitCacheKey, tarotCacheKey, pairCompatCacheKey, roomVariantCacheKey,
  PairCompatHistoryEntry, getPairCompatHistory, addPairCompatHistoryEntry,
  chatCacheKey, CHAT_DISPLAY_LIMIT, CHAT_CONTEXT_TURNS, archetypeCacheKey,
  setCachedItem, GEMINI_API_KEY,
  CompatInvite, encodeCompatInvite, decodeCompatInvite,
} from './appHelpers';
import { fetchCreditBalance, consumeCredit, CREDIT_GATE_ENABLED } from './utils/credits';
import { initPurchases, purchaseCreditPackage } from './utils/purchases';
import { requestTossPayment, readTossReturnParams, clearTossReturnParams, CreditPriceOption } from './utils/tossPayments';

// ─── 타입은 ./appTypes.ts, 순수 헬퍼/캐시 키 함수는 ./appHelpers.ts로 이동 (2026-08-07) ───

// ─── 앱 컴포넌트 ──────────────────────────────────
export default function App() {
  const [step, setStep] = useState<Step>(() => (localStorage.getItem(ONBOARDING_SEEN_KEY) ? 'input' : 'onboarding'));
  const [activeSection, setActiveSection] = useState<'today' | 'saju' | 'astrology'>('saju');
  const [activeSajuTab, setActiveSajuTab] = useState<'fortune' | 'ai' | 'compat' | 'fengshui'>('fortune');
  const [activeTab, setActiveTab] = useState<'personality' | 'career' | 'romance' | 'wealth' | 'prescriptions' | 'archetype'>('personality');
  // 어떤 탭/섹션을 실제로 많이 보는지 알기 위한 최소 화면 추적(analytics.ts 설정 안 돼 있으면 무동작)
  useEffect(() => {
    if (step !== 'result') return;
    trackEvent('screen_view', { screen_name: activeSection === 'saju' ? `saju_${activeSajuTab}` : activeSection });
  }, [step, activeSection, activeSajuTab]);
  // 🔔 매일 알림(네이티브 앱 전용) — 웹 버전에서는 UI 자체를 노출하지 않음
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => isDailyNotificationEnabled());
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationHour, setNotificationHour] = useState(() => getNotificationHour());
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
  // 심화해석 6종 크레딧제 — 이 기능들만 로그인 필수(계획안.md 8-3 참고), 나머지는 계속 비로그인 무료.
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [showLoginGateModal, setShowLoginGateModal] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [paywallLoading, setPaywallLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [introError, setIntroError] = useState<string | null>(null);
  const [selectedModal, setSelectedModal] = useState<{ title: string; content: string; extra?: string } | null>(null);

  // AI 해석 4개 카테고리 + 처방전 (탭 진입 시 버튼으로 개별 생성)
  const [categoryData, setCategoryData] = useState<Partial<Record<AiCategoryKey, CategoryInterpretation>>>({});
  const [categoryLoading, setCategoryLoading] = useState<Partial<Record<AiCategoryKey, boolean>>>({});
  const [prescriptionsData, setPrescriptionsData] = useState<string[] | null>(null);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);

  // 🎭 나와 닮은 인물 AI 매칭카드
  const [archetypeData, setArchetypeData] = useState<ArchetypeMatch | null>(null);
  const [archetypeLoading, setArchetypeLoading] = useState(false);

  // 🗨️ AI 후속질문(채팅) — "AI 해석" 탭 전체에서 하나의 대화를 공유
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // 커리어/연애/재물 생성 전 개인화 질문 답변 (선택 사항, [질문1 답, 질문2 답])
  const [categoryAnswers, setCategoryAnswers] = useState<Partial<Record<QuestionableCategory, [string?, string?]>>>({});

  // 사주 4기둥 클릭 시 AI 심층 해설
  const [pillarModal, setPillarModal] = useState<{ key: PillarKey; label: string; hanjaText: string; koreanText: string; branchIdx: number; staticDesc?: string } | null>(null);
  const [pillarAiData, setPillarAiData] = useState<Partial<Record<PillarKey, string>>>({});
  const [pillarAiLoading, setPillarAiLoading] = useState(false);

  // 🪐 별자리 행성/하우스 클릭 시 AI 심층 해설 — 사주 4기둥 클릭 패턴과 동일.
  // dataKey: 행성이면 "planet_sun", 하우스면 "house_4"(0-based 인덱스) 형태로 구분.
  const [astroModal, setAstroModal] = useState<{ dataKey: string; title: string; staticDesc: string } | null>(null);
  const [astroPlacementAiData, setAstroPlacementAiData] = useState<Record<string, string>>({});
  const [astroPlacementAiLoading, setAstroPlacementAiLoading] = useState(false);

  const [fengShuiText, setFengShuiText] = useState<string | null>(null);
  const [fengShuiLoading, setFengShuiLoading] = useState(false);
  const [unseText, setUnseText] = useState<string | null>(null);
  const [unseLoading, setUnseLoading] = useState(false);
  const [elementSummaryText, setElementSummaryText] = useState<string | null>(null);
  const [elementSummaryLoading, setElementSummaryLoading] = useState(false);
  const [sipsinSummaryText, setSipsinSummaryText] = useState<string | null>(null);
  const [sipsinSummaryLoading, setSipsinSummaryLoading] = useState(false);
  const [gyeokgukSummaryText, setGyeokgukSummaryText] = useState<string | null>(null);
  const [gyeokgukSummaryLoading, setGyeokgukSummaryLoading] = useState(false);
  const [compatSummaryText, setCompatSummaryText] = useState<string | null>(null);
  const [compatSummaryLoading, setCompatSummaryLoading] = useState(false);
  const [dailyFortuneData, setDailyFortuneData] = useState<DailyFortune | null>(null);
  const [dailyFortuneLoading, setDailyFortuneLoading] = useState(false);
  const [dailyFortuneFailed, setDailyFortuneFailed] = useState(false);

  // 심화해석(🔍 십신·MBTI 상세 근거, 3배 이상 분량) — 8개 섹션 공통, "_deep" 캐시로 별도 저장
  const [categoryDeepData, setCategoryDeepData] = useState<Partial<Record<AiCategoryKey, string>>>({});
  const [categoryDeepLoading, setCategoryDeepLoading] = useState<Partial<Record<AiCategoryKey, boolean>>>({});
  const [fengShuiDeepText, setFengShuiDeepText] = useState<string | null>(null);
  const [fengShuiDeepLoading, setFengShuiDeepLoading] = useState(false);
  const [unseDeepText, setUnseDeepText] = useState<string | null>(null);
  const [unseDeepLoading, setUnseDeepLoading] = useState(false);
  const [elementSummaryDeepText, setElementSummaryDeepText] = useState<string | null>(null);
  const [elementSummaryDeepLoading, setElementSummaryDeepLoading] = useState(false);
  const [sipsinSummaryDeepText, setSipsinSummaryDeepText] = useState<string | null>(null);
  const [sipsinSummaryDeepLoading, setSipsinSummaryDeepLoading] = useState(false);
  const [gyeokgukSummaryDeepText, setGyeokgukSummaryDeepText] = useState<string | null>(null);
  const [gyeokgukSummaryDeepLoading, setGyeokgukSummaryDeepLoading] = useState(false);
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
  const [transitFailed, setTransitFailed] = useState(false);

  // 🃏 오늘의 타로
  const [tarotData, setTarotData] = useState<string | null>(null);
  const [tarotLoading, setTarotLoading] = useState(false);
  const [tarotFailed, setTarotFailed] = useState(false);

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
  const [pairCompatHistory, setPairCompatHistory] = useState<PairCompatHistoryEntry[]>([]);
  // 🏠 나풀이의 방 — 오행별로 4종씩 있는 방 중 사람별로 선택한 것(1~4)을 기억.
  // 하우징 모드 확장을 염두에 두고 사람별 로컬 저장 컨벤션(roomVariantCacheKey)을 먼저 맞춰둠.
  const [roomVariant, setRoomVariant] = useState(1);
  // "오늘" 탭 안에 있어 발견성이 낮다는 피드백으로, 프로필 배너 옆 아이콘 버튼 + 팝업(모달)
  // 형태로 변경(2026-08-21, 계획안.md 7-BM 참고) — 어느 탭에 있든 항상 보임.
  const [showRoomModal, setShowRoomModal] = useState(false);
  // 💑 궁합 초대 링크로 들어온 경우 — 링크를 보낸 사람의 정보(URL ?invite= 파라미터에서 디코딩).
  // 내 정보를 입력해 결과 화면에 도달하면 자동으로 이 사람과의 정밀 궁합을 보여준다(7-AI 참고).
  const [compatInvite, setCompatInvite] = useState<CompatInvite | null>(null);
  const [inviteLinkCopying, setInviteLinkCopying] = useState(false);

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [imageCardGenerating, setImageCardGenerating] = useState(false);
  // 오늘의 타로/닮은 인물 개별 결과 이미지 카드 — 어떤 카드가 생성 중인지만 구분(동시 클릭 방지용)
  const [personaImageGenerating, setPersonaImageGenerating] = useState<'tarot' | 'archetype' | 'streak' | null>(null);

  // PDF 저장 시 섹션 선택 모달 — 기본값은 전부 체크(기존 "전체 포함" 동작과 동일)
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfSections, setPdfSections] = useState<Record<PdfSectionKey, boolean>>({
    aiCategories: true, prescriptions: true, elementSummary: true, compat: true,
    fengshui: true, fortune: true, pillars: true, astrology: true,
  });

  // 🔥 연속 방문일수(스트릭) — 앱을 열 때마다 한 번만 기록(탭과 무관하게 "오늘 앱을 열었는지" 기준)
  const [streakCount, setStreakCount] = useState(0);
  // 스트릭이 끊겨도 사라지지 않는 영구 배지 기록 — 다이어리 "내 배지" 섹션에서 사용
  const [earnedTiers, setEarnedTiers] = useState<EarnedTier[]>([]);

  useEffect(() => {
    const savedBm = localStorage.getItem('saju_bookmarks');
    if (savedBm) { try { setBookmarks(JSON.parse(savedBm)); } catch {} }
  }, []);

  useEffect(() => {
    const { count, newTier } = recordTodayVisitAndGetStreak(todayDateStr());
    setStreakCount(count);
    setEarnedTiers(getEarnedTiers());
    if (newTier) {
      showToast(`${newTier.emoji} ${newTier.days}일 연속 방문 달성! "${newTier.label}" 배지를 획득했어요`);
      trackEvent('streak_milestone', { days: newTier.days, tier: newTier.label });
    }
  }, []);

  // 💡 기능 가이드 팝업 — 온보딩(최초 1회, ONBOARDING_SEEN_KEY)과 별개로 하루에 한 번만
  // 자동으로 뜨는 기능 소개. 오늘 이미 떴으면(GUIDE_LAST_SHOWN_KEY===오늘) 다시 안 띄우고,
  // 팝업 안의 토글로 꺼두면(GUIDE_DAILY_ENABLED_KEY==='false') 자동으로는 아예 안 뜬다 —
  // 헤더의 "가이드" 버튼으로 언제든 수동으로 다시 볼 수 있음(handleOpenGuide).
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [guideDailyEnabled, setGuideDailyEnabled] = useState(() => localStorage.getItem(GUIDE_DAILY_ENABLED_KEY) !== 'false');
  // 결과 화면에 처음 도달했을 때 딱 1회만 보여주는 "어디부터 볼지" 안내 배너.
  const [showResultHint, setShowResultHint] = useState(() => !localStorage.getItem(RESULT_HINT_SEEN_KEY));

  useEffect(() => {
    if (localStorage.getItem(GUIDE_DAILY_ENABLED_KEY) === 'false') return;
    const today = todayDateStr();
    if (localStorage.getItem(GUIDE_LAST_SHOWN_KEY) === today) return;
    localStorage.setItem(GUIDE_LAST_SHOWN_KEY, today);
    setGuideModalOpen(true);
  }, []);

  const handleOpenGuide = () => {
    setGuideDailyEnabled(localStorage.getItem(GUIDE_DAILY_ENABLED_KEY) !== 'false');
    setGuideModalOpen(true);
    trackEvent('guide_opened');
  };

  const handleToggleGuideDaily = () => {
    const next = !guideDailyEnabled;
    setGuideDailyEnabled(next);
    localStorage.setItem(GUIDE_DAILY_ENABLED_KEY, next ? 'true' : 'false');
  };

  // 💑 궁합 초대 링크(?invite=...)로 들어왔는지 확인. 있으면 상태에 저장하고 URL에서는 바로
  // 제거(주소창/방문 기록에 남지 않게, main.tsx의 devkey 처리와 동일한 패턴).
  useEffect(() => {
    const inviteParam = new URLSearchParams(window.location.search).get('invite');
    if (!inviteParam) return;
    const decoded = decodeCompatInvite(inviteParam);
    const url = new URL(window.location.href);
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', url.toString());
    if (decoded) {
      setCompatInvite(decoded);
      trackEvent('invite_link_opened');
    }
  }, []);

  // 클라우드 동기화(선택 기능): 로그인 상태 구독 + 로그인 시 로컬↔클라우드 다이어리 기록 병합
  // Firebase Auth+Firestore 청크(~660KB)는 절대 다수인 비로그인 사용자에게도 매번 즉시
  // 받아지고 있었음(모바일 저속망에서 첫 화면 표시와 대역폭을 다투는 원인) — window의
  // load 이벤트(핵심 리소스 로드 완료) 이후로 미뤄서 초기 로딩 경로에서 완전히 빼냄.
  // main.tsx의 서비스워커 등록도 동일한 패턴(load 이후 등록)을 이미 쓰고 있음.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const start = () => {
      loadCloudSync().then(mod => {
        if (cancelled) return;
        setCloudSyncAvailable(mod.cloudSyncAvailable);
        unsubscribe = mod.subscribeToAuthState(async (user) => {
          setCurrentUser(user);
          if (!user) {
            setCreditBalance(null);
            return;
          }
          if (CREDIT_GATE_ENABLED) {
            fetchCreditBalance(user).then(r => { if (r.ok) setCreditBalance(r.credits); });
            initPurchases(user.uid);
          }
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
    };

    if (document.readyState === 'complete') {
      start();
    } else {
      window.addEventListener('load', start, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('load', start);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleToggleNotifications = async () => {
    setNotificationsLoading(true);
    try {
      if (notificationsEnabled) {
        await disableDailyNotification();
        setNotificationsEnabled(false);
        showToast('매일 알림을 껐어요');
      } else {
        const granted = await enableDailyNotification(notificationHour);
        setNotificationsEnabled(granted);
        showToast(granted ? `매일 ${notificationHour}시에 알려드릴게요 🔔` : '알림 권한이 허용되지 않았어요');
      }
    } catch (err: any) {
      showToast(`알림 설정 실패: ${err?.message ?? '알 수 없는 오류'}`);
    } finally {
      setNotificationsLoading(false);
    }
  };

  // 알림 시간 변경 — 이미 켜져 있으면 새 시각으로 즉시 재예약, 꺼져 있으면 값만 저장해뒀다가 다음에 켤 때 반영
  const handleChangeNotificationHour = async (hour: number) => {
    setNotificationHour(hour);
    if (!notificationsEnabled) return;
    setNotificationsLoading(true);
    try {
      const granted = await enableDailyNotification(hour);
      setNotificationsEnabled(granted);
      showToast(granted ? `알림 시각을 ${hour}시로 변경했어요 🔔` : '알림 권한이 허용되지 않았어요');
    } catch (err: any) {
      showToast(`알림 시각 변경 실패: ${err?.message ?? '알 수 없는 오류'}`);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      const mod = await loadCloudSync();
      await mod.signInWithGoogle();
      showToast('로그인되었습니다 ☁️');
      trackEvent('sign_in', { method: 'google' });
    } catch (err: any) {
      showToast(`로그인 실패: ${err?.message ?? '알 수 없는 오류'}`);
    }
  };

  const handleSignInApple = async () => {
    try {
      const mod = await loadCloudSync();
      await mod.signInWithApple();
      showToast('로그인되었습니다 ☁️');
      trackEvent('sign_in', { method: 'apple' });
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

  // ─── 심화해석 6종 크레딧제 ───────────────────────────────────────────
  // 심화해석 버튼 핸들러(handleGenerate*Deep) 맨 앞에서 호출한다. 로그인이 안 돼 있으면
  // 로그인 유도 모달, 크레딧이 0이면 결제 모달을 띄우고 false를 반환 — 호출부는 이미
  // `if (!result) return null` 같은 이른 반환 관례를 쓰고 있어 자연스럽게 이어붙는다.
  const ensureCreditForDeepGeneration = useCallback(async (): Promise<boolean> => {
    if (!CREDIT_GATE_ENABLED) return true; // 킬스위치 꺼짐 — 기존처럼 완전 무료·비로그인으로 동작
    if (!currentUser) {
      setShowLoginGateModal(true);
      return false;
    }
    const r = await consumeCredit(currentUser);
    if (!r.ok) {
      if (r.reason === 'LOGIN_REQUIRED') {
        setShowLoginGateModal(true);
      } else {
        setShowPaywallModal(true);
      }
      return false;
    }
    setCreditBalance(r.credits);
    return true;
  }, [currentUser]);

  // 토스페이먼츠 결제창에서 돌아왔을 때(웹 전용) 최초 1회 승인 요청 처리.
  useEffect(() => {
    if (!CREDIT_GATE_ENABLED) return;
    const params = readTossReturnParams();
    if (!params || !currentUser) return;
    (async () => {
      try {
        const idToken = await currentUser.getIdToken();
        const res = await fetch(`${DEPLOY_ORIGIN}/api/toss-confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (res.ok) {
          showToast(`크레딧 ${data.credits}개가 충전됐어요 🎉`);
          const balance = await fetchCreditBalance(currentUser);
          if (balance.ok) setCreditBalance(balance.credits);
        } else {
          showToast(`결제 확인에 실패했어요: ${data?.error?.message ?? '알 수 없는 오류'}`);
        }
      } catch (err: any) {
        showToast(`결제 확인 중 오류가 발생했어요: ${err?.message ?? '알 수 없는 오류'}`);
      } finally {
        clearTossReturnParams();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const handlePurchaseCreditsNative = async (identifier: string) => {
    setPaywallLoading(true);
    try {
      const started = await purchaseCreditPackage(identifier);
      if (started && currentUser) {
        // RevenueCat 웹훅(api/revenuecat-webhook.ts)이 비동기로 크레딧을 반영하므로 약간의
        // 지연 후 재조회 — 아직 반영 전이면 사용자가 결제 모달을 닫고 다시 열 때 다시 갱신됨.
        setTimeout(async () => {
          const balance = await fetchCreditBalance(currentUser);
          if (balance.ok) { setCreditBalance(balance.credits); showToast(`크레딧이 충전됐어요 🎉`); }
        }, 2000);
        setShowPaywallModal(false);
      }
    } finally {
      setPaywallLoading(false);
    }
  };

  const handlePurchaseCreditsWeb = async (option: CreditPriceOption) => {
    setPaywallLoading(true);
    try {
      await requestTossPayment(option); // 페이지 이동 — 성공 시 위 useEffect가 이어받음
    } catch (err: any) {
      showToast(err?.message ?? '결제를 시작하지 못했어요.');
    } finally {
      setPaywallLoading(false);
    }
  };

  // 풍수 수리 가이드 / 운세 해설 캐시 로드
  useEffect(() => {
    if (!result) { setFengShuiText(null); setUnseText(null); setFengShuiDeepText(null); setUnseDeepText(null); return; }
    setFengShuiText(localStorage.getItem(fengShuiCacheKey(result.formData)));
    setUnseText(localStorage.getItem(unseCacheKey(result.formData, new Date().getFullYear())));
    setFengShuiDeepText((v => isStaleDeepFallbackText(v) ? null : v)(localStorage.getItem(fengShuiDeepCacheKey(result.formData))));
    setUnseDeepText((v => isStaleDeepFallbackText(v) ? null : v)(localStorage.getItem(unseDeepCacheKey(result.formData, new Date().getFullYear()))));
  }, [result]);

  // 💑 정밀 궁합 "이전에 비교한 상대" 이력 로드
  useEffect(() => {
    setPairCompatHistory(result ? getPairCompatHistory(result.formData) : []);
  }, [result]);

  // 🌟 귀인지도 — 이력에 있는 상대마다 오행 상생상극 관계를 다시 계산(순수 계산이라 API 호출 없음)해
  // 게임화 라벨(GWIIN_TYPE_META)을 입힌 노드 목록을 만든다. 정밀 궁합 계산 자체와 동일한 방식
  // (handleComparePair 참고: 시간 모름으로 간주)으로 상대 사주를 산출해 일관성을 맞춤.
  const gwiinNodes: GwiinMapNode[] = useMemo(() => {
    if (!result) return [];
    return pairCompatHistory.map((entry): GwiinMapNode | null => {
      const py = parseInt(entry.partnerBirthYear);
      const pm = parseInt(entry.partnerBirthMonth);
      const pd = parseInt(entry.partnerBirthDay);
      if (!py || !pm || !pd) return null;
      const sajuB = calculateSaju(py, pm, pd, '오시', entry.partnerGender, true);
      const rel = comparePillars(result.sajuResult, sajuB);
      const type = GWIIN_TYPE_META[rel.dayStemRelation];
      return {
        id: `${entry.partnerName}_${entry.partnerBirthYear}${entry.partnerBirthMonth}${entry.partnerBirthDay}_${entry.partnerGender}`,
        name: entry.partnerName,
        genderEmoji: entry.partnerGender === 'male' ? '🌊' : '🌸',
        type,
        detail: STEM_RELATION_LABEL[rel.dayStemRelation],
        score: getGwiinScore(rel),
      };
    }).filter((n): n is GwiinMapNode => n !== null);
  }, [result, pairCompatHistory]);

  // AI 해석 4개 카테고리 + 처방전 캐시 로드
  useEffect(() => {
    if (!result) { setCategoryData({}); setCategoryDeepData({}); setPrescriptionsData(null); return; }
    const loaded: Partial<Record<AiCategoryKey, CategoryInterpretation>> = {};
    const loadedDeep: Partial<Record<AiCategoryKey, string>> = {};
    (['personality', 'career', 'romance', 'wealth'] as AiCategoryKey[]).forEach(cat => {
      const cached = localStorage.getItem(categoryCacheKey(result.formData, result.formData.mbti, cat));
      if (cached) { try { loaded[cat] = JSON.parse(cached); } catch {} }
      const cachedDeep = localStorage.getItem(categoryDeepCacheKey(result.formData, result.formData.mbti, cat));
      if (cachedDeep && !isStaleDeepFallbackText(cachedDeep)) loadedDeep[cat] = cachedDeep;
    });
    setCategoryData(loaded);
    setCategoryDeepData(loadedDeep);

    const cachedPrescriptions = localStorage.getItem(prescriptionsCacheKey(result.formData, result.formData.mbti));
    if (cachedPrescriptions) {
      try { setPrescriptionsData(JSON.parse(cachedPrescriptions)); } catch { setPrescriptionsData(null); }
    } else {
      setPrescriptionsData(null);
    }

    const cachedArchetype = localStorage.getItem(archetypeCacheKey(result.formData, result.formData.mbti));
    if (cachedArchetype) {
      try { setArchetypeData(JSON.parse(cachedArchetype)); } catch { setArchetypeData(null); }
    } else {
      setArchetypeData(null);
    }
  }, [result]);

  // 🗨️ AI 후속질문 대화 캐시 로드
  useEffect(() => {
    if (!result) { setChatMessages([]); return; }
    const cached = localStorage.getItem(chatCacheKey(result.formData));
    if (cached) { try { setChatMessages(JSON.parse(cached)); } catch { setChatMessages([]); } }
    else { setChatMessages([]); }
  }, [result]);

  // 오행/십신/격국/궁합 종합 해설 캐시 로드
  useEffect(() => {
    if (!result) {
      setElementSummaryText(null); setCompatSummaryText(null); setElementSummaryDeepText(null); setCompatSummaryDeepText(null);
      setSipsinSummaryText(null); setSipsinSummaryDeepText(null); setGyeokgukSummaryText(null); setGyeokgukSummaryDeepText(null);
      return;
    }
    setElementSummaryText(localStorage.getItem(elementSummaryCacheKey(result.formData)));
    setCompatSummaryText(localStorage.getItem(compatSummaryCacheKey(result.formData)));
    setElementSummaryDeepText((v => isStaleDeepFallbackText(v) ? null : v)(localStorage.getItem(elementSummaryDeepCacheKey(result.formData))));
    setCompatSummaryDeepText((v => isStaleDeepFallbackText(v) ? null : v)(localStorage.getItem(compatSummaryDeepCacheKey(result.formData))));
    setSipsinSummaryText(localStorage.getItem(sipsinSummaryCacheKey(result.formData)));
    setGyeokgukSummaryText(localStorage.getItem(gyeokgukSummaryCacheKey(result.formData)));
    setSipsinSummaryDeepText((v => isStaleDeepFallbackText(v) ? null : v)(localStorage.getItem(sipsinSummaryDeepCacheKey(result.formData))));
    setGyeokgukSummaryDeepText((v => isStaleDeepFallbackText(v) ? null : v)(localStorage.getItem(gyeokgukSummaryDeepCacheKey(result.formData))));
  }, [result]);

  // 🪐 별자리(서양점성술) AI 해설 캐시 로드
  useEffect(() => {
    if (!result) { setAstrologyData(null); setAstrologyDeepText(null); return; }
    const cached = localStorage.getItem(astrologyCacheKey(result.formData, result.formData.birthCity));
    if (cached) { try { setAstrologyData(JSON.parse(cached)); } catch { setAstrologyData(null); } }
    else { setAstrologyData(null); }
    setAstrologyDeepText((v => isStaleDeepFallbackText(v) ? null : v)(localStorage.getItem(astrologyDeepCacheKey(result.formData, result.formData.birthCity))));
  }, [result]);

  // 오늘의 나풀이(데일리 운세) 캐시 로드 (오늘 날짜 기준)
  useEffect(() => {
    if (!result) { setDailyFortuneData(null); return; }
    const cached = localStorage.getItem(dailyFortuneCacheKey(result.formData, todayDateStr()));
    if (cached) { try { setDailyFortuneData(JSON.parse(cached)); } catch { setDailyFortuneData(null); } }
    else { setDailyFortuneData(null); }
  }, [result]);

  // 🏠 나풀이의 방 — 사람별로 선택했던 방 변형(1~4) 로드, 없으면 기본 1
  useEffect(() => {
    if (!result) { setRoomVariant(1); return; }
    const cached = localStorage.getItem(roomVariantCacheKey(result.formData));
    const n = cached ? parseInt(cached, 10) : 1;
    setRoomVariant(n >= 1 && n <= 4 ? n : 1);
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

  // 🪐 별자리 행성/하우스 클릭 AI 심층 해설 캐시 로드 — 행성 7개 + 하우스 12개, 총 19개 키를 확인.
  useEffect(() => {
    if (!result) { setAstroPlacementAiData({}); return; }
    const loaded: Record<string, string> = {};
    const dataKeys = [
      ...result.astrologyResult.planets.map(p => `planet_${p.key}`),
      ...result.astrologyResult.houseSignIndexes.map((_, i) => `house_${i}`),
    ];
    dataKeys.forEach(k => {
      const cached = localStorage.getItem(astroPlacementCacheKey(result.formData, result.formData.birthCity, k));
      if (cached) loaded[k] = cached;
    });
    setAstroPlacementAiData(loaded);
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
      setCachedItem(categoryCacheKey(result.formData, result.formData.mbti, category, answers), JSON.stringify(data));
      trackEvent('content_generate', { feature: 'category', category });
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
    if (!(await ensureCreditForDeepGeneration())) return null;
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
      setCachedItem(categoryDeepCacheKey(result.formData, result.formData.mbti, category, answers), text);
      trackEvent('content_generate', { feature: 'category_deep', category });
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
      setCachedItem(prescriptionsCacheKey(result.formData, result.formData.mbti), JSON.stringify(data));
      trackEvent('content_generate', { feature: 'prescriptions' });
      return data;
    } catch (err: any) {
      showToast(`처방전 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setPrescriptionsLoading(false);
    }
  };

  // 🎭 나와 닮은 인물 AI 매칭카드 생성
  const handleGenerateArchetype = async (): Promise<ArchetypeMatch | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setArchetypeLoading(true);
    try {
      const data = await generateArchetypeMatch(
        GEMINI_API_KEY,
        result.formData.name,
        result.formData.gender,
        result.formData.mbti,
        result.sajuResult,
      );
      setArchetypeData(data);
      setCachedItem(archetypeCacheKey(result.formData, result.formData.mbti), JSON.stringify(data));
      trackEvent('content_generate', { feature: 'archetype' });
      return data;
    } catch (err: any) {
      showToast(`닮은 인물 매칭 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setArchetypeLoading(false);
    }
  };

  // 🗨️ AI 후속질문(채팅) 전송 — 최근 CHAT_CONTEXT_TURNS턴만 컨텍스트로 다시 실어 보냄
  const handleSendChatMessage = async () => {
    if (!result) return;
    const question = chatInput.trim();
    if (!question) return;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const userMsg: ChatMessage = { role: 'user', text: question };
    const withUserMsg = [...chatMessages, userMsg];
    setChatMessages(withUserMsg);
    setChatInput('');
    setChatLoading(true);
    try {
      const recentHistory = chatMessages.slice(-CHAT_CONTEXT_TURNS * 2);
      const answer = await generateFollowUpAnswer(
        GEMINI_API_KEY,
        result.formData.name,
        result.formData.gender,
        result.formData.mbti,
        result.sajuResult,
        recentHistory,
        question,
      );
      const updated = [...withUserMsg, { role: 'assistant', text: answer } as ChatMessage].slice(-CHAT_DISPLAY_LIMIT);
      setChatMessages(updated);
      setCachedItem(chatCacheKey(result.formData), JSON.stringify(updated));
      trackEvent('content_generate', { feature: 'chat_message' });
    } catch (err: any) {
      showToast(`답변 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      // 사용자 질문 자체는 화면에 남겨둬 무엇을 물어봤는지 보이게 하고, 다시 입력해 재시도하게 함
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearChat = () => {
    if (!result) return;
    setChatMessages([]);
    localStorage.removeItem(chatCacheKey(result.formData));
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
      setCachedItem(fengShuiCacheKey(result.formData), text);
      trackEvent('content_generate', { feature: 'fengshui' });
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
    if (!(await ensureCreditForDeepGeneration())) return null;
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
      setCachedItem(fengShuiDeepCacheKey(result.formData), text);
      trackEvent('content_generate', { feature: 'fengshui_deep' });
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
      setCachedItem(unseCacheKey(result.formData, nowYear), text);
      trackEvent('content_generate', { feature: 'fortune' });
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
    if (!(await ensureCreditForDeepGeneration())) return null;
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
      setCachedItem(unseDeepCacheKey(result.formData, nowYear), text);
      trackEvent('content_generate', { feature: 'fortune_deep' });
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
      setCachedItem(elementSummaryCacheKey(result.formData), text);
      trackEvent('content_generate', { feature: 'element_summary' });
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
    if (!(await ensureCreditForDeepGeneration())) return null;
    setElementSummaryDeepLoading(true);
    try {
      const text = await generateElementSummaryDeepInterpretation(GEMINI_API_KEY, result.formData.name, result.sajuResult);
      setElementSummaryDeepText(text);
      setCachedItem(elementSummaryDeepCacheKey(result.formData), text);
      trackEvent('content_generate', { feature: 'element_summary_deep' });
      return text;
    } catch (err: any) {
      showToast(`오행 종합 심화해석 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setElementSummaryDeepLoading(false);
    }
  };

  // 십신 종합 해설 AI 생성
  const handleGenerateSipsinSummary = async (): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setSipsinSummaryLoading(true);
    try {
      const text = await generateSipsinSummaryInterpretation(GEMINI_API_KEY, result.formData.name, result.sajuResult.sipsin);
      setSipsinSummaryText(text);
      setCachedItem(sipsinSummaryCacheKey(result.formData), text);
      trackEvent('content_generate', { feature: 'sipsin_summary' });
      return text;
    } catch (err: any) {
      showToast(`십신 종합 해설 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setSipsinSummaryLoading(false);
    }
  };

  // 십신 종합 심화해석(🔍 더보기) 생성
  const handleGenerateSipsinSummaryDeep = async (): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    if (!(await ensureCreditForDeepGeneration())) return null;
    setSipsinSummaryDeepLoading(true);
    try {
      const text = await generateSipsinSummaryDeepInterpretation(GEMINI_API_KEY, result.formData.name, result.sajuResult);
      setSipsinSummaryDeepText(text);
      setCachedItem(sipsinSummaryDeepCacheKey(result.formData), text);
      trackEvent('content_generate', { feature: 'sipsin_summary_deep' });
      return text;
    } catch (err: any) {
      showToast(`십신 종합 심화해석 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setSipsinSummaryDeepLoading(false);
    }
  };

  // 격국 해설 AI 생성
  const handleGenerateGyeokgukSummary = async (): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setGyeokgukSummaryLoading(true);
    try {
      const text = await generateGyeokgukInterpretation(GEMINI_API_KEY, result.formData.name, result.sajuResult.gyeokguk);
      setGyeokgukSummaryText(text);
      setCachedItem(gyeokgukSummaryCacheKey(result.formData), text);
      trackEvent('content_generate', { feature: 'gyeokguk_summary' });
      return text;
    } catch (err: any) {
      showToast(`격국 해설 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setGyeokgukSummaryLoading(false);
    }
  };

  // 격국 심화해석(🔍 더보기) 생성
  const handleGenerateGyeokgukSummaryDeep = async (): Promise<string | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    if (!(await ensureCreditForDeepGeneration())) return null;
    setGyeokgukSummaryDeepLoading(true);
    try {
      const text = await generateGyeokgukDeepInterpretation(GEMINI_API_KEY, result.formData.name, result.sajuResult);
      setGyeokgukSummaryDeepText(text);
      setCachedItem(gyeokgukSummaryDeepCacheKey(result.formData), text);
      trackEvent('content_generate', { feature: 'gyeokguk_summary_deep' });
      return text;
    } catch (err: any) {
      showToast(`격국 심화해석 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setGyeokgukSummaryDeepLoading(false);
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
      setCachedItem(compatSummaryCacheKey(result.formData), text);
      trackEvent('content_generate', { feature: 'compat_summary' });
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
    if (!(await ensureCreditForDeepGeneration())) return null;
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
      setCachedItem(compatSummaryDeepCacheKey(result.formData), text);
      trackEvent('content_generate', { feature: 'compat_summary_deep' });
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
      setCachedItem(astrologyCacheKey(result.formData, result.formData.birthCity), JSON.stringify(data));
      trackEvent('content_generate', { feature: 'astrology' });
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
    if (!(await ensureCreditForDeepGeneration())) return null;
    setAstrologyDeepLoading(true);
    try {
      const text = await generateAstrologyDeepInterpretation(GEMINI_API_KEY, result.formData.name, result.formData.gender, result.astrologyResult);
      setAstrologyDeepText(text);
      setCachedItem(astrologyDeepCacheKey(result.formData, result.formData.birthCity), text);
      trackEvent('content_generate', { feature: 'astrology_deep' });
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
    setTransitFailed(false);
    try {
      const { calculateTodayTransits } = await import('./utils/astrologyCalculator');
      const transits = calculateTodayTransits(result.astrologyResult);
      const data = await generateTransitInterpretation(GEMINI_API_KEY, result.formData.name, result.formData.gender, result.astrologyResult, transits);
      setTransitData(data);
      const dateStr = todayDateStr();
      setCachedItem(transitCacheKey(result.formData, result.formData.birthCity, dateStr), JSON.stringify(data));
      trackEvent('content_generate', { feature: 'transit' });
      return data;
    } catch (err: any) {
      showToast(isChunkLoadError(err)
        ? '네트워크 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.'
        : `오늘의 트랜짓 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      setTransitFailed(true);
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
    setTarotFailed(false);
    try {
      const dateStr = todayDateStr();
      const seed = `${result.formData.name}_${result.formData.birthYear}${result.formData.birthMonth}${result.formData.birthDay}_${dateStr}`;
      const { card, reversed } = drawDailyTarotCard(seed);
      const text = await generateTarotInterpretation(GEMINI_API_KEY, result.formData.name, result.formData.gender, result.formData.mbti, card, reversed);
      setTarotData(text);
      setCachedItem(tarotCacheKey(result.formData, dateStr), text);
      addBookmark('오늘의 타로', `${dateStr} 오늘의 타로 · ${card.name}(${reversed ? '역방향' : '정방향'})`, text);
      trackEvent('content_generate', { feature: 'tarot' });
      return text;
    } catch (err: any) {
      showToast(`오늘의 타로 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      setTarotFailed(true);
      return null;
    } finally {
      setTarotLoading(false);
    }
  };

  // 💑 정밀 궁합(실제 2인 비교) — 상대방 생년월일로 실제 사주를 산출해 비교.
  // override를 주면 폼 state 대신 그 값을 사용 — "이전에 비교한 상대" 이력에서 바로 재조회할 때,
  // setState 직후 같은 틱에 최신 값을 곧바로 읽을 수 없는 React state 타이밍 문제를 피하기 위함.
  const handleComparePair = async (override?: {
    partnerName: string; partnerBirthYear: string; partnerBirthMonth: string; partnerBirthDay: string; partnerGender: string;
  }) => {
    if (!result) return;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const pName = override?.partnerName ?? partnerName;
    const pBirthYear = override?.partnerBirthYear ?? partnerBirthYear;
    const pBirthMonth = override?.partnerBirthMonth ?? partnerBirthMonth;
    const pBirthDay = override?.partnerBirthDay ?? partnerBirthDay;
    const pGender = override?.partnerGender ?? partnerGender;

    if (!pName.trim()) { showToast('상대방 이름을 입력해 주세요!'); return; }
    const py = parseInt(pBirthYear);
    const pm = parseInt(pBirthMonth);
    const pd = parseInt(pBirthDay);
    if (!py || !pm || !pd) { showToast('상대방 생년월일을 모두 입력해 주세요!'); return; }
    const parsedDate = new Date(py, pm - 1, pd);
    const isRealDate = parsedDate.getFullYear() === py && parsedDate.getMonth() === pm - 1 && parsedDate.getDate() === pd;
    if (!isRealDate) { showToast('상대방의 생년월일이 존재하지 않는 날짜예요. 다시 확인해 주세요!'); return; }

    setPairCompatLoading(true);
    try {
      const sajuB = calculateSaju(py, pm, pd, '오시', pGender, true);
      const compare = comparePillars(result.sajuResult, sajuB);
      setPairSajuB(sajuB);
      setPairCompare(compare);

      // 8-1: 이 상대와 비교했다는 사실을 이력에 남겨서, 다음에 "이전에 비교한 상대" 목록에서
      // 폼을 다시 입력하지 않고 바로 다시 볼 수 있게 함(성공/실패와 무관하게, 시도한 조합 자체를 기록).
      addPairCompatHistoryEntry(result.formData, { partnerName: pName, partnerBirthYear: pBirthYear, partnerBirthMonth: pBirthMonth, partnerBirthDay: pBirthDay, partnerGender: pGender });
      setPairCompatHistory(getPairCompatHistory(result.formData));

      // 같은 상대와 이미 비교해본 적 있으면 캐시를 재사용(API 재호출 없이 바로 표시)
      const cacheKey = pairCompatCacheKey(result.formData, pName, pBirthYear, pBirthMonth, pBirthDay, pGender);
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
        pName, pGender, sajuB,
        compare,
      );
      setPairCompatText(text);
      setCachedItem(cacheKey, JSON.stringify({ text, sajuB, compare }));
      addBookmark('정밀 궁합', `${result.formData.name}님 × ${pName}님 정밀 궁합`, text);
      trackEvent('content_generate', { feature: 'pair_compat' });
    } catch (err: any) {
      showToast(`정밀 궁합 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      // 비교 자체(일주 산출·이력 기록)는 이미 끝난 뒤라, AI 해설만 실패해도 폼을 닫아 귀인지도/이전
      // 이력으로 돌아갈 수 있게 함 — 안 닫으면 폼이 그대로 남아 사용자가 다시 시도할 방법이 새로고침뿐이었음.
      setPartnerFormOpen(false);
    } finally {
      setPairCompatLoading(false);
    }
  };

  // 8-1: 이력에서 이전에 비교한 상대를 골라 폼 입력 없이 바로 다시 비교(캐시가 있으면 API 재호출 없이 즉시 표시됨)
  const handleReopenPairCompatHistory = (entry: PairCompatHistoryEntry) => {
    setPartnerName(entry.partnerName);
    setPartnerBirthYear(entry.partnerBirthYear);
    setPartnerBirthMonth(entry.partnerBirthMonth);
    setPartnerBirthDay(entry.partnerBirthDay);
    setPartnerGender(entry.partnerGender);
    setPartnerFormOpen(true);
    void handleComparePair(entry);
  };

  // 💑 궁합 초대 링크 생성 + 공유 — 내 생년월일을 URL에 담아 보내면, 링크를 연 상대방은
  // 자기 정보만 입력하고 바로 나와의 정밀 궁합을 보게 됨(7-AI 참고).
  const handleShareCompatInvite = async () => {
    if (!result) return;
    const invite: CompatInvite = {
      name: result.formData.name,
      birthYear: result.formData.birthYear,
      birthMonth: result.formData.birthMonth,
      birthDay: result.formData.birthDay,
      gender: result.formData.gender,
    };
    const base = window.location.href.includes('localhost') ? DEPLOY_ORIGIN : window.location.origin;
    // base64 인코딩 결과에 +/=/ 같은 문자가 섞일 수 있어(실측 확인됨), 쿼리 파라미터 값으로
    // 그대로 이어붙이면 안 되고 반드시 encodeURIComponent로 한 번 더 감싸야 함 —
    // 특히 "+"는 쿼리스트링에서 공백으로 잘못 해석되어 링크가 깨짐.
    const inviteUrl = `${base}/?invite=${encodeURIComponent(encodeCompatInvite(invite))}`;
    const shareText = `${result.formData.name}님이 나풀이에서 궁합을 보자고 초대했어요! 내 정보만 입력하면 바로 결과를 볼 수 있어요 🔮`;

    const nav = navigator as any;
    if (nav.share) {
      try {
        await nav.share({ title: '나풀이 궁합 초대', text: shareText, url: inviteUrl });
        trackEvent('invite_link_created', { method: 'native_share' });
        return;
      } catch {
        // 공유 취소/실패 시 클립보드 복사로 대체
      }
    }
    setInviteLinkCopying(true);
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showToast('궁합 초대 링크가 복사되었어요! 친구에게 보내보세요 🔗');
      trackEvent('invite_link_created', { method: 'clipboard' });
    } catch {
      showToast('링크 복사에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setInviteLinkCopying(false);
    }
  };

  // 💑 궁합 초대 링크로 들어온 상태에서 내 결과가 준비되면, 상대방(초대한 사람) 정보를 자동으로
  // 채우고 정밀 궁합을 바로 보여준다. result가 setResult() 직후의 같은 틱에서는 아직 최신값이
  // 아니므로(React state 비동기 특성 — 6-A-2와 동일한 이유) result 변화를 구독하는 effect로 처리.
  useEffect(() => {
    if (!result || !compatInvite) return;
    setActiveSection('saju');
    setActiveSajuTab('compat');
    setPartnerName(compatInvite.name);
    setPartnerBirthYear(compatInvite.birthYear);
    setPartnerBirthMonth(compatInvite.birthMonth);
    setPartnerBirthDay(compatInvite.birthDay);
    setPartnerGender(compatInvite.gender);
    setPartnerFormOpen(true);
    void handleComparePair({
      partnerName: compatInvite.name,
      partnerBirthYear: compatInvite.birthYear,
      partnerBirthMonth: compatInvite.birthMonth,
      partnerBirthDay: compatInvite.birthDay,
      partnerGender: compatInvite.gender,
    });
    trackEvent('invite_redeemed');
    setCompatInvite(null); // 한 번만 실행되도록 소모
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, compatInvite]);

  // 오늘의 나풀이(데일리 운세) 생성 — 일주와 오늘 일진의 관계를 바탕으로 한 짧은 오늘의 한마디 + 팩폭 한줄
  const handleGenerateDailyFortune = async (): Promise<DailyFortune | null> => {
    if (!result) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setDailyFortuneLoading(true);
    setDailyFortuneFailed(false);
    try {
      const today = new Date();
      const todayPillar = calcDayPillar(today.getFullYear(), today.getMonth() + 1, today.getDate());
      const todayAnimal = EARTHLY_BRANCHES[todayPillar.branchIdx].animal;
      const data = await generateDailyFortune(
        GEMINI_API_KEY,
        result.formData.name,
        result.formData.mbti,
        result.sajuResult.dayStem,
        result.sajuResult.dayStemElement,
        result.sajuResult.elementCounts,
        result.formData.hourUnknown ? null : result.hourBranch.name,
        todayPillar.text,
        todayPillar.hanjaText,
        todayAnimal,
      );
      setDailyFortuneData(data);
      const dateStr = todayDateStr();
      setCachedItem(dailyFortuneCacheKey(result.formData, dateStr), JSON.stringify(data));
      addBookmark('오늘의 나풀이', `${dateStr} 오늘의 나풀이`, `${data.analysis}\n\n${data.factBomb}`);
      trackEvent('content_generate', { feature: 'daily_fortune' });
      return data;
    } catch (err: any) {
      showToast(`오늘의 나풀이 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      setDailyFortuneFailed(true);
      return null;
    } finally {
      setDailyFortuneLoading(false);
    }
  };

  // 사주 4기둥 클릭 → AI 심층 해설 모달 열기
  const handlePillarClick = (key: PillarKey, label: string, pillar: Pillar, staticDesc?: string) => {
    setSelectedModal(null);
    setPillarModal({ key, label, hanjaText: pillar.hanjaText, koreanText: pillar.text, branchIdx: pillar.branchIdx, staticDesc });
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
      setCachedItem(pillarCacheKey(result.formData, pillarModal.key), text);
      trackEvent('content_generate', { feature: 'pillar_deep', pillar: pillarModal.key });
      return text;
    } catch (err: any) {
      showToast(`기둥 해설 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setPillarAiLoading(false);
    }
  };

  // 🪐 별자리 행성 클릭 → AI 심층 해설 모달 열기(정적 좋을때/나쁠때/상징인물 설명은 즉시 표시)
  const handleAstroPlanetClick = (planetKey: PlanetKey) => {
    if (!result) return;
    const p = result.astrologyResult.planets.find(x => x.key === planetKey);
    if (!p) return;
    const info = PLANETS.find(x => x.key === planetKey)!;
    const sign = ZODIAC_SIGNS[p.signIndex];
    const dignityLabel = p.dignity ? DIGNITY_LABEL[p.dignity] : null;
    setSelectedModal(null);
    setAstroModal({
      dataKey: `planet_${planetKey}`,
      title: `${info.emoji} ${info.name} · ${sign.name} ${p.houseIndex + 1}하우스`,
      staticDesc: `✨ 좋을 때: ${info.goodMeaning}\n⚠️ 나쁠 때: ${info.badMeaning}\n👤 상징 인물: ${info.person}${dignityLabel ? `\n📐 품위: ${dignityLabel}` : ''}`,
    });
  };

  // 🪐 별자리 하우스 클릭 → AI 심층 해설 모달 열기
  const handleAstroHouseClick = (houseIndex: number) => {
    if (!result) return;
    const house = HOUSES[houseIndex];
    const sign = ZODIAC_SIGNS[result.astrologyResult.houseSignIndexes[houseIndex]];
    setSelectedModal(null);
    setAstroModal({
      dataKey: `house_${houseIndex}`,
      title: `${houseIndex + 1}하우스 · ${sign.name}`,
      staticDesc: `${house.meaning}\n${house.strength}${house.favorability ? ` · ${house.favorability}` : ''}`,
    });
  };

  const handleGenerateAstroPlacementAi = async (): Promise<string | null> => {
    if (!result || !astroModal) return null;
    if (!GEMINI_API_KEY) {
      showToast('나풀이 해석 기능이 현재 비활성화되어 있습니다. 잠시 후 다시 시도해 주세요.');
      return null;
    }
    setAstroPlacementAiLoading(true);
    try {
      const [kind, rawKey] = astroModal.dataKey.split('_');
      let text: string;
      if (kind === 'planet') {
        const planetKey = rawKey as PlanetKey;
        const p = result.astrologyResult.planets.find(x => x.key === planetKey)!;
        const info = PLANETS.find(x => x.key === planetKey)!;
        const sign = ZODIAC_SIGNS[p.signIndex];
        text = await generatePlanetPlacementInterpretation(
          GEMINI_API_KEY, result.formData.name, result.formData.mbti,
          info.name, sign.name, p.houseIndex + 1, HOUSES[p.houseIndex].meaning,
          p.dignity ? DIGNITY_LABEL[p.dignity] : null,
        );
      } else {
        const houseIndex = Number(rawKey);
        const sign = ZODIAC_SIGNS[result.astrologyResult.houseSignIndexes[houseIndex]];
        const planetsInHouse = result.astrologyResult.planets
          .filter(p => p.houseIndex === houseIndex)
          .map(p => `${PLANETS.find(x => x.key === p.key)!.emoji} ${PLANETS.find(x => x.key === p.key)!.name}`);
        text = await generateHousePlacementInterpretation(
          GEMINI_API_KEY, result.formData.name, result.formData.mbti,
          houseIndex + 1, HOUSES[houseIndex].meaning, sign.name, planetsInHouse,
        );
      }
      setAstroPlacementAiData(prev => ({ ...prev, [astroModal.dataKey]: text }));
      setCachedItem(astroPlacementCacheKey(result.formData, result.formData.birthCity, astroModal.dataKey), text);
      trackEvent('content_generate', { feature: 'astro_placement', kind });
      return text;
    } catch (err: any) {
      showToast(`별자리 해설 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      return null;
    } finally {
      setAstroPlacementAiLoading(false);
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
      ? `${DEPLOY_ORIGIN}/`
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
      trackEvent('share', { method: 'kakao' });
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

      // MBTI 유형별 나풀이 캐릭터 일러스트(미드저니 제작) — 실패 시 기존 이모지 배지로 조용히 대체
      const mbtiCharacterImage = await loadCanvasImage(`/gwiin/mbti/${result.formData.mbti.toLowerCase()}.webp`).catch(() => null);

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

      // MBTI 유형 캐릭터 원형 배지 — 이미지 로드 성공 시 나풀이 캐릭터, 실패 시 기존 이모지로 대체
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
      if (mbtiCharacterImage) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(badgeCx, badgeCy, badgeR - 4, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(mbtiCharacterImage, badgeCx - (badgeR - 4), badgeCy - (badgeR - 4), (badgeR - 4) * 2, (badgeR - 4) * 2);
        ctx.restore();
      } else {
        ctx.font = `400 88px ${fontStack}`;
        ctx.fillText(MBTI_DATA[result.formData.mbti]?.emoji ?? '✨', badgeCx, badgeCy + 32);
      }

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
      ctx.fillText(DEPLOY_DOMAIN, W / 2, H - 100);

      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('이미지 생성에 실패했습니다.');

      const fileName = `${result.formData.name}_사주카드.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: '나풀이 사주 × MBTI 카드' });
          trackEvent('share', { method: 'native_share', content: 'profile_card' });
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
      trackEvent('download', { content: 'profile_card' });
    } catch (err: any) {
      showToast(`이미지 카드 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
    } finally {
      setImageCardGenerating(false);
    }
  };

  // 오늘의 타로 / 나와 닮은 인물처럼 "카드 한 장" 형태의 개별 결과를 이미지로 공유하는 공용 함수.
  // 메인 프로필 카드(handleDownloadImageCard)와 같은 브랜드 크롬(상단 워터마크·하단 도메인)을
  // 재사용하되, 중앙에는 카드 하나(이모지 메달리온 + 이름 + 부제 + 배지 + 본문)만 크게 담는다.
  const handleDownloadPersonaCard = async (opts: {
    kind: 'tarot' | 'archetype' | 'streak';
    kicker: string;
    emoji: string;
    emojiRotated?: boolean;
    name: string;
    subtitle: string;
    badge: string;
    bodyText: string;
    accent: string;
    accentDark: string;
    fileName: string;
    shareTitle: string;
    sparkle?: number; // 0~4, 등급이 있는 카드(스트릭 배지 등)에서 티어가 높을수록 장식을 더 화려하게
    imageUrl?: string; // 있으면 원형 이모지 메달리온 대신 실제 카드 이미지를 세로 카드 모양으로 그림(오늘의 타로용)
  }) => {
    if (!result) return;
    setPersonaImageGenerating(opts.kind);
    try {
      const cardImage = opts.imageUrl ? await loadCanvasImage(opts.imageUrl).catch(() => null) : null;
      const W = 1080;
      const H = 1920;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('캔버스를 생성할 수 없습니다.');

      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#1a0b2e');
      bgGrad.addColorStop(0.55, '#0f0620');
      bgGrad.addColorStop(1, '#050510');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

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

      // 실제 카드 이미지가 있는 경우(오늘의 타로)는 카드 자체를 훨씬 크게 키우기 위해
      // 레이아웃 좌표 전체를 별도로 잡음 — 이모지 원형 배지(닮은 인물·스트릭 배지)는 기존 좌표 그대로.
      const layout = cardImage
        ? { kickerY: 140, nameY: 205, badgeCy: 545, cardW: 310, cardH: 537, resultNameY: 855, subtitleY: 893, badgeBoxY: 925, badgeTextY: 958, bodyBoxTop: 1040 }
        : { kickerY: 170, nameY: 260, badgeCy: 460, cardW: 0, cardH: 0, resultNameY: 700, subtitleY: 740, badgeBoxY: 775, badgeTextY: 809, bodyBoxTop: 900 };

      ctx.fillStyle = 'rgba(245, 200, 66, 0.85)';
      ctx.font = `600 32px ${fontStack}`;
      ctx.fillText(`🔮 나풀이 · ${opts.kicker}`, W / 2, layout.kickerY);

      ctx.fillStyle = '#f0eeff';
      ctx.font = `700 44px ${fontStack}`;
      ctx.fillText(`${result.formData.name}님`, W / 2, layout.nameY);

      // 메달리온 — 실제 카드 이미지가 있으면(오늘의 타로) 원형 배경은 생략(사각 카드와 겹쳐 지저분해짐)
      const badgeCx = W / 2;
      const badgeCy = layout.badgeCy;
      const badgeR = 130;
      if (!cardImage) {
        const badgeGrad = ctx.createRadialGradient(badgeCx - 35, badgeCy - 40, 15, badgeCx, badgeCy, badgeR);
        badgeGrad.addColorStop(0, opts.accent);
        badgeGrad.addColorStop(0.55, opts.accent);
        badgeGrad.addColorStop(1, opts.accentDark);
        ctx.save();
        ctx.shadowColor = opts.accent;
        ctx.shadowBlur = 55;
        ctx.fillStyle = badgeGrad;
        ctx.beginPath();
        ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      if (cardImage) {
        // 오늘의 타로 — 실제 카드 스캔 이미지를 세로 카드 모양(둥근 모서리)으로 그림(500:866 비율 유지)
        const cardW = layout.cardW;
        const cardH = layout.cardH;
        ctx.translate(badgeCx, badgeCy);
        if (opts.emojiRotated) ctx.rotate(Math.PI);
        ctx.beginPath();
        (ctx as any).roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 14);
        ctx.save();
        ctx.clip();
        ctx.drawImage(cardImage, -cardW / 2, -cardH / 2, cardW, cardH);
        ctx.restore();
        ctx.lineWidth = 3;
        ctx.strokeStyle = opts.accent;
        ctx.stroke();
      } else {
        ctx.font = `400 120px ${fontStack}`;
        if (opts.emojiRotated) {
          ctx.translate(badgeCx, badgeCy + 45);
          ctx.rotate(Math.PI);
          ctx.fillText(opts.emoji, 0, 0);
        } else {
          ctx.fillText(opts.emoji, badgeCx, badgeCy + 45);
        }
      }
      ctx.restore();

      // 티어별 화려함 단계(0~4) — 등급이 있는 카드(스트릭 배지 등)에서 티어가 높을수록
      // 메달리온 주변 링/반짝임을 더해 "성장하는" 느낌을 줌(sparkle 없으면 기존 카드와 동일).
      if (opts.sparkle && opts.sparkle > 0) {
        ctx.save();
        const ringCount = opts.sparkle >= 3 ? 2 : 1;
        for (let r = 0; r < ringCount; r++) {
          ctx.strokeStyle = opts.accent;
          ctx.globalAlpha = 0.5 - r * 0.15;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(badgeCx, badgeCy, badgeR + 20 + r * 18, 0, Math.PI * 2);
          ctx.stroke();
        }
        const starCount = opts.sparkle * 3;
        for (let i = 0; i < starCount; i++) {
          const angle = (Math.PI * 2 * i) / starCount + Math.PI / 8;
          const dist = badgeR + 55 + (i % 2 === 0 ? 0 : 20);
          const sx = badgeCx + Math.cos(angle) * dist;
          const sy = badgeCy + Math.sin(angle) * dist;
          ctx.fillStyle = opts.accent;
          ctx.font = `${14 + (i % 3) * 4}px ${fontStack}`;
          ctx.globalAlpha = 0.55 + ((i * 37) % 30) / 100; // 반짝임 크기별로 살짝 다른 투명도(고정 시드라 매번 동일하게 재현됨)
          ctx.fillText('✦', sx, sy);
        }
        ctx.restore();
      }

      // 이름 + 부제
      ctx.fillStyle = '#f5c842';
      ctx.font = `900 68px "Noto Serif KR", serif`;
      ctx.fillText(opts.name, W / 2, layout.resultNameY);
      ctx.fillStyle = 'rgba(240, 238, 255, 0.6)';
      ctx.font = `400 26px ${fontStack}`;
      ctx.fillText(opts.subtitle, W / 2, layout.subtitleY);

      // 배지
      ctx.font = `600 24px ${fontStack}`;
      const badgeTextWidth = ctx.measureText(opts.badge).width;
      const badgePadX = 26;
      ctx.save();
      ctx.fillStyle = 'rgba(139, 92, 246, 0.18)';
      ctx.strokeStyle = 'rgba(245, 200, 66, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      (ctx as any).roundRect(W / 2 - badgeTextWidth / 2 - badgePadX, layout.badgeBoxY, badgeTextWidth + badgePadX * 2, 52, 26);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#f0eeff';
      ctx.fillText(opts.badge, W / 2, layout.badgeTextY);

      // 본문 텍스트 박스 — 팩폭 한줄평·타로 해석처럼 길이가 들쭉날쭉한 텍스트라 최대 9줄로
      // 안전하게 자르고(그 이상은 "…") 카드 하단(도메인 워터마크)과 겹치지 않게 함.
      ctx.font = `500 40px ${fontStack}`;
      const MAX_BODY_LINES = 9;
      let lines = wrapCanvasText(ctx, opts.bodyText, W - 200);
      if (lines.length > MAX_BODY_LINES) {
        lines = [...lines.slice(0, MAX_BODY_LINES - 1), `${lines[MAX_BODY_LINES - 1]}…`];
      }
      const lineHeight = 58;
      const boxPaddingY = 56;
      const boxTop = layout.bodyBoxTop;
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
      let y = boxTop + boxPaddingY + 30;
      lines.forEach(line => {
        ctx.fillText(line, W / 2, y);
        y += lineHeight;
      });

      ctx.fillStyle = 'rgba(240, 238, 255, 0.4)';
      ctx.font = `400 26px ${fontStack}`;
      ctx.fillText(DEPLOY_DOMAIN, W / 2, H - 100);

      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('이미지 생성에 실패했습니다.');

      const file = new File([blob], opts.fileName, { type: 'image/png' });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: opts.shareTitle });
          trackEvent('share', { method: 'native_share', content: opts.kind });
          return;
        } catch {
          // 공유 취소/실패 시 다운로드로 대체
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = opts.fileName;
      a.click();
      URL.revokeObjectURL(url);
      trackEvent('download', { content: opts.kind });
    } catch (err: any) {
      showToast(`이미지 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
    } finally {
      setPersonaImageGenerating(null);
    }
  };

  // 보고서형 PDF 파일 다운로드 기능 (인쇄 친화적 팝업 출력 창)
  // PDF 저장은 "버튼 눌러야 생성" 원칙의 예외로, 아직 생성되지 않은 AI 콘텐츠를 전부 자동 생성한 뒤 포함합니다.
  const handleDownloadPDF = async () => {
    if (!result) return;
    setPdfModalOpen(false);

    // 클릭 이벤트와 동기적으로(비동기 대기 없이) 곧바로 호출해야 브라우저가 "사용자가 직접 연"
    // 창으로 인식해 팝업 차단을 하지 않는다 — 아래 AI 콘텐츠 생성처럼 시간이 걸리는 비동기
    // 작업이 먼저 끝난 뒤에 호출하면(예전 코드가 그랬음) 모바일 브라우저, 특히 iOS Safari에서
    // 사실상 항상 팝업이 막히거나 빈 창만 뜬다(계획안.md 7-AU 참고). 창 자체는 여기서 미리
    // 열어두고, 실제 내용은 기존과 동일하게 아래에서 다 만든 뒤 마지막에 써 넣는다.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('팝업 차단이 설정되어 있습니다. 팝업을 허용해 주세요.');
      return;
    }

    setPdfGenerating(true);
    try {
      // 체크 해제한 섹션은 아예 생성 자체를 건너뛰어(API 호출 없음) 시간을 절약함 —
      // 아래 각 *ForPdf 변수가 null/빈 값이면 뒤의 HTML 조립부는 원래부터 있던
      // "값이 있을 때만 렌더링" 삼항연산자 덕에 자동으로 그 섹션을 생략함.
      const categoriesForPdf: Partial<Record<AiCategoryKey, CategoryInterpretation>> = pdfSections.aiCategories ? { ...categoryData } : {};
      const categoriesDeepForPdf: Partial<Record<AiCategoryKey, string>> = pdfSections.aiCategories ? { ...categoryDeepData } : {};
      let archetypeForPdf = pdfSections.aiCategories ? archetypeData : null;
      if (pdfSections.aiCategories) {
        for (const cat of ['personality', 'career', 'romance', 'wealth'] as AiCategoryKey[]) {
          if (!categoriesForPdf[cat] && GEMINI_API_KEY) {
            categoriesForPdf[cat] = await handleGenerateCategory(cat, getAnsweredForCategory(cat)) ?? undefined;
          }
          if (!categoriesDeepForPdf[cat] && GEMINI_API_KEY) {
            categoriesDeepForPdf[cat] = await handleGenerateCategoryDeep(cat, getAnsweredForCategory(cat)) ?? undefined;
          }
        }
        if (!archetypeForPdf && GEMINI_API_KEY) {
          archetypeForPdf = await handleGenerateArchetype();
        }
      }
      const prescriptionsForPdf = pdfSections.prescriptions
        ? (prescriptionsData || (GEMINI_API_KEY ? await handleGeneratePrescriptions() : null))
        : null;
      const elementSummaryForPdf = pdfSections.elementSummary
        ? (elementSummaryText || (GEMINI_API_KEY ? await handleGenerateElementSummary() : null))
        : null;
      const compatSummaryForPdf = pdfSections.compat
        ? (compatSummaryText || (GEMINI_API_KEY ? await handleGenerateCompatSummary() : null))
        : null;
      const fengShuiForPdf = pdfSections.fengshui
        ? (fengShuiText || (GEMINI_API_KEY ? await handleGenerateFengShui() : null))
        : null;
      const unseForPdf = pdfSections.fortune
        ? (unseText || (GEMINI_API_KEY ? await handleGenerateUnse() : null))
        : null;
      const elementSummaryDeepForPdf = pdfSections.elementSummary
        ? (elementSummaryDeepText || (GEMINI_API_KEY ? await handleGenerateElementSummaryDeep() : null))
        : null;
      const compatSummaryDeepForPdf = pdfSections.compat
        ? (compatSummaryDeepText || (GEMINI_API_KEY ? await handleGenerateCompatSummaryDeep() : null))
        : null;
      const fengShuiDeepForPdf = pdfSections.fengshui
        ? (fengShuiDeepText || (GEMINI_API_KEY ? await handleGenerateFengShuiDeep() : null))
        : null;
      const unseDeepForPdf = pdfSections.fortune
        ? (unseDeepText || (GEMINI_API_KEY ? await handleGenerateUnseDeep() : null))
        : null;
      const astrologyForPdf = pdfSections.astrology
        ? (astrologyData || (GEMINI_API_KEY ? await handleGenerateAstrology() : null))
        : null;
      const astrologyDeepForPdf = pdfSections.astrology
        ? (astrologyDeepText || (GEMINI_API_KEY ? await handleGenerateAstrologyDeep() : null))
        : null;

      // 사주 4기둥 AI 심층 해설도 자동 생성(섹션 체크 시에만)
      const pillarDefs: { key: PillarKey; label: string; pillar: Pillar; staticDesc: string }[] = [
        { key: 'year', label: '연주 (年柱)', pillar: result.sajuResult.yearPillar, staticDesc: '연주는 조상과 초년운을 상징하는 기둥입니다.' },
        { key: 'month', label: '월주 (月柱)', pillar: result.sajuResult.monthPillar, staticDesc: '월주는 부모와 청년운을 상징하는 기둥입니다.' },
        { key: 'day', label: '일주 (日柱)', pillar: result.sajuResult.dayPillar, staticDesc: '일주는 본인의 본질과 배우자운을 상징하는 기둥입니다.' },
        ...(result.sajuResult.hourPillar
          ? [{ key: 'hour' as PillarKey, label: '시주 (時柱)', pillar: result.sajuResult.hourPillar, staticDesc: result.hourBranch.desc }]
          : []),
      ];
      const pillarAiForPdf: Partial<Record<PillarKey, string>> = pdfSections.pillars ? { ...pillarAiData } : {};
      if (pdfSections.pillars && GEMINI_API_KEY) {
        for (const def of pillarDefs) {
          if (!pillarAiForPdf[def.key]) {
            try {
              const text = await generatePillarInterpretation(
                GEMINI_API_KEY, result.formData.name, result.formData.mbti,
                def.label, def.pillar.text, def.pillar.hanjaText, def.staticDesc,
              );
              pillarAiForPdf[def.key] = text;
              setPillarAiData(prev => ({ ...prev, [def.key]: text }));
              setCachedItem(pillarCacheKey(result.formData, def.key), text);
            } catch {
              // 개별 기둥 해설 실패는 무시하고 나머지 리포트는 계속 진행
            }
          }
        }
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

            ${archetypeForPdf ? `
              <div class="report-block">
                <h3>🎭 나와 닮은 인물${(() => { const f = ARCHETYPE_FIGURES.find(x => x.id === archetypeForPdf!.figureId); return f ? ` — ${f.name}(${f.origin})` : ''; })()}</h3>
                <p>${escapeHtml(archetypeForPdf.analysis)}</p>
                <p class="fact-bomb"><strong>🔥 한줄 정리:</strong> ${escapeHtml(archetypeForPdf.factBomb)}</p>
              </div>
            ` : ''}

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
      trackEvent('download', { content: 'pdf' });
    } catch (err: any) {
      showToast(`PDF 생성 실패: ${err?.message ?? '알 수 없는 오류'}`);
      // printWindow를 팝업 차단 회피를 위해 미리 열어뒀으므로(위 참고), 생성 도중 실패하면
      // 빈 채로 방치하지 않고 닫아준다 — 사용자에게 내용 없는 빈 탭만 남는 것을 방지.
      try { printWindow.close(); } catch {}
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
        const { calculateAstrology } = await import('./utils/astrologyCalculator');
        astrologyResult = calculateAstrology(year, month, day, astroHour, astroMinute, city.lat, city.lon, astrologyTimeConfidence);
      } catch (err) {
        clearInterval(msgInterval);
        // 별자리 계산 모듈은 코드 스플리팅으로 필요할 때 따로 받아오는데(계획안.md 7-AS/7-AU
        // 참고), 이 fetch가 네트워크 문제나 새 배포로 실패하는 경우와 실제 생년월일 값 문제를
        // 구분해서 안내 — 전자를 "날짜가 틀렸다"고 잘못 알리면 사용자가 애먼 입력값을 의심하게 됨.
        if (isChunkLoadError(err)) {
          showToast('네트워크 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.');
        } else {
          showToast('생년월일 입력값이 올바르지 않습니다. 날짜를 다시 확인해 주세요.');
        }
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
          setCachedItem(introCacheKey, JSON.stringify(aiIntro));
        } catch (err: any) {
          errMsg = err?.message ?? '나풀이 해석 오류가 발생했습니다.';
        }
      }

      clearInterval(msgInterval);
      setResult({ formData: { ...formData }, sajuResult, hourBranch, aiIntro, astrologyResult, astrologyTimeConfidence });
      setIntroError(errMsg);
      setStep('result');
      trackEvent('result_view', { mbti: formData.mbti, hour_unknown: formData.hourUnknown });
      void trackResultViewAndMaybeRequestReview();
    };

    // 최소 1.5초 로딩 후 실행
    const timer = setTimeout(run, 1500);
    return () => { clearInterval(msgInterval); clearTimeout(timer); };
    // formData는 로딩 중 변경되지 않지만(제출 시점에 고정), 이 effect가 실제로 읽는 값이라
    // 의존성 배열에 명시 — 로딩 중 재실행은 없음(참조가 바뀌지 않으므로).
  }, [step, formData]);

  const handleFinishOnboarding = () => {
    localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
    setStep('input');
  };

  const handleDismissResultHint = () => {
    localStorage.setItem(RESULT_HINT_SEEN_KEY, 'true');
    setShowResultHint(false);
  };

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
              <img src="/gwiin/na.webp" alt="나풀이" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
            </div>
            <span className="logo-text">나풀이</span>
            <span className="logo-badge">사주 × MBTI 정밀 만세력 엔진</span>
          </div>
          <div className="header-actions">
            <button className="btn-guide-header" aria-label="기능 가이드" onClick={handleOpenGuide}>💡</button>
            <button className="btn-bookmark-header" onClick={() => setStep('bookmarks')}>
              📔 다이어리 ({bookmarks.length})
            </button>
            {step === 'result' && (
              <button className="btn-reset" onClick={handleReset}>↺ 다시 하기</button>
            )}
          </div>
        </div>
      </header>

      {/* 모달 (💡 기능 가이드 — 하루 한 번 자동 표시 + 헤더 버튼으로 언제든 수동 재열람) */}
      {guideModalOpen && (
        <div className="modal-overlay" onClick={() => setGuideModalOpen(false)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-label="나풀이 기능 가이드" onClick={e => e.stopPropagation()}>
            <button className="modal-close" aria-label="닫기" onClick={() => setGuideModalOpen(false)}>✕</button>
            <div style={{ marginBottom: 20 }}>
              <div className="section-label">💡 나풀이 둘러보기</div>
              <div className="section-title">이런 기능들이 있어요</div>
            </div>

            <div className="guide-toggle-row">
              <span className="guide-toggle-label">🔔 하루에 한 번 자동으로 보기</span>
              <button
                type="button"
                className={`guide-switch ${guideDailyEnabled ? 'on' : ''}`}
                role="switch"
                aria-checked={guideDailyEnabled}
                aria-label="가이드 하루 한 번 자동 표시"
                onClick={handleToggleGuideDaily}
              >
                <span className="guide-switch-knob" />
              </button>
            </div>

            {GUIDE_FEATURES.map((f, idx) => (
              <div key={f.title} className="guide-feature-card">
                <img src={f.image} alt={f.title} loading="lazy" />
                <div className="guide-feature-body">
                  {idx === 0 && (
                    <span className="hero-badge" style={{ marginBottom: 8 }}>
                      <span className="hero-badge-dot" />
                      먼저 보세요
                    </span>
                  )}
                  <div className="guide-feature-title">{f.emoji} {f.title}</div>
                  <div className="guide-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}

            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setGuideModalOpen(false)}>
              확인했어요
            </button>
          </div>
        </div>
      )}

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

      {/* 모달 (심화해석 로그인 유도 — 비로그인 사용자가 심화해석을 시도했을 때) */}
      {showLoginGateModal && (
        <div className="modal-overlay" onClick={() => setShowLoginGateModal(false)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-label="로그인 안내" onClick={e => e.stopPropagation()}>
            <button className="modal-close" aria-label="닫기" onClick={() => setShowLoginGateModal(false)}>✕</button>
            <div style={{ marginBottom: 20 }}>
              <div className="section-label">🔒 심화해석</div>
              <div className="section-title">로그인하면 이용할 수 있어요</div>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 20 }}>
              심화해석은 계정당 무료체험 3회 제공 후 크레딧으로 더 보실 수 있어요.
              나풀이의 다른 기능(사주 조회, 기본 해석, 공유, 저장 등)은 로그인 없이 그대로 계속 무료로 쓸 수 있습니다.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn-gold"
                style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                onClick={async () => { await handleSignIn(); setShowLoginGateModal(false); }}
              >
                구글로 로그인
              </button>
              <button
                className="btn-secondary"
                style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                onClick={async () => { await handleSignInApple(); setShowLoginGateModal(false); }}
              >
                Apple로 로그인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달 (심화해석 크레딧 결제 — 네이티브는 RevenueCat, 웹은 토스페이먼츠) */}
      {showPaywallModal && (
        <div className="modal-overlay" onClick={() => !paywallLoading && setShowPaywallModal(false)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-label="크레딧 충전" onClick={e => e.stopPropagation()}>
            <button className="modal-close" aria-label="닫기" onClick={() => setShowPaywallModal(false)} disabled={paywallLoading}>✕</button>
            <div style={{ marginBottom: 20 }}>
              <div className="section-label">✨ 심화해석 크레딧</div>
              <div className="section-title">크레딧을 충전해 주세요</div>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 20 }}>
              현재 크레딧 {creditBalance ?? 0}개. 아래에서 충전하면 심화해석을 계속 볼 수 있어요.
            </div>
            <PaywallOptions loading={paywallLoading} onPurchaseNative={handlePurchaseCreditsNative} onPurchaseWeb={handlePurchaseCreditsWeb} />
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
            {/* 지장간(支藏干) — 이 지지 안에 숨어있는 천간(여기/중기/정기) */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>🌱 지장간(支藏干) — 이 글자 안에 숨은 기운</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {getJijanggan(pillarModal.branchIdx).map(j => (
                  <div key={j.stage} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Noto Serif KR', serif", color: 'var(--purple-light)' }}>{j.hanja}({j.name})</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{j.stage}</div>
                  </div>
                ))}
              </div>
            </div>
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

      {/* 모달 (🪐 별자리 행성/하우스 AI 심층 해설) */}
      {astroModal && (
        <div className="modal-overlay" onClick={() => setAstroModal(null)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-label={astroModal.title} onClick={e => e.stopPropagation()}>
            <button className="modal-close" aria-label="닫기" onClick={() => setAstroModal(null)}>✕</button>
            <div style={{ marginBottom: 20 }}>
              <div className="section-title">{astroModal.title}</div>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 16, whiteSpace: 'pre-line' }}>
              {astroModal.staticDesc}
            </div>
            {astroPlacementAiData[astroModal.dataKey] ? (
              <>
                <div className="deep-analysis-text" style={{ marginBottom: 16 }}>
                  {astroPlacementAiData[astroModal.dataKey]}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn-gold"
                    style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                    onClick={() => {
                      addBookmark('별자리 배치 해설', astroModal.title, astroPlacementAiData[astroModal.dataKey]!);
                      setAstroModal(null);
                    }}
                  >
                    🔖 다이어리에 저장
                  </button>
                  <button className="btn-secondary" onClick={() => setAstroModal(null)}>닫기</button>
                </div>
              </>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
                  이 배치가 당신과 MBTI에 어떤 의미인지 나풀이가 심층 해설해드려요.
                </p>
                <button
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleGenerateAstroPlacementAi}
                  disabled={astroPlacementAiLoading}
                >
                  {astroPlacementAiLoading ? <span>✨ 생성 중...</span> : <span>🔮 나풀이 심층 해설 생성하기</span>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 모달 (PDF 저장 시 섹션 선택) */}
      {pdfModalOpen && (
        <div className="modal-overlay" onClick={() => setPdfModalOpen(false)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-label="PDF 섹션 선택" onClick={e => e.stopPropagation()}>
            <button className="modal-close" aria-label="닫기" onClick={() => setPdfModalOpen(false)}>✕</button>
            <div style={{ marginBottom: 16 }}>
              <div className="section-label">📄 PDF 저장</div>
              <div className="section-title">포함할 내용을 선택해 주세요</div>
            </div>
            <div className="space-y-2" style={{ marginBottom: 20 }}>
              {(Object.keys(PDF_SECTION_META) as PdfSectionKey[]).map(key => (
                <label
                  key={key}
                  className="flex items-center"
                  style={{ gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={pdfSections[key]}
                    onChange={(e) => setPdfSections(prev => ({ ...prev, [key]: e.target.checked }))}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{PDF_SECTION_META[key].label}</div>
                    {PDF_SECTION_META[key].desc && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{PDF_SECTION_META[key].desc}</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
              체크 해제한 항목은 생성 자체를 건너뛰어 PDF 저장이 더 빨라져요. 아직 안 만든 콘텐츠가 있으면 선택한 항목만 새로 생성합니다.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn-primary"
                style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
                onClick={handleDownloadPDF}
                disabled={pdfGenerating || !Object.values(pdfSections).some(Boolean)}
              >
                {pdfGenerating ? <span>⏳ 생성 중...</span> : <span>📄 PDF 생성하기</span>}
              </button>
              <button className="btn-secondary" onClick={() => setPdfModalOpen(false)}>취소</button>
            </div>
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

        {/* ── 온보딩 화면(최초 1회만) ───────────────── */}
        {step === 'onboarding' && (
          <div className="animate-fade-in" style={{ paddingTop: 32 }}>
            <div className="hero">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <NapuliMark size={56} />
              </div>
              <h1 className="hero-title">
                동양의 사주부터<br />
                <span className="hero-title-accent">서양 별자리·타로까지</span>
              </h1>
              <p className="hero-desc">
                생년월일 하나로 나풀이가 여러 관점을 한곳에 모아<br />
                당신을 이야기처럼 풀어드려요.
              </p>
            </div>

            <div className="space-y-4" style={{ margin: '28px 0' }}>
              {[
                { emoji: '🔮', title: '사주 × MBTI 융합 해석', desc: '정밀 만세력으로 산출한 사주원국을 MBTI와 엮어 성격·커리어·연애·재물까지' },
                { emoji: '🪐', title: '서양 점성술 + 🃏 타로', desc: '어센던트·행성·하우스는 물론, 78장 정식 타로 덱으로 매일 새로운 카드까지' },
                { emoji: '💑', title: '궁합 & 🏡 풍수', desc: '띠 기반 궁합은 물론 상대방 실제 생년월일로 정밀 궁합까지 비교' },
                { emoji: '✨', title: '매일 새로워지는 오늘', desc: '오늘의 나풀이·트랜짓·타로가 하루하루 다르게 도착해요' },
              ].map((item) => (
                <div key={item.title} className="glass-card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <span style={{ fontSize: 26 }}>{item.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleFinishOnboarding}>
              <span>✨</span>
              <span>시작하기</span>
              <span>→</span>
            </button>
          </div>
        )}

        {/* ── 입력 화면 ───────────────────────────── */}
        {step === 'input' && (
          <div className="animate-fade-in">
            {/* 💑 궁합 초대 링크로 들어온 경우 — 내 정보를 입력하면 자동으로 궁합을 보여준다는 안내 */}
            {compatInvite && (
              <div className="glass-card-gold" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>💑</span>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  <strong>{compatInvite.name}</strong>님이 궁합을 보자고 초대했어요! 아래에 내 정보를 입력하면 결과 화면에서 바로 정밀 궁합을 확인할 수 있어요.
                </div>
              </div>
            )}
            {/* 히어로 */}
            <div className="hero">
              <img
                src="/gwiin/na.webp"
                alt="나풀이"
                style={{ width: 96, height: 96, objectFit: 'contain', margin: '0 auto 12px', filter: 'drop-shadow(0 6px 18px rgba(139, 92, 246, 0.45))' }}
              />
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
                    min="1900" max="2100"
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
              <div className="orb-center">
                <img src="/gwiin/na.webp" alt="나풀이" style={{ width: '90%', height: '90%', objectFit: 'contain' }} />
              </div>
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
            {/* 🔮 탄생 포스터 — 오행 기운이 소용돌이치며 캐릭터가 형체를 갖추는 극적인 리빌 장면.
                일간 오행(dayStemElement)에 맞는 포스터를 보여줌(미드저니 제작, public/gwiin/poster/). */}
            <div className="animate-slide-up" style={{ textAlign: 'center' }}>
              <img
                src={`/gwiin/poster/${result.sajuResult.dayStemElement}.webp`}
                alt={`${result.formData.name}님의 나풀이 탄생 포스터`}
                style={{ width: '100%', maxWidth: 320, borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                loading="eager"
              />
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 10 }}>
                🔮 {ELEMENT_LABELS[result.sajuResult.dayStemElement].emoji} {ELEMENT_LABELS[result.sajuResult.dayStemElement].ko} 기운의 나풀이가 찾아왔어요
              </div>
            </div>

            {/* 프로필 배너 */}
            <div className="profile-banner animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="profile-avatar">
                  {result.formData.name[0] || '?'}
                </div>
                {/* 🏠 나풀이의 방 — 어느 탭에 있든 항상 보이는 자리(프로필 배너)에 작은 아이콘
                    버튼으로 배치, 누르면 팝업(모달)으로 바로 열림 */}
                <button
                  type="button"
                  onClick={() => setShowRoomModal(true)}
                  aria-label="나풀이의 방 보기"
                  title="나풀이의 방"
                  style={{
                    width: 56, height: 56, borderRadius: 16, flexShrink: 0, padding: 0,
                    border: '1px solid rgba(245, 200, 66, 0.4)', overflow: 'hidden', cursor: 'pointer',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
                  }}
                >
                  <img
                    src={`/gwiin/room/${result.sajuResult.dayStemElement}-${roomVariant}.webp`}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </button>
                <div className="profile-info">
                  <div className="profile-badge-row">
                    <span className="profile-mbti-badge">{result.formData.mbti}</span>
                    <span className="profile-score-badge">✦ 정밀 만세력 산출 완료</span>
                    {/* 🔥 연속 방문 스트릭 — 프로필 상단에 항상 보이는 위치로 이동(예전엔 "오늘" 탭
                        안에 있어서 눈에 잘 안 띈다는 피드백). 2일차부터 노출, 3일차(첫 배지)부터 티어 이름 함께 표시. */}
                    {streakCount >= 2 && (() => {
                      const tier = getHighestTier(streakCount);
                      return (
                        <span className="profile-streak-badge">
                          🔥 {streakCount}일 연속{tier && ` · ${tier.emoji} ${tier.label}`}
                        </span>
                      );
                    })()}
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
                      onClick={() => setPdfModalOpen(true)}
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
                    {(() => {
                      const tier = getHighestTier(streakCount);
                      if (!tier) return null;
                      return (
                        <button
                          className="btn-secondary"
                          style={{ padding: '10px 14px', fontSize: '13px' }}
                          disabled={personaImageGenerating === 'streak'}
                          onClick={() => handleDownloadPersonaCard({
                            kind: 'streak',
                            kicker: '연속 방문 기록',
                            emoji: tier.emoji,
                            name: `${streakCount}일 연속`,
                            subtitle: `${tier.label} 배지 획득`,
                            badge: '🔥 STREAK',
                            bodyText: `${result.formData.name}님은 ${streakCount}일 연속으로 나풀이를 찾아주셨어요. 꾸준함이 만든 이 기록, 자랑해도 좋아요!`,
                            accent: tier.accent,
                            accentDark: tier.accentDark,
                            sparkle: tier.sparkle,
                            fileName: `${result.formData.name}_${streakCount}일연속.png`,
                            shareTitle: '나풀이 연속 방문 기록',
                          })}
                        >
                          {personaImageGenerating === 'streak' ? '⏳ 카드 생성 중...' : `${tier.emoji} 배지 카드 저장`}
                        </button>
                      );
                    })()}
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
              {/* 격국(格局) — 월지 기준으로 정해지는 사주의 "기본 유형", MBTI 유형처럼 헤드라인급으로 표시 */}
              <div style={{
                marginTop: 10, padding: '14px 16px', borderRadius: 14,
                background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontSize: 26 }}>🎴</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>격국(格局) — 사주의 기본 유형</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--purple-light)' }}>{result.sajuResult.gyeokguk.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.6 }}>{GYEOKGUK_INFO[result.sajuResult.gyeokguk.name].desc}</div>
                </div>
              </div>
            </div>

            {/* 처음 결과 화면에 도달했을 때 1회만 — "어디부터 볼지" 안내 (온보딩 진입점 과다 완화, 계획안.md 참고) */}
            {showResultHint && (
              <div className="glass-card" style={{
                padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12,
                border: '1px solid rgba(245, 200, 66, 0.25)',
              }}>
                <span style={{ fontSize: 20 }}>💡</span>
                <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  위 <strong style={{ color: 'var(--gold)' }}>사주원국</strong>과 아래 <strong style={{ color: 'var(--gold)' }}>🌌 운세</strong>부터 먼저 보시면 돼요.
                  별자리·궁합·풍수 등 나머지는 궁금할 때 아래 탭에서 천천히 둘러보세요.
                </div>
                <button className="modal-close" aria-label="안내 닫기" style={{ position: 'static' }} onClick={handleDismissResultHint}>✕</button>
              </div>
            )}

            {/* 결과 화면 대분류 탭 — 이모지 대신 캐릭터 톤에 맞춘 일러스트 아이콘(미드저니 제작, 얼굴
                없는 순수 사물로 통일: 크리스탈볼·해돋이·망원경) */}
            <div className="tab-nav section-tab-nav" role="tablist" aria-label="결과 섹션">
              {[
                { id: 'today', label: '오늘', icon: '/gwiin/tabicon/today.webp' },
                { id: 'saju', label: '사주', icon: '/gwiin/tabicon/saju.webp' },
                { id: 'astrology', label: '별자리', icon: '/gwiin/tabicon/astrology.webp' },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeSection === t.id}
                  className={`tab-btn ${activeSection === t.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(t.id as any)}
                >
                  <img src={t.icon} alt="" aria-hidden="true" style={{ width: 20, height: 20, objectFit: 'contain', verticalAlign: 'middle', marginRight: 4 }} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* 🔮 사주 대분류 안의 서브탭(운세/해석/궁합/풍수) — 메인 탭과 동일하게 얼굴 없는
                일러스트 아이콘으로 통일(미드저니 제작) */}
            {activeSection === 'saju' && (
              <div className="tab-nav" role="tablist" aria-label="사주 세부 메뉴" style={{ marginBottom: 20 }}>
                {[
                  { id: 'fortune', label: '운세', icon: '/gwiin/tabicon/unse.webp' },
                  { id: 'ai', label: '해석', icon: '/gwiin/tabicon/interpret.webp' },
                  { id: 'compat', label: '궁합', icon: '/gwiin/tabicon/compat.webp' },
                  { id: 'fengshui', label: '풍수', icon: '/gwiin/tabicon/fengshui.webp' },
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={activeSajuTab === t.id}
                    className={`tab-btn ${activeSajuTab === t.id ? 'active' : ''}`}
                    onClick={() => setActiveSajuTab(t.id as any)}
                  >
                    <img src={t.icon} alt="" aria-hidden="true" style={{ width: 18, height: 18, objectFit: 'contain', verticalAlign: 'middle', marginRight: 4 }} />
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
                  🔔 {notificationsEnabled ? `매일 ${notificationHour}시에 알려드리고 있어요` : '매일 정해진 시각에 오늘의 나풀이를 알림으로 받아보세요'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    className="form-select"
                    style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
                    value={notificationHour}
                    disabled={notificationsLoading}
                    onChange={(e) => handleChangeNotificationHour(parseInt(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{h}시</option>
                    ))}
                  </select>
                  <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleToggleNotifications} disabled={notificationsLoading}>
                    {notificationsLoading ? '처리 중...' : notificationsEnabled ? '알림 끄기' : '알림 켜기'}
                  </button>
                </div>
              </div>
            )}

            {/* 오늘의 나풀이 (데일리 운세) */}
            <div className="glass-card-gold" style={{ padding: '20px 22px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* 결과 화면 상단 탄생 포스터와 같은 오행 캐릭터 — "같은 나풀이가 매일 말을 걸어준다"는 느낌 */}
                  <img
                    src={`/gwiin/element/${result.sajuResult.dayStemElement}.webp`}
                    alt="나풀이"
                    style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(245, 200, 66, 0.4)', flexShrink: 0 }}
                  />
                  <div>
                    <div className="section-label">🌅 오늘의 나풀이</div>
                    <div className="section-title" style={{ fontSize: 16 }}>{todayDateStr()}</div>
                  </div>
                </div>
                {dailyFortuneData && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {dailyFortuneData.keyword && (
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'rgba(245, 200, 66, 0.15)', color: 'var(--gold)', whiteSpace: 'nowrap' }}>
                        오늘의 기운: {dailyFortuneData.keyword}
                      </span>
                    )}
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: 11 }}
                      onClick={() => addBookmark('오늘의 나풀이', `${todayDateStr()} 오늘의 나풀이`, `${dailyFortuneData.analysis}\n\n${dailyFortuneData.factBomb}`)}
                    >
                      🔖 저장
                    </button>
                  </div>
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

                  {/* 온보딩 브릿지 — 매일 보는 무료 콘텐츠에서 심화해석으로 자연스럽게 유도 (계획안.md 참고) */}
                  <button
                    type="button"
                    className="glass-card"
                    style={{
                      marginTop: 14, padding: '14px 16px', width: '100%', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                      border: '1px solid rgba(139, 92, 246, 0.25)', background: 'rgba(139, 92, 246, 0.06)',
                    }}
                    onClick={() => { setActiveSection('saju'); setActiveSajuTab('ai'); setActiveTab('personality'); }}
                  >
                    <span style={{ fontSize: 20 }}>🔍</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      오늘의 기운 말고, <strong style={{ color: 'var(--purple-light)' }}>{result.formData.name}님의 성격 자체</strong>를 더 깊게 알고 싶다면?
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--purple-light)', fontWeight: 700, whiteSpace: 'nowrap' }}>심화해석 →</span>
                  </button>
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: dailyFortuneFailed ? '#fca5a5' : 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    {dailyFortuneFailed
                      ? '⚠️ 생성에 실패했어요. 잠시 후 다시 시도해 주세요.'
                      : '오늘의 일진과 내 일주의 관계로, 오늘 하루 짧은 한마디를 나풀이가 들려드려요.'}
                  </p>
                  <button className="btn-primary" onClick={handleGenerateDailyFortune} disabled={dailyFortuneLoading}>
                    {dailyFortuneLoading ? <span>✨ 살펴보는 중...</span> : dailyFortuneFailed ? <span>🔄 다시 시도</span> : <span>🌅 오늘의 나풀이 보기</span>}
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
                {tarotData && (() => {
                  const seed = `${result.formData.name}_${result.formData.birthYear}${result.formData.birthMonth}${result.formData.birthDay}_${todayDateStr()}`;
                  const { card, reversed } = drawDailyTarotCard(seed);
                  const cardMeaning = reversed ? card.meaningReversed : card.meaningUpright;
                  // 메이저 아르카나·에이스는 keywordsUpright/Reversed가 따로 있고, 나머지 마이너 카드는
                  // meaning 필드 자체가 "·"로 구분된 짧은 구문 나열이라 첫 구문을 키워드로 재사용.
                  const keyword = (reversed ? card.keywordsReversed : card.keywordsUpright)?.[0] ?? cardMeaning.split('·')[0]?.trim();
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {keyword && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'rgba(139, 92, 246, 0.15)', color: 'var(--purple-light)', whiteSpace: 'nowrap' }}>
                          오늘의 키워드: {keyword}
                        </span>
                      )}
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: 11 }}
                        onClick={() => addBookmark('오늘의 타로', `${todayDateStr()} 오늘의 타로`, tarotData)}
                      >
                        🔖 저장
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: 11 }}
                        disabled={personaImageGenerating === 'tarot'}
                        onClick={() => {
                          const { accent, accentDark } = tarotCardTheme(card);
                          handleDownloadPersonaCard({
                            kind: 'tarot',
                            kicker: '오늘의 타로',
                            emoji: card.emoji,
                            emojiRotated: reversed,
                            name: card.name,
                            subtitle: card.nameEn,
                            badge: reversed ? '🔄 역방향' : '✨ 정방향',
                            bodyText: tarotData,
                            accent,
                            accentDark,
                            imageUrl: `/tarot/${card.id}.webp`,
                            fileName: `${result.formData.name}_오늘의타로.png`,
                            shareTitle: '나풀이 오늘의 타로',
                          });
                        }}
                      >
                        {personaImageGenerating === 'tarot' ? '⏳' : '🖼️ 이미지'}
                      </button>
                    </div>
                  );
                })()}
              </div>
              {tarotData ? (() => {
                const seed = `${result.formData.name}_${result.formData.birthYear}${result.formData.birthMonth}${result.formData.birthDay}_${todayDateStr()}`;
                const { card, reversed } = drawDailyTarotCard(seed);
                const { accent, accentDark, glow } = tarotCardTheme(card);
                return (
                  <>
                    <div
                      className="persona-card"
                      style={{ marginBottom: 14, '--accent': accent, '--accent-dark': accentDark, '--accent-glow': glow, '--accent-text': accent } as React.CSSProperties}
                    >
                      <div className="persona-card-image">
                        <img
                          src={`/tarot/${card.id}.webp`}
                          alt={`${card.name}(${card.nameEn})`}
                          style={{ transform: reversed ? 'rotate(180deg)' : undefined }}
                        />
                      </div>
                      <div className="persona-card-name">{card.name}</div>
                      <div className="persona-card-divider" />
                      <div className="persona-card-origin">{card.nameEn}</div>
                      <div className="persona-card-badge">{reversed ? '🔄 역방향' : '✨ 정방향'}</div>
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
                  <p style={{ fontSize: 13, color: tarotFailed ? '#fca5a5' : 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    {tarotFailed
                      ? '⚠️ 생성에 실패했어요. 잠시 후 다시 시도해 주세요.'
                      : '오늘의 카드를 한 장 뽑아봐요. 같은 날 다시 눌러도 같은 카드가 나와요.'}
                  </p>
                  <button className="btn-primary" onClick={handleGenerateTarot} disabled={tarotLoading}>
                    {tarotLoading ? <span>✨ 카드를 뽑는 중...</span> : tarotFailed ? <span>🔄 다시 시도</span> : <span>🃏 오늘의 타로 뽑기</span>}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {transitData.keyword && (
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'rgba(59, 130, 246, 0.15)', color: 'var(--blue)', whiteSpace: 'nowrap' }}>
                        오늘의 하늘: {transitData.keyword}
                      </span>
                    )}
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: 11 }}
                      onClick={() => addBookmark('오늘의 트랜짓', `${todayDateStr()} 오늘의 트랜짓`, `${transitData.analysis}\n\n${transitData.luckyWindow}`)}
                    >
                      🔖 저장
                    </button>
                  </div>
                )}
              </div>
              {result.astrologyTimeConfidence !== 'exact' && (
                <p style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 12, lineHeight: 1.6 }}>
                  ⚠️ {result.astrologyTimeConfidence === 'unknown'
                    ? '출생 시간을 몰라 정오로 근사 계산했어요. 오늘의 트랜짓도 참고만 해주세요.'
                    : '태어난 시간대의 대표 시각으로 근사 계산했어요. "정확한 시:분 입력"을 쓰면 트랜짓 결과가 더 정확해져요.'}
                </p>
              )}
              {transitData ? (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, margin: '0 0 14px' }}>
                    {transitData.analysis}
                  </p>
                  <div className="lucky-window-box">
                    <div className="lucky-window-title">🕐 오늘의 행운 시간대</div>
                    <div className="lucky-window-content">{transitData.luckyWindow}</div>
                  </div>
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: transitFailed ? '#fca5a5' : 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    {transitFailed
                      ? '⚠️ 생성에 실패했어요. 잠시 후 다시 시도해 주세요.'
                      : '오늘 실제 하늘의 행성이 내 출생 차트와 어떤 각도를 이루는지 살펴봐요. (별자리 탭에서 어센던트·행성 배치를 먼저 확인하면 더 잘 이해돼요)'}
                  </p>
                  <button className="btn-primary" onClick={handleGenerateTransit} disabled={transitLoading}>
                    {transitLoading ? <span>✨ 살펴보는 중...</span> : transitFailed ? <span>🔄 다시 시도</span> : <span>🔮 오늘의 트랜짓 보기</span>}
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

            {/* 십신(十神) 분포 — 계산 자체는 예전부터 있었지만(AI 프롬프트 내부 참고용) 화면 표시는
                이번에 처음 추가(계획안.md 참고). 오행 분포와 같은 카드 스타일로 통일. */}
            <div className="glass-card animate-slide-up-delay-2">
              <div className="section-label" style={{ marginBottom: 4 }}>🔟 십신 분포</div>
              <div className="section-title" style={{ marginBottom: 16 }}>십신(十神)으로 보는 기질</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {(['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'] as const).map(sipsin => {
                  const cnt = result.sajuResult.sipsin.counts[sipsin] ?? 0;
                  return (
                    <div
                      key={sipsin}
                      style={{
                        background: 'rgba(5, 5, 25, 0.9)',
                        border: `1px solid ${cnt > 0 ? 'rgba(245, 200, 66, 0.3)' : 'rgba(100, 80, 200, 0.15)'}`,
                        borderRadius: 14, padding: '12px 4px', textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{sipsin}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "'Noto Serif KR', serif", color: cnt > 0 ? 'var(--gold)' : 'var(--text-secondary)' }}>
                        {cnt}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(Object.entries(result.sajuResult.sipsin.counts) as [SipsinType, number][])
                  .filter(([, cnt]) => cnt > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([sipsin]) => (
                    <div key={sipsin} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{sipsin}</strong> — {SIPSIN_INFO[sipsin].desc}
                    </div>
                  ))}
              </div>
            </div>

            {/* 신살(神殺) 8종 — 도화/역마/화개/양인/괴강/백호/원진/귀문관. 해당하는 것만 배지로 표시. */}
            <div className="glass-card animate-slide-up-delay-2">
              <div className="section-label" style={{ marginBottom: 4 }}>✨ 신살</div>
              <div className="section-title" style={{ marginBottom: 16 }}>사주에 담긴 특별한 기운</div>
              {result.sajuResult.sinsal.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.sajuResult.sinsal.map(s => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(245, 200, 66, 0.06)', border: '1px solid rgba(245, 200, 66, 0.2)', borderRadius: 12 }}>
                      <span style={{ fontSize: 20 }}>{SINSAL_INFO[s].emoji}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)' }}>{s}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{SINSAL_INFO[s].desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>이번 사주 8글자엔 해당하는 신살이 없어요.</p>
              )}
            </div>

            {/* 격국(格局) 해설 (AI) */}
            <div className="glass-card animate-slide-up-delay-2">
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div>
                  <div className="section-label">🎴 나풀이 격국 해설</div>
                  <div className="section-title">{result.sajuResult.gyeokguk.name}, 어떤 의미일까요?</div>
                </div>
                {gyeokgukSummaryText && (
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 11 }}
                    onClick={() => addBookmark('격국 해설', `${result.formData.name}님의 격국(${result.sajuResult.gyeokguk.name}) 해설`, gyeokgukSummaryText)}
                  >
                    🔖 저장
                  </button>
                )}
              </div>
              {gyeokgukSummaryText ? (
                <>
                  <div className="deep-analysis-text">{gyeokgukSummaryText}</div>
                  <button
                    className="btn-secondary"
                    style={{ marginTop: 12, fontSize: 12 }}
                    onClick={handleGenerateGyeokgukSummary}
                    disabled={gyeokgukSummaryLoading}
                  >
                    {gyeokgukSummaryLoading ? '다시 생성 중...' : '🔄 다시 생성하기'}
                  </button>

                  {gyeokgukSummaryDeepText ? (
                    <div className="deep-dive-block">
                      <div className="deep-dive-block-header">
                        <div className="deep-dive-label">🔍 심화해석</div>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: 11 }}
                          onClick={() => addBookmark('격국 심화 해설', `${result.formData.name}님의 격국(${result.sajuResult.gyeokguk.name}) 심화 해설`, gyeokgukSummaryDeepText)}
                        >
                          🔖 저장
                        </button>
                      </div>
                      <div className="deep-analysis-text">{gyeokgukSummaryDeepText}</div>
                    </div>
                  ) : (
                    <button className="btn-deep-dive" onClick={handleGenerateGyeokgukSummaryDeep} disabled={gyeokgukSummaryDeepLoading}>
                      {gyeokgukSummaryDeepLoading ? '✨ 심화해석 생성 중...' : '🔍 심화해석 더보기'}
                    </button>
                  )}
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    사주의 기본 유형인 격국이 당신의 일하는 방식과 삶의 패턴에 어떻게 드러나는지, 나풀이가 풀어드려요.
                  </p>
                  <button className="btn-primary" onClick={handleGenerateGyeokgukSummary} disabled={gyeokgukSummaryLoading}>
                    {gyeokgukSummaryLoading ? <span>✨ 생성 중...</span> : <span>🎴 격국 해설 생성하기</span>}
                  </button>
                </div>
              )}
            </div>

            {/* 십신 종합 해설 (AI) */}
            <div className="glass-card animate-slide-up-delay-2">
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div>
                  <div className="section-label">🔟 나풀이 십신 종합 해설</div>
                  <div className="section-title">십신 전체를 하나로 풀어보면</div>
                </div>
                {sipsinSummaryText && (
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: 11 }}
                    onClick={() => addBookmark('십신 종합 해설', `${result.formData.name}님의 십신 종합 해설`, sipsinSummaryText)}
                  >
                    🔖 저장
                  </button>
                )}
              </div>
              {sipsinSummaryText ? (
                <>
                  <div className="deep-analysis-text">{sipsinSummaryText}</div>
                  <button
                    className="btn-secondary"
                    style={{ marginTop: 12, fontSize: 12 }}
                    onClick={handleGenerateSipsinSummary}
                    disabled={sipsinSummaryLoading}
                  >
                    {sipsinSummaryLoading ? '다시 생성 중...' : '🔄 다시 생성하기'}
                  </button>

                  {sipsinSummaryDeepText ? (
                    <div className="deep-dive-block">
                      <div className="deep-dive-block-header">
                        <div className="deep-dive-label">🔍 심화해석</div>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: 11 }}
                          onClick={() => addBookmark('십신 종합 심화 해설', `${result.formData.name}님의 십신 종합 심화 해설`, sipsinSummaryDeepText)}
                        >
                          🔖 저장
                        </button>
                      </div>
                      <div className="deep-analysis-text">{sipsinSummaryDeepText}</div>
                    </div>
                  ) : (
                    <button className="btn-deep-dive" onClick={handleGenerateSipsinSummaryDeep} disabled={sipsinSummaryDeepLoading}>
                      {sipsinSummaryDeepLoading ? '✨ 심화해석 생성 중...' : '🔍 심화해석 더보기'}
                    </button>
                  )}
                </>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                    십신 10개 분포를 하나로 종합해서, 나만의 기질과 관계 맺는 방식을 나풀이가 만들어드려요.
                  </p>
                  <button className="btn-primary" onClick={handleGenerateSipsinSummary} disabled={sipsinSummaryLoading}>
                    {sipsinSummaryLoading ? <span>✨ 생성 중...</span> : <span>🔟 십신 종합 해설 생성하기</span>}
                  </button>
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
                <button
                  className="btn-secondary"
                  style={{ fontSize: 12, marginBottom: 14 }}
                  onClick={handleShareCompatInvite}
                  disabled={inviteLinkCopying}
                >
                  {inviteLinkCopying ? '⏳ 링크 준비 중...' : '🔗 나와 궁합 볼 초대 링크 보내기'}
                </button>
                {!partnerFormOpen && !pairCompatText && (
                  <button className="btn-primary" onClick={() => setPartnerFormOpen(true)}>
                    + 상대방 입력하고 정밀 궁합 보기
                  </button>
                )}
                {/* 🌟 귀인지도 — 이전에 비교한 상대들을 오행 관계 유형별 방사형 지도로 표시(계획안.md 참고).
                    노드를 클릭하면 기존처럼 폼 재입력 없이 바로 다시 비교해 보여줌. */}
                {!partnerFormOpen && !pairCompatText && gwiinNodes.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, textAlign: 'center' }}>
                      🌟 귀인지도 — 노드를 눌러 다시 보기
                    </div>
                    <div style={{ opacity: pairCompatLoading ? 0.5 : 1, pointerEvents: pairCompatLoading ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
                      <GwiinMap
                        centerName={result.formData.name}
                        nodes={gwiinNodes}
                        onNodeClick={(id) => {
                          const entry = pairCompatHistory.find(e =>
                            `${e.partnerName}_${e.partnerBirthYear}${e.partnerBirthMonth}${e.partnerBirthDay}_${e.partnerGender}` === id
                          );
                          if (entry) handleReopenPairCompatHistory(entry);
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 12 }}>
                      {Object.values(GWIIN_TYPE_META).map(t => (
                        <span key={t.label} style={{ fontSize: 10.5, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, display: 'inline-block' }} />
                          {t.emoji} {t.label}
                        </span>
                      ))}
                    </div>
                  </div>
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
                      <input className="form-input" type="number" placeholder="연도" min="1900" max="2100" value={partnerBirthYear} onChange={(e) => setPartnerBirthYear(e.target.value)} />
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
                    <button className="btn-primary" onClick={() => handleComparePair()} disabled={pairCompatLoading}>
                      {pairCompatLoading ? <span>✨ 비교하는 중...</span> : <span>💑 정밀 궁합 보기</span>}
                    </button>
                  </div>
                )}
                {pairCompatText && pairSajuB && pairCompare && (
                  <>
                    {/* 🌟 귀인지도에 방금 추가된 관계 유형을 바로 보여줌 — 비교와 지도 사이 연결고리 */}
                    {(() => {
                      const type = GWIIN_TYPE_META[pairCompare.dayStemRelation];
                      const score = getGwiinScore(pairCompare);
                      return (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
                          padding: '14px 16px', borderRadius: 14,
                          background: `${type.color}18`, border: `1px solid ${type.color}55`,
                        }}>
                          <span style={{ fontSize: 30 }}>{type.emoji}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>🌟 귀인지도에 추가됐어요</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: type.color }}>{partnerName}님은 나에게 "{type.label}"</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>{STEM_RELATION_LABEL[pairCompare.dayStemRelation]}</div>
                          </div>
                          <div style={{ textAlign: 'center', flexShrink: 0 }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: type.color, lineHeight: 1 }}>{score}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>점</div>
                          </div>
                        </div>
                      );
                    })()}
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
                      { id: 'archetype', label: '🎭 닮은 인물', icon: '🎭' },
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
                                              style={{ padding: '8px 12px', fontSize: 12, flex: 'none', color: selected ? 'var(--gold)' : 'var(--silver)' }}
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

                    {activeTab === 'archetype' && (
                      <div className="tab-pane animate-fade-in space-y-4">
                        {archetypeData ? (() => {
                          const figure = ARCHETYPE_FIGURES.find(f => f.id === archetypeData.figureId);
                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <div className="tab-pane-title">🎭 {result.formData.name} 님과 닮은 인물</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button
                                    className="btn-secondary"
                                    style={{ padding: '6px 12px', fontSize: 11 }}
                                    onClick={() => addBookmark('닮은 인물', `${result.formData.name}님과 닮은 인물`, `${figure?.name ?? ''}\n\n${archetypeData.analysis}\n\n${archetypeData.factBomb}`)}
                                  >
                                    🔖 저장
                                  </button>
                                  {figure && (
                                    <button
                                      className="btn-secondary"
                                      style={{ padding: '6px 12px', fontSize: 11 }}
                                      disabled={personaImageGenerating === 'archetype'}
                                      onClick={() => handleDownloadPersonaCard({
                                        kind: 'archetype',
                                        kicker: '나와 닮은 인물',
                                        emoji: figure.emoji,
                                        name: figure.name,
                                        subtitle: figure.origin,
                                        badge: figure.traits[0],
                                        bodyText: archetypeData.factBomb,
                                        accent: '#8b5cf6',
                                        accentDark: '#4c1d95',
                                        fileName: `${result.formData.name}_닮은인물_${figure.name}.png`,
                                        shareTitle: '나풀이 나와 닮은 인물',
                                      })}
                                    >
                                      {personaImageGenerating === 'archetype' ? '⏳' : '🖼️ 이미지'}
                                    </button>
                                  )}
                                </div>
                              </div>
                              {figure && (
                                <div
                                  className="persona-card"
                                  style={{ '--accent': '#8b5cf6', '--accent-dark': '#4c1d95', '--accent-glow': 'rgba(139, 92, 246, 0.45)', '--accent-text': 'var(--purple-light)' } as React.CSSProperties}
                                >
                                  <div className="persona-card-medallion">
                                    <img
                                      src={`/gwiin/archetype/${figure.id}.webp`}
                                      alt={figure.name}
                                      className="persona-card-medallion-img"
                                    />
                                  </div>
                                  <div className="persona-card-name">{figure.name}</div>
                                  <div className="persona-card-divider" />
                                  <div className="persona-card-origin">{figure.origin}</div>
                                  <div className="persona-card-badge">{figure.traits[0]}</div>
                                </div>
                              )}
                              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, margin: 0 }}>
                                {archetypeData.analysis}
                              </p>
                              <div className="fact-bomb-box">
                                <div className="fact-bomb-title">🔥 한줄 정리</div>
                                <div className="fact-bomb-content">{archetypeData.factBomb}</div>
                              </div>
                              <button
                                className="btn-secondary"
                                style={{ fontSize: 12 }}
                                onClick={handleGenerateArchetype}
                                disabled={archetypeLoading}
                              >
                                {archetypeLoading ? '다시 뽑는 중...' : '🔄 다시 뽑기'}
                              </button>
                            </>
                          );
                        })() : (
                          <div>
                            <div className="tab-pane-title" style={{ marginBottom: 12 }}>🎭 나와 닮은 인물</div>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                              역사·신화·고전문학 속 인물 중, 사주와 MBTI로 봤을 때 당신과 가장 닮은 한 명을 나풀이가 찾아드려요.
                            </p>
                            <button className="btn-primary" onClick={handleGenerateArchetype} disabled={archetypeLoading}>
                              {archetypeLoading ? <span>✨ 찾는 중...</span> : <span>🎭 닮은 인물 찾기</span>}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 🗨️ AI 후속질문(채팅) — 카테고리와 무관하게 "AI 해석" 탭 전체에서 공유 */}
                  <div className="glass-card" style={{ padding: '18px 20px' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                      <div>
                        <div className="section-label">🗨️ 나풀이에게 더 물어보기</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>위 해석을 바탕으로 궁금한 걸 자유롭게 물어보세요</div>
                      </div>
                      {chatMessages.length > 0 && (
                        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 11 }} onClick={handleClearChat}>
                          🗑️ 대화 초기화
                        </button>
                      )}
                    </div>

                    {chatMessages.length > 0 && (
                      <div className="space-y-2" style={{ marginBottom: 12, maxHeight: 320, overflowY: 'auto' }}>
                        {chatMessages.map((msg, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                            <div style={{
                              maxWidth: '80%', padding: '8px 14px', borderRadius: 14, fontSize: 13, lineHeight: 1.6,
                              background: msg.role === 'user' ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255,255,255,0.05)',
                              border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                            }}>
                              {msg.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="form-input"
                        type="text"
                        placeholder="예: 그럼 이직은 언제가 좋을까요?"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !chatLoading) handleSendChatMessage(); }}
                        disabled={chatLoading}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <button className="btn-primary" style={{ flexShrink: 0, width: 'auto', padding: '10px 16px' }} onClick={handleSendChatMessage} disabled={chatLoading || !chatInput.trim()}>
                        {chatLoading ? '✨' : '전송'}
                      </button>
                    </div>
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

            {/* 🌙 손없는날 — 별도 정적 페이지 링크(SEO 공용 콘텐츠, 계획안.md 참고) */}
            {activeSajuTab === 'fengshui' && (
              <a
                href="/sohn-eobsneun-nal.html"
                target="_blank"
                rel="noopener noreferrer"
                className="glass-card"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textDecoration: 'none' }}
              >
                <span style={{ fontSize: 20 }}>🌙</span>
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  이사·개업 날짜 잡을 때 — <strong style={{ color: 'var(--text-primary)' }}>손없는날 계산기</strong> 무료로 보기
                </span>
                <span style={{ fontSize: 12, color: 'var(--purple-light)' }}>→</span>
              </a>
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
                <div className="section-title" style={{ marginBottom: 4 }}>7개 행성이 있는 자리</div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>💡 각 행성을 클릭하면 나풀이의 심층 해설을 볼 수 있어요</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.astrologyResult.planets.map(p => {
                    const info = PLANETS.find(x => x.key === p.key)!;
                    const sign = ZODIAC_SIGNS[p.signIndex];
                    return (
                      <div
                        key={p.key}
                        onClick={() => handleAstroPlanetClick(p.key)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', cursor: 'pointer' }}
                      >
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
                <div className="section-title" style={{ marginBottom: 4 }}>1~12하우스가 있는 별자리</div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>💡 각 하우스를 클릭하면 나풀이의 심층 해설을 볼 수 있어요</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {result.astrologyResult.houseSignIndexes.map((signIdx, i) => (
                    <div
                      key={i}
                      onClick={() => handleAstroHouseClick(i)}
                      style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', cursor: 'pointer' }}
                    >
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
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleSignIn}>구글로 로그인</button>
                      <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleSignInApple}>Apple로 로그인</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 🏅 내 배지 — 연속 방문 마일스톤 컬렉션. 스트릭이 끊겨도 한 번 딴 배지는 계속
                남음(earnedTiers는 streak.ts의 영구 기록에서 옴 — 현재 streakCount와 무관). */}
            <div className="glass-card" style={{ padding: '18px 20px', marginBottom: 24 }}>
              <div className="section-label">🏅 내 배지</div>
              <div className="section-title" style={{ marginBottom: 14, fontSize: 16 }}>
                연속 방문으로 모으는 컬렉션 ({earnedTiers.length}/{STREAK_TIERS.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
                {STREAK_TIERS.map(tier => {
                  const earned = earnedTiers.find(e => e.days === tier.days);
                  return (
                    <div
                      key={tier.days}
                      style={{
                        padding: '14px 10px',
                        borderRadius: 14,
                        textAlign: 'center',
                        background: earned ? `linear-gradient(135deg, ${tier.accent}22, ${tier.accentDark}22)` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${earned ? `${tier.accent}55` : 'var(--border)'}`,
                      }}
                    >
                      {earned ? (
                        <img
                          src={tier.growthImage}
                          alt={tier.label}
                          style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 4 }}
                        />
                      ) : (
                        <div style={{ fontSize: 32, marginBottom: 6, opacity: 0.4 }}>🔒</div>
                      )}
                      <div style={{ fontSize: 12, fontWeight: 700, color: earned ? tier.accent : 'var(--text-secondary)' }}>
                        {tier.label}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {tier.days}일 연속
                      </div>
                      {earned ? (
                        <>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
                            {earned.earnedAt} 획득
                          </div>
                          {result && (
                            <button
                              className="btn-secondary"
                              style={{ marginTop: 8, padding: '4px 8px', fontSize: 10, width: '100%' }}
                              disabled={personaImageGenerating === 'streak'}
                              onClick={() => handleDownloadPersonaCard({
                                kind: 'streak',
                                kicker: '연속 방문 기록',
                                emoji: tier.emoji,
                                name: `${tier.days}일 연속`,
                                subtitle: `${tier.label} 배지 획득`,
                                badge: '🔥 STREAK',
                                bodyText: `${result.formData.name}님은 ${tier.days}일 연속으로 나풀이를 찾아주셨어요. 꾸준함이 만든 이 기록, 자랑해도 좋아요!`,
                                accent: tier.accent,
                                accentDark: tier.accentDark,
                                sparkle: tier.sparkle,
                                fileName: `${result.formData.name}_${tier.days}일연속.png`,
                                shareTitle: '나풀이 연속 방문 기록',
                              })}
                            >
                              {personaImageGenerating === 'streak' ? '⏳' : '🖼️ 카드'}
                            </button>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4, opacity: 0.7 }}>
                          미획득
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

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

        {/* 🏠 나풀이의 방 — 캐릭터 에셋 마지막 통합 지점. 새 상태/계산 없이 이미 앱에 있는 값들
            (오늘의 기운·배지·다이어리 기록·귀인지도 상대 수)을 한 화면에 모아 보여주는 정적 요약 화면.
            아이템 배치 등 상호작용 시스템은 범위 밖(계획안.md 참고).
            [2026-08-21] "오늘" 탭 안에 있어 발견성이 낮다는 피드백으로 전체 화면(step)에서
            프로필 배너 옆 아이콘 버튼 + 팝업(모달)으로 전환(7-BM) — 어느 탭에 있든 열 수 있음. */}
        {showRoomModal && result && (
          <div className="modal-overlay" onClick={() => setShowRoomModal(false)}>
            <div className="modal-box" role="dialog" aria-modal="true" aria-label="나풀이의 방" onClick={e => e.stopPropagation()}>
              <button className="modal-close" aria-label="닫기" onClick={() => setShowRoomModal(false)}>✕</button>
              <div style={{ marginBottom: 16 }}>
                <div className="section-label">🏠 {ELEMENT_LABELS[result.sajuResult.dayStemElement].emoji} {ELEMENT_LABELS[result.sajuResult.dayStemElement].ko} 나풀이의 방</div>
                <div className="section-title">{result.formData.name}님의 공간</div>
              </div>

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden', position: 'relative', marginBottom: 12 }}>
              <img
                src={`/gwiin/room/${result.sajuResult.dayStemElement}-${roomVariant}.webp`}
                alt="나풀이의 방 배경"
                style={{ width: '100%', display: 'block' }}
              />
              <img
                src={`/gwiin/element/${result.sajuResult.dayStemElement}.webp`}
                alt="나의 나풀이"
                style={{
                  position: 'absolute', bottom: '6%', left: '50%', transform: 'translateX(-50%)',
                  width: '28%', maxWidth: 130, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.5))',
                }}
              />
              {/* 🎨 방 꾸미기 — 오행마다 미리 만들어둔 4가지 방 중 선택(하우징 모드로 가기 전
                  가장 저렴한 "커스터마이징" 단계). 선택은 사람별로 저장됨. */}
              <button
                type="button"
                aria-label="이전 방"
                onClick={() => {
                  const next = roomVariant === 1 ? 4 : roomVariant - 1;
                  setRoomVariant(next);
                  localStorage.setItem(roomVariantCacheKey(result.formData), String(next));
                }}
                style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  width: 36, height: 36, borderRadius: '50%', border: 'none',
                  background: 'rgba(10, 8, 24, 0.55)', color: '#fff', fontSize: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >‹</button>
              <button
                type="button"
                aria-label="다음 방"
                onClick={() => {
                  const next = roomVariant === 4 ? 1 : roomVariant + 1;
                  setRoomVariant(next);
                  localStorage.setItem(roomVariantCacheKey(result.formData), String(next));
                }}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  width: 36, height: 36, borderRadius: '50%', border: 'none',
                  background: 'rgba(10, 8, 24, 0.55)', color: '#fff', fontSize: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >›</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n}번 방 보기`}
                  onClick={() => { setRoomVariant(n); localStorage.setItem(roomVariantCacheKey(result.formData), String(n)); }}
                  style={{
                    width: 8, height: 8, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
                    background: n === roomVariant ? 'var(--gold)' : 'rgba(255,255,255,0.2)',
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>🌅</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>
                  {dailyFortuneData?.keyword ?? '아직 없음'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>오늘의 기운</div>
              </div>
              <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>🏅</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>
                  {earnedTiers.length} / {STREAK_TIERS.length}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>획득 배지</div>
              </div>
              <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>📔</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>
                  {bookmarks.length}개
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>다이어리 기록</div>
              </div>
              <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>🤝</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)' }}>
                  {pairCompatHistory.length}명
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>귀인지도에서 만남</div>
              </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
