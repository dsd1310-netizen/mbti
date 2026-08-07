import { defineConfig, devices } from '@playwright/test';

/**
 * 골든플로우 E2E 스모크 테스트 — 실제 Gemini API 키 없이도(net-independent) 검증 가능한
 * 범위로 의도적으로 한정함(입력→계산→렌더링은 전부 클라이언트 로직이라 AI 호출이 필요 없음).
 * `npm run build`가 만든 정적 산출물을 `vite preview`로 서빙해 테스트 — 실제 배포와 가장 가까운
 * 형태. 배포 직전 회귀 검증용으로 `npm run test:e2e`(먼저 `npm run build` 필요)로 실행.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
