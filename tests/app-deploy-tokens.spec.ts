import { test, expect } from './fixtures.ts'
import { assertFits } from './helpers.ts'
import { readFile } from 'node:fs/promises'
import { archivePath } from './fixtures.ts'
import type { DeployToken } from '../src/types/deployToken.ts'

const appId = '0c2d84bb-15a1-492b-938a-83282600c112'

test('应用自动部署明确授权，一次性展示凭据并支持撤销与刷新深链接', async ({ page }) => {
  const secret = `snd_${'r'.repeat(43)}`
  let tokens: DeployToken[] = []
  let input: Record<string, unknown> | null = null
  await page.route('**/api/apps/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === `/api/apps/${appId}`) {
      return route.fulfill({
        json: {
          app: { id: appId, name: 'CI 示例应用', slug: 'demo', generation: 1, status: 'ready' },
          available: true,
          limits: { maxApps: 3, totalMemoryMiB: 768 },
        },
      })
    }
    if (!path.startsWith(`/api/apps/${appId}/deploy-tokens`)) return route.fallback()
    if (route.request().method() === 'POST') {
      input = route.request().postDataJSON() as Record<string, unknown>
      const token: DeployToken = {
        id: 'credential-fixture',
        name: String(input.name),
        canPublish: false,
        createdAt: '2026-11-04T00:00:00Z',
        expiresAt: '2099-01-01T00:00:00Z',
        lastUsedAt: null,
        createdBy: 'owner@example.com',
      }
      tokens = [token]
      return route.fulfill({ status: 201, json: { token, secret } })
    }
    if (route.request().method() === 'DELETE') {
      tokens = []
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ json: { tokens } })
  })
  await page.goto(`/apps/${appId}/automation`)
  await expect(page.getByRole('heading', { name: 'CI 示例应用 · 自动部署' })).toBeVisible()
  await page.route('**/api/deploy-tools/skill', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/zip',
      body: await readFile(archivePath),
    }),
  )
  await page.getByRole('button', { name: '交给 AI 部署' }).click()
  const ai = page.getByRole('dialog', { name: '交给 AI 部署' })
  const instructions = await ai.getByRole('textbox', { name: 'AI 部署说明' }).inputValue()
  expect(instructions).toContain(`应用 ID：${appId}`)
  expect(instructions).toContain('app status')
  expect(instructions).not.toContain('暂不正式发布')
  expect(instructions).not.toContain(secret)
  await expect(ai.getByText('让 AI 更新镜像，直接部署正式应用并等待健康检查结果。')).toBeVisible()
  await assertFits(page)
  const downloading = page.waitForEvent('download')
  await ai.getByRole('button', { name: '下载 Skill' }).click()
  expect((await downloading).suggestedFilename()).toBe('stacknest-deploy-skill.zip')
  await ai
    .getByRole('button', { name: /^关\s*闭$/ })
    .last()
    .click()
  await expect(ai).toBeHidden()
  expect(input).toBeNull()
  await page.getByRole('button', { name: '创建部署 Token' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('checkbox', { name: '允许更新正式应用' })).not.toBeChecked()
  await expect(dialog.getByRole('checkbox', { name: '允许正式发布', exact: true })).toHaveCount(0)
  await dialog.getByLabel('用途名称').fill('GitHub Actions')
  await dialog.getByRole('button', { name: /^创\s*建$/ }).click()
  await expect(dialog.getByText('请确认允许更新正式应用', { exact: true })).toBeVisible()
  expect(input).toBeNull()
  await dialog.getByRole('checkbox', { name: '允许更新正式应用' }).check()
  await dialog.getByRole('button', { name: /^创\s*建$/ }).click()
  await expect(dialog.getByRole('textbox', { name: '部署 Token' })).toHaveValue(secret)
  expect(input).toEqual({ name: 'GitHub Actions', expiresInDays: 30 })
  expect(
    await page.evaluate(() =>
      JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
    ),
  ).not.toContain(secret)
  await assertFits(page)
  await dialog.getByRole('button', { name: '已保存，关闭' }).click()
  await page
    .getByRole('dialog')
    .filter({ hasText: '已保存部署 Token？' })
    .getByRole('button', { name: '已保存，关闭' })
    .click()
  await page.reload()
  await expect(page.getByText('更新镜像', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '部署 Token' })).toHaveCount(0)
  await page.getByRole('button', { name: /^撤\s*销$/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: '撤销 Token' }).click()
  await expect(page.getByText('还没有部署 Token')).toBeVisible()
  await assertFits(page)
})
