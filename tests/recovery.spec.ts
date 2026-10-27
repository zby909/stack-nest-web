import type { Page } from '@playwright/test'
import { test, expect } from './fixtures.ts'
import { admin } from './data.ts'
import { assertFits } from './helpers.ts'

const content = Buffer.alloc(5 * 1024 ** 2, 65)
const file = { name: 'recover.zip', mimeType: 'application/zip', buffer: content }

// startUpdate 经界面创建半传任务，填入非空说明以确认恢复参数不丢失。
async function startUpdate(page: Page) {
  await page
    .locator('#projects article')
    .getByRole('button', { name: /^更\s*新$/ })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '更新说明（可选）' }).fill('恢复说明\n第二行内容')
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '上传待发布版', exact: true }).click()
  await expect(dialog.getByText(/连接暂时中断/)).toBeVisible()
  await dialog.getByRole('button', { name: '暂停上传', exact: true }).click()
  await expect(dialog.getByText(/已暂停。/)).toBeVisible()
  return dialog
}

// 验证刷新后无需重填更新说明，显示真实服务端偏移并从正确分片继续。
test('项目页恢复更新任务、原说明与服务端进度', async ({ page, api, isMobile }, info) => {
  api.uploads.failOffset = 4 * 1024 ** 2
  await page.goto('/projects')
  const original = await startUpdate(page)
  const identity = [...api.uploads.records.keys()][0]
  await original.getByRole('button', { name: /^取\s*消$/ }).click()
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) =>
      name.startsWith('stacknest:upload-recovery:v1:'),
    )!
    const records = JSON.parse(localStorage.getItem(key)!)
    records[0].offset = 0
    localStorage.setItem(key, JSON.stringify(records))
  })
  await page.reload()
  const card = page.getByRole('region', { name: '未完成上传' })
  await expect(card.getByText(/服务端已接收 80%/)).toBeVisible()
  if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
  await assertFits(page)
  await page.screenshot({
    path: info.outputPath('recovery-banner.png'),
    animations: 'disabled',
  })
  const before = api.requests.length
  await card.getByRole('button', { name: '继续上次上传' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('textbox', { name: '更新说明（可选）' })).toHaveValue(
    '恢复说明\n第二行内容',
  )
  await expect(dialog.getByRole('textbox', { name: '更新说明（可选）' })).toBeDisabled()
  await expect(dialog.getByText(/请重新选择原文件/)).toBeVisible()
  await expect(dialog.locator('input[type=file]')).toHaveValue('')
  if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await assertFits(page)
    await page.screenshot({
      path: info.outputPath(`recover-${colorScheme}.png`),
      animations: 'disabled',
    })
  }
  api.uploads.failOffset = null
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '继续上传', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect([...api.uploads.records.keys()]).toEqual([identity])
  const resumedOffsets = api.requests
    .slice(before)
    .filter((item) => item.method === 'PATCH')
    .map((item) => Number(item.offset))
  expect(resumedOffsets[0]).toBe(4 * 1024 ** 2)
  expect(resumedOffsets.every((offset) => offset >= 4 * 1024 ** 2)).toBe(true)
  expect(new Set(resumedOffsets).size).toBe(resumedOffsets.length)
  expect(api.projects[0].draft?.notes).toBe('恢复说明\n第二行内容')
  await page.goto('/projects')
  await expect(page.getByRole('region', { name: '未完成上传' })).not.toBeVisible()
})

// 验证创建任务恢复名称、slug、项目说明和更新说明，并保留原目标。
test('创建任务刷新后自动回填全部项目信息', async ({ page, api }) => {
  api.uploads.failOffset = 4 * 1024 ** 2
  await page.goto('/projects')
  await page.getByRole('button', { name: '＋ 部署静态项目' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '项目名称', exact: true }).fill('恢复创建测试')
  await dialog.getByRole('textbox', { name: 'Slug（可选）', exact: true }).fill('recovered-create')
  await dialog
    .getByRole('textbox', { name: '项目说明（可选）', exact: true })
    .fill('自动恢复项目说明')
  await dialog.getByRole('textbox', { name: '更新说明（可选）', exact: true }).fill('首版说明')
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '创建待发布版' }).click()
  await expect(dialog.getByText(/连接暂时中断/)).toBeVisible()
  await dialog.getByRole('button', { name: '暂停上传' }).click()
  await page.reload()
  await page.getByRole('button', { name: '继续上次上传' }).click()
  dialog = page.getByRole('dialog')
  for (const [label, value] of [
    ['项目名称', '恢复创建测试'],
    ['Slug（可选）', 'recovered-create'],
    ['项目说明（可选）', '自动恢复项目说明'],
    ['更新说明（可选）', '首版说明'],
  ])
    await expect(dialog.getByRole('textbox', { name: label, exact: true })).toHaveValue(value)
  api.uploads.failOffset = null
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '继续上传', exact: true }).click()
  await expect(page).toHaveURL(/recovered-create\/versions$/)
  expect(api.uploads.records.size).toBe(1)
  expect(api.uploads.publishCount).toBe(1)
})

// 验证同名同大小错误内容不能创建新任务或污染原分片，重选正确文件后可继续。
test('恢复任务拒绝同名同大小的错误文件并允许重新选择', async ({ page, api }) => {
  api.uploads.failOffset = 4 * 1024 ** 2
  await page.goto('/projects')
  const paused = await startUpdate(page)
  const requestsBeforeReselect = api.requests.length
  await paused
    .locator('input[type=file]')
    .setInputFiles({ ...file, buffer: Buffer.alloc(content.length, 66) })
  const firstRetry = paused.getByRole('button', { name: /继续上传$/ })
  await expect(firstRetry).not.toHaveClass(/ant-btn-loading/)
  await firstRetry.click()
  await expect(paused.getByText(/选中的文件与原上传不一致/)).toBeVisible()
  expect(
    api.requests
      .slice(requestsBeforeReselect)
      .filter((item) => item.path.startsWith('/api/uploads')),
  ).toHaveLength(0)
  expect(api.uploads.records.size).toBe(1)
  await page.reload()
  await page.getByRole('button', { name: '继续上次上传' }).click()
  const dialog = page.getByRole('dialog')
  const before = api.requests.length
  await dialog
    .locator('input[type=file]')
    .setInputFiles({ ...file, buffer: Buffer.alloc(content.length, 66) })
  await dialog.getByRole('button', { name: '继续上传', exact: true }).click()
  await expect(dialog.getByText(/选中的文件与原上传不一致/)).toBeVisible()
  expect(
    api.requests.slice(before).filter((item) => item.path.startsWith('/api/uploads')),
  ).toHaveLength(0)
  expect([...api.uploads.records.values()][0].offset).toBe(4 * 1024 ** 2)
  const retry = dialog.getByRole('button', { name: /继续上传$/ })
  await expect(retry).not.toHaveClass(/ant-btn-loading/)
  api.uploads.failOffset = null
  await dialog.locator('input[type=file]').setInputFiles(file)
  await expect(retry).toBeEnabled()
  await retry.click()
  await expect(dialog).not.toBeVisible()
  expect(api.uploads.publishCount).toBe(1)
})

// 验证过期版本拒绝恢复，并通过页面确认后清理原分片和本机线索。
test('项目版本变化时拒绝恢复，放弃需要确认', async ({ page, api }) => {
  api.uploads.failOffset = 4 * 1024 ** 2
  await page.goto('/projects')
  await startUpdate(page)
  api.projects[0].deployments![0].id = 'newer-current'
  await page.reload()
  await page.getByRole('button', { name: '继续上次上传' }).click()
  await expect(page.getByText(/项目版本已发生变化，请放弃旧上传/)).toBeVisible()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: '放弃上传', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^取\s*消$/ })
    .click()
  expect(api.uploads.records.size).toBe(1)
  await page.getByRole('button', { name: '放弃上传', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认放弃' }).click()
  await expect(page.getByRole('region', { name: '未完成上传' })).not.toBeVisible()
  expect(api.uploads.records.size).toBe(0)
  expect(api.projects[0].deployments![0].id).toBe('newer-current')
})

// 验证已传完的任务无需重选文件，直接沿用原编号确认结果且不再传片。
test('文件已传完时直接确认结果，无需重新选择文件', async ({ page, api }) => {
  api.uploads.failOffset = 4 * 1024 ** 2
  await page.goto('/projects')
  await startUpdate(page)
  const record = [...api.uploads.records.values()][0]
  record.offset = record.size
  api.uploadAllowed = false
  await page.reload()
  await page.getByRole('button', { name: '确认上传结果' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('文件已传完，可直接确认处理结果')).toBeVisible()
  await expect(dialog.locator('input[type=file]')).toHaveValue('')
  const before = api.requests.length
  await dialog.getByRole('button', { name: '确认上传结果' }).click()
  await expect(dialog).not.toBeVisible()
  expect(api.requests.slice(before).filter((item) => item.method === 'PATCH')).toHaveLength(0)
  expect(api.uploads.publishCount).toBe(1)
})

// 验证服务端过期记录清除提示，其他账号不会看到或请求原账号任务。
test('恢复记录按账号隔离，服务端失效后清除线索', async ({ page, api, context }) => {
  api.uploads.failOffset = 4 * 1024 ** 2
  await page.goto('/projects')
  await startUpdate(page)
  const originalId = [...api.uploads.records.keys()][0]
  await context.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...admin, id: 'other-account', role: 'user' }),
    }),
  )
  const before = api.requests.length
  await page.reload()
  await expect(page.getByRole('region', { name: '未完成上传' })).not.toBeVisible()
  expect(api.requests.slice(before).some((item) => item.path.includes(originalId))).toBe(false)
  await context.unroute('**/api/auth/session')
  api.uploads.records.clear()
  await page.reload()
  await expect(page.getByText('上次上传记录已过期或失效，请重新上传。')).toBeVisible()
  await expect(page.getByRole('button', { name: '继续上次上传' })).not.toBeVisible()
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('stacknest:upload:')),
    ),
  ).toHaveLength(0)
})

// 验证浏览器禁止持久化时本页仍可恢复任务，不影响正常传输。
test('本地存储受限时仍可在当前页面恢复上传', async ({ page, api }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('storage disabled')
    }
    Storage.prototype.setItem = () => {
      throw new Error('storage disabled')
    }
  })
  api.uploads.failOffset = 4 * 1024 ** 2
  await page.goto('/projects')
  const paused = await startUpdate(page)
  await paused.getByRole('button', { name: /^取\s*消$/ }).click()
  await page.getByRole('button', { name: '继续上次上传' }).click()
  api.uploads.failOffset = null
  const dialog = page.getByRole('dialog')
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '继续上传', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(api.uploads.publishCount).toBe(1)
})

// 验证已成功创建但回执丢失的任务在暂停新上传后仍可确认，不重复生成草稿。
test('创建结果已提交，空间暂停后仍可恢复确认', async ({ page, api }) => {
  api.uploads.failOffset = 4 * 1024 ** 2
  await page.goto('/projects')
  await page.getByRole('button', { name: '＋ 部署静态项目' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '项目名称', exact: true }).fill('已完成创建')
  await dialog.getByRole('textbox', { name: 'Slug（可选）', exact: true }).fill('completed-create')
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '创建待发布版' }).click()
  await expect(dialog.getByText(/连接暂时中断/)).toBeVisible()
  await dialog.getByRole('button', { name: '暂停上传' }).click()
  await expect(dialog.getByText(/已暂停。/)).toBeVisible()
  const record = [...api.uploads.records.values()][0]
  record.offset = record.size
  await page.evaluate(async (id) => {
    await fetch('/api/uploads/' + id + '/complete', { method: 'POST' })
  }, record.id)
  expect(api.uploads.publishCount).toBe(1)
  api.uploadAllowed = false
  await page.reload()
  await page.getByRole('button', { name: '确认上传结果' }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('textbox', { name: '项目名称', exact: true })).toHaveValue(
    '已完成创建',
  )
  await expect(dialog.locator('input[type=file]')).toHaveValue('')
  const before = api.requests.length
  await dialog.getByRole('button', { name: '确认上传结果' }).click()
  await expect(page).toHaveURL(/completed-create\/versions$/)
  expect(api.uploads.publishCount).toBe(1)
  expect(api.requests.slice(before).filter((item) => item.method === 'PATCH')).toHaveLength(0)
  expect(api.requests.slice(before).filter((item) => item.path === '/api/uploads')).toHaveLength(0)
  await page.goto('/projects')
  await expect(page.getByRole('region', { name: '未完成上传' })).not.toBeVisible()
})

// 验证已有记录时存储突然写满，当前页面仍能保留新任务，不被旧记录覆盖。
test('已有恢复记录时存储写入失败仍保留新的上传', async ({ page, api }) => {
  api.uploads.failOffset = 4 * 1024 ** 2
  await page.goto('/projects')
  const original = await startUpdate(page)
  await original.getByRole('button', { name: /^取\s*消$/ }).click()
  await expect(page.getByRole('region', { name: '未完成上传' }).locator('article')).toHaveCount(1)
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    }
  })
  await page.getByRole('button', { name: '＋ 部署静态项目' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '项目名称', exact: true }).fill('本页新上传')
  await dialog.getByRole('textbox', { name: 'Slug（可选）', exact: true }).fill('memory-create')
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '创建待发布版' }).click()
  await expect(dialog.getByText(/连接暂时中断/)).toBeVisible()
  await dialog.getByRole('button', { name: '暂停上传' }).click()
  await expect(dialog.getByText(/已暂停。/)).toBeVisible()
  await dialog.getByRole('button', { name: /^取\s*消$/ }).click()
  const cards = page.getByRole('region', { name: '未完成上传' }).locator('article')
  await expect(cards).toHaveCount(2)
  await cards
    .filter({ hasText: '新建：本页新上传' })
    .getByRole('button', { name: '继续上次上传' })
    .click()
  await expect(
    page.getByRole('dialog').getByRole('textbox', { name: '项目名称', exact: true }),
  ).toHaveValue('本页新上传')
})
