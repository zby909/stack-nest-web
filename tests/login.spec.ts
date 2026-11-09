import { test, expect } from './fixtures.ts'
import { admin } from './data.ts'
import { assertFits } from './helpers.ts'

// 登录完整经过验证码表单、错误恢复和会话刷新，各浏览器仅使用本地模拟邮件接口。
test('验证码登录失败可重试，刷新保留已登录会话', async ({ page, api }) => {
  api.role = 'guest'
  let sent = 0
  await page.route('**/api/auth/request-code', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ email: admin.email })
    sent++
    await route.fulfill({ status: 204 })
  })
  await page.route('**/api/auth/verify', async (route) => {
    const body = route.request().postDataJSON() as { email: string; code: string }
    expect(body.email).toBe(admin.email)
    if (body.code !== '12345678')
      return route.fulfill({ status: 400, json: { error: '验证码无效或已过期' } })
    api.role = 'admin'
    await route.fulfill({ json: admin })
  })
  await page.goto('/projects')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByPlaceholder('name@example.com').fill(admin.email)
  await page.getByRole('button', { name: '发送验证码', exact: true }).click()
  const code = page.getByPlaceholder('请输入邮件中的验证码')
  await expect(code).toHaveAttribute('inputmode', 'numeric')
  await expect(code).toHaveAttribute('autocomplete', 'one-time-code')
  await code.fill('00000000')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page.getByText('验证码无效或已过期')).toBeVisible()
  await assertFits(page)
  await code.fill('12345678')
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/projects$/)
  await page.reload()
  await expect(page.locator('#projects article')).toHaveCount(1)
  expect(sent).toBe(1)
})
