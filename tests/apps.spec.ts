import { test, expect } from '@playwright/test'
import { admin } from './data.ts'
import type { AppView, AppInput, AppLimitsView } from '../src/types/app.ts'

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
  options: { empty?: boolean; user?: boolean; superadmin?: boolean } = {},
) {
  const state = {
    apps: options.empty ? ([] as AppView[]) : [structuredClone(initial)],
    writes: [] as { path: string; body: Record<string, unknown> }[],
    failed: false,
    logText: '<script>window.logExecuted = true</script>\n[已隐藏]',
    logReads: 0,
    limits: {
      maxApps: 3,
      totalMemoryMiB: 768,
      revision: 1,
      usedApps: options.empty ? 0 : 1,
      allocatedMemoryMiB: options.empty ? 0 : 128,
      maxTotalMemoryMiB: 3072,
    } as AppLimitsView,
  }
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    // reply 统一模拟 JSON 响应。
    const reply = (body: unknown, status = 200) => route.fulfill({ status, json: body })
    if (path === '/api/auth/session')
      return reply(
        options.superadmin
          ? { ...admin, role: 'superadmin' }
          : options.user
            ? { ...admin, role: 'user' }
            : admin,
      )
    if (path === '/api/apps' && method === 'GET') {
      if (state.failed) return reply({ error: '暂时无法获取应用' }, 503)
      return reply({
        apps: state.apps,
        available: true,
        limits: {
          maxApps: state.limits.maxApps,
          totalMemoryMiB: state.limits.totalMemoryMiB,
          maxMemoryMiB: 1024,
        },
      })
    }
    if (path === '/api/apps/limits') {
      if (!options.superadmin) return reply({ error: '仅超级管理员可配置应用资源' }, 403)
      if (method === 'GET') return reply(state.limits)
      if (method === 'PUT') {
        const body = request.postDataJSON() as Record<string, unknown>
        state.writes.push({ path, body })
        if (body.expectedRevision !== state.limits.revision)
          return reply({ error: '资源配置已被更新，请刷新后重试' }, 409)
        Object.assign(state.limits, body, { revision: state.limits.revision + 1 })
        return reply(state.limits)
      }
    }
    if (path.endsWith('/logs')) {
      state.logReads++
      return reply({ text: state.logText })
    }
    if (method === 'GET' && path.startsWith('/api/apps/')) {
      const item = state.apps.find((view) => path === `/api/apps/${view.app.id}`)
      return item
        ? reply({
            ...item,
            available: true,
            limits: { maxApps: 3, totalMemoryMiB: 768, maxMemoryMiB: 1024 },
          })
        : reply({ error: '应用不存在或无权查看' }, 404)
    }
    if (method === 'POST' || method === 'PUT') {
      const body = request.postDataJSON() as Record<string, unknown>
      state.writes.push({ path, body })
      if (path.endsWith('/actions')) {
        const next = structuredClone(state.apps[0])
        if (body.action === 'cancel') {
          if (
            body.generation !== next.app.generation ||
            !(next.progress?.canCancel || next.app.status === 'pending')
          )
            return reply({ error: '部署已进入容器切换阶段，无法取消，请等待完成' }, 409)
          next.app.status = 'error'
          next.app.action = ''
          next.app.canceled = true
          next.app.error = '已取消本次部署'
          next.progress = {
            generation: next.app.generation,
            stage: 'cancelled',
            canCancel: false,
            updatedAt: next.app.updatedAt,
          }
          state.apps = [next]
          return reply(next, 202)
        }
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

// 取消需要确认，携带当前代次，结束后保留旧版运行状态并允许编辑镜像地址。
test('取消镜像拉取后可以重新编辑应用', async ({ page }) => {
  const state = await installAPI(page, { user: true })
  state.apps[0].app.status = 'deploying'
  state.apps[0].app.action = 'deploy'
  state.apps[0].progress = {
    generation: 1,
    stage: 'pulling',
    canCancel: true,
    downloadedBytes: 10 * 1024 * 1024,
    totalBytes: 300 * 1024 * 1024,
    updatedAt: initial.app.updatedAt,
  }
  await page.goto('/apps')
  const article = page.getByRole('article', { name: 'Small HTTP' })
  await expect(article.getByText('拉取镜像', { exact: true })).toBeVisible()
  await expect(article.getByRole('button', { name: /^更\s*新$/ })).toBeDisabled()
  await article.getByRole('button', { name: '取消部署', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '继续部署', exact: true }).click()
  expect(state.writes).toHaveLength(0)
  await article.getByRole('button', { name: '取消部署', exact: true }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByText(/已运行的版本会继续提供服务/)).toBeVisible()
  await page.screenshot({
    path: `test-results/cancel-deploy-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  })
  await dialog.getByRole('button', { name: '确认取消部署', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.writes[0].body).toEqual({ action: 'cancel', generation: 1 })
  await expect(article.getByText('已取消本次部署', { exact: true })).toBeVisible()
  await expect(article.getByRole('link', { name: '打开应用 ↗', exact: true })).toHaveAttribute(
    'href',
    initial.app.url,
  )
  await expect(article.getByRole('button', { name: /^更\s*新$/ })).toBeEnabled()
  await article.getByRole('button', { name: /^更\s*新$/ }).click()
  await expect(page.getByRole('dialog').getByLabel('镜像地址', { exact: true })).toHaveValue(
    initial.app.image,
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

// 容器切换时关闭取消入口；旧弹窗的请求被拒绝后仍显示新任务。
test('取消入口遵守切换阶段及版本冲突', async ({ page }) => {
  const state = await installAPI(page)
  state.apps[0].app.status = 'deploying'
  state.apps[0].app.action = 'deploy'
  state.apps[0].progress = {
    generation: 1,
    stage: 'creating',
    canCancel: false,
    updatedAt: initial.app.updatedAt,
  }
  await page.goto('/apps')
  const article = page.getByRole('article', { name: 'Small HTTP' })
  await expect(article.getByRole('button', { name: '取消部署', exact: true })).toBeDisabled()
  state.apps[0].progress.stage = 'pulling'
  state.apps[0].progress.canCancel = true
  await page.getByRole('button', { name: /^刷\s*新$/ }).click()
  await article.getByRole('button', { name: '取消部署', exact: true }).click()
  state.apps[0].app.generation = 2
  state.apps[0].progress.generation = 2
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '确认取消部署', exact: true }).click()
  await expect(
    page.getByText('部署已进入容器切换阶段，无法取消，请等待完成', { exact: true }),
  ).toBeVisible()
  await expect(dialog).toBeVisible()
  expect(state.apps[0].app.status).toBe('deploying')
  expect(state.writes[0].body).toEqual({ action: 'cancel', generation: 1 })
})

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
  await expect(dialog.getByLabel('变量名称 1', { exact: true })).toHaveValue('SECRET')
  await expect(dialog.getByLabel('SECRET 操作', { exact: true })).toHaveCount(1)
  await expect(dialog.locator('input[type="password"]')).toHaveCount(0)
  await dialog.getByText('私有仓库（已有凭据，留空保留）', { exact: true }).click()
  await expect(dialog.getByLabel('仓库密码 / 访问令牌', { exact: true })).toHaveValue('')
  await dialog.getByRole('button', { name: '提交更新', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.writes[1].body).toMatchObject({
    replaceEnv: false,
    envPatch: {},
    clearRegistry: false,
    generation: 1,
    healthPath: '/health',
  })
  expect(state.writes[1].body).not.toHaveProperty('registry')
})

// 按项修改、空字符串和明确删除可以一起提交，未改动的敏感值不会被覆盖。
test('环境变量逐项修改与明确删除', async ({ page }) => {
  const state = await installAPI(page)
  state.apps[0].app.envKeys = ['KEEP', 'CHANGE', 'EMPTY', 'DELETE']
  await page.goto('/apps')
  await page.getByRole('button', { name: /^更\s*新$/ }).click()
  const dialog = page.getByRole('dialog')
  for (const key of ['CHANGE', 'EMPTY']) {
    const select = dialog.getByRole('combobox', { name: `${key} 操作` })
    await select.click()
    await select.press('ArrowDown')
    await select.press('Enter')
  }
  await dialog.getByLabel('CHANGE 新值', { exact: true }).fill('changed=a=b')
  const remove = dialog.getByRole('combobox', { name: 'DELETE 操作' })
  await remove.click()
  await remove.press('ArrowDown')
  await remove.press('ArrowDown')
  await remove.press('Enter')
  await dialog.getByRole('button', { name: '添加环境变量', exact: true }).click()
  await dialog.getByLabel('变量名称 5', { exact: true }).fill('NEW')
  await dialog.getByLabel('NEW 新值', { exact: true }).fill('new-value')
  await dialog.getByRole('button', { name: '提交更新', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.writes[0].body).toMatchObject({
    env: {},
    replaceEnv: false,
    generation: 1,
    envPatch: { CHANGE: 'changed=a=b', EMPTY: '', DELETE: null, NEW: 'new-value' },
  })
  expect(state.writes[0].body.envPatch).not.toHaveProperty('KEEP')
})

// 重复键不能提交；整批替换需明确勾选，并与逐项补丁互斥。
test('重复环境变量和整体替换', async ({ page }) => {
  const state = await installAPI(page)
  await page.goto('/apps')
  await page.getByRole('button', { name: /^更\s*新$/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '添加环境变量', exact: true }).click()
  await dialog.getByLabel('变量名称 2', { exact: true }).fill('SECRET')
  await dialog.getByRole('button', { name: '提交更新', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('SECRET 重复')
  expect(state.writes).toHaveLength(0)
  await dialog.getByRole('checkbox', { name: '整体替换环境变量（清除未填写的变量）' }).check()
  await dialog.getByLabel('环境变量', { exact: true }).fill('REPLACEMENT=')
  await dialog.getByRole('button', { name: '提交更新', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.writes[0].body).toMatchObject({ env: { REPLACEMENT: '' }, replaceEnv: true })
  expect(state.writes[0].body).not.toHaveProperty('envPatch')
})

// 更高的实例预算允许 1 GiB 应用，数字输入会将越界值校正到实际上限。
test('1 GiB 应用内存与越界输入', async ({ page }) => {
  const state = await installAPI(page, { empty: true, user: true })
  state.limits.totalMemoryMiB = 2048
  await page.goto('/apps')
  await page.getByRole('button', { name: '＋ 部署应用' }).click()
  const dialog = page.getByRole('dialog')
  const memory = dialog.getByLabel('内存上限 (MiB)', { exact: true })
  await expect(memory).toHaveValue('256')
  await expect(memory).toHaveAttribute('aria-valuemax', '1024')
  await dialog.getByLabel('应用名称', { exact: true }).fill('Memory limit')
  await dialog.getByLabel('应用标识', { exact: true }).fill('memory-limit')
  await dialog.getByLabel('镜像地址', { exact: true }).fill('example/http:v1')
  await memory.fill('1025')
  await memory.press('Tab')
  await expect(memory).toHaveValue('1024')
  expect(state.writes).toHaveLength(0)
  await dialog.getByRole('button', { name: '开始部署', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.writes[0].body).toMatchObject({ memoryMiB: 1024 })
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

// 只有超管能打开实例预算，冲突保留输入，重新加载后再保存使用新版本。
test('超管资源配置与版本冲突', async ({ page }) => {
  const state = await installAPI(page, { superadmin: true })
  await page.goto('/apps')
  await page.getByRole('button', { name: '资源配置', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('已预留：1 个应用，128 MiB 内存。')).toBeVisible()
  await page.screenshot({
    path: `test-results/resources-modal-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  })
  await dialog.getByLabel('应用总数上限', { exact: true }).fill('6')
  await dialog.getByLabel('应用内存总预算（MiB）', { exact: true }).fill('1536')
  state.limits.revision = 2
  await dialog.getByRole('button', { name: '保存配置', exact: true }).click()
  await expect(dialog.getByText(/资源配置已被更新/)).toBeVisible()
  await expect(dialog.getByLabel('应用总数上限', { exact: true })).toHaveValue('6')
  expect(state.writes[0].body).toEqual({ maxApps: 6, totalMemoryMiB: 1536, expectedRevision: 1 })
  await dialog.getByRole('button', { name: '重新加载', exact: true }).click()
  await expect(dialog.getByLabel('应用总数上限', { exact: true })).toHaveValue('3')
  await dialog.getByLabel('应用总数上限', { exact: true }).fill('6')
  await dialog.getByLabel('应用内存总预算（MiB）', { exact: true }).fill('1536')
  await dialog.getByRole('button', { name: '保存配置', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(state.writes[1].body).toEqual({ maxApps: 6, totalMemoryMiB: 1536, expectedRevision: 2 })
  await expect(page.getByText(/最多 6 个应用，内存总额 1536 MiB/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({
    path: `test-results/resources-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  })
})

// 管理员和普通用户不会看到或请求实例维护接口。
for (const ordinary of [false, true]) {
  test(`资源配置入口隐藏：${ordinary ? '普通用户' : '管理员'}`, async ({ page }) => {
    await installAPI(page, { user: ordinary })
    await page.goto('/apps')
    await expect(page.getByRole('article', { name: 'Small HTTP' })).toBeVisible()
    await expect(page.getByRole('button', { name: '资源配置', exact: true })).toHaveCount(0)
  })
}

// 刷新仍读取当前代次的阶段，旧代次快照不能覆盖当前状态，也不伪造整体百分比。
test('部署进度、失败阶段和旧代次隔离', async ({ page }) => {
  const state = await installAPI(page)
  const app = state.apps[0]
  app.app.status = 'deploying'
  app.app.generation = 2
  app.progress = {
    generation: 2,
    stage: 'pulling',
    downloadedBytes: 1024,
    totalBytes: 4096,
    updatedAt: '2026-10-11T08:00:00Z',
  }
  await page.goto('/apps')
  const progress = page.getByRole('status', { name: '操作进度' })
  await expect(progress.getByText('拉取镜像', { exact: true })).toBeVisible()
  await expect(progress.getByText('镜像层下载：1.0 KiB / 当前已知 4.0 KiB')).toBeVisible()
  await expect(progress.getByText(/关闭页面后继续/)).toBeVisible()
  await page.reload()
  await expect(progress.getByText('拉取镜像', { exact: true })).toBeVisible()
  app.progress.stage = 'healthchecking'
  await page.getByRole('button', { name: /^刷\s*新$/ }).click()
  await expect(progress.getByText('等待健康检查', { exact: true })).toBeVisible()
  app.progress = { generation: 1, stage: 'pulling', updatedAt: '2026-10-11T07:00:00Z' }
  await page.getByRole('button', { name: /^刷\s*新$/ }).click()
  await expect(progress.getByText('正在执行，等待阶段反馈')).toBeVisible()
  await expect(progress.getByText('拉取镜像', { exact: true })).toHaveCount(0)
  app.app.status = 'error'
  app.app.error = '新版本未通过健康检查，已尝试恢复旧容器'
  app.progress = {
    generation: 2,
    stage: 'failed',
    failedStage: 'healthchecking',
    updatedAt: '2026-10-11T08:01:00Z',
  }
  await page.getByRole('button', { name: /^刷\s*新$/ }).click()
  await expect(progress.getByText('失败阶段：等待健康检查')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({
    path: `test-results/progress-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  })
})

// 详情直接访问与刷新、磁盘临界预警、日志控制在桌面和手机采用同一路由。
test('详情路由、磁盘配额与日志快照', async ({ page }) => {
  const state = await installAPI(page)
  state.apps[0].runtime!.disk = {
    writable: { usedBytes: 950 * 1024 * 1024, limitBytes: 1024 ** 3, source: 'xfs' },
    persistent: { source: 'unavailable' },
    sampledAt: new Date().toISOString(),
  }
  await page.goto('/apps')
  await page.getByRole('link', { name: 'Small HTTP', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/apps/${initial.app.id}$`))
  await expect(page.getByText('接近配额上限，继续写入可能失败。')).toBeVisible()
  await expect(page.getByText('用量暂不可用')).toBeVisible()
  await page.reload()
  await expect(page.getByText('环境变量名称（不显示值）')).toBeVisible()
  await page.screenshot({
    path: `test-results/app-detail-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: /^日\s*志$/ }).click()
  await page.getByRole('dialog').getByRole('link', { name: '在详情页查看日志' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page).toHaveURL(/\/logs$/)
  await expect(page.getByRole('checkbox', { name: '自动刷新' })).toBeChecked()
  const before = state.logReads
  state.logText = 'line-one\nerror-needle\nline-three'
  await expect.poll(() => state.logReads, { timeout: 12000 }).toBeGreaterThan(before)
  await page.getByRole('checkbox', { name: '自动刷新' }).uncheck()
  await page.getByRole('checkbox', { name: '跟随最新' }).uncheck()
  await expect(page.getByText(/已暂停跟随/)).toBeVisible()
  await page.getByRole('textbox', { name: '搜索运行日志' }).fill('needle')
  await expect(page.getByLabel('运行日志内容')).toHaveText('error-needle')
  await page.getByRole('textbox', { name: '搜索运行日志' }).fill('not-found')
  await expect(page.getByLabel('运行日志内容')).toHaveText('没有匹配的日志')
  await page.goBack()
  await expect(page.getByText('环境变量名称（不显示值）')).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
})

// 不存在的 UUID 页面不可显示其他应用信息。
test('应用详情不存在时保持权限边界', async ({ page }) => {
  await installAPI(page)
  await page.goto('/apps/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
  await expect(page.getByText('应用不存在或无权查看')).toBeVisible()
  await expect(page.getByText('Small HTTP', { exact: true })).toHaveCount(0)
})
