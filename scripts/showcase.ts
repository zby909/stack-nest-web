import { copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { assertFits } from '../tests/helpers.ts'

const appId = '0c2d84bb-15a1-492b-938a-83282600c112'

// capture 等待实际数据、字体和布局稳定后，保存当前管理台页面。
async function capture(page: Page, name: string, ready: Locator) {
  await expect(ready).toBeVisible()
  await page.evaluate(() => document.fonts.ready.then(() => true))
  await page.mouse.move(0, 0)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await assertFits(page)
  // 连续两帧一致后才写入，避免点击反馈或正在变化的进度条造成无意义的图片提交。
  await expect(page).toHaveScreenshot(name + '.png', {
    fullPage: true,
    animations: 'disabled',
    // 容忍文字抗锯齿的细微色差，其余差异按零像素容差更新文档原图。
    threshold: 0.01,
    maxDiffPixels: 0,
  })
  const images = join(test.info().project.outputDir, 'gallery/docs/images')
  await mkdir(images, { recursive: true })
  await copyFile(test.info().snapshotPath(name + '.png'), join(images, name + '.png'))
}

// 截图矩阵同时检查实际导航、两个详情页、明暗主题、移动端、诊断和登录。
test('从当前前端生成视觉稿', async ({ page, isMobile, baseURL }) => {
  const problems: string[] = []
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.protocol === 'data:' || url.origin === baseURL) return route.continue()
    problems.push('external ' + url.origin + url.pathname)
    return route.abort()
  })
  page.on('pageerror', (error) => problems.push(error.message))
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname
    if (
      path.startsWith('/api/') &&
      response.status() >= 400 &&
      !(path === '/api/auth/session' && response.status() === 401)
    )
      problems.push(path + ' ' + response.status())
  })
  await page.clock.setFixedTime(new Date('2026-10-12T09:00:00Z'))
  await page.goto('/projects')
  await expect(page.locator('#projects article')).toHaveCount(3)
  await capture(
    page,
    isMobile ? 'projects-mobile' : 'projects-desktop',
    page.getByText('37.5%', { exact: false }),
  )
  if (isMobile) {
    await page.goto('/__visual/login')
    await capture(page, 'login-mobile', page.getByRole('heading', { name: '登录 StackNest' }))
    await page.getByPlaceholder('name@example.com').fill('owner@example.com')
    await page.getByRole('button', { name: '发送验证码' }).click()
    await page.getByPlaceholder('请输入邮件中的验证码').fill('12345678')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page.locator('#projects article')).toHaveCount(3)
  } else {
    await page.getByRole('link', { name: '作品预览', exact: true }).click()
    await page
      .getByRole('navigation', { name: '项目详情' })
      .getByRole('link', { name: '版本' })
      .click()
    await expect(page.getByRole('button', { name: '发布此版本' })).toBeVisible()
    await expect(page.getByRole('article', { name: '上一正式版' })).toBeVisible()
    await capture(
      page,
      'versions-desktop',
      page.getByText('调整首页排版与作品说明', { exact: true }),
    )
    await page.goto('/apps')
    await expect(page.getByText('HTTP 正常', { exact: true })).toHaveCount(2)
    const app = page.getByRole('link', { name: '团队文档 API', exact: true })
    await capture(page, 'docker-desktop', app)
    await app.click()
    await expect(page).toHaveURL(new RegExp('/apps/' + appId + '(?:/overview)?$'))
    await capture(page, 'app-detail-desktop', page.getByRole('progressbar', { name: '内存使用率' }))
    await page.goto('/activity')
    await capture(page, 'activity-desktop', page.getByText('已生成待发布版', { exact: true }))
    await page.goto('/users')
    await capture(page, 'users-desktop', page.getByText('editor@example.com', { exact: true }))
    await page.goto('/network')
    await capture(page, 'network-desktop', page.getByRole('heading', { name: '网络访问策略' }))
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/system')
    const card = page.getByRole('region', { name: '平台诊断' })
    await card.getByRole('button', { name: '运行诊断' }).click()
    await expect(page.getByText('最近备份成功', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('region', { name: '平台版本' }).getByText('开发构建', { exact: true }),
    ).toHaveCount(2)
    await capture(page, 'system-desktop', card.getByText('Docker 可达，存储驱动：overlay2'))
  }
  expect(problems).toEqual([])
})

// 访问深链接和尝试写入时，分别验证视觉稿数据和独立的只读边界。
test('详情可刷新，演示操作不转发', async ({ request }) => {
  expect((await request.get('/api/apps/' + appId + '/logs')).ok()).toBeTruthy()
  expect((await request.get('/api/projects/portfolio/files')).ok()).toBeTruthy()
  expect((await request.get('/api/unknown')).status()).toBe(404)
  expect((await request.delete('/api/projects/portfolio')).status()).toBe(405)
  const project = await request.get('/api/projects/portfolio')
  expect((await project.json()).name).toBe('作品预览')
})
