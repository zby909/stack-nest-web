import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test, expect } from '../tests/fixtures.ts'
import { admin, original } from '../tests/data.ts'
import { assertFits } from '../tests/helpers.ts'
import type { AppList, AppView } from '../src/types/app.ts'

// demoApps 提供可公开的虚构应用及资源采样，不包含真实镜像仓库或环境变量值。
function demoApps(): AppList {
  const apps = [
    {
      id: '0c2d84bb-15a1-492b-938a-83282600c112',
      name: '团队文档 API',
      slug: 'handbook-api',
      image: 'ghcr.io/example/handbook-api:v1.2',
      memoryMiB: 256,
      dataPath: '/app/data',
    },
    {
      id: '0c2d84bb-15a1-492b-938a-83282600c113',
      name: '团队状态页',
      slug: 'status-page',
      image: 'ghcr.io/example/status-page:v1.0',
      memoryMiB: 128,
      dataPath: '',
    },
  ].map((item, index): AppView => ({
    app: {
      ...item,
      ownerId: admin.id,
      ownerEmail: 'owner@example.com',
      port: 3000,
      cpus: 0.5,
      healthPath: '/health',
      envKeys: ['NODE_ENV', 'PORT'],
      hasRegistry: false,
      generation: 1,
      status: 'ready',
      createdAt: '2026-10-12T08:30:00Z',
      updatedAt: '2026-10-12T08:30:00Z',
      url: `https://stack-nest--app-${item.slug}.example.com/`,
    },
    runtime: {
      state: 'running',
      health: 'healthy',
      healthCheck: 'http',
      oomKilled: false,
      exitCode: 0,
      containerId: `example-container-${index}`,
      imageId: 'example-image',
      usage: {
        cpuPercent: index === 0 ? 3.8 : 0.6,
        memoryBytes: (index === 0 ? 82 : 28) * 1024 ** 2,
        memoryLimitBytes: item.memoryMiB * 1024 ** 2,
        pids: index === 0 ? 14 : 5,
        sampledAt: '2026-10-12T08:30:00Z',
      },
      disk: {
        writable: { usedBytes: 128 * 1024 ** 2, limitBytes: 1024 ** 3, source: 'xfs' },
        persistent: item.dataPath
          ? {
              usedBytes: 32 * 1024 ** 2,
              limitBytes: 1024 ** 3,
              usedInodes: 335,
              limitInodes: 100_000,
              source: 'xfs',
            }
          : undefined,
        sampledAt: '2026-10-12T08:30:00Z',
      },
    },
  }))
  return { apps, available: true, limits: { maxApps: 3, totalMemoryMiB: 2048, maxMemoryMiB: 1024 } }
}

// 演示使用虚构项目、邮箱和状态，不读取部署配置或连接真实服务器。
test('生成文档界面截图', async ({ page, api, isMobile }) => {
  api.role = 'superadmin'
  const items = [
    {
      name: '产品介绍页',
      slug: 'landing',
      description: '产品能力、更新计划与联系信息',
      bytes: 1850000,
      count: 24,
    },
    {
      name: '团队文档',
      slug: 'handbook',
      description: '开发约定与常用流程',
      bytes: 726000,
      count: 18,
    },
    {
      name: '作品预览',
      slug: 'portfolio',
      description: '准备发布的新作品',
      bytes: 4360000,
      count: 32,
    },
  ]
  api.projects = items.map((item, index) => {
    const project = structuredClone(original)
    project.id = item.slug
    project.name = item.name
    project.slug = item.slug
    project.description = item.description
    project.ownerEmail = 'owner@example.com'
    project.updatedAt = '2026-10-12T08:30:00Z'
    project.deployments = [
      {
        ...project.deployments![0],
        id: item.slug + '-v1',
        fileName: item.slug + '.zip',
        files: { bytes: item.bytes, count: item.count },
      },
    ]
    if (index === 2)
      project.draft = {
        ...project.deployments[0],
        id: item.slug + '-draft',
        previewUrl: 'https://stack-nest--preview.example.com',
        notes: '调整首页排版与作品说明',
      }
    return project
  })
  await page.route('**/api/auth/session', (route) =>
    route.fulfill({ json: { ...admin, role: 'superadmin', email: 'owner@example.com' } }),
  )
  await page.route('**/api/version', (route) =>
    route.fulfill({ json: { version: 'dev', revision: 'unknown' } }),
  )
  await page.route(/\/api\/apps(?:\/limits)?$/, (route) => {
    if (route.request().method() !== 'GET') throw new Error('展示截图只能读取应用')
    return route.fulfill({
      json: route.request().url().endsWith('/limits')
        ? {
            maxApps: 3,
            totalMemoryMiB: 2048,
            revision: 1,
            usedApps: 2,
            allocatedMemoryMiB: 384,
            maxTotalMemoryMiB: 3072,
          }
        : demoApps(),
    })
  })
  await page.route('**/api/system/diagnostics', (route) =>
    route.fulfill({
      json: {
        checks: [
          { name: 'database', status: 'pass', message: '连接正常，必要数据表存在' },
          { name: 'docker', status: 'pass', message: 'Docker 可达，存储驱动：overlay2' },
          { name: 'quota', status: 'pass', message: '应用可写层与持久化数据已启用硬配额' },
          { name: 'smtp', status: 'pass', message: 'TLS 与 SMTP 认证成功；未发送邮件' },
        ],
        failed: false,
        checkedAt: '2026-10-12T08:30:00Z',
        durationMs: 380,
      },
    }),
  )
  const images = new URL('../docs/images/', import.meta.url)
  await mkdir(images, { recursive: true })
  await page.goto('/projects')
  await expect(page.locator('#projects article')).toHaveCount(3)
  await expect(page.getByText('37.5%', { exact: false })).toBeVisible()
  await assertFits(page)
  await page.screenshot({
    path: fileURLToPath(new URL(isMobile ? 'projects-mobile.png' : 'projects-desktop.png', images)),
    fullPage: true,
    animations: 'disabled',
  })
  if (!isMobile) {
    await page.goto('/apps')
    await expect(page.getByRole('link', { name: '团队文档 API', exact: true })).toBeVisible()
    await expect(page.getByText('HTTP 正常', { exact: true })).toHaveCount(2)
    await assertFits(page)
    await page.screenshot({
      path: fileURLToPath(new URL('docker-desktop.png', images)),
      fullPage: true,
      animations: 'disabled',
    })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/system')
    const card = page.getByRole('region', { name: '平台诊断' })
    await card.getByRole('button', { name: '运行诊断' }).click()
    await expect(card.getByText('Docker 可达，存储驱动：overlay2')).toBeVisible()
    await expect(
      page.getByRole('region', { name: '平台版本' }).getByText('开发构建', { exact: true }),
    ).toHaveCount(2)
    await assertFits(page)
    await page.screenshot({
      path: fileURLToPath(new URL('system-desktop.png', images)),
      fullPage: true,
      animations: 'disabled',
    })
  }
})
