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
export type Step = 'onboarding' | 'input' | 'loading' | 'result' | 'bookmarks';

export const ONBOARDING_SEEN_KEY = 'napuli_onboarding_seen';
export type PillarKey = 'year' | 'month' | 'day' | 'hour';

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
