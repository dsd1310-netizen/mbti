/**
 * Gemini API 호출 공통 인프라 — 모델 목록, 프록시 호출 함수(JSON/plain 응답), 공용 헬퍼.
 * 기능별 프롬프트 생성 함수는 ./saju.ts, ./deep.ts, ./astrology.ts, ./social.ts에 나뉘어 있고,
 * 이 파일은 그 네 파일이 공통으로 쓰는 하부 구조만 담는다 (2026-08-07 리팩터링, 계획안.md 참고).
 */

import { Capacitor } from '@capacitor/core';
import { ElementCounts } from '../sajuCalculator';
import { DEPLOY_ORIGIN } from '../../deployConfig';

// 모델 과부하 및 트래픽 분산을 위한 릴레이 모델 배열 (2026년 최신 모델 기준)
export const MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

// [2026-08-06] "심화해석"류(15~20줄 이상 긴 분량 요청)는 실측 결과 gemini-3.6-flash가
// thinkingBudget을 줘도 여전히 사고 토큰을 많이 써서(17.6초→16.3초 정도로 개선폭이 작음)
// 느렸던 반면, gemini-3.5-flash-lite는 같은 프롬프트에서 사고 토큰 0으로 5~6초 만에
// 십신 용어·실생활 예시 요구사항을 전부 충족하는 동등하거나 더 나은 품질의 결과를 냄
// (직접 비교 재현 완료). 심화해석 계열 호출에서만 이 모델을 1순위로 시도하도록 순서를 바꿈
// — 자동/버튼 생성형 짧은 콘텐츠(사주 인트로 등)의 기본 폴백 순서(MODELS)는 그대로 유지.
export const DEEP_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.6-flash',
  'gemini-2.5-pro',
];

// 네이티브 앱(Capacitor)의 웹뷰는 capacitor://localhost 등 로컬 오리진에서 로드되어
// 상대경로 fetch('/api/gemini')가 실제 배포 서버에 도달하지 못한다 — 네이티브일 때만
// 배포 도메인 절대경로를 사용(웹은 기존처럼 상대경로 유지). api/gemini.ts의 Origin
// 허용리스트에도 네이티브 오리진이 함께 추가되어 있어야 함(계획안.md 8절 참고).
const API_BASE = Capacitor.isNativePlatform() ? DEPLOY_ORIGIN : '';

export interface CategoryInterpretation {
  analysis: string;       // 심층 분석 내용 (5~7줄 이상, 비유 활용)
  factBomb: string;       // 🔥 사주 x MBTI 뼈 때리는 팩폭 한줄평 (존댓말 매운맛)
  luckyItem: string;      // 🍀 럭키 아이템 & ⚠️ 피해야 할 상극 유형
}

export interface SajuIntro {
  title: string;
  jungianNote: string;
  sajuExplanation: string; // 사주원국(연/월/일/시주) 8글자 전체를 대중 눈높이에 맞춘 쉽고 흥미로운 해설
}

export type AiCategoryKey = 'personality' | 'career' | 'romance' | 'wealth';

export const ELEMENT_KO: Record<string, string> = {
  wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)'
};

export function elementCountsStr(elementCounts: ElementCounts): string {
  return Object.entries(elementCounts).map(([k, v]) => `${ELEMENT_KO[k]} ${v}개`).join(', ');
}

/**
 * AI 응답이 프롬프트의 JSON 예시 placeholder 문구를 그대로 앞부분에 반환하는 경우가 가끔 있어
 * (예: "🔥 뼈 때리는 팩폭 한줄평 (존댓말 매운맛): 실제 내용...") 알려진 placeholder 문자열을 방어적으로 제거.
 * 제거 후 남는 내용이 없으면 fallback을 사용.
 */
export function cleanField(raw: string | undefined, placeholder: string, fallback: string): string {
  if (!raw) return fallback;
  let text = raw.trim();
  if (text.startsWith(placeholder)) {
    text = text.slice(placeholder.length).replace(/^[:\s\-–—]+/, '').trim();
  }
  return text || fallback;
}

// ─── JSON 추출 및 부분/잘린 JSON 복구 정규식 파서 ────────────────────────────

/**
 * AI 응답 텍스트가 도중에 잘리거나 마크다운에 감싸져 있어도
 * 안전하게 파싱하여 반환합니다.
 */
function extractJsonObject<T>(raw: string): Partial<T> | null {
  if (!raw) return null;

  let text = raw
    .replace(/```[\w]*\r?\n?/gi, '')
    .replace(/```\r?\n?/g, '')
    .trim();

  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return null;

  text = text.slice(firstBrace);

  let textToParse = text;
  const lastBrace = textToParse.lastIndexOf('}');

  if (lastBrace === -1 || lastBrace < firstBrace) {
    const quoteCount = (textToParse.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      textToParse += '"';
    }
    textToParse += '}';
  } else {
    textToParse = textToParse.slice(0, lastBrace + 1);
  }

  try {
    return JSON.parse(textToParse) as Partial<T>;
  } catch {
    return null;
  }
}

/**
 * 지수 백오프 지연 유틸 (Sleep)
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 429/503/500(업스트림 과부하)이 아닌 응답(400 잘못된 요청, 403 Origin 불일치 등)은 재시도해도
 * 절대 성공할 수 없으므로 즉시 실패시켜야 하는데, 이 에러를 그냥 new Error로 던지면 바로 아래
 * catch 블록에 다시 잡혀서(같은 try/catch 안이므로) 결과적으로 나머지 attempt/model을 전부
 * 소진할 때까지 계속 재시도되는 문제가 있었음. 이 마커 클래스로 구분해 catch에서 즉시 재던짐.
 */
class NonRetryableApiError extends Error {}

/**
 * /api/gemini 요청 헤더 구성 — 개발자가 브라우저 localStorage에 직접 설정해둔
 * 우회 키가 있으면 함께 실어 보낸다(코드에는 값이 절대 없음, 서버 검증용).
 */
function buildGeminiRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const devKey = localStorage.getItem('napuli_dev_key');
    if (devKey) headers['X-Dev-Key'] = devKey;
  } catch {
    // localStorage 접근 불가 환경(사파리 프라이빗 모드 등)은 그냥 무시
  }
  return headers;
}

/**
 * JSON 응답을 기대하는 Gemini API 호출 공통 함수 (모델 폴백 + 재시도 + 타임아웃)
 */
export async function callGeminiJsonApi<T>(
  _apiKey: string,
  prompt: string,
  maxOutputTokens: number,
  timeoutMs: number = 20000,
): Promise<Partial<T> | null> {
  let lastError: Error | null = null;
  let hadSuccessfulResponse = false;
  const maxRetries = 3;

  for (const model of MODELS) {
    // Gemini API 키는 클라이언트에 절대 노출하지 않는다 — 서버리스 프록시(api/gemini.ts)를 통해서만 호출.
    const url = `${API_BASE}/api/gemini?model=${model}`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        if (attempt > 1) {
          await sleep(attempt * 1500);
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: buildGeminiRequestHeaders(),
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens,
              responseMimeType: 'application/json',
              // [2026-08-06] 로딩 체감 속도 개선: 실측 결과 이 앱이 쓰는 "사고형" 모델은 답변
              // 자체보다 훨씬 많은 숨은 "사고(thinking)" 토큰을 먼저 소모함(짧은 소개글 하나에
              // 응답 405토큰 대비 사고 2315토큰, 15.8초 소요를 실측). thinkingBudget을 낮게
              // 잡으면(0은 이 모델에서 400 오류라 안 됨) 같은 프롬프트가 3~4초대로 줄어들면서도
              // JSON 품질은 그대로였음 — 값을 완전히 없애지 않고 여유 있게 512로 제한.
              thinkingConfig: { thinkingBudget: 512 },
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const status = response.status;
          const errInfo = (err as { error?: { message?: string; code?: string } })?.error;
          const msg = errInfo?.message || `API 오류 (${status})`;

          // CONFIG_MISSING(서버 환경변수 누락)은 재시도해도 절대 성공할 수 없는 설정 오류라
          // 과부하(429/503/500)와 달리 즉시 실패 처리.
          if (errInfo?.code !== 'CONFIG_MISSING' && (status === 429 || status === 503 || status === 500)) {
            console.warn(`[GeminiAPI] ${model} 과부하/오류 (HTTP ${status}). ${attempt}/${maxRetries}회 재시도...`);
            lastError = new Error(msg);
            continue;
          }

          throw new NonRetryableApiError(msg);
        }

        hadSuccessfulResponse = true;
        const data = await response.json();
        const rawText: string = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
          ?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

        const parsed = extractJsonObject<T>(rawText);
        if (parsed !== null) {
          return parsed;
        }

        // 응답은 정상 수신했지만 JSON 파싱에 실패 (사고형 모델의 토큰 소진 등) — 네트워크 오류와 동일하게 재시도
        const finishReason = (data as { candidates?: { finishReason?: string }[] })?.candidates?.[0]?.finishReason;
        console.warn(`[GeminiAPI] ${model} 응답 JSON 파싱 실패 (finishReason: ${finishReason ?? '알 수 없음'}). ${attempt}/${maxRetries}회 재시도...`);
        lastError = new Error('AI 응답을 올바른 형식으로 해석하지 못했습니다.');
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err instanceof NonRetryableApiError) throw err;
        lastError = err;
        if (attempt < maxRetries) {
          console.warn(`[GeminiAPI] ${model} 호출 실패, 재시도 대기...`, err?.message);
        }
      }
    }
  }

  if (hadSuccessfulResponse) {
    // 모든 모델/재시도에서 응답은 왔지만 끝내 파싱 가능한 JSON을 얻지 못함 — 호출부의 폴백 콘텐츠 사용
    console.warn('[GeminiAPI] 모든 모델에서 JSON 파싱 실패, 폴백 콘텐츠로 대체합니다:', lastError?.message);
    return null;
  }
  throw lastError || new Error('현재 나풀이 서버 응답 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
}

/**
 * 일반 텍스트 출력을 위한 Gemini API 호출 함수
 */
export async function callGeminiPlainApi(
  _apiKey: string,
  prompt: string,
  fallbackText: string,
  maxOutputTokens: number = 2048,
  timeoutMs: number = 20000,
  models: string[] = MODELS,
  // [2026-08-06] 실사용 버그: "심화해석" 계열은 fallbackText가 실제 콘텐츠가 아니라
  // "지금은 불러올 수 없습니다" 같은 에러 문구인데, 이 함수가 실패 시에도 그 문구를
  // 정상 반환값처럼 돌려주다 보니 호출부(App.tsx)가 성공으로 착각해 그 문구를 그대로
  // localStorage에 캐시해버리고, 재시도 버튼도 없이 영구히 그 문구만 보이는 버그가 있었음.
  // throwOnFailure=true인 호출부는 실패 시 예외를 던져, 기존에도 있던 호출부의 catch(토스트
  // 안내 + state 미설정 + 버튼 유지)가 정상 동작하게 함. 반대로 타로/풍수(짧은 버전) 등
  // fallbackText 자체가 그럭저럭 쓸만한 정적 콘텐츠인 함수들은 기존처럼 조용히 대체됨.
  throwOnFailure: boolean = false,
): Promise<string> {
  let lastError: Error | null = null;
  const maxRetries = 3;

  try {
    for (const model of models) {
      // Gemini API 키는 클라이언트에 절대 노출하지 않는다 — 서버리스 프록시(api/gemini.ts)를 통해서만 호출.
      const url = `${API_BASE}/api/gemini?model=${model}`;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          if (attempt > 1) {
            await sleep(attempt * 1500);
          }

          const response = await fetch(url, {
            method: 'POST',
            headers: buildGeminiRequestHeaders(),
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.8,
                maxOutputTokens,
                thinkingConfig: { thinkingBudget: 512 },
              },
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const status = response.status;
            const errInfo = (err as { error?: { message?: string; code?: string } })?.error;
            const msg = errInfo?.message || `API 오류 (${status})`;

            if (errInfo?.code !== 'CONFIG_MISSING' && (status === 429 || status === 503 || status === 500)) {
              lastError = new Error(msg);
              continue;
            }
            throw new NonRetryableApiError(msg);
          }

          const data = await response.json();
          const rawText: string = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
            ?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

          if (rawText.trim()) {
            return rawText.trim();
          }

          // 응답은 정상 수신했지만 콘텐츠가 비어있음(세이프티 필터 등) — 네트워크 오류와 동일하게 재시도
          const finishReason = (data as { candidates?: { finishReason?: string }[] })?.candidates?.[0]?.finishReason;
          console.warn(`[GeminiAPI] ${model} 빈 응답 (finishReason: ${finishReason ?? '알 수 없음'}). ${attempt}/${maxRetries}회 재시도...`);
          lastError = new Error('AI가 빈 응답을 반환했습니다.');
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err instanceof NonRetryableApiError) throw err;
          lastError = err;
        }
      }
    }
  } catch (err: any) {
    if (err instanceof NonRetryableApiError) {
      // 재시도해도 절대 성공할 수 없는 오류(설정 누락/Origin 불일치 등) — 나머지 attempt/model을
      // 다 소진할 때까지 기다리지 않고 즉시 실패 처리.
      if (throwOnFailure) throw err;
      console.warn('[GeminiAPI] 재시도 불가 오류, 폴백 콘텐츠로 대체:', err.message);
      return fallbackText;
    }
    throw err;
  }

  console.warn('All Gemini models failed:', lastError?.message);
  if (throwOnFailure) throw lastError || new Error('현재 나풀이 서버 응답 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  return fallbackText;
}
