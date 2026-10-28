import { test, expect } from './fixtures.ts'
import { date } from './data.ts'
import { assertFits } from './helpers.ts'
import type { Project } from '../src/types/project.ts'

const oldID = 'dep-c260ac42-2201-4717-8613-c058bcb41cf1'
const file = { name: 'edited.html', mimeType: 'text/html', buffer: Buffer.alloc(1024 ** 2, 65) }

// withDraft 保留已有正式版，模拟用户正在反复修改的同一个草稿。
function withDraft(project: Project) {
  project.draft = {
    id: oldID,
    status: 'draft',
    fileName: 'first.html',
    notes: '原更新说明',
    createdAt: date,
    previewUrl: 'https://stack-nest--old.example.com/',
  }
}

// 验证用户明确选择草稿更新后，新链接替换旧链接，正式版本保持原样。
test('更新指定待发布版，保留正式内容并返回新预览', async ({ page, api }, info) => {
  const project = api.projects[0]
  withDraft(project)
  const published = structuredClone(project.deployments)
  await page.goto(`/projects/${project.slug}/versions`)
  const draft = page.getByRole('article', { name: '待发布版', exact: true })
  await draft.getByRole('button', { name: '更新待发布版' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('新文件校验成功后替换此待发布版')).toBeVisible()
  await expect(dialog.getByText(/失败时保留旧草稿/)).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: '更新说明（可选）' })).toHaveValue('原更新说明')
  await dialog.getByRole('textbox', { name: '更新说明（可选）' }).fill('修改后的行程')
  await dialog.locator('input[type=file]').setInputFiles(file)
  await assertFits(page)
  await page.screenshot({ path: info.outputPath('replace-draft.png') })
  await dialog.getByRole('button', { name: '更新待发布版', exact: true }).click()
  await expect(dialog).toBeHidden()
  const created = [...api.uploads.records.values()][0]
  expect(created.input.replaceDraftId).toBe(oldID)
  expect(created.input.expectedId).toBe(published?.[0].id)
  expect(project.deployments).toEqual(published)
  expect(project.draft?.id).toBe('dep-' + created.id)
  expect(project.draft?.notes).toBe('修改后的行程')
  await expect(draft.getByRole('heading', { name: 'edited.html' })).toBeVisible()
  await expect(draft.getByRole('link', { name: '独立预览 ↗' })).toHaveAttribute(
    'href',
    project.draft!.previewUrl!,
  )
  expect(project.draft?.previewUrl).not.toBe('https://stack-nest--old.example.com/')
})

// 验证处理中被另一人更新的草稿不会被旧弹窗覆盖。
test('草稿发生变化时停止替换，不追随最新草稿', async ({ page, api }) => {
  const project = api.projects[0]
  withDraft(project)
  await page.route('**/api/uploads/*/complete', async (route) => {
    project.draft = { ...project.draft!, id: 'newer-draft', notes: '其他人的更新' }
    await route.fallback()
  })
  await page.goto(`/projects/${project.slug}/versions`)
  await page
    .getByRole('article', { name: '待发布版', exact: true })
    .getByRole('button', { name: '更新待发布版' })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '更新待发布版', exact: true }).click()
  await expect(dialog.getByText(/项目版本已发生变化/)).toBeVisible()
  expect(project.draft?.id).toBe('newer-draft')
  expect(project.draft?.notes).toBe('其他人的更新')
  expect(api.uploads.publishCount).toBe(0)
  expect([...api.uploads.records.values()][0].input.replaceDraftId).toBe(oldID)
})

// 验证刷新恢复替换任务时，保留原草稿编号和已确认偏移，响应丢失也不重复创建版本。
test('替换草稿中断后可恢复原任务', async ({ page, api }) => {
  const project = api.projects[0]
  withDraft(project)
  api.uploads.failOffset = 512 * 1024
  await page.goto('/projects')
  await page.locator('#projects article').getByRole('button', { name: '更新草稿' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '更新待发布版', exact: true }).click()
  await expect(dialog.getByText(/连接暂时中断/)).toBeVisible()
  await dialog.getByRole('button', { name: '暂停上传', exact: true }).click()
  await expect(dialog.getByText(/已暂停。/)).toBeVisible()
  const [id] = api.uploads.records.keys()
  expect(project.draft?.id).toBe(oldID)
  await page.reload()
  await page.getByRole('button', { name: '继续上次上传' }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByText('已恢复上次上传信息')).toBeVisible()
  const before = api.requests.length
  api.uploads.failOffset = null
  api.uploads.dropCompletionOnce = true
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '继续上传', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect([...api.uploads.records.keys()]).toEqual([id])
  expect(api.uploads.records.get(id)?.input.replaceDraftId).toBe(oldID)
  const offsets = api.requests.slice(before).filter((request) => request.method === 'PATCH')
  expect(Number(offsets[0].offset)).toBe(512 * 1024)
  expect(api.uploads.publishCount).toBe(1)
  expect(project.draft?.id).toBe('dep-' + id)
})
