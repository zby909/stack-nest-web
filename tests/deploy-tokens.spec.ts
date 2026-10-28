import { test, expect } from './fixtures.ts'
import { original } from './data.ts'
import { assertFits } from './helpers.ts'
import type { DeployToken } from '../src/types/deployToken.ts'

// 验证默认最小权限、一次性凭据、关闭确认、撤销和移动端布局。
test('项目部署 Token 默认仅预览且不持久保存明文', async ({ page }) => {
  const secret = 'snd_this_is_a_test_only_secret_not_a_real_token'
  let tokens: DeployToken[] = []
  let input: { canPublish: boolean; expiresInDays: number; name: string } | undefined
  await page.route('**/api/projects/*/deploy-tokens**', async (route) => {
    if (route.request().method() === 'POST') {
      input = route.request().postDataJSON()
      const token: DeployToken = {
        id: 'test-token',
        name: input!.name,
        canPublish: input!.canPublish,
        createdAt: '2026-10-28T00:00:00Z',
        expiresAt: '2099-01-01T00:00:00Z',
        lastUsedAt: null,
        createdBy: 'owner@example.com',
      }
      tokens = [token]
      return route.fulfill({ json: { token, secret }, status: 201 })
    }
    if (route.request().method() === 'DELETE') {
      tokens = []
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ json: { tokens } })
  })
  await page.goto(`/projects/${original.slug}/settings`)
  await page.getByRole('button', { name: '创建部署 Token' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('checkbox', { name: '允许正式发布' })).not.toBeChecked()
  await dialog.getByLabel('用途名称').fill('本机 AI')
  await dialog.getByRole('button', { name: /^创\s*建$/ }).click()
  await expect(dialog.getByRole('textbox', { name: '部署 Token' })).toHaveValue(secret)
  expect(input).toEqual({ name: '本机 AI', expiresInDays: 30, canPublish: false })
  await assertFits(page)
  const stored = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  )
  expect(stored).not.toContain(secret)
  await dialog.getByRole('button', { name: '已保存，关闭' }).click()
  await page
    .getByRole('dialog')
    .filter({ hasText: '已保存部署 Token？' })
    .getByRole('button', { name: '已保存，关闭' })
    .click()
  await expect(page.getByRole('textbox', { name: '部署 Token' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('仅预览', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^撤\s*销$/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: '撤销 Token' }).click()
  await expect(page.getByText('还没有部署 Token')).toBeVisible()
  await assertFits(page)
})
