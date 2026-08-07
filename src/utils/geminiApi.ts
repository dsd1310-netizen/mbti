/**
 * Google Gemini API 연동 모듈 — 사주 정보 + MBTI를 기반으로 AI 해석 생성.
 *
 * [2026-08-07] 실제 구현은 ./gemini/ 아래 기능별 파일로 분리되어 있다(core/saju/deep/astrology/social).
 * 이 파일은 기존 import 경로(`from '../utils/geminiApi'` 또는 `from './utils/geminiApi'`)를
 * 그대로 유지하기 위한 배럴(barrel) re-export일 뿐이다 — 리팩터링 이전에 이 파일을 직접 import하던
 * 코드는 한 글자도 바꿀 필요가 없다. 계획안.md 참고.
 */
export * from './gemini/core';
export * from './gemini/saju';
export * from './gemini/deep';
export * from './gemini/astrology';
export * from './gemini/social';
