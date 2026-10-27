import { defineConfig, devices } from '@playwright/test'

// 浏览器只访问本机预览服务；命令自动构建、启动和关闭该服务。
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  workers: 2,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['line'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 960 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    env: {
      STACKNEST_BUILD_VERSION: 'v1.2.3-test.1',
      STACKNEST_BUILD_REVISION: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 90_000,
  },
})
