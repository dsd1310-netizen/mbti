import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'

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
