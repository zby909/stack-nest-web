import { test, expect } from './fixtures.ts'
import { navigate, selectOption } from './helpers.ts'
import { admin } from './data.ts'

// 邮箱确认每次默认不发邀请，取消不请求接口，发信失败不会丢失已创建的用户。
test('添加邮箱的邀请确认', async ({ page, api }) => {
  await page.goto('/users')
  const email = page.getByRole('textbox', { name: '新用户邮箱' })
  await email.fill('first@example.com')
  await page.getByRole('button', { name: '添加邮箱', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('checkbox', { name: '发送邀请邮件' })).not.toBeChecked()
  await dialog.getByRole('checkbox', { name: '发送邀请邮件' }).check()
  await dialog.getByRole('button', { name: /^取\s*消$/ }).click()
  await expect(dialog).not.toBeVisible()
  expect(api.requests.filter((request) => request.method === 'POST')).toHaveLength(0)
  await page.getByRole('button', { name: '添加邮箱', exact: true }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('checkbox', { name: '发送邀请邮件' })).not.toBeChecked()
  await dialog.getByRole('button', { name: '确认添加', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByTitle('first@example.com', { exact: true })).toBeVisible()
  expect(api.requests.findLast((request) => request.method === 'POST')?.body).toEqual({
    email: 'first@example.com',
    sendInvitation: false,
  })
  await email.fill('second@example.com')
  await page.getByRole('button', { name: '添加邮箱', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox', { name: '发送邀请邮件' }).check()
  api.invitation = 'failed'
  await dialog.getByRole('button', { name: '添加并发送邀请', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText(/已添加，但邀请邮件未能确认发送/)).toBeVisible()
  await expect(page.getByTitle('second@example.com', { exact: true })).toBeVisible()
  expect(api.requests.findLast((request) => request.method === 'POST')?.body).toEqual({
    email: 'second@example.com',
    sendInvitation: true,
  })
})

// 日志列表向服务端发送分页与组合条件，日期按本地时区转换。
test('日志分页、筛选和重置', async ({ page, api }) => {
  await page.goto('/activity')
  await expect(page.getByText('记录 1', { exact: true })).toBeVisible()
  await page.locator('.ant-pagination-item-2').click()
  await expect(page.getByText('记录 51', { exact: true })).toBeVisible()
  expect(api.logQueries.at(-1)).toMatchObject({ page: '2', pageSize: '50' })
  await page.getByRole('textbox', { name: '筛选项目', exact: true }).fill('demo')
  await page.getByRole('textbox', { name: '搜索操作日志' }).fill('request-test')
  await page.getByRole('textbox', { name: '筛选操作人' }).fill(admin.email)
  await selectOption(page, '筛选操作类型', '暂停')
  await selectOption(page, '筛选操作结果', '成功')
  await page.getByLabel('开始日期').fill('2026-10-01')
  await page.getByLabel('结束日期').fill('2026-10-02')
  await page.locator('form button[type=submit]').click()
  await expect(page.getByText('记录 1', { exact: true })).toBeVisible()
  expect(api.logQueries.at(-1)).toMatchObject({
    page: '1',
    pageSize: '50',
    slug: 'demo',
    q: 'request-test',
    actor: admin.email,
    action: 'pause',
    status: 'succeeded',
    from: '2026-09-30T16:00:00.000Z',
    to: '2026-10-02T16:00:00.000Z',
  })
  await page.getByRole('button', { name: '清除筛选', exact: true }).click()
  await expect.poll(() => api.logQueries.at(-1)).toEqual({ page: '1', pageSize: '50' })
})

// 验证普通用户入口隐藏管理员资源，手输路由同样回到自己的项目页。
test('普通用户没有邮箱、系统与备份入口', async ({ page, api }) => {
  api.role = 'user'
  await page.goto('/system')
  await expect(page).toHaveURL(/\/projects$/)
  await expect(page.locator('nav:visible').getByRole('link')).toHaveCount(3)
  await expect(page.getByText('服务器存储', { exact: true })).toHaveCount(0)
  await expect(page.getByText('3.0 KiB', { exact: true })).toBeVisible()
  await page.goto('/users')
  await expect(page).toHaveURL(/\/projects$/)
  await navigate(page, '操作日志', '/activity')
  await expect(page.getByText('记录 1', { exact: true })).toBeVisible()
  expect(
    api.requests.some((request) =>
      ['/api/system', '/api/backups/status', '/api/users'].includes(request.path),
    ),
  ).toBe(false)
})

// 退出确认前不撤销会话，确认后回到登录页。
test('退出登录需要确认', async ({ page, api }) => {
  await page.goto('/projects')
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /^取\s*消$/ }).click()
  await expect(dialog).not.toBeVisible()
  expect(api.requests.some((request) => request.path === '/api/auth/logout')).toBe(false)
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await dialog.getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: '发送验证码', exact: true })).toBeVisible()
})

// 备份读取失败时保留最后成功信息并清楚标出旧状态。
test('备份过期和读取失败均可见', async ({ page, api }) => {
  api.backup.overdue = true
  await page.goto('/system')
  const card = page.getByRole('region', { name: '备份状态' })
  await expect(card.getByText(/超过 48 小时/)).toBeVisible()
  await expect(card.getByText('60.0 KiB', { exact: true })).toBeVisible()
  api.backupError = true
  await card.getByRole('button', { name: /^刷\s*新$/ }).click()
  await expect(card.getByText(/下面显示上次读取结果/)).toBeVisible()
  await expect(card.getByText('60.0 KiB', { exact: true })).toBeVisible()
})

// Docker 停止或恢复失败时显示真实阶段，保留已有成功备份。
for (const [stage, label] of [
  ['apps-freeze', '停止 Docker 应用写入'],
  ['apps-restore', '恢复 Docker 应用'],
] as const) {
  test('Docker 备份失败阶段可见：' + stage, async ({ page, api }) => {
    api.backup.state = 'failed'
    api.backup.lastAttempt.stage = stage
    await page.goto('/system')
    const card = page.getByRole('region', { name: '备份状态' })
    await expect(card.getByText('最近备份失败', { exact: true })).toBeVisible()
    await expect(card.getByText('异常阶段：' + label + '；已有的成功备份仍可保留。')).toBeVisible()
    await expect(card.getByText('60.0 KiB', { exact: true })).toBeVisible()
  })
}

// 会话存储被浏览器限制时，登录仍返回原页面，退出后不误报服务端失败。
for (const mode of ['禁止访问', '禁止写入'] as const) {
  test(`会话存储受限时仍可登录和退出：${mode}`, async ({ page, api }) => {
    api.role = 'guest'
    api.projects[0].slug = 'demo'
    api.projects[0].name = '演示项目'
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.addInitScript((restriction) => {
      Object.defineProperty(window, 'sessionStorage', {
        get() {
          if (restriction === '禁止访问')
            throw new DOMException('Disabled by test', 'SecurityError')
          return {
            getItem: () => null,
            setItem() {
              throw new DOMException('Disabled by test', 'QuotaExceededError')
            },
            removeItem() {
              throw new DOMException('Disabled by test', 'SecurityError')
            },
          }
        },
      })
    }, mode)
    await page.route('**/api/auth/request-code', (route) => route.fulfill({ status: 202 }))
    await page.route('**/api/auth/verify', (route) => {
      api.role = 'admin'
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(admin),
      })
    })
    await page.goto('/projects/demo/versions')
    await expect(page).toHaveURL(/\/login$/)
    await page.getByPlaceholder('name@example.com').fill(admin.email)
    await page.getByRole('button', { name: '发送验证码', exact: true }).click()
    await page.getByPlaceholder('请输入邮件中的验证码').fill('12345678')
    await page.getByRole('button', { name: /登\s*录$/ }).click()
    await expect(page).toHaveURL(/\/projects\/demo\/versions$/)
    await expect(page.getByRole('heading', { name: '演示项目', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '退出登录', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '退出登录', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: '发送验证码', exact: true })).toBeVisible()
    expect(pageErrors).toEqual([])
  })
}
