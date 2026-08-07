/**
 * Google Analytics 4(GA4) 최소 연동 — 지금까지 이 앱엔 어떤 사용성 추적도 없어서,
 * 20개 넘는 AI 콘텐츠 기능 중 실제로 뭐가 쓰이고 뭐가 안 쓰이는지 전혀 알 수 없었음.
 * Firebase(../firebase.ts)와 동일한 패턴 — 환경변수가 없으면 조용히 비활성화되고
 * 앱 나머지 기능에는 전혀 영향을 주지 않는다(계획안.md 참고).
 */
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

export const analyticsAvailable = Boolean(GA_MEASUREMENT_ID);

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

/** main.tsx에서 앱 시작 시 한 번만 호출. gtag.js를 동적으로 로드해 초기 페이지뷰를 기록한다. */
export function initAnalytics(): void {
  if (initialized || !GA_MEASUREMENT_ID) return;
  initialized = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag('js', new Date());
  // 이 앱은 라우팅이 없는 단일 페이지(탭 전환만 있음)라 자동 page_view만으로는
  // 화면 전환을 알 수 없음 — 수동 page_view 전송은 여기서 끄고, 탭 전환은
  // trackEvent('screen_view', { screen_name })로 개별 추적한다.
  window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/** GA4로 커스텀 이벤트 전송. 설정 안 돼 있으면 조용히 무시(개발 환경 등). */
export function trackEvent(name: string, params?: Record<string, string | number | boolean | undefined>): void {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

/**
 * [2026-08-07] ErrorBoundary는 렌더링 크래시를 잡아도 console.error만 남기고 끝이라, 실제
 * 사용자가 겪는 오류를 개발자가 알 방법이 전혀 없었음. GA4의 예약 이벤트명 `exception`(description/fatal
 * 파라미터가 표준 스키마)으로 최소한의 가시성을 확보 — 별도 유료 에러 트래킹 서비스 없이도
 * GA4 대시보드에서 발생 빈도/추이 정도는 볼 수 있음(스택트레이스 전체 등 상세 디버깅 정보는 아님).
 */
export function trackException(description: string, fatal: boolean): void {
  // GA4는 이벤트 파라미터 문자열 값을 100자로 잘라내므로 미리 잘라서 보냄.
  trackEvent('exception', { description: description.slice(0, 100), fatal });
}

/**
 * ErrorBoundary는 React 렌더링 중 오류만 잡는다 — 이 앱의 실제 위험은 대부분
 * `handleGenerateXxx` 류의 비동기 이벤트 핸들러(await 실패 등)에 있는데, 여기서 던져진
 * 예외는 대부분 이미 각 핸들러의 try/catch가 토스트로 안내하지만, 혹시 놓친 곳이 있다면
 * 이 전역 리스너가 그물망 역할을 한다. main.tsx에서 앱 시작 시 한 번 호출.
 */
export function initGlobalErrorTracking(): void {
  window.addEventListener('error', (event) => {
    trackException(event.message || 'window.onerror', false);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
    trackException(message, false);
  });
}
