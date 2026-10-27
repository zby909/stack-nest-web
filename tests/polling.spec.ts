import { test, expect } from './fixtures.ts'
import { navigate } from './helpers.ts'

// setHidden 模拟浏览器的页面可见性事件，验证实际请求而非组件内部状态。
async function setHidden(page: import('@playwright/test').Page, hidden: boolean) {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}

// freezeClock 等初始页面完成加载再暂停时间，保留 React 延迟加载所需的调度。
async function freezeClock(page: import('@playwright/test').Page) {
  const now = await page.evaluate(() => Date.now())
  await page.clock.pauseAt(new Date(now + 100))
}

// 慢请求超过刷新间隔仍只有一次读取，返回页面也不会叠加正在进行的请求。
test('服务器慢请求串行刷新', async ({ page, api }) => {
  await page.clock.install({ time: new Date('2026-10-12T00:00:00Z') })
  let reads = 0
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/system', async (route) => {
    reads++
    if (reads === 1) await pending
    await route.fallback()
  })

  try {
    await page.goto('/system')
    await expect.poll(() => reads).toBe(1)
    await expect(page.getByText('最近备份成功', { exact: true })).toBeVisible()
    await freezeClock(page)
    await page.clock.fastForward(61_000)
    expect(reads).toBe(1)
    await setHidden(page, true)
    await setHidden(page, false)
    expect(reads).toBe(1)
    release()
    await expect(page.getByText('6.5%', { exact: true })).toBeVisible()
    await page.clock.fastForward(29_000)
    expect(reads).toBe(1)
    await page.clock.fastForward(1_000)
    await expect.poll(() => reads).toBe(2)
    expect(api.unexpected).toEqual([])
  } finally {
    release()
  }
})

for (const scenario of [
  {
    path: '/projects',
    endpoints: ['/api/storage'],
    ready: '服务器存储',
    next: '服务器状态',
    to: '/system',
  },
  {
    path: '/system',
    endpoints: ['/api/system', '/api/backups/status'],
    ready: '最近备份成功',
    next: '项目',
    to: '/projects',
  },
]) {
  // 隐藏超过多个刷新周期不发请求，回来立即更新，离开页面后停止读取。
  test(`隐藏与离开页面停止状态刷新：${scenario.path}`, async ({ page, api }) => {
    await page.clock.install({ time: new Date('2026-10-12T00:00:00Z') })
    await page.goto(scenario.path)
    await expect(page.getByText(scenario.ready, { exact: true })).toBeVisible()
    // reads 仅统计目标页面的状态接口，忽略正常导航和项目查询。
    const reads = () =>
      scenario.endpoints.map(
        (endpoint) => api.requests.filter((request) => request.path === endpoint).length,
      )
    await expect.poll(reads).toEqual(scenario.endpoints.map(() => 1))
    await freezeClock(page)
    await setHidden(page, true)
    await page.clock.fastForward(95_000)
    expect(reads()).toEqual(scenario.endpoints.map(() => 1))
    await setHidden(page, false)
    await expect.poll(reads).toEqual(scenario.endpoints.map(() => 2))
    await navigate(page, scenario.next, scenario.to)
    await page.clock.fastForward(35_000)
    expect(reads()).toEqual(scenario.endpoints.map(() => 2))
  })
}

// 离开项目页会取消未完成的空间读取，返回后正常恢复上传入口。
test('离开页面取消空间请求并恢复上传', async ({ page }) => {
  let first = true
  const failed = page.waitForEvent('requestfailed', {
    predicate: (request) => new URL(request.url()).pathname === '/api/storage',
  })
  await page.route('**/api/storage', (route) => {
    if (first) {
      first = false
      return
    }
    return route.fallback()
  })
  await page.goto('/projects')
  await expect(page.locator('#projects article')).toHaveCount(1)
  await navigate(page, '服务器状态', '/system')
  await failed
  await navigate(page, '项目', '/projects')
  await expect(page.getByRole('button', { name: '＋ 部署静态项目', exact: true })).toBeEnabled()
  await expect(page.getByText(/暂时无法连接服务，已暂停上传/)).toHaveCount(0)
})
