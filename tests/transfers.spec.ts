import { createHash } from 'node:crypto'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures.ts'
import { assertFits, openMenu, selectOption } from './helpers.ts'

const content = Buffer.alloc(5 * 1024 ** 2, 65)
const file = { name: 'resume.zip', mimeType: 'application/zip', buffer: content }

// 验证创建流程也能暂停恢复，并锁定本次项目参数避免上传中改错目标。
test('创建项目可暂停继续，刷新活动上传前提示确认', async ({ page, api, isMobile }, testInfo) => {
  api.uploads.failOffset = 4 * 1024 ** 2
  await page.goto('/projects')
  await page.getByRole('button', { name: '＋ 部署静态项目' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '项目名称', exact: true }).fill('续传创建测试')
  await dialog.getByRole('textbox', { name: 'Slug（可选）', exact: true }).fill('created-demo')
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '创建待发布版' }).click()
  await expect(dialog.getByText(/连接暂时中断/)).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: '项目名称', exact: true })).toBeDisabled()
  const unload = page.waitForEvent('dialog')
  void page.reload({ timeout: 5000 }).catch(() => {})
  const warning = await unload
  expect(warning.type()).toBe('beforeunload')
  await warning.dismiss()
  await dialog.getByRole('button', { name: '暂停上传' }).click()
  await expect(dialog.getByText(/已暂停。/)).toBeVisible()
  if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme)
    await assertFits(page)
    await page.screenshot({
      path: testInfo.outputPath(`upload-${colorScheme}.png`),
      animations: 'disabled',
    })
  }
  api.uploads.failOffset = null
  await dialog.getByRole('button', { name: '继续上传' }).click()
  await expect(dialog).not.toBeVisible()
  expect(api.uploads.publishCount).toBe(1)
  await expect(page).toHaveURL(/created-demo\/versions$/)
  await expect(page.getByRole('article', { name: '待发布版', exact: true })).toBeVisible()
})

// openUpdate 使用真实更新表单选择文件，不修改组件内部状态。
async function openUpdate(page: Page) {
  await page
    .locator('#projects article')
    .getByRole('button', { name: /^更\s*新$/ })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '上传待发布版', exact: true }).click()
  return dialog
}

// 验证分片已存但响应丢失后查询真实偏移，以及发布响应丢失后幂等确认。
test('分片和发布响应丢失后自动恢复，不重复传输或发布', async ({ page, api }) => {
  api.uploads.dropResponseOnce = true
  api.uploads.dropCompletionOnce = true
  await page.goto('/projects')
  const dialog = await openUpdate(page)
  await expect(dialog).not.toBeVisible({ timeout: 20_000 })
  const chunks = api.requests.filter(
    (request) => request.method === 'PATCH' && request.path.startsWith('/api/uploads/'),
  )
  const offsets = chunks.map((chunk) => Number(chunk.offset))
  expect(offsets[0]).toBe(0)
  expect(offsets[1]).toBeGreaterThan(0)
  expect(new Set(offsets).size).toBe(offsets.length)
  expect([...api.uploads.records.values()][0].offset).toBe(content.length)
  expect(api.requests.find((request) => request.path === '/api/uploads')?.body).toMatchObject({
    sha256: createHash('sha256').update(content).digest('hex'),
  })
  expect(api.uploads.publishCount).toBe(1)
  expect(api.requests.filter((request) => request.path.endsWith('/complete'))).toHaveLength(2)
})

// 验证手动暂停、刷新页面、重新选择同一文件后沿用同一会话和已完成的 4 MiB。
test('暂停后刷新重选原文件，从已完成分片继续', async ({ page, api }) => {
  api.uploads.failOffset = 4 * 1024 ** 2
  await page.goto('/projects')
  let dialog = await openUpdate(page)
  await expect(dialog.getByText('连接暂时中断，正在查询进度并重试…')).toBeVisible()
  await dialog.getByRole('button', { name: '暂停上传', exact: true }).click()
  await expect(dialog.getByText(/已暂停。点击继续上传/)).toBeVisible()
  const id = [...api.uploads.records.keys()][0]
  expect(api.uploads.records.get(id)?.offset).toBe(4 * 1024 ** 2)
  await assertFits(page)
  const before = api.requests.length
  api.uploads.failOffset = null
  await page.reload()
  dialog = await openUpdate(page)
  await expect(dialog).not.toBeVisible()
  expect([...api.uploads.records.keys()]).toEqual([id])
  const resumedOffsets = api.requests
    .slice(before)
    .filter((request) => request.method === 'PATCH')
    .map((request) => Number(request.offset))
  expect(resumedOffsets[0]).toBe(4 * 1024 ** 2)
  expect(resumedOffsets.every((offset) => offset >= 4 * 1024 ** 2)).toBe(true)
  expect(new Set(resumedOffsets).size).toBe(resumedOffsets.length)
  expect(api.uploads.publishCount).toBe(1)
})

// 验证放弃只清理上传会话，已发布项目和版本保持完整。
test('暂停后可放弃临时上传', async ({ page, api }) => {
  api.uploads.failOffset = 0
  await page.goto('/projects')
  const dialog = await openUpdate(page)
  await expect(dialog.getByText(/连接暂时中断/)).toBeVisible()
  await dialog.getByRole('button', { name: '暂停上传' }).click()
  await dialog.getByRole('button', { name: '放弃本次上传' }).click()
  await expect(dialog.getByRole('button', { name: '上传待发布版' })).toBeVisible()
  expect(api.uploads.records.size).toBe(0)
  expect(api.uploads.publishCount).toBe(0)
  expect(api.projects[0].deployments?.[0].id).toBe('current-version')
})

// 验证目录导航、跨目录搜索、版本切换及错误恢复，文件名不能执行 HTML。
test('文件目录、搜索与版本切换', async ({ page, api, isMobile }, testInfo) => {
  await page.goto('/projects')
  const dialog = await openMenu(page, '查看文件')
  await expect(dialog.getByText('index.html', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: '打开目录 assets' }).click()
  await expect(dialog.getByText('main.js', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: '打开目录 nested' }).click()
  await expect(dialog.getByText('theme.css', { exact: true })).toBeVisible()
  await dialog.getByRole('searchbox', { name: '搜索文件' }).fill('index')
  await expect(dialog.getByText('index.html', { exact: true })).toBeVisible()
  await dialog.getByRole('searchbox', { name: '搜索文件' }).fill('script')
  await expect(dialog.getByText('<script>alert(1)</script>.txt', { exact: true })).toBeVisible()
  await expect(dialog.locator('script')).toHaveCount(0)
  await assertFits(page)
  await selectOption(page, '文件版本', '上一版本')
  await expect(dialog.getByText('old.css', { exact: true })).toBeVisible()
  if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme)
    await assertFits(page)
    await page.screenshot({
      path: testInfo.outputPath(`files-${colorScheme}.png`),
      animations: 'disabled',
    })
  }
  api.filesError = true
  await dialog.getByRole('button', { name: '刷新目录' }).click()
  await expect(dialog.getByText(/项目版本已发生变化/)).toBeVisible()
  await expect(dialog.getByText('old.css', { exact: true })).toHaveCount(0)
  api.filesError = false
  await dialog.getByRole('button', { name: '刷新目录' }).click()
  await expect(dialog.getByText('old.css', { exact: true })).toBeVisible()
})
