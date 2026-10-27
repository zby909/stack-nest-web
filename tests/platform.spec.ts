import { test, expect } from './fixtures.ts'
import { assertFits } from './helpers.ts'

// 超管手动运行诊断，检查失败仍展示报告，接口错误保留上次结果。
test('超管手动诊断、重复点击和失败恢复', async ({ page, api }) => {
  api.role = 'superadmin'
  let runs = 0
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let mode: 'report' | 'error' = 'report'
  await page.route('**/api/system/diagnostics', async (route) => {
    runs++
    if (runs === 1) await pending
    if (mode === 'error') return route.fulfill({ status: 503, json: { error: '诊断服务暂不可用' } })
    return route.fulfill({
      json: {
        checkedAt: '2026-10-12T08:00:00Z',
        durationMs: 450,
        failed: true,
        checks: [
          { name: 'database', status: 'pass', message: '数据库连接正常' },
          { name: 'quota', status: 'warn', message: '尚未启用可选磁盘配额' },
          { name: 'smtp', status: 'fail', message: 'SMTP 认证失败，请检查配置' },
        ],
      },
    })
  })
  try {
    await page.goto('/system')
    const card = page.getByRole('region', { name: '平台诊断' })
    await expect(card.getByRole('button', { name: '运行诊断' })).toBeVisible()
    expect(runs).toBe(0)
    await card.getByRole('button', { name: '运行诊断' }).click()
    await expect.poll(() => runs).toBe(1)
    await expect(card.getByRole('button', { name: '正在诊断' })).toHaveClass(/ant-btn-loading/)
    release()
    await expect(card.getByText('SMTP 认证失败，请检查配置', { exact: true })).toBeVisible()
    await expect(card.getByText('通过', { exact: true })).toBeVisible()
    await expect(card.getByText('提示', { exact: true })).toBeVisible()
    await expect(card.getByText('失败', { exact: true })).toBeVisible()
    await assertFits(page)
    mode = 'error'
    await card.getByRole('button', { name: '重新诊断' }).click()
    await expect(card.getByText('下方保留上次结果，尚未确认当前状态。')).toBeVisible()
    await expect(card.getByText('SMTP 认证失败，请检查配置', { exact: true })).toBeVisible()
  } finally {
    release()
  }
})

// 普通管理员只能读取版本，不会自动触发超管诊断接口。
test('管理员只能看版本，无法看到诊断入口', async ({ page, api }) => {
  await page.goto('/system')
  await expect(page.getByRole('region', { name: '平台版本' })).toBeVisible()
  await expect(page.getByRole('region', { name: '平台诊断' })).toHaveCount(0)
  expect(api.requests.some((request) => request.path === '/api/system/diagnostics')).toBe(false)
})

// 构建时前端版本固定，后端版本不一致可见，开发构建不误报警。
test('版本配套提示、开发构建和读取失败', async ({ page }) => {
  let mode: 'mismatch' | 'dev' | 'error' = 'mismatch'
  await page.route('**/api/version', (route) =>
    mode === 'error'
      ? route.fulfill({ status: 503, json: { error: '版本暂不可用' } })
      : route.fulfill({
          json: { version: mode === 'dev' ? 'dev' : 'v9.0.0', revision: 'unknown' },
        }),
  )
  await page.goto('/system')
  const card = page.getByRole('region', { name: '平台版本' })
  await expect(card.getByText('v1.2.3-test.1', { exact: true })).toBeVisible()
  await expect(card.getByText('前后端发布版本不同', { exact: true })).toBeVisible()
  mode = 'dev'
  await page.reload()
  await expect(card.getByText('开发构建', { exact: true })).toBeVisible()
  await expect(card.getByText('前后端发布版本不同', { exact: true })).toHaveCount(0)
  mode = 'error'
  await page.reload()
  await expect(card.getByText('版本暂不可用', { exact: true })).toBeVisible()
  mode = 'dev'
  await card.getByRole('button', { name: /^重\s*试$/ }).click()
  await expect(card.getByText('开发构建', { exact: true })).toBeVisible()
  await assertFits(page)
})
