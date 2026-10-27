import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test, expect, archivePath } from './fixtures.ts'
import { date, original } from './data.ts'
import { openMenu, openUsage, selectOption, assertFits } from './helpers.ts'

// 验证按两版合计排序、部分缺失排后以及搜索后刷新统计。
test('空间统计、占用排序与刷新', async ({ page, api }) => {
  const small = structuredClone(original)
  Object.assign(small, { id: 'small', name: '小项目', slug: 'small' })
  small.deployments = [{ ...small.deployments![0], files: { bytes: 100, count: 1 } }]
  const unknown = structuredClone(original)
  Object.assign(unknown, { id: 'unknown', name: '缺失上一版的项目', slug: 'unknown' })
  delete unknown.deployments![1].files
  api.projects = [unknown, small, api.projects[0]]
  await page.goto('/projects')
  const originalRow = page.locator('#projects article').filter({ hasText: original.name })
  await expect(originalRow.getByText('3.0 KiB', { exact: true })).toBeVisible()
  await expect(originalRow.getByText('2.0 KiB · 3 个文件', { exact: true })).toHaveCount(0)
  let details = await openUsage(page, originalRow)
  await expect(details.getByText('2.0 KiB · 3 个文件', { exact: true })).toBeVisible()
  await expect(details.getByText('1.0 KiB · 2 个文件', { exact: true })).toBeVisible()
  await originalRow.getByRole('button', { name: '查看版本空间详情' }).press('Escape')
  await expect(details).not.toBeVisible()
  const smallRow = page.locator('#projects article').filter({ hasText: '小项目' })
  details = await openUsage(page, smallRow)
  await expect(details.getByText('无', { exact: true })).toBeVisible()
  await smallRow.getByRole('button', { name: '查看版本空间详情' }).press('Escape')
  await expect(details).not.toBeVisible()
  const unknownRow = page.locator('#projects article').filter({ hasText: '缺失上一版的项目' })
  await expect(unknownRow.getByText('统计暂不可用', { exact: true })).toHaveCount(1)
  details = await openUsage(page, unknownRow)
  await expect(details.getByText('统计暂不可用', { exact: true })).toBeVisible()
  await unknownRow.getByRole('button', { name: '查看版本空间详情' }).press('Escape')
  await expect(details).not.toBeVisible()
  await selectOption(page, '项目排序', '占用从大到小')
  await expect(page.locator('#projects article').first()).toContainText(original.name)
  await expect(page.locator('#projects article').last()).toContainText('缺失上一版的项目')
  await selectOption(page, '项目排序', '占用从小到大')
  await expect(page.locator('#projects article').first()).toContainText('小项目')
  await expect(page.locator('#projects article').last()).toContainText('缺失上一版的项目')
  await page.getByRole('textbox', { name: '搜索项目' }).fill('小项目')
  await expect(page.locator('#projects article')).toHaveCount(1)
  small.deployments[0].files = { bytes: 512, count: 2 }
  await page.getByRole('button', { name: '刷新项目', exact: true }).click()
  await expect(smallRow.getByText('512 B', { exact: true })).toBeVisible()
  details = await openUsage(page, smallRow)
  await expect(details.getByText('512 B · 2 个文件', { exact: true })).toBeVisible()
  await assertFits(page)
})

// 验证真实菜单、校验、乐观并发错误与重试保存，不覆盖用户输入。
test('编辑失败保留输入，保存携带页面版本', async ({ page, api }) => {
  await page.goto('/projects')
  const dialog = await openMenu(page, '编辑信息')
  await dialog.getByRole('textbox', { name: '项目名称', exact: true }).fill(' ')
  await dialog.getByRole('button', { name: /保\s*存$/ }).click()
  await expect(dialog.getByText('请输入项目名称', { exact: true })).toBeVisible()
  expect(api.requests.filter((request) => request.method === 'PATCH')).toHaveLength(0)
  await dialog.getByRole('textbox', { name: '项目名称', exact: true }).fill(' 修改后的项目 ')
  await dialog.getByRole('textbox', { name: '项目说明（可选）', exact: true }).fill(' 更新说明 ')
  api.editError = true
  await dialog.getByRole('button', { name: /保\s*存$/ }).click()
  await expect(dialog.getByText(/项目版本已发生变化.*regression-request/)).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: '项目名称', exact: true })).toHaveValue(
    ' 修改后的项目 ',
  )
  api.editError = false
  await dialog.getByRole('button', { name: /保\s*存$/ }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('#projects article')).toContainText('修改后的项目')
  expect(api.requests.findLast((request) => request.method === 'PATCH')).toMatchObject({
    match: JSON.stringify(date),
    body: { name: '修改后的项目', description: '更新说明' },
  })
})

// 验证取消无副作用，暂停失败可重试，恢复后重新开放原网址。
test('暂停与恢复需要确认，失败可重试', async ({ page, api }) => {
  await page.goto('/projects')
  let dialog = await openMenu(page, '暂停访问')
  await dialog.getByRole('button', { name: /^取\s*消$/ }).click()
  expect(api.requests.filter((request) => request.path.endsWith('/access'))).toHaveLength(0)
  dialog = await openMenu(page, '暂停访问')
  api.accessError = true
  await dialog.getByRole('button', { name: /暂停访问$/ }).click()
  await expect(dialog.getByText(/模拟失败.*regression-request/)).toBeVisible()
  api.accessError = false
  await dialog.getByRole('button', { name: /暂停访问$/ }).click()
  await expect(page.getByText('已暂停', { exact: true })).toBeVisible()
  expect(api.requests.findLast((request) => request.path.endsWith('/access'))).toMatchObject({
    body: { paused: true },
    match: JSON.stringify(date),
  })
  const open = page.getByText('打开站点 ↗', { exact: true })
  await expect
    .poll(() =>
      open.evaluate((element) =>
        element.closest('a, button')?.matches('[disabled], [aria-disabled="true"]'),
      ),
    )
    .toBe(true)
  dialog = await openMenu(page, '恢复访问')
  await dialog.getByRole('button', { name: '恢复访问', exact: true }).click()
  await expect(page.getByRole('link', { name: '打开站点 ↗', exact: true })).toHaveAttribute(
    'href',
    original.siteUrl,
  )
})

// 验证 ZIP 下载选择的版本与字节内容，并能展示磁盘不足的错误。
test('导出上一版及下载失败提示', async ({ page, api }) => {
  await page.goto('/projects')
  const dialog = await openMenu(page, '导出 ZIP')
  await dialog.getByRole('radio', { name: /上一版/ }).check()
  api.exportError = true
  await dialog.getByRole('button', { name: /下载 ZIP$/ }).click()
  await expect(dialog.getByText(/服务器空间不足.*regression-request/)).toBeVisible()
  api.exportError = false
  const downloadPending = page.waitForEvent('download')
  await dialog.getByRole('button', { name: /下载 ZIP$/ }).click()
  const download = await downloadPending
  expect(download.suggestedFilename()).toBe(`${original.slug}-previous-version.zip`)
  const downloaded = await download.path()
  expect(downloaded).not.toBeNull()
  expect(await readFile(downloaded!)).toEqual(await readFile(archivePath))
})

// 验证更新与回退后重新加载对应版本统计，上传不允许时保留回退能力。
test('更新与回退刷新空间统计', async ({ page, api }) => {
  await page.goto('/projects')
  await page
    .locator('article')
    .getByRole('button', { name: /^更\s*新$/ })
    .click()
  let dialog = page.getByRole('dialog')
  await dialog.locator('input[type=file]').setInputFiles(fileURLToPath(archivePath))
  await dialog.getByRole('button', { name: '上传待发布版', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('article', { name: '待发布版', exact: true })).toBeVisible()
  expect(api.projects[0].deployments?.[0].id).toBe('current-version')
  await page.getByRole('button', { name: '发布此版本' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认发布' }).click()
  await expect(page.getByRole('article', { name: '待发布版', exact: true })).not.toBeVisible()
  await page.getByRole('link', { name: '← 所有项目' }).click()
  await expect(page.getByText('10.0 KiB', { exact: true })).toBeVisible()
  const row = page.locator('#projects article')
  const details = await openUsage(page, row)
  await expect(details.getByText('8.0 KiB · 4 个文件', { exact: true })).toBeVisible()
  expect(api.requests.find((request) => request.path === '/api/uploads')?.body).toMatchObject({
    expectedId: 'current-version',
    kind: 'update',
  })
  api.uploadAllowed = false
  await page.reload()
  await expect(
    page.locator('#projects article').getByRole('button', { name: /^更\s*新$/ }),
  ).toBeDisabled()
  dialog = await openMenu(page, '回退上一版')
  await dialog.getByRole('button', { name: '确认回退', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const usage = await openUsage(page, row)
  await expect(usage.locator('div').nth(0)).toContainText('2.0 KiB · 3 个文件')
  await expect(usage.locator('div').nth(1)).toContainText('8.0 KiB · 4 个文件')
  expect(api.requests.find((request) => request.path.endsWith('/rollback'))?.match).toBe(
    JSON.stringify('updated-version'),
  )
})

// 草稿标签不随正式版数量变化，下载请求和文件名均对应用户选中的草稿。
for (const publishedCount of [0, 1, 2]) {
  test(`导出待发布版：已有 ${publishedCount} 个正式版`, async ({ page, api }) => {
    const project = api.projects[0]
    project.deployments = project.deployments!.slice(0, publishedCount)
    project.status = publishedCount ? 'online' : 'draft'
    project.draft = {
      ...original.deployments![0],
      id: 'draft-export',
      status: 'draft',
      fileName: 'unpublished.zip',
    }
    await page.goto('/projects')
    const dialog = await openMenu(page, '导出 ZIP')
    await expect(dialog.getByRole('radio')).toHaveCount(publishedCount + 1)
    await expect(dialog.getByRole('radio', { name: /^当前版本/ })).toHaveCount(
      publishedCount ? 1 : 0,
    )
    await expect(dialog.getByRole('radio', { name: /^上一版/ })).toHaveCount(
      publishedCount === 2 ? 1 : 0,
    )
    await expect(
      dialog.getByRole('radio', { name: publishedCount ? /^当前版本/ : /^待发布版/ }),
    ).toBeChecked()
    await dialog.getByRole('radio', { name: /^待发布版/ }).check()
    const requestPending = page.waitForRequest((request) =>
      new URL(request.url()).pathname.endsWith('/export'),
    )
    const downloadPending = page.waitForEvent('download')
    await dialog.getByRole('button', { name: /下载 ZIP$/ }).click()
    const request = await requestPending
    const download = await downloadPending
    expect(new URL(request.url()).searchParams.get('deploymentId')).toBe('draft-export')
    expect(download.suggestedFilename()).toBe(`${original.slug}-draft-export.zip`)
  })
}
