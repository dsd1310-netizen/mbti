import { test, expect, type Page } from '@playwright/test';

/**
 * 골든플로우 스모크 테스트 — 사주 계산/렌더링은 전부 클라이언트 로직이라 Gemini API 없이도
 * 검증 가능한 범위로 의도적으로 한정했다(계획안.md 7-AK 참고). AI 해석 생성·PDF·이미지 카드처럼
 * 실제 `/api/gemini` 응답이 필요한 기능은 이 스위트의 범위 밖 — 여기서는 "화면이 죽지 않고
 * 정상적으로 그려지는지"만 지킨다.
 *
 * 기본 입력값(App.tsx formData 초기값: 1995-09-27 오시 · 여성 · ENTP · 서울)이 이미 유효한
 * 값으로 채워져 있어, 테스트에서는 이름만 입력하면 바로 제출 가능하다.
 */

function skipOnboarding(page: Page) {
  return page.addInitScript(() => {
    localStorage.setItem('napuli_onboarding_seen', 'true');
  });
}

// 💡 기능 가이드 팝업(계획안.md 7-AT)은 온보딩과 무관하게 하루 한 번 자동으로 뜨는데,
// 골든플로우 테스트의 첫 클릭(시작하기/제출 버튼)을 모달 오버레이가 가로채 실패시킨다.
// 오늘 이미 본 것으로 미리 표시해 테스트에서는 항상 자동 표시를 건너뛴다.
function skipGuidePopup(page: Page) {
  return page.addInitScript(() => {
    // appHelpers.ts의 todayDateStr()과 동일하게 로컬 날짜 기준(UTC 아님)으로 맞춰야
    // 자정 근처 타임존 오차로 오탐(스킵 실패)하지 않는다.
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem('napuli_guide_last_shown', today);
  });
}

const consoleErrors: string[] = [];
function watchForErrors(page: Page) {
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`);
  });
}

test('온보딩 → 입력 → 제출 → 결과 화면까지 도달한다', async ({ page }) => {
  watchForErrors(page);
  await skipGuidePopup(page);
  await page.goto('/');

  // 온보딩 화면(최초 1회) — "시작하기" 클릭 시 입력 폼으로 전환
  await expect(page.getByRole('button', { name: /시작하기/ })).toBeVisible();
  await page.getByRole('button', { name: /시작하기/ }).click();

  await page.getByPlaceholder('예: 홍길동').fill('테스트유저');
  await page.getByRole('button', { name: /정밀 만세력.*나풀이 분석 시작/ }).click();

  // 로딩 화면을 거쳐 결과 화면(사주원국 4기둥 카드)에 도달할 때까지 대기.
  // AI 인트로 호출이 실패해도(테스트 서버엔 /api/gemini가 없음) 결과 화면 자체는 그대로 뜨도록
  // 설계돼 있음(App.tsx 로딩 useEffect의 try/catch) — 다만 재시도 루프 때문에 다소 걸릴 수 있어 넉넉히 대기.
  await expect(page.locator('.pillar-grid')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.pillar-card')).toHaveCount(4); // 시간 모름 아님 → 연/월/일/시주 4기둥

  const dayPillar = page.locator('.pillar-card.pillar-day .pillar-hanja');
  await expect(dayPillar).not.toBeEmpty();
});

test('2월 30일처럼 존재하지 않는 날짜는 제출을 막는다', async ({ page }) => {
  watchForErrors(page);
  await skipOnboarding(page);
  await skipGuidePopup(page);
  await page.goto('/');

  await page.getByPlaceholder('예: 홍길동').fill('테스트유저');
  await page.getByPlaceholder('월').fill('2');
  await page.getByPlaceholder('일').fill('30');
  await page.getByRole('button', { name: /정밀 만세력.*나풀이 분석 시작/ }).click();

  await expect(page.locator('.toast')).toContainText('존재하지 않는 날짜');
  // 결과 화면으로 넘어가지 않고 입력 폼이 그대로 남아있어야 함
  await expect(page.getByPlaceholder('예: 홍길동')).toBeVisible();
});

test('"태어난 시간을 모릅니다" 체크 시 사주원국이 3기둥만 표시된다', async ({ page }) => {
  watchForErrors(page);
  await skipOnboarding(page);
  await skipGuidePopup(page);
  await page.goto('/');

  await page.getByPlaceholder('예: 홍길동').fill('테스트유저');
  await page.getByText('태어난 시간을 모릅니다').click();
  await page.getByRole('button', { name: /정밀 만세력.*나풀이 분석 시작/ }).click();

  await expect(page.locator('.pillar-grid')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.pillar-card')).toHaveCount(3); // 시주 제외
});

test('결과 화면의 대분류/서브 탭을 전환해도 콘솔 에러 없이 정상 렌더링된다', async ({ page }) => {
  watchForErrors(page);
  await skipOnboarding(page);
  await skipGuidePopup(page);
  await page.goto('/');

  await page.getByPlaceholder('예: 홍길동').fill('테스트유저');
  await page.getByRole('button', { name: /정밀 만세력.*나풀이 분석 시작/ }).click();
  await expect(page.locator('.pillar-grid')).toBeVisible({ timeout: 60000 });

  // [2026-08-21] 대분류/서브 탭 라벨에서 이모지를 빼고 일러스트 아이콘(이미지)으로 교체함
  // (계획안.md 7-BL 참고) — 매칭 텍스트를 이모지 없는 새 라벨로 갱신.
  for (const label of [/오늘/, /사주/, /별자리/]) {
    await page.getByRole('tab', { name: label }).click();
  }

  await page.getByRole('tab', { name: /사주/ }).click();
  for (const label of [/운세/, /해석/, /궁합/, /풍수/]) {
    await page.getByRole('tab', { name: label }).click();
  }

  // 테스트 서버엔 /api/gemini가 없어 오늘의 타로/트랜짓 등 AI 콘텐츠 요청이 404로 실패하는 게
  // 정상 — 브라우저가 남기는 네트워크 실패 로그(및 앱이 그걸 잡아서 남기는 [GeminiAPI] 경고)는
  // 이 테스트의 관심사가 아니므로 제외하고, 그 외 진짜 예기치 못한 에러만 검사한다.
  const EXPECTED_PATTERNS = [/api\/gemini/, /Failed to fetch/, /Failed to load resource/, /404/, /\[GeminiAPI\]/];
  const unexpected = consoleErrors.filter((e) => !EXPECTED_PATTERNS.some((p) => p.test(e)));
  expect(unexpected, `예상치 못한 콘솔 에러:\n${unexpected.join('\n')}`).toEqual([]);
});
