import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test, expect } from '@playwright/test'
import { assertFits } from '../tests/helpers.ts'

// 用读者双击 HTML 的方式验收图册，新增管理台菜单时也要有对应预览。
test('离线图册覆盖管理台导航，原图和深链接均可访问', async ({ page, context }) => {
  await page.goto('/projects')
  const menu = page.getByRole('navigation', { name: '页面导航' })
  await expect(menu).toBeVisible()
  const routes = await menu
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))

  await context.setOffline(true)
  // 用本次实际捕获的截图组装可下载图册，让仓库中残留的旧图也无法掩盖漏截页面。
  const bundle = join(test.info().project.outputDir, 'gallery')
  const entry = 'stacknest-html-design-neutral/index.html'
  for (const asset of [
    entry,
    'stacknest-html-design-neutral/style.css',
    'stacknest-html-design-neutral/script.js',
    'public/stacknest.svg',
  ]) {
    const target = join(bundle, asset)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(new URL('../' + asset, import.meta.url), target)
  }
  await page.goto(pathToFileURL(join(bundle, entry)).href)
  const links = page.getByRole('navigation', { name: '预览页面' }).getByRole('link')
  const screens = await links.evaluateAll((links) =>
    links.map((link) => ({
      title: link.textContent?.trim() ?? '',
      image: (link as HTMLAnchorElement).href,
      route: link.getAttribute('data-route') ?? '',
    })),
  )
  expect(screens.map((screen) => screen.route)).toEqual(expect.arrayContaining(routes))
  for (const [index, screen] of screens.entries()) {
    await links.nth(index).click()
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(screen.title)
    await expect(page.locator('#screen')).toHaveJSProperty('src', screen.image)
    await expect(page.locator('#screen')).toHaveJSProperty('complete', true)
    await expect
      .poll(() =>
        page.locator('#screen').evaluate((node) => (node as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0)
    await expect(page.locator('#original')).toHaveJSProperty('href', screen.image)
    await expect(page.locator('#live')).toHaveJSProperty(
      'href',
      new URL(screen.route, 'http://127.0.0.1:4176').href,
    )
  }
  await page.goBack()
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    screens[screens.length - 2].title,
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await assertFits(page)
})
