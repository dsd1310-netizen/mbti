import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { initAnalytics, initGlobalErrorTracking } from './utils/analytics'
import { Capacitor } from '@capacitor/core'

initAnalytics();
initGlobalErrorTracking();

// 개발자 전용 요청 제한 우회 키를 URL(?devkey=...)로 한 번 열어서 localStorage에 저장할 수 있게 함
// — 모바일은 개발자도구 콘솔에 접근하기 어려우므로, 링크(북마크) 하나로 같은 효과를 내기 위함.
// 저장 후에는 주소창/방문 기록에 값이 남지 않도록 URL에서 바로 제거한다.
const devKeyParam = new URLSearchParams(window.location.search).get('devkey');
if (devKeyParam) {
  localStorage.setItem('napuli_dev_key', devKeyParam);
  const url = new URL(window.location.href);
  url.searchParams.delete('devkey');
  window.history.replaceState({}, '', url.toString());
}

// 청크 로딩 실패(동적 import 실패) 자동 복구 — 이 앱은 App.tsx에서 별자리 계산 등을
// import()로 나눠 불러오는데(계획안.md 7-AS 참고), 아래 두 상황에서 그 fetch가 실패할 수 있음:
//   1) 지하철 등 네트워크가 순간적으로 끊긴 경우
//   2) 사용자가 탭을 오래 열어둔 사이 새 버전이 배포돼, 브라우저가 기억하는 파일 해시가
//      더 이상 서버에 없는 경우(가장 흔함 — 배포가 잦은 이 프로젝트에서 특히 자주 발생)
// 두 경우 다 화면이 "로딩 중간에 멈추거나 새까맣게" 보일 수 있어(계획안.md 7-AU 참고),
// Vite가 이럴 때 쏘는 vite:preloadError 이벤트를 받아 한 번만 자동 새로고침한다
// (세션당 1회로 제한해 정말 네트워크가 끊긴 상태에서 새로고침이 무한 반복되는 것을 방지).
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  if (sessionStorage.getItem('napuli_reloaded_after_chunk_error')) return;
  sessionStorage.setItem('napuli_reloaded_after_chunk_error', 'true');
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// PWA 서비스워커 — "홈 화면에 추가" + 오프라인 접근을 위한 최소 캐싱(public/sw.js 참고).
// 개발 서버(Vite HMR)와 캐싱이 충돌하지 않도록 프로덕션 빌드에서만 등록.
// 네이티브 앱(Capacitor WebView)에서는 등록해도 무해하지만 의미가 없어 웹에서만 등록.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('서비스워커 등록 실패:', err));
  });
}
