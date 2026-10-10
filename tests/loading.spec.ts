import { test, expect } from './fixtures.ts'
import { navigate } from './helpers.ts'

// 未登录仅加载登录页，不提前加载管理端与用户数据。
test('未登录访问只加载登录入口', async ({ page, api }) => {
  api.role = 'guest'
  const scripts: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url())
  })
  await page.goto('/projects')
  await expect(page.getByRole('button', { name: '发送验证码', exact: true })).toBeVisible()
  expect(
    scripts.some((url) => /\/(App|ActivityLog|UserManagement|SystemOverview)-/.test(url)),
  ).toBe(false)
  expect(api.requests.map((request) => request.path)).toEqual(['/api/auth/session'])
})

// 按需脚本下载失败不白屏，仍能返回已经加载的项目页。
test('延迟加载失败后仍能返回项目页', async ({ page, context }) => {
  const scripts: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url())
  })
  await page.goto('/projects')
  await expect(page.locator('#projects article')).toHaveCount(1)
  expect(
    scripts.some((url) =>
      /\/(ActivityLog|UserManagement|SystemOverview|ProjectAccessModal)-/.test(url),
    ),
  ).toBe(false)
  await context.route('**/assets/ActivityLog-*.js', (route) => route.abort('failed'))
  await navigate(page, '操作日志', '/activity')
  await expect(page.getByText('页面加载失败', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '刷新页面', exact: true })).toBeVisible()
  await navigate(page, '项目', '/projects')
  await expect(page.locator('#projects article')).toHaveCount(1)
})
