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
