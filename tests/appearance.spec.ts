import type { Locator } from '@playwright/test'
import { test, expect } from './fixtures.ts'
import { assertFits, chooseTheme, navigate, openMenu, openUsage } from './helpers.ts'

// contrastRatio 按实际渲染的前景与背景计算对比度，不依赖主题实现值。
async function contrastRatio(locator: Locator) {
  const colors = await locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return [style.color, style.backgroundColor]
  })
  // luminance 将不透明 RGB 转为相对亮度。
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)!.map(Number)
    expect(channels.length === 3 || channels[3] === 1).toBe(true)
    const [r, g, b] = channels.slice(0, 3).map((channel) => {
      const value = channel / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [a, b] = colors.map(luminance)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

// 验证系统变更、用户覆盖、刷新持久化与跨标签页同步。
test('主题跟随系统，手动选择可记忆并同步标签页', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/projects')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: '切换主题，当前：跟随系统' })).toBeVisible()
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await chooseTheme(page, '深色')
  await page.reload()
  await expect(page.getByRole('button', { name: '切换主题，当前：深色' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const other = await context.newPage()
  await other.goto('/projects')
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark')
  await chooseTheme(other, '浅色')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await other.close()
  await chooseTheme(page, '跟随系统')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

// 首屏脚本不依赖应用包下载完成，深色偏好在应用尚未启动时已生效。
test('应用脚本加载前已恢复深色主题', async ({ page, api }) => {
  api.role = 'guest'
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => localStorage.setItem('stacknest:theme', 'dark'))
  await page.route('**/assets/*.js', (route) => route.abort('failed'))
  await page.goto('/login')
  await expect(page.locator('#root')).toBeEmpty()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
})

// 系统主题改变不应重新挂载弹窗，更不能丢失尚未提交的编辑内容。
test('主题切换保留弹窗草稿并覆盖登录页', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/projects')
  const dialog = await openMenu(page, '编辑信息')
  const name = dialog.getByRole('textbox', { name: '项目名称', exact: true })
  await name.fill('尚未保存的草稿')
  const lightBackground = await dialog
    .locator('.ant-modal-container')
    .evaluate((element) => getComputedStyle(element).backgroundColor)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(name).toHaveValue('尚未保存的草稿')
  await expect
    .poll(() =>
      dialog
        .locator('.ant-modal-container')
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe(lightBackground)
  await dialog.getByRole('button', { name: /^取\s*消$/ }).click()
  await expect(dialog).not.toBeVisible()
  await chooseTheme(page, '深色')
  await page.getByRole('button', { name: '退出登录', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '退出登录', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: '切换主题，当前：深色' })).toBeVisible()
  await page.getByPlaceholder('name@example.com').fill('draft@example.com')
  await chooseTheme(page, '浅色')
  await expect(page.getByPlaceholder('name@example.com')).toHaveValue('draft@example.com')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

// 浏览器限制本地存储时仍可手动选择主题并使用登录页面。
test('本地存储不可用时仍可切换外观', async ({ page, api }) => {
  api.role = 'guest'
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Disabled by test', 'SecurityError')
      },
    })
  })
  await page.goto('/login')
  await chooseTheme(page, '深色')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: '发送验证码', exact: true })).toBeVisible()
  await assertFits(page)
})

// 在两个配色下实际检查排序选中项文字，并保留截图供视觉复核。
for (const label of ['浅色', '深色']) {
  test(`${label}下排序菜单清晰可读`, async ({ page }, testInfo) => {
    await page.goto('/projects')
    await chooseTheme(page, label)
    await page.getByRole('combobox', { name: '项目排序' }).click()
    const selected = page.locator('.ant-select-dropdown:visible .ant-select-item-option-selected')
    await expect(selected).toBeVisible()
    expect(await contrastRatio(selected)).toBeGreaterThanOrEqual(4.5)
    await selected.hover()
    expect(await contrastRatio(selected)).toBeGreaterThanOrEqual(4.5)
    await assertFits(page)
    await page.screenshot({
      path: testInfo.outputPath(`sort-${label}.png`),
      fullPage: true,
      animations: 'disabled',
    })
  })
}

// 信息浮层支持鼠标与键盘，手机点按后在最窄布局也不溢出。
test('版本详情支持悬浮、键盘和手机点按', async ({ page, isMobile }, testInfo) => {
  await page.goto('/projects')
  const icon = page.getByRole('button', { name: '查看版本空间详情' })
  const details = page.locator('dl[aria-label="版本空间详情"]:visible')
  await expect(details).toHaveCount(0)
  if (!isMobile) {
    await icon.hover()
    await expect(details).toContainText('2.0 KiB · 3 个文件')
    await page.mouse.move(0, 0)
    await expect(details).not.toBeVisible()
    await icon.focus()
    await expect(details).toBeVisible()
    await icon.press('Escape')
    await expect(details).not.toBeVisible()
    await icon.press('Tab')
  }
  await page.setViewportSize({ width: 320, height: 900 })
  await chooseTheme(page, '深色')
  if (isMobile) {
    await icon.tap()
    // 等待组件关闭延迟与动画周期，确保真实点按不会短暂打开后自行关闭。
    await page.waitForTimeout(350)
    await expect(icon).toHaveAttribute('aria-expanded', 'true')
    await expect(details).toBeVisible()
    await icon.tap()
    await page.waitForTimeout(350)
    await expect(icon).toHaveAttribute('aria-expanded', 'false')
    await expect(details).not.toBeVisible()
    await icon.tap()
    await page.waitForTimeout(350)
    await expect(icon).toHaveAttribute('aria-expanded', 'true')
  } else {
    await openUsage(page, page.locator('#projects article'))
  }
  await expect(details).toContainText('1.0 KiB · 2 个文件')
  await assertFits(page)
  await page.screenshot({
    path: testInfo.outputPath('usage-dark-320.png'),
    fullPage: false,
    animations: 'disabled',
  })
  await expect(details).toBeVisible()
  await page.getByRole('heading', { level: 1 }).click()
  await expect(details).not.toBeVisible()
  await navigate(page, '操作日志', '/activity')
  await assertFits(page)
  await navigate(page, '服务器状态', '/system')
  await assertFits(page)
  await navigate(page, '用户邮箱', '/users')
  await assertFits(page)
})
