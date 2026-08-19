import { useState } from 'react';
import { GwiinTypeMeta } from '../utils/pairCompatibility';

export interface GwiinMapNode {
  id: string;
  name: string;
  genderEmoji: string; // 🌊(남)/🌸(여)
  type: GwiinTypeMeta;
  detail: string; // 학술적 설명 — 노드를 탭하면 뜨는 설명 팝업에 노출
}

/**
 * 귀인지도 — 나를 중심으로 지금까지 비교한 사람들을 오행 상생상극 관계 유형별로
 * 방사형으로 배치해 보여주는 SVG 다이어그램. 데이터(관계 판정)는 pairCompatibility.ts를
 * 그대로 쓰고, 이 컴포넌트는 순수 시각화만 담당한다.
 *
 * 노드를 탭하면 먼저 설명 팝업(이모지·라벨·상세 설명)이 뜨고, 그 안의 "다시 비교하기" 버튼을
 * 눌러야 실제 재비교(onNodeClick)가 실행된다 — 예전엔 탭=재비교 직행이라 설명을 볼 방법이
 * SVG <title>(호버 전용, 모바일에서 사실상 안 뜸)뿐이었던 문제를 해결(계획안.md 참고).
 */
export function GwiinMap({ centerName, nodes, onNodeClick }: {
  centerName: string;
  nodes: GwiinMapNode[];
  onNodeClick: (id: string) => void;
}) {
  const [selected, setSelected] = useState<GwiinMapNode | null>(null);

  const size = 320;
  const center = size / 2;
  const orbitRadius = 118;
  const nodeRadius = 32;
  const centerRadius = 40;

  return (
    <>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 380, display: 'block', margin: '0 auto' }} role="img" aria-label={`${centerName}님의 귀인지도`}>
        <style>{`
          @keyframes gwiinFadeIn { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
          .gwiin-node { animation: gwiinFadeIn 0.45s ease-out backwards; transform-origin: center; transform-box: fill-box; }
        `}</style>
        <defs>
          <radialGradient id="gwiinCenterGrad" cx="36%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffe577" />
            <stop offset="100%" stopColor="#f5c842" />
          </radialGradient>
          {nodes.map(node => (
            <radialGradient key={`glow-${node.id}`} id={`gwiinGlow-${node.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={node.type.color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={node.type.color} stopOpacity={0} />
            </radialGradient>
          ))}
        </defs>

        {nodes.map((node, idx) => {
          const angle = (2 * Math.PI * idx) / nodes.length - Math.PI / 2;
          const x = center + orbitRadius * Math.cos(angle);
          const y = center + orbitRadius * Math.sin(angle);
          return <line key={node.id} x1={center} y1={center} x2={x} y2={y} stroke={node.type.color} strokeOpacity={0.35} strokeWidth={2} />;
        })}

        {/* 나 (중심) */}
        <circle cx={center} cy={center} r={centerRadius + 10} fill="url(#gwiinCenterGrad)" opacity={0.25} />
        <circle cx={center} cy={center} r={centerRadius} fill="url(#gwiinCenterGrad)" stroke="var(--gold)" strokeWidth={2} />
        <text x={center} y={center + 6} textAnchor="middle" fontSize={16} fontWeight={800} fill="#1a1530">나</text>

        {nodes.map((node, idx) => {
          const angle = (2 * Math.PI * idx) / nodes.length - Math.PI / 2;
          const x = center + orbitRadius * Math.cos(angle);
          const y = center + orbitRadius * Math.sin(angle);
          return (
            <g
              key={node.id}
              className="gwiin-node"
              style={{ animationDelay: `${idx * 80}ms` }}
              transform={`translate(${x}, ${y})`}
              onClick={() => setSelected(node)}
              role="button"
              tabIndex={0}
              aria-label={`${node.name} — ${node.type.label}, 눌러서 자세히 보기`}
            >
              <circle r={nodeRadius + 10} fill={`url(#gwiinGlow-${node.id})`} />
              <circle r={nodeRadius} fill="rgba(20, 18, 50, 0.92)" stroke={node.type.color} strokeWidth={3} style={{ cursor: 'pointer' }} />
              <text textAnchor="middle" y={-5} fontSize={20} style={{ pointerEvents: 'none' }}>{node.type.emoji}</text>
              <text textAnchor="middle" y={13} fontSize={10.5} fill="var(--text-secondary)" style={{ pointerEvents: 'none' }}>{node.genderEmoji} {node.name.slice(0, 4)}</text>
            </g>
          );
        })}
      </svg>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-label={`${selected.name} 관계 설명`} onClick={e => e.stopPropagation()}>
            <button className="modal-close" aria-label="닫기" onClick={() => setSelected(null)}>✕</button>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>{selected.type.emoji}</div>
              <div className="section-title" style={{ color: selected.type.color }}>{selected.genderEmoji} {selected.name} · {selected.type.label}</div>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 20, textAlign: 'center' }}>
              {selected.detail}
            </div>
            <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => { const id = selected.id; setSelected(null); onNodeClick(id); }}
            >
              🔄 다시 비교하기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
