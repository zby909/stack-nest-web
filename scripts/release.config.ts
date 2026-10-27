import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const baseURL = process.env.STACKNEST_SMOKE_BASE_URL
if (!baseURL || !/^http:\/\/localhost:\d+$/.test(baseURL))
  throw new Error('发布回归只能由 server/deploy/check_release.py 启动隔离的本机实例。')

// 发布回归使用已构建镜像中的界面和真实 API，不启用 mock 或另一个前端开发服务。
export default defineConfig({
  testDir: '.',
  testMatch: 'release-smoke.ts',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['line'],
    [
      'html',
      {
        outputFolder: fileURLToPath(new URL('../playwright-report/release', import.meta.url)),
        open: 'never',
      },
    ],
  ],
  outputDir: fileURLToPath(new URL('../test-results/release', import.meta.url)),
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    locale: 'zh-CN',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    launchOptions: { args: ['--host-resolver-rules=MAP *.localhost 127.0.0.1'] },
  },
})
