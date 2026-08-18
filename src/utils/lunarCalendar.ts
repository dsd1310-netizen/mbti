/**
 * "손없는날" 계산 — 음력 날짜 끝자리가 9 또는 0인 날(9·10·19·20·29·30일)은 손(귀신)이 없어
 * 이사·혼례 등에 좋다는 민속 개념. 음력 "몇 월"인지(윤달 배정 포함)는 이 판정에 불필요해,
 * "가장 최근 신월(음력 1일)로부터 며칠째인지"만 계산한다 — scripts/generateNewMoons.ts 참고.
 */
import { NEW_MOONS } from '../data/newMoons';

/**
 * 주어진 날짜가 속한 음력월의 일수(신월로부터 며칠째, 1부터 시작)를 반환.
 * 이분 탐색으로 "이 날짜 이하의 가장 최근 신월"을 찾는다.
 */
export function getLunarDayOfMonth(year: number, month: number, day: number): number {
  const target = Date.UTC(year, month - 1, day);

  let lo = 0;
  let hi = NEW_MOONS.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [ny, nm, nd] = NEW_MOONS[mid];
    const t = Date.UTC(ny, nm - 1, nd);
    if (t <= target) {
      idx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (idx === -1) throw new Error(`날짜(${year}-${month}-${day})가 신월 데이터 범위를 벗어났습니다.`);

  const [ny, nm, nd] = NEW_MOONS[idx];
  const newMoonTime = Date.UTC(ny, nm - 1, nd);
  const diffDays = Math.round((target - newMoonTime) / 86400000);
  return diffDays + 1; // 신월 당일 = 음력 1일
}

/** 음력 날짜 끝자리가 9 또는 0인 "손없는날"인지 판정. */
export function isSohnEobsNeunNal(year: number, month: number, day: number): boolean {
  const lunarDay = getLunarDayOfMonth(year, month, day);
  const last = lunarDay % 10;
  return last === 9 || last === 0;
}
