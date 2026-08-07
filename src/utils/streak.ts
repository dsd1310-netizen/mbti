/**
 * "오늘" 탭 연속 방문일수(스트릭) — 계획안.md 8-2 습관화 요소.
 * 서버 없이 기기 안(localStorage)에서만 계산되는 가벼운 카운터.
 *
 * [2026-08-07] 스트릭 표시만 있고 "얻는 것"이 없어 습관화 효과가 약하다는 지적에 따라
 * 마일스톤 배지 + 공유 가능한 이미지 카드를 추가(App.tsx의 handleDownloadPersonaCard 재사용).
 * 이 앱엔 결제/유료 기능이 없어 "무료 이용권"류 보상은 의미가 없고, 대신 도달 자체를 눈에
 * 띄게 만들고(배지 티어) 자랑할 거리(카드 공유)를 주는 방향으로 설계.
 *
 * [2026-08-07 2차] "질문을 1개씩" 방식으로 방향을 더 구체화 — ① 티어마다 카드 색상/화려함을
 * 다르게(사용자가 "게임 레어도"처럼 초록→주황→파랑→보라→시안 순으로 진해지길 원함),
 * ② 스트릭이 끊겨도 예전에 딴 배지가 사라지지 않도록 별도의 영구 기록(EARNED_TIERS_KEY)을
 * 신설 — 기존엔 streakCount(끊기면 1로 리셋)로만 "현재 티어"를 계산해서, 스트릭이 끊기는 순간
 * 이전에 땄던 배지 자체가 화면에서 사라지는 문제가 있었음.
 */
const LAST_VISIT_KEY = 'napuli_streak_last_visit'; // YYYY-MM-DD
const COUNT_KEY = 'napuli_streak_count';
const CELEBRATED_KEY = 'napuli_streak_celebrated_max'; // 지금까지 축하 토스트를 띄운 최고 마일스톤(일수) — 스트릭 리셋 시 함께 초기화됨
const EARNED_TIERS_KEY = 'napuli_streak_earned_tiers'; // 스트릭 리셋과 무관하게 영구 보존되는 배지 기록

export interface StreakTier {
  days: number;
  label: string;
  emoji: string;
  accent: string;     // 카드 메달리온 밝은 색
  accentDark: string;  // 카드 메달리온 어두운 색(그라디언트 하단)
  glow: string;        // 카드 메달리온 글로우 색(rgba)
  sparkle: number;     // 0~4, 높을수록 카드 장식(반짝임 개수)이 화려해짐
}

export interface EarnedTier {
  days: number;
  earnedAt: string; // YYYY-MM-DD, 처음 딴 날짜
}

// 우주/별자리 테마와 어울리는 이름 + "게임 레어도"처럼 초록→주황→파랑→보라→시안 순으로
// 색과 화려함이 단계적으로 진해지도록 구성(사용자 확정 방향).
export const STREAK_TIERS: StreakTier[] = [
  { days: 3, label: '새싹', emoji: '🌱', accent: '#4ade80', accentDark: '#166534', glow: 'rgba(74, 222, 128, 0.5)', sparkle: 0 },
  { days: 7, label: '불꽃', emoji: '🔥', accent: '#fb923c', accentDark: '#9a3412', glow: 'rgba(251, 146, 60, 0.5)', sparkle: 1 },
  { days: 14, label: '별빛', emoji: '⭐', accent: '#60a5fa', accentDark: '#1e40af', glow: 'rgba(96, 165, 250, 0.55)', sparkle: 2 },
  { days: 30, label: '나풀이 마스터', emoji: '👑', accent: '#a78bfa', accentDark: '#4c1d95', glow: 'rgba(167, 139, 250, 0.6)', sparkle: 3 },
  { days: 100, label: '다이아몬드', emoji: '💎', accent: '#67e8f9', accentDark: '#155e75', glow: 'rgba(103, 232, 249, 0.65)', sparkle: 4 },
];

/** 지금 streakCount로 얻을 수 있는 가장 높은 티어(없으면 null) — 프로필 배너 상시 표시용. */
export function getHighestTier(streakCount: number): StreakTier | null {
  return STREAK_TIERS.filter(t => t.days <= streakCount).pop() ?? null;
}

/** 스트릭이 끊긴 뒤에도 사라지지 않는 영구 배지 기록. */
export function getEarnedTiers(): EarnedTier[] {
  try {
    const raw = localStorage.getItem(EARNED_TIERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function addEarnedTier(days: number, dateStr: string): void {
  const earned = getEarnedTiers();
  if (earned.some(e => e.days === days)) return; // 이미 딴 배지는 최초 획득일 그대로 유지
  earned.push({ days, earnedAt: dateStr });
  localStorage.setItem(EARNED_TIERS_KEY, JSON.stringify(earned));
}

function daysBetween(fromStr: string, toStr: string): number {
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/**
 * 오늘 방문을 기록하고 현재 연속 방문일수 + (오늘 새로 딴 배지가 있다면) 그 티어를 반환한다.
 * - 오늘 이미 방문 기록이 있으면 카운트를 그대로 반환(같은 날 여러 번 호출해도 중복 증가 없음),
 *   newTier는 항상 null(같은 날 재방문으로는 축하가 반복되지 않음).
 * - 어제 방문했다면 +1, 그 외(첫 방문/하루 이상 건너뜀)라면 1로 리셋.
 * - 스트릭이 끊기고 새로 시작되면 "축하한 최고 마일스톤" 기록(CELEBRATED_KEY)만 초기화해,
 *   다음 번 스트릭에서 같은 배지를 다시 딸 때도 축하 토스트가 다시 뜨도록 함. 단, 영구 배지
 *   기록(EARNED_TIERS_KEY)은 리셋하지 않음 — 한 번 딴 배지는 다이어리 "내 배지" 컬렉션에 계속 남음.
 * - 현재 streakCount로 도달 가능한 모든 티어를 매번 영구 기록에 반영(이미 있으면 무시)해서,
 *   이 기능이 추가되기 전부터 이미 스트릭이 쌓여있던 사용자도 다음 방문 시 자동으로 소급 반영됨.
 */
export function recordTodayVisitAndGetStreak(todayStr: string): { count: number; newTier: StreakTier | null } {
  const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
  const prevCount = Number(localStorage.getItem(COUNT_KEY)) || 0;

  if (lastVisit === todayStr) {
    return { count: prevCount || 1, newTier: null };
  }

  const continuing = !!lastVisit && daysBetween(lastVisit, todayStr) === 1;
  const nextCount = continuing ? prevCount + 1 : 1;
  localStorage.setItem(LAST_VISIT_KEY, todayStr);
  localStorage.setItem(COUNT_KEY, String(nextCount));
  if (!continuing) localStorage.removeItem(CELEBRATED_KEY);

  const celebratedMax = Number(localStorage.getItem(CELEBRATED_KEY)) || 0;
  const newTier = STREAK_TIERS.filter(t => t.days <= nextCount && t.days > celebratedMax).pop() ?? null;
  if (newTier) localStorage.setItem(CELEBRATED_KEY, String(newTier.days));

  for (const t of STREAK_TIERS) {
    if (t.days <= nextCount) addEarnedTier(t.days, todayStr);
  }

  return { count: nextCount, newTier };
}
