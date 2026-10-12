import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures.ts'

// openMenu 使用实际项目菜单打开弹窗，兼容触屏与桌面。
export async function openMenu(page: Page, label: string) {
  await page
    .getByRole('button', { name: /^更多操作：/ })
    .first()
    .click()
  const item = page.getByRole('menuitem', { name: label, exact: true })
  await expect(item).toBeVisible()
  // 等浮层入场结束后点击，避免动画期间的坐标落到相邻菜单项。
  await expect(page.locator('.ant-dropdown:visible')).not.toHaveClass(
    /\bant-slide-\w+-(?:appear|enter)(?:-\w+)?\b/,
  )
  await item.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

// selectOption 通过实际下拉框选择条件，不直接修改组件内部状态。
export async function selectOption(page: Page, name: string, label: string) {
  await page.getByRole('combobox', { name }).click()
  await page
    .locator('.ant-select-dropdown:visible .ant-select-item-option-content')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .click()
}

// openUsage 点按真实信息按钮，定位浮层内的版本统计。
export async function openUsage(page: Page, row: Locator) {
  await row.getByRole('button', { name: '查看版本空间详情' }).click()
  const details = page.locator('dl[aria-label="版本空间详情"]:visible')
  await expect(details).toBeVisible()
  return details
}

// chooseTheme 通过用户菜单选择外观，不直接改写存储或 DOM。
export async function chooseTheme(page: Page, label: string) {
  await page.getByRole('button', { name: /^切换主题/ }).click()
  const item = page.getByRole('menuitem', { name: label, exact: true })
  await expect(item).toBeVisible()
  // 等菜单入场完成，避免触屏下自动滚动与浮层重新定位竞争。
  await expect(page.locator('.ant-dropdown:visible')).not.toHaveClass(
    /\bant-slide-\w+-(?:appear|enter)(?:-\w+)?\b/,
  )
  await item.click()
  await expect(page.getByRole('button', { name: `切换主题，当前：${label}` })).toBeVisible()
}

// assertFits 检查页面和弹窗不会撑出水平滚动条。
export async function assertFits(page: Page) {
  const sizes = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1)
  expect(sizes.body).toBeLessThanOrEqual(sizes.width + 1)
}

// navigate 验证可见菜单会改变路由，而非只切换页面内容。
export async function navigate(page: Page, label: string, path: string) {
  const link = page.locator('nav:visible').locator(`a[href="${path}"]`)
  await expect(link, `导航入口：${label}`).toBeVisible()
  await link.click()
  await expect(page).toHaveURL(new RegExp(`${path}$`))
}
