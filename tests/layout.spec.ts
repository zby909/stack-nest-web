import { test, expect } from './fixtures.ts'
import { assertFits, navigate, openMenu } from './helpers.ts'

// 五种常见宽度覆盖项目、日志、系统、邮箱以及确认弹窗。
for (const width of [320, 375, 390, 768, 1440]) {
  test(`页面和弹窗在 ${width}px 下不横向溢出`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/projects')
    await expect(page.locator('#projects article')).toHaveCount(1)
    await assertFits(page)
    if (width === 320 || width === 1440) {
      await page.screenshot({
        path: testInfo.outputPath(`projects-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      })
    }
    const dialog = await openMenu(page, '暂停访问')
    await assertFits(page)
    await dialog.getByRole('button', { name: /^取\s*消$/ }).click()
    await navigate(page, '操作日志', '/activity')
    await expect(page.getByText('记录 1', { exact: true })).toBeVisible()
    await assertFits(page)
    await navigate(page, '服务器状态', '/system')
    await expect(page.getByText('60.0 KiB', { exact: true })).toBeVisible()
    await assertFits(page)
    await navigate(page, '用户邮箱', '/users')
    await page
      .getByRole('textbox', { name: '新用户邮箱' })
      .fill('new-user-with-a-long-email@example.com')
    await page.getByRole('button', { name: '添加邮箱', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await assertFits(page)
  })
}
