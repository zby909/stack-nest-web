import { defineConfig, devices } from '@playwright/test'

// 截图和交互稿运行相同的源码入口，使用独立回环端口，避免占用开发者正在浏览的预览。
export default defineConfig({
  testDir: '.',
  globalSetup: './showcase-server.ts',
  outputDir: '../node_modules/.tmp/visual-results',
  snapshotPathTemplate: '{testDir}/../docs/images/{arg}{ext}',
  updateSnapshots: 'changed',
  workers: 1,
  reporter: 'line',
  timeout: 90_000,
  use: {
    actionTimeout: 12_000,
    baseURL: 'http://127.0.0.1:4177',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  projects: [
    {
      name: 'desktop',
      testMatch: 'showcase.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 960 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'mobile',
      testMatch: 'showcase.ts',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 },
    },
    { name: 'gallery', testMatch: 'gallery.ts', dependencies: ['desktop', 'mobile'] },
  ],
})
