/**
 * "오늘" 탭 연속 방문일수(스트릭) — 계획안.md 8-2 습관화 요소.
 * 서버 없이 기기 안(localStorage)에서만 계산되는 가벼운 카운터.
 */
const LAST_VISIT_KEY = 'napuli_streak_last_visit'; // YYYY-MM-DD
const COUNT_KEY = 'napuli_streak_count';

function daysBetween(fromStr: string, toStr: string): number {
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/**
 * 오늘 방문을 기록하고 현재 연속 방문일수를 반환한다.
 * - 오늘 이미 방문 기록이 있으면 카운트를 그대로 반환(같은 날 여러 번 호출해도 중복 증가 없음).
 * - 어제 방문했다면 +1.
 * - 그 외(오늘이 첫 방문이거나 하루 이상 건너뛰었다면) 1로 리셋.
 */
export function recordTodayVisitAndGetStreak(todayStr: string): number {
  const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
  const prevCount = Number(localStorage.getItem(COUNT_KEY)) || 0;

  if (lastVisit === todayStr) {
    return prevCount || 1;
  }

  const nextCount = lastVisit && daysBetween(lastVisit, todayStr) === 1 ? prevCount + 1 : 1;
  localStorage.setItem(LAST_VISIT_KEY, todayStr);
  localStorage.setItem(COUNT_KEY, String(nextCount));
  return nextCount;
}
