import { defineConfig } from '@playwright/test'
import base from '../playwright.config.ts'

// 截图只运行本地虚构数据示例，产物写入文档目录。
export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'showcase.ts',
  fullyParallel: false,
  workers: 1,
  use: { ...base.use, colorScheme: 'light', reducedMotion: 'reduce' },
  webServer: {
    ...base.webServer,
    command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4175 --strictPort',
    env: { STACKNEST_BUILD_VERSION: 'dev', STACKNEST_BUILD_REVISION: 'unknown' },
  },
  projects: base.projects?.map((project) => ({
    ...project,
    use: { ...project.use, deviceScaleFactor: 1 },
  })),
})
