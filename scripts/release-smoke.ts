import { test, expect, type Page } from '@playwright/test'

const singleHTML =
  '<!doctype html><meta charset="utf-8"><style>h1{color:rgb(20,100,40)}</style><h1>单 HTML 页面</h1><script>document.body.dataset.version="html"</script>' +
  '<!--' +
  ' '.repeat(3_396_472) +
  '-->'
const singleFile = { name: '我的页面.HTM', mimeType: 'text/html', buffer: Buffer.from(singleHTML) }
// 上传包含真实文件传输，独立使用较长等待；普通界面断言仍保留较短超时。
const uploadTimeout = 120_000

// checkHTML 确认固定入口的原始内容、内联样式和脚本均保留。
async function checkHTML(page: Page, address: string) {
  const response = await page.goto(address)
  expect(response?.status()).toBe(200)
  expect(await response!.text()).toBe(singleHTML)
  await expect(page.getByRole('heading')).toHaveText('单 HTML 页面')
  await expect(page.getByRole('heading')).toHaveCSS('color', 'rgb(20, 100, 40)')
  await expect(page.locator('body')).toHaveAttribute('data-version', 'html')
  const entry = await page.goto(new URL('/index.html', address).href)
  expect(entry?.status()).toBe(200)
  expect(await entry!.text()).toBe(singleHTML)
}

// testFile 只使用编排器生成的测试归档，不读取用户上传或真实项目配置。
function testFile(version: 1 | 2): string {
  const path = process.env[`STACKNEST_SMOKE_ZIP_${version}`]
  if (!path) throw new Error('缺少发布回归测试归档')
  return path
}

// checkSite 通过真实浏览器验证页面、独立 CSS 和脚本属于同一发布版本。
async function checkSite(page: Page, address: string, version: 1 | 2) {
  const base = new URL(process.env.STACKNEST_SMOKE_BASE_URL!)
  const url = new URL(address)
  expect(url.protocol).toBe('http:')
  expect(url.hostname).toMatch(/^stack-nest-[a-z0-9-]+\.localhost$/)
  expect(url.port).toBe(base.port)
  const response = await page.goto(address)
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading')).toHaveText(`Release version ${version}`)
  await expect(page.getByRole('heading')).toHaveCSS(
    'color',
    version === 1 ? 'rgb(200, 10, 20)' : 'rgb(10, 20, 200)',
  )
  await expect(page.locator('body')).toHaveAttribute('data-version', String(version))
}

// publish 通过界面的二次确认发布草稿，并等待数据库返回正式版本。
async function publish(page: Page) {
  await page
    .getByRole('article', { name: '待发布版', exact: true })
    .getByRole('button', { name: '发布此版本' })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: '确认发布' }).click()
  await expect(page.getByRole('article', { name: '待发布版', exact: true })).toHaveCount(0)
  await expect(page.getByRole('article', { name: '当前正式版', exact: true })).toBeVisible()
}

// 覆盖真实 SMTP 登录、分片上传、独立预览、发布、更新、回退和匿名站点访问。
test('真实发布链路：登录、上传、预览、发布、更新和回退', async ({ page, browser, request }) => {
  let chunks = 0
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && new URL(request.url()).pathname.startsWith('/api/uploads/'))
      chunks++
  })
  const mailbox = process.env.STACKNEST_SMOKE_MAILBOX_URL
  if (!mailbox || !/^http:\/\/127\.0\.0\.1:\d+$/.test(mailbox)) throw new Error('缺少隔离测试邮箱')
  await page.goto('/login')
  await page.getByPlaceholder('name@example.com').fill('admin@example.com')
  await page.getByRole('button', { name: '发送验证码', exact: true }).click()
  let code = ''
  await expect
    .poll(async () => {
      const response = await request.get(`${mailbox}/inbox`)
      expect(response.ok()).toBeTruthy()
      const messages = (await response.json()) as { to: string; code: string }[]
      code = messages.find((message) => message.to === 'admin@example.com')?.code ?? ''
      return code.length
    })
    .toBe(8)
  await page.getByPlaceholder('请输入邮件中的验证码').fill(code)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/projects$/)

  await page.getByRole('button', { name: '＋ 部署静态项目' }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: '项目名称', exact: true }).fill('Release smoke')
  await dialog.getByRole('textbox', { name: 'Slug（可选）', exact: true }).fill('release-smoke')
  await dialog.locator('input[type=file]').setInputFiles(testFile(1))
  await dialog.getByRole('button', { name: '创建待发布版', exact: true }).click()
  await expect(dialog).not.toBeVisible({ timeout: uploadTimeout })
  await expect(page).toHaveURL(/\/projects\/release-smoke\/versions$/)
  expect(chunks).toBeGreaterThanOrEqual(2)

  const visitor = await browser.newContext({ serviceWorkers: 'block' })
  const site = await visitor.newPage()
  try {
    const draft = page.getByRole('article', { name: '待发布版', exact: true })
    const preview1 = await draft.getByRole('link', { name: '独立预览 ↗' }).getAttribute('href')
    expect(preview1).toBeTruthy()
    await checkSite(site, preview1!, 1)
    const formal = new URL(process.env.STACKNEST_SMOKE_BASE_URL!)
    formal.hostname = 'stack-nest-release-smoke.localhost'
    // 首次发布前，正式入口处于暂停状态；只能通过独立预览查看草稿。
    expect((await site.goto(formal.href))?.status()).toBe(503)
    await expect(site.locator('body')).toContainText('站点已暂停访问')

    await publish(page)
    await expect(page.getByRole('link', { name: '打开正式站点 ↗' })).toHaveAttribute(
      'href',
      formal.href,
    )
    await checkSite(site, formal.href, 1)
    await page.reload()
    await expect(page.getByRole('article', { name: '当前正式版', exact: true })).toContainText(
      'version-1.zip',
    )

    await page.getByRole('button', { name: '上传新版本', exact: true }).click()
    dialog = page.getByRole('dialog')
    await dialog.locator('input[type=file]').setInputFiles(testFile(2))
    await dialog.getByRole('button', { name: '上传待发布版', exact: true }).click()
    await expect(dialog).not.toBeVisible({ timeout: uploadTimeout })
    let preview2 = await page
      .getByRole('article', { name: '待发布版', exact: true })
      .getByRole('link', { name: '独立预览 ↗' })
      .getAttribute('href')
    expect(preview2).not.toBe(preview1)
    await checkSite(site, preview2!, 2)
    await checkSite(site, formal.href, 1)

    // 更新指定草稿走真实上传接口，新预览可用后旧地址失效，正式版保持原样。
    const retiredPreview = preview2!
    await page
      .getByRole('article', { name: '待发布版', exact: true })
      .getByRole('button', { name: '更新待发布版', exact: true })
      .click()
    dialog = page.getByRole('dialog')
    await dialog.locator('input[type=file]').setInputFiles(testFile(2))
    await dialog.getByRole('button', { name: '更新待发布版', exact: true }).click()
    await expect(dialog).not.toBeVisible({ timeout: uploadTimeout })
    preview2 = await page
      .getByRole('article', { name: '待发布版', exact: true })
      .getByRole('link', { name: '独立预览 ↗' })
      .getAttribute('href')
    expect(preview2).not.toBe(retiredPreview)
    expect((await site.goto(retiredPreview))?.status()).toBe(404)
    await checkSite(site, preview2!, 2)
    await checkSite(site, formal.href, 1)
    await publish(page)
    await checkSite(site, formal.href, 2)
    await checkSite(site, preview1!, 1)

    await page.getByRole('button', { name: '回退到此版本', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确认回退', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('article', { name: '当前正式版', exact: true })).toContainText(
      'version-1.zip',
    )
    await checkSite(site, formal.href, 1)
    await checkSite(site, preview2!, 2)

    // 已有 ZIP 项目可更新为单 HTML，发布前仍保留旧正式版，发布后也能回退。
    await page.getByRole('button', { name: '上传新版本', exact: true }).click()
    dialog = page.getByRole('dialog')
    await dialog.locator('input[type=file]').setInputFiles(singleFile)
    await dialog.getByRole('button', { name: '上传待发布版', exact: true }).click()
    await expect(dialog).not.toBeVisible({ timeout: uploadTimeout })
    const htmlPreview = await page
      .getByRole('article', { name: '待发布版', exact: true })
      .getByRole('link', { name: '独立预览 ↗' })
      .getAttribute('href')
    await checkHTML(site, htmlPreview!)
    await checkSite(site, formal.href, 1)
    await publish(page)
    await expect(page.getByRole('article', { name: '当前正式版', exact: true })).toContainText(
      singleFile.name,
    )
    await checkHTML(site, formal.href)
    await page.getByRole('button', { name: '回退到此版本', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: '确认回退', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await checkSite(site, formal.href, 1)

    // 新建单文件项目同样保留原名，公开站点从根路径及 index.html 访问。
    await page.goto('/projects')
    await page.getByRole('button', { name: '＋ 部署静态项目' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: '项目名称', exact: true }).fill('Single HTML')
    await dialog.getByRole('textbox', { name: 'Slug（可选）', exact: true }).fill('single-html')
    await dialog.locator('input[type=file]').setInputFiles(singleFile)
    await dialog.getByRole('button', { name: '创建待发布版', exact: true }).click()
    await expect(dialog).not.toBeVisible({ timeout: uploadTimeout })
    await expect(page).toHaveURL(/\/projects\/single-html\/versions$/)
    await publish(page)
    const singleURL = await page.getByRole('link', { name: '打开正式站点 ↗' }).getAttribute('href')
    await checkHTML(site, singleURL!)

    const anonymous = await visitor.request.get(
      `${process.env.STACKNEST_SMOKE_BASE_URL}/api/projects`,
    )
    expect(anonymous.status()).toBe(401)
  } finally {
    await visitor.close()
  }
})
