/**
 * src/data/newMoons.ts 재생성 스크립트 — "손없는날" 계산에 필요한 신월(New Moon, 음력 매월 1일)
 * 시각만 계산한다(음력 월 번호·윤달 배정 로직은 손없는날 판정에 불필요해 의도적으로 생략 —
 * scripts/generateSolarTerms.ts와 같은 astronomy-engine을 SearchMoonPhase(0, ...)로 사용).
 *
 * 검증: 2020~2025년 계산 결과가 실제 설날(음력 1월 1일) 6개 연도 전부와 정확히 일치함을 확인
 * (2020-01-25/2021-02-12/2022-02-01/2023-01-22/2024-02-10/2025-01-29). KASI 음양력 변환
 * 페이지(astro.kasi.re.kr/life/pageView/8)는 JS 기반 폼이라 직접 GET 대조는 못 했음 — 계획안.md 참고.
 *
 * 실행: npx tsx scripts/generateNewMoons.ts
 */
import * as Astronomy from 'astronomy-engine';
import { writeFileSync } from 'fs';
import { join } from 'path';

const START_YEAR = 1900;
const END_YEAR = 2100;

// 넉넉한 여유를 두고 START_YEAR 한 해 전부터 탐색 시작(END_YEAR 다음 신월까지 포함해
// 연말 날짜의 "현재 음력월" 판정이 항상 가능하도록).
let cursor = new Date(Date.UTC(START_YEAR - 1, 11, 1));
const newMoons: [number, number, number][] = [];

while (true) {
  const result = Astronomy.SearchMoonPhase(0, cursor, 40);
  if (!result) throw new Error(`신월 탐색 실패: ${cursor.toISOString()}`);
  const kst = new Date(result.date.getTime() + 9 * 3600 * 1000); // UTC+9 (동경 135도 표준시)
  const y = kst.getUTCFullYear();
  if (y > END_YEAR + 1) break;
  newMoons.push([y, kst.getUTCMonth() + 1, kst.getUTCDate()]);
  cursor = new Date(result.date.getTime() + 3600 * 1000); // 다음 탐색은 1시간 뒤부터(같은 삭 재검출 방지)
}

const out = `/**
 * 신월(New Moon, 음력 매월 1일) 날짜 목록 — ${START_YEAR}~${END_YEAR}년 범위(여유분 포함).
 * "손없는날"(src/utils/lunarCalendar.ts) 계산 전용 — 음력 월 번호·윤달 배정은 다루지 않는다.
 * scripts/generateNewMoons.ts로 재생성 가능. [year, month, day] = 그 신월이 속하는 KST 날짜.
 */
export const NEW_MOONS: [number, number, number][] = [
${newMoons.map(([y, m, d]) => `  [${y},${m},${d}],`).join('\n')}
];
`;

writeFileSync(join(__dirname, '..', 'src', 'data', 'newMoons.ts'), out, 'utf-8');
console.log(`생성 완료: 신월 ${newMoons.length}개 (${newMoons[0]} ~ ${newMoons[newMoons.length - 1]})`);
