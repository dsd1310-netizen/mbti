import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// React 컴포넌트 렌더링 중 예기치 못한 오류가 나면 흰 화면 대신 복구 UI를 보여줌.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    console.error('[ErrorBoundary] 렌더링 중 오류 발생:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            background: '#050510',
            color: '#f0eeff',
            textAlign: 'center',
            padding: 24,
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          <div style={{ fontSize: 40 }}>🔮</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>예기치 못한 오류가 발생했어요</h1>
          <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 320, lineHeight: 1.6, margin: 0 }}>
            나풀이가 잠시 길을 잃었어요. 새로고침하면 다시 정상적으로 이용하실 수 있어요.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #a78bfa, #f0abfc)',
              color: '#1b1440',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            🔄 새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
