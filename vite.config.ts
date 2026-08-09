import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // Electron 상대 경로 로딩 필수
  test: {
    environment: 'node', // 계산 엔진은 순수 함수라 DOM 불필요 — jsdom보다 빠름
    include: ['src/**/*.test.ts'],
  },
})
