import type { Page } from '@playwright/test'
import { test, expect } from './fixtures.ts'

const content = Buffer.concat([
  Buffer.from('<!doctype html><h1>行程</h1>'),
  Buffer.alloc(3_396_472, 32),
])
const file = { name: '川西行程.html', mimeType: 'text/html', buffer: content }

// updateHTML 从实际弹窗开始单 HTML 更新，保留网络故障时的上传会话。
async function updateHTML(page: Page) {
  await page.goto('/projects')
  await page
    .locator('#projects article')
    .getByRole('button', { name: /^更\s*新$/ })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('input[type=file]').setInputFiles(file)
  await dialog.getByRole('button', { name: '上传待发布版', exact: true }).click()
  return dialog
}

// 模拟弱网代理只能完成较小的请求，重试应缩小分片并继续原会话。
test('大分片中断后缩小分片，完成 3.3 MiB HTML 上传', async ({ page, api }) => {
  api.uploads.transportLimit = 128 * 1024
  const dialog = await updateHTML(page)
  await expect(dialog).not.toBeVisible({ timeout: 25_000 })
  expect(api.uploads.records.size).toBe(1)
  expect([...api.uploads.records.values()][0].offset).toBe(content.length)
  expect(api.uploads.publishCount).toBe(1)
  expect(api.projects[0].draft?.fileName).toBe(file.name)
})

// 模拟移动浏览器在请求失败后仍投递已排队的上传进度事件。
test('连续失败停止重试，迟到的进度回调不能重新显示上传中', async ({ page, api }) => {
  await page.addInitScript(() => {
    const callbacks: Array<() => void> = []
    Object.assign(window, { lateUploadProgress: callbacks })
    const prototype: EventTarget = XMLHttpRequestUpload.prototype
    const original = prototype.addEventListener
    // collect 保存进度回调，用于投递网络请求结束后才到达的浏览器事件。
    prototype.addEventListener = function (type, listener, options) {
      if (type === 'progress' && typeof listener === 'function') {
        callbacks.push(() =>
          listener.call(
            this,
            new ProgressEvent('progress', {
              lengthComputable: true,
              loaded: 3_396_472,
              total: 3_396_472,
            }),
          ),
        )
      }
      return original.call(this, type, listener, options)
    }
  })
  api.uploads.failOffset = 0
  const dialog = await updateHTML(page)
  await expect(dialog.getByRole('alert').filter({ hasText: '模拟暂时断网' })).toBeVisible({
    timeout: 20_000,
  })
  await expect(dialog.getByRole('button', { name: '继续上传', exact: true })).toBeEnabled()
  const attempts = api.requests.filter((request) => request.method === 'PATCH').length
  expect(attempts).toBe(4)
  await page.evaluate(() => {
    const callbacks = Reflect.get(window, 'lateUploadProgress') as Array<() => void>
    if (!callbacks.length) throw new Error('未捕获到上传进度回调')
    for (const callback of callbacks) callback()
  })
  await expect(dialog.getByRole('button', { name: '暂停上传', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('alert').filter({ hasText: '模拟暂时断网' })).toBeVisible()
  expect(api.requests.filter((request) => request.method === 'PATCH')).toHaveLength(attempts)
  expect(api.uploads.publishCount).toBe(0)
})

// 未提供最小分片大小的旧服务仍使用固定 4 MiB 协议。
test('服务未声明小分片能力时仍兼容原上传协议', async ({ page, api }) => {
  api.uploads.legacyChunks = true
  const dialog = await updateHTML(page)
  await expect(dialog).not.toBeVisible()
  expect(api.requests.filter((request) => request.method === 'PATCH')).toHaveLength(1)
  expect(api.uploads.publishCount).toBe(1)
})
