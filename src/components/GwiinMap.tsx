import { GwiinTypeMeta } from '../utils/pairCompatibility';

export interface GwiinMapNode {
  id: string;
  name: string;
  genderEmoji: string; // 🌊(남)/🌸(여)
  type: GwiinTypeMeta;
  detail: string; // 학술적 설명 — 노드에 마우스 올렸을 때 title로 노출
}

/**
 * 귀인지도 — 나를 중심으로 지금까지 비교한 사람들을 오행 상생상극 관계 유형별로
 * 방사형으로 배치해 보여주는 SVG 다이어그램. 데이터(관계 판정)는 pairCompatibility.ts를
 * 그대로 쓰고, 이 컴포넌트는 순수 시각화만 담당한다.
 */
export function GwiinMap({ centerName, nodes, onNodeClick }: {
  centerName: string;
  nodes: GwiinMapNode[];
  onNodeClick: (id: string) => void;
}) {
  const size = 300;
  const center = size / 2;
  const orbitRadius = 105;
  const nodeRadius = 26;
  const centerRadius = 32;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 340, display: 'block', margin: '0 auto' }} role="img" aria-label={`${centerName}님의 귀인지도`}>
      {nodes.map((node, idx) => {
        const angle = (2 * Math.PI * idx) / nodes.length - Math.PI / 2;
        const x = center + orbitRadius * Math.cos(angle);
        const y = center + orbitRadius * Math.sin(angle);
        return (
          <g key={node.id}>
            <line x1={center} y1={center} x2={x} y2={y} stroke={node.type.color} strokeOpacity={0.35} strokeWidth={2} />
          </g>
        );
      })}

      {/* 나 (중심) */}
      <circle cx={center} cy={center} r={centerRadius} fill="url(#gwiinCenterGrad)" stroke="var(--gold)" strokeWidth={1.5} />
      <text x={center} y={center + 5} textAnchor="middle" fontSize={13} fontWeight={800} fill="#1a1530">나</text>

      {nodes.map((node, idx) => {
        const angle = (2 * Math.PI * idx) / nodes.length - Math.PI / 2;
        const x = center + orbitRadius * Math.cos(angle);
        const y = center + orbitRadius * Math.sin(angle);
        return (
          <g
            key={node.id}
            transform={`translate(${x}, ${y})`}
            style={{ cursor: 'pointer' }}
            onClick={() => onNodeClick(node.id)}
            role="button"
            aria-label={`${node.name} — ${node.type.label}`}
          >
            <title>{node.name} · {node.type.label} — {node.detail}</title>
            <circle r={nodeRadius} fill="rgba(20, 18, 50, 0.9)" stroke={node.type.color} strokeWidth={2.5} />
            <text textAnchor="middle" y={-4} fontSize={16}>{node.type.emoji}</text>
            <text textAnchor="middle" y={10} fontSize={9} fill="var(--text-secondary)">{node.genderEmoji} {node.name.slice(0, 4)}</text>
          </g>
        );
      })}

      <defs>
        <radialGradient id="gwiinCenterGrad" cx="36%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffe577" />
          <stop offset="100%" stopColor="#f5c842" />
        </radialGradient>
      </defs>
    </svg>
  );
}
