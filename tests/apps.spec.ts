import { test, expect } from '@playwright/test'
import { admin } from './data.ts'
import type { AppView, AppInput } from '../src/types/app.ts'

const initial: AppView = {
  app: {
    id: '0c2d84bb-15a1-492b-938a-83282600c112',
    ownerId: admin.id,
    ownerEmail: admin.email,
    name: 'Small HTTP',
    slug: 'small-http',
    image: 'example/http:v1',
    port: 3000,
    memoryMiB: 128,
    cpus: 0.5,
    dataPath: '/app/data',
    healthPath: '/health',
    envKeys: ['SECRET'],
    hasRegistry: true,
    generation: 1,
    status: 'ready',
    createdAt: '2026-10-09T01:00:00Z',
    updatedAt: '2026-10-09T01:00:00Z',
    url: 'http://stack-nest--app-small-http.localhost:4175/',
  },
  runtime: {
    state: 'running',
    oomKilled: false,
    exitCode: 0,
    containerId: 'aaaaaaaaaaaa',
    imageId: 'image-test',
    health: 'healthy',
    healthCheck: 'http',
    usage: {
      cpuPercent: 12.5,
      memoryBytes: 32 * 1024 * 1024,
      memoryLimitBytes: 128 * 1024 * 1024,
      pids: 7,
      sampledAt: '2026-10-10T13:00:00Z',
    },
  },
}

// installAPI 在独立上下文模拟应用接口；未知 API 立即失败，测试不连接任何服务器。
async function installAPI(
  page: import('@playwright/test').Page,
  options: { empty?: boolean; user?: boolean } = {},
) {
  const state = {
    apps: options.empty ? ([] as AppView[]) : [structuredClone(initial)],
    writes: [] as { path: string; body: Record<string, unknown> }[],
    failed: false,
  }
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    // reply 统一模拟 JSON 响应。
    const reply = (body: unknown, status = 200) => route.fulfill({ status, json: body })
    if (path === '/api/auth/session')
      return reply(options.user ? { ...admin, role: 'user' } : admin)
    if (path === '/api/apps' && method === 'GET') {
      if (state.failed) return reply({ error: '暂时无法获取应用' }, 503)
      return reply({
        apps: state.apps,
        available: true,
        limits: { maxApps: 3, totalMemoryMiB: 768, maxMemoryMiB: 512 },
      })
    }
    if (path.endsWith('/logs'))
      return reply({ text: '<script>window.logExecuted = true</script>\n[已隐藏]' })
    if (method === 'POST' || method === 'PUT') {
      const body = request.postDataJSON() as Record<string, unknown>
      state.writes.push({ path, body })
      if (path.endsWith('/actions')) {
        const next = structuredClone(state.apps[0])
        next.app.generation += 1
        next.app.status = 'pending'
        next.app.action = body.action as string
        state.apps = [next]
        return reply(next, 202)
      }
      const input = body as unknown as AppInput
      const next = structuredClone(initial)
      Object.assign(next.app, {
        name: input.name,
        slug: input.slug,
        image: input.image,
        port: input.port,
        memoryMiB: input.memoryMiB,
        cpus: input.cpus,
        dataPath: input.dataPath,
        healthPath: input.healthPath,
      })
      if (input.replaceEnv) next.app.envKeys = Object.keys(input.env)
      next.app.hasRegistry =
        !!input.registry || (!!state.apps[0]?.app.hasRegistry && !input.clearRegistry)
      if (method === 'PUT') next.app.generation += 1
      state.apps = [next]
      return reply(next, 202)
    }
    throw new Error(`Unexpected application API: ${method} ${path}`)
  })
  return state
}

// 普通用户也能部署；界面提交真实配置，编辑不会回显已保存的秘密。
test('部署与编辑应用保留敏感配置', async ({ page }) => {
  const state = await installAPI(page, { empty: true, user: true })
  await page.goto('/apps')
  await expect(page.getByRole('heading', { name: '让应用运行起来。' })).toBeVisible()
  await page.getByRole('button', { name: '＋ 部署应用' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('应用名称', { exact: true }).fill('Small HTTP')
  await dialog.getByLabel('应用标识', { exact: true }).fill('small-http')
  await dialog.getByLabel('镜像地址', { exact: true }).fill('example/http:v1')
  await dialog.getByLabel('HTTP 健康检查路径（可选）', { exact: true }).fill('/health')
  await dialog.getByLabel('环境变量', { exact: true }).fill('SECRET=a=b')
  await dialog.getByText('私有仓库（可选）', { exact: true }).click()
  await dialog.getByLabel('仓库用户名', { exact: true }).fill('test-user')
  await dialog.getByLabel('仓库密码 / 访问令牌', { exact: true }).fill('fake-registry-secret')
  await dialog.getByRole('button', { name: '开始部署', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.writes[0].body).toMatchObject({
    env: { SECRET: 'a=b' },
    registry: { username: 'test-user', password: 'fake-registry-secret' },
    replaceEnv: true,
    healthPath: '/health',
  })
  await expect(page.getByRole('article', { name: 'Small HTTP' })).toBeVisible()
  await page.getByRole('button', { name: /^更\s*新$/ }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('HTTP 健康检查路径（可选）', { exact: true })).toHaveValue(
    '/health',
  )
  await expect(dialog.getByLabel('环境变量', { exact: true })).toBeDisabled()
  await expect(dialog.getByLabel('环境变量', { exact: true })).toHaveValue('')
  await dialog.getByText('私有仓库（已有凭据，留空保留）', { exact: true }).click()
  await expect(dialog.getByLabel('仓库密码 / 访问令牌', { exact: true })).toHaveValue('')
  await dialog.getByRole('button', { name: '提交更新', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.writes[1].body).toMatchObject({
    replaceEnv: false,
    clearRegistry: false,
    generation: 1,
    healthPath: '/health',
  })
  expect(state.writes[1].body).not.toHaveProperty('registry')
})

// 删除必须确认；取消不发请求，日志只按文本呈现，旧页面也能看到排队状态。
test('应用日志安全与删除确认', async ({ page }) => {
  const state = await installAPI(page)
  await page.goto('/apps')
  const article = page.getByRole('article', { name: 'Small HTTP' })
  await expect(article.getByRole('link', { name: '打开应用 ↗' })).toHaveAttribute(
    'href',
    initial.app.url,
  )
  await article.getByRole('button', { name: /^日\s*志$/ }).click()
  let dialog = page.getByRole('dialog')
  await expect(
    dialog.getByText('<script>window.logExecuted = true</script>', { exact: false }),
  ).toBeVisible()
  expect(await page.evaluate(() => 'logExecuted' in window)).toBe(false)
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await article.getByRole('button', { name: /^删\s*除$/ }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByText(/持久化数据/)).toBeVisible()
  await dialog.getByRole('button', { name: /^取\s*消$/ }).click()
  expect(state.writes).toHaveLength(0)
  await article.getByRole('button', { name: /^停\s*止$/ }).click()
  await expect(article.getByText('等待执行', { exact: true })).toBeVisible()
  await expect(article.getByRole('button', { name: /^更\s*新$/ })).toBeDisabled()
  expect(state.writes[0].body).toEqual({ action: 'stop', generation: 1 })
})

// 重复变量不会提交，布局在手机上没有横向溢出。
test('应用输入边界与手机布局', async ({ page }) => {
  const state = await installAPI(page, { empty: true })
  await page.goto('/apps')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('button', { name: '＋ 部署应用' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('应用名称', { exact: true }).fill('Example')
  await dialog.getByLabel('应用标识', { exact: true }).fill('example')
  await dialog.getByLabel('镜像地址', { exact: true }).fill('example/http:v1')
  await dialog.getByLabel('环境变量', { exact: true }).fill('KEY=one\nKEY=two')
  await dialog.getByRole('button', { name: '开始部署', exact: true }).click()
  await expect(dialog.getByText('环境变量 KEY 重复。', { exact: true })).toBeVisible()
  expect(state.writes).toHaveLength(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

// HTTP 异常不会伪装成停止；采样缺失不能展示为零，恢复后显示当前用量。
test('健康状态与资源采样分别展示', async ({ page }) => {
  const state = await installAPI(page)
  const runtime = state.apps[0].runtime!
  runtime.health = 'unhealthy'
  runtime.usage = undefined
  await page.goto('/apps')
  const article = page.getByRole('article', { name: 'Small HTTP' })
  await expect(article.getByText('运行中', { exact: true })).toBeVisible()
  await expect(article.getByText('HTTP 检查失败', { exact: true })).toBeVisible()
  await expect(article.getByText('暂时无法获取用量，稍后自动重试。')).toBeVisible()
  await expect(article.getByRole('button', { name: /^停\s*止$/ })).toBeEnabled()
  runtime.health = 'healthy'
  runtime.usage = structuredClone(initial.runtime!.usage)
  await page.getByRole('button', { name: /^刷\s*新$/ }).click()
  await expect(article.getByText('HTTP 正常', { exact: true })).toBeVisible()
  await expect(article.getByText('CPU 12.5%', { exact: true })).toBeVisible()
  await expect(article.getByText('内存 32.0 MiB / 128 MiB', { exact: true })).toBeVisible()
  await expect(article.getByText('进程 / 线程 7', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  runtime.healthCheck = 'tcp'
  runtime.usage!.cpuPercent = undefined
  await page.getByRole('button', { name: /^刷\s*新$/ }).click()
  await expect(article.getByText('端口可连接', { exact: true })).toBeVisible()
  await expect(article.getByText('CPU —', { exact: true })).toBeVisible()
  await expect(article.getByText('端口连通不代表业务正常')).toBeVisible()
})

// 健康路径不能指定其他主机；留空可沿用旧应用的端口检查。
test('健康检查路径拒绝外部地址并支持留空', async ({ page }) => {
  const state = await installAPI(page, { empty: true })
  await page.goto('/apps')
  await page.getByRole('button', { name: '＋ 部署应用' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('应用名称', { exact: true }).fill('Health')
  await dialog.getByLabel('应用标识', { exact: true }).fill('health')
  await dialog.getByLabel('镜像地址', { exact: true }).fill('example/http:v1')
  const input = dialog.getByLabel('HTTP 健康检查路径（可选）', { exact: true })
  await input.fill('//127.0.0.1:8080/health')
  await dialog.getByRole('button', { name: '开始部署', exact: true }).click()
  await expect(
    dialog.getByText('填写 /health 形式的路径，不包含地址、查询参数或片段'),
  ).toBeVisible()
  expect(state.writes).toHaveLength(0)
  await input.fill('')
  await dialog.getByRole('button', { name: '开始部署', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.writes[0].body.healthPath).toBe('')
})
