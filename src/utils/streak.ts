/**
 * "오늘" 탭 연속 방문일수(스트릭) — 계획안.md 8-2 습관화 요소.
 * 서버 없이 기기 안(localStorage)에서만 계산되는 가벼운 카운터.
 *
 * [2026-08-07] 스트릭 표시만 있고 "얻는 것"이 없어 습관화 효과가 약하다는 지적에 따라
 * 마일스톤 배지 + 공유 가능한 이미지 카드를 추가(App.tsx의 handleDownloadPersonaCard 재사용).
 * 이 앱엔 결제/유료 기능이 없어 "무료 이용권"류 보상은 의미가 없고, 대신 도달 자체를 눈에
 * 띄게 만들고(배지 티어) 자랑할 거리(카드 공유)를 주는 방향으로 설계.
 */
const LAST_VISIT_KEY = 'napuli_streak_last_visit'; // YYYY-MM-DD
const COUNT_KEY = 'napuli_streak_count';
const CELEBRATED_KEY = 'napuli_streak_celebrated_max'; // 지금까지 축하 토스트를 띄운 최고 마일스톤(일수)

export interface StreakTier {
  days: number;
  label: string;
  emoji: string;
}

// 우주/별자리 테마와 어울리는 이름으로 구성 — 앱 전체 톤(보라/골드, 별빛)과 통일.
export const STREAK_TIERS: StreakTier[] = [
  { days: 3, label: '새싹', emoji: '🌱' },
  { days: 7, label: '불꽃', emoji: '🔥' },
  { days: 14, label: '별빛', emoji: '⭐' },
  { days: 30, label: '나풀이 마스터', emoji: '👑' },
  { days: 100, label: '다이아몬드', emoji: '💎' },
];

/** 지금 streakCount로 얻을 수 있는 가장 높은 티어(없으면 null) — 배지 상시 표시용. */
export function getHighestTier(streakCount: number): StreakTier | null {
  return STREAK_TIERS.filter(t => t.days <= streakCount).pop() ?? null;
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
 * - 스트릭이 끊기고 새로 시작되면 "축하한 최고 마일스톤" 기록도 초기화해, 다음 번 스트릭에서
 *   같은 배지를 다시 딸 때도 축하 토스트가 다시 뜨도록 함(한 번 쓰고 버려지는 배지가 아니게).
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

  return { count: nextCount, newTier };
}
