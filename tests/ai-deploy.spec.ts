import { readFile } from 'node:fs/promises'
import { test, expect, archivePath } from './fixtures.ts'
import { original } from './data.ts'
import { assertFits, chooseTheme } from './helpers.ts'

// 验证用户能下载通用 Skill、复制当前项目说明，且这些操作不会签发凭据或上传项目。
test('交给 AI 部署使用当前地址和已有项目，不携带凭据', async ({ page, api, baseURL }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          document.documentElement.dataset.copied = text
        },
      },
    })
  })
  await page.route('**/api/deploy-tools/skill', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/zip',
      headers: { 'Content-Disposition': 'attachment; filename="stacknest-deploy-skill.zip"' },
      body: await readFile(archivePath),
    }),
  )
  await page.goto(`/projects/${original.slug}/settings`)
  await page.getByRole('button', { name: '交给 AI 部署' }).click()
  const dialog = page.getByRole('dialog', { name: '交给 AI 部署' })
  const content = await dialog.getByRole('textbox', { name: 'AI 部署说明' }).inputValue()
  expect(content).toContain(`后台：${baseURL}`)
  expect(content).toContain(`项目：${original.slug}`)
  expect(content).toContain(`项目 ID：${original.id}`)
  expect(content).toContain('暂不正式发布')
  expect(content).toContain('先用 Token 核对项目')
  expect(content).not.toContain('snd_')
  expect(content).not.toContain('zby909.top')
  await assertFits(page)
  await expect(dialog.getByRole('link', { name: '下载 CLI ↗' })).toHaveAttribute(
    'href',
    'https://github.com/zby909/stack-nest-server/releases',
  )
  const downloading = page.waitForEvent('download')
  await dialog.getByRole('button', { name: '下载 Skill' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('stacknest-deploy-skill.zip')
  expect(await readFile((await download.path())!)).toEqual(await readFile(archivePath))
  await dialog.getByRole('button', { name: '复制部署说明' }).click()
  await expect(page.getByText('已复制，可粘贴给 AI')).toBeVisible()
  expect(await page.locator('html').getAttribute('data-copied')).toBe(content)
  expect(api.requests.filter((request) => request.method !== 'GET')).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('ai-deploy-light.png') })
  await dialog
    .getByRole('button', { name: /^关\s*闭$/ })
    .last()
    .click()
  await expect(dialog).toBeHidden()
})

// 验证非安全上下文或剪贴板被拒绝时，用户仍能手动选中说明。
test('剪贴板不可用时保留手动复制入口', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined })
  })
  await page.goto(`/projects/${original.slug}/settings`)
  await chooseTheme(page, '深色')
  await page.getByRole('button', { name: '交给 AI 部署' }).click()
  const dialog = page.getByRole('dialog', { name: '交给 AI 部署' })
  await dialog.getByRole('button', { name: '复制部署说明' }).click()
  await expect(
    dialog.getByText('浏览器未允许复制。点击上方说明选中全文，手动复制即可。'),
  ).toBeVisible()
  const text = dialog.getByRole('textbox', { name: 'AI 部署说明' })
  await text.focus()
  const selected = await text.evaluate((node: HTMLTextAreaElement) =>
    node.value.slice(node.selectionStart, node.selectionEnd),
  )
  expect(selected).toBe(await text.inputValue())
  await assertFits(page)
  await page.screenshot({ path: testInfo.outputPath('ai-deploy-dark.png') })
})

// 验证会话失效沿用全局登录流程，不配套的后端响应不会被保存成 ZIP。
test('Skill 下载失败时显示原因并允许重试', async ({ page }) => {
  let mode = 'expired'
  const downloads: string[] = []
  page.on('download', (download) => downloads.push(download.suggestedFilename()))
  await page.route('**/api/deploy-tools/skill', async (route) =>
    mode === 'expired'
      ? route.fulfill({ status: 401, json: { error: '请先登录' } })
      : route.fulfill({ status: 200, contentType: 'text/html', body: '<html>old backend</html>' }),
  )
  await page.goto(`/projects/${original.slug}/settings`)
  await page.getByRole('button', { name: '交给 AI 部署' }).click()
  const dialog = page.getByRole('dialog', { name: '交给 AI 部署' })
  await dialog.getByRole('button', { name: '下载 Skill' }).click()
  await expect(page.getByRole('heading', { name: '登录 StackNest' })).toBeVisible()
  expect(downloads).toEqual([])
  mode = 'old-backend'
  await page.goto(`/projects/${original.slug}/settings`)
  await page.getByRole('button', { name: '交给 AI 部署' }).click()
  await dialog.getByRole('button', { name: '下载 Skill' }).click()
  await expect(dialog.getByText('服务器未提供 Skill 下载包，请确认前后端已配套更新')).toBeVisible()
  expect(downloads).toEqual([])
  await expect(page).toHaveURL(new RegExp(`/projects/${original.slug}/settings$`))
})
