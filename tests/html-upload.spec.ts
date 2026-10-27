import { createHash } from 'node:crypto'
import type { Locator } from '@playwright/test'
import { test, expect } from './fixtures.ts'

const content = Buffer.from('<!doctype html><h1>你好</h1>')
const file = { name: '我的页面.HTM', mimeType: 'text/html', buffer: content }

// checkPickerTypes 检查传给系统选择器的扩展名和 MIME，避免手机将合法文件置灰。
async function checkPickerTypes(input: Locator) {
  const accept = (await input.getAttribute('accept'))?.split(',') ?? []
  expect(accept).toEqual(
    expect.arrayContaining([
      '.zip',
      '.rar',
      '.html',
      '.htm',
      'text/html',
      'application/zip',
      'application/vnd.rar',
      'application/x-rar-compressed',
    ]),
  )
}

// 单 HTML 创建使用原文件名及真实内容哈希，拒绝不支持的扩展名。
test('单 HTML 创建项目并进入预览流程', async ({ page, api }) => {
  await page.goto('/projects')
  await page.getByRole('button', { name: '＋ 部署静态项目' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '项目名称', exact: true }).fill('单页演示')
  await dialog.getByRole('textbox', { name: 'Slug（可选）', exact: true }).fill('single-page')
  const input = dialog.locator('input[type=file]')
  await checkPickerTypes(input)
  await input.setInputFiles({ ...file, name: 'page.html.exe' })
  await expect(dialog.getByText('请选择 ZIP、RAR 或 HTML 文件')).toBeVisible()
  const choosing = page.waitForEvent('filechooser')
  await dialog.getByText('选择或拖入 HTML / ZIP / RAR 文件', { exact: true }).click()
  const chooser = await choosing
  expect(chooser.isMultiple()).toBe(false)
  await chooser.setFiles(file)
  await dialog.getByRole('button', { name: '创建待发布版', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page).toHaveURL(/\/projects\/single-page\/versions$/)
  await expect(page.getByRole('article', { name: '待发布版', exact: true })).toContainText(
    file.name,
  )
  expect(api.requests.find((request) => request.path === '/api/uploads')?.body).toMatchObject({
    kind: 'create',
    fileName: file.name,
    size: content.length,
    preview: true,
    sha256: createHash('sha256').update(content).digest('hex'),
  })
})

// 单 HTML 更新中断后仍能从浏览器恢复记录，重选原文件后继续同一上传。
test('单 HTML 更新可暂停并在刷新后继续', async ({ page, api }) => {
  api.uploads.failOffset = 0
  await page.goto('/projects')
  await page
    .locator('#projects article')
    .getByRole('button', { name: /^更\s*新$/ })
    .click()
  let dialog = page.getByRole('dialog')
  await checkPickerTypes(dialog.locator('input[type=file]'))
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '上传待发布版', exact: true }).click()
  await expect(dialog.getByText(/连接暂时中断/)).toBeVisible()
  await dialog.getByRole('button', { name: '暂停上传', exact: true }).click()
  const id = [...api.uploads.records.keys()][0]
  await page.reload()
  await expect(page.getByText(file.name, { exact: false }).first()).toBeVisible()
  api.uploads.failOffset = null
  await page
    .locator('#projects article')
    .getByRole('button', { name: /^更\s*新$/ })
    .click()
  dialog = page.getByRole('dialog')
  await checkPickerTypes(dialog.locator('input[type=file]'))
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '上传待发布版', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect([...api.uploads.records.keys()]).toEqual([id])
  expect(api.uploads.publishCount).toBe(1)
  expect(api.projects[0].draft?.fileName).toBe(file.name)
})

// 文件提供器未声明 MIME 时仍按文件名接受 HTML，避免误伤手机保存的文档。
test('手机文件缺少 MIME 时仍可通过选择按钮上传 HTML', async ({ page, api }) => {
  await page.goto('/projects')
  await page
    .locator('#projects article')
    .getByRole('button', { name: /^更\s*新$/ })
    .click()
  const dialog = page.getByRole('dialog')
  const choosing = page.waitForEvent('filechooser')
  await dialog.getByText('选择或拖入新的 HTML / ZIP / RAR 文件', { exact: true }).click()
  const chooser = await choosing
  expect(chooser.isMultiple()).toBe(false)
  await chooser.setFiles({ ...file, name: '手机保存的报告.html', mimeType: '' })
  await dialog.getByRole('button', { name: '上传待发布版', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(api.projects[0].draft?.fileName).toBe('手机保存的报告.html')
})
