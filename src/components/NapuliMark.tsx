// 나풀이 심볼 (크리스탈볼 속 별) — 헤더 로고 등에 사용
export function NapuliMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="napuliBallGrad" cx="36%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#c9adff" />
          <stop offset="55%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#4c2889" />
        </radialGradient>
        <linearGradient id="napuliStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe577" />
          <stop offset="100%" stopColor="#f5c842" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="46" r="32" fill="url(#napuliBallGrad)" />
      <ellipse cx="38" cy="31" rx="8" ry="5" fill="#ffffff" opacity="0.32" transform="rotate(-18 38 31)" />
      <path d="M50 26 L54.5 41.5 L70 46 L54.5 50.5 L50 66 L45.5 50.5 L30 46 L45.5 41.5 Z" fill="url(#napuliStarGrad)" />
      <circle cx="50" cy="46" r="4.2" fill="#fffbe8" />
    </svg>
  );
}
