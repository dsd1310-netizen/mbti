/**
 * App.tsx 전역에서 쓰는 데이터 형태(폼 입력값/결과/북마크 등) — React 컴포넌트나 훅과
 * 무관한 순수 타입 정의만 모아둔 파일. (2026-08-07 App.tsx 리팩터링, 계획안.md 참고)
 */
import { HOUR_BRANCHES, SajuResult } from './utils/sajuCalculator';
import { SajuIntro } from './utils/geminiApi';
import { AstrologyResult } from './utils/astrologyData';

export interface FormData {
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
export interface AppResult {
  formData: FormData;
  sajuResult: SajuResult;
  hourBranch: typeof HOUR_BRANCHES[0];
  aiIntro: SajuIntro | null;
  astrologyResult: AstrologyResult;
  astrologyTimeConfidence: 'exact' | 'approximate' | 'unknown';
}
export interface Bookmark {
  id: number;
  category: string;
  title: string;
  content: string;
  date: string;
  snapshot?: FormData; // 저장 당시의 입력값 — 전체 결과 화면으로 되돌아갈 때 사용
}
export type Step = 'onboarding' | 'input' | 'loading' | 'result' | 'bookmarks' | 'room';

export const ONBOARDING_SEEN_KEY = 'napuli_onboarding_seen';
// 결과 화면 최초 진입 시 1회만 보여주는 "어디부터 볼지" 안내 배너 — 온보딩 진입점 과다 문제(계획안.md 참고) 완화용.
export const RESULT_HINT_SEEN_KEY = 'napuli_result_hint_seen';
export type PillarKey = 'year' | 'month' | 'day' | 'hour';

// 💡 기능 가이드 팝업 — 온보딩(최초 1회)과 별개로, 하루 한 번 자동으로 뜨는 기능 소개 팝업.
// GUIDE_LAST_SHOWN_KEY: 마지막으로 "자동으로" 뜬 날짜(YYYY-MM-DD) — 오늘 이미 떴으면 다시 안 띄움.
// GUIDE_DAILY_ENABLED_KEY: 팝업 안의 토글로 끄면 'false' 저장, 이후 자동으로는 안 뜸(헤더의
// 가이드 버튼으로 언제든 수동으로 다시 볼 수 있고, 그 안에서 토글을 다시 켤 수도 있음).
export const GUIDE_LAST_SHOWN_KEY = 'napuli_guide_last_shown';
export const GUIDE_DAILY_ENABLED_KEY = 'napuli_guide_daily_enabled';

export interface GuideFeature {
  image: string;
  emoji: string;
  title: string;
  desc: string;
}

export const GUIDE_FEATURES: GuideFeature[] = [
  {
    image: '/guide/saju-mbti.webp',
    emoji: '🔮',
    title: '사주 × MBTI 융합 해석',
    desc: '절기 기준 정밀 만세력으로 산출한 사주원국을 나풀이가 MBTI와 엮어 성격 · 커리어 · 연애 · 재물까지 심층 분석해드려요.',
  },
  {
    image: '/guide/astrology.webp',
    emoji: '🪐',
    title: '서양 점성술 · 타로',
    desc: '어센던트 · 행성 · 하우스까지 정밀하게 계산하는 홀사인 점성술과, 매일 새로운 78장 타로 카드로 오늘의 기운도 확인해보세요.',
  },
  {
    image: '/guide/compat.webp',
    emoji: '💑',
    title: '궁합 보기',
    desc: '나와 상대방의 사주를 비교해 궁합을 확인해보세요. 일지 기준 합 · 충 · 형 · 파 · 해 조합표와 나풀이의 AI 종합 해설까지 제공돼요.',
  },
  {
    image: '/guide/diary.webp',
    emoji: '📔',
    title: '다이어리에 저장',
    desc: '마음에 드는 해석은 다이어리에 저장해두고 언제든 다시 볼 수 있어요. 로그인하면 기기를 바꿔도 기록이 그대로 유지돼요.',
  },
  {
    image: '/guide/share.webp',
    emoji: '📤',
    title: 'PDF · 카톡 공유',
    desc: '결과를 PDF로 저장하거나 카카오톡으로 공유하고, 예쁜 이미지 카드로 만들어 친구에게 자랑해보세요.',
  },
];

// PDF 저장 시 섹션 선택 — 12개 개별 항목 대신 8개 큰 단위로 묶음(계획안.md 논의 결과)
export type PdfSectionKey = 'aiCategories' | 'prescriptions' | 'elementSummary' | 'compat' | 'fengshui' | 'fortune' | 'pillars' | 'astrology';
export const PDF_SECTION_META: Record<PdfSectionKey, { label: string; desc: string }> = {
  aiCategories: { label: '🔮 AI 해석', desc: '성격 · 커리어 · 연애 · 재물 · 닮은 인물' },
  prescriptions: { label: '🎯 3대 실천 처방전', desc: '' },
  elementSummary: { label: '🌿 오행 종합 해설', desc: '' },
  compat: { label: '💑 궁합 조합표', desc: '' },
  fengshui: { label: '🏡 풍수 수리 가이드', desc: '' },
  fortune: { label: '🌌 대운 · 세운 & 운세 해설', desc: '' },
  pillars: { label: '🧭 사주 4기둥 심층 해설', desc: '' },
  astrology: { label: '🪐 서양 고전점성술 (별자리)', desc: '' },
};
