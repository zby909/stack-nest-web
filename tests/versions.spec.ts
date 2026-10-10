import { test, expect } from './fixtures.ts'
import { date } from './data.ts'
import { assertFits } from './helpers.ts'

// 验证详情页真实导航、刷新恢复、日志固定项目以及移动端两种主题的布局。
test('项目详情支持深链接、前后退和项目范围日志', async ({ page, api, isMobile }, info) => {
  const project = api.projects[0]
  await page.goto(`/projects/${project.slug}/versions`)
  await expect(page.getByRole('heading', { name: project.name, exact: true })).toBeVisible()
  const nav = page.getByRole('navigation', { name: '项目详情' })
  await nav.getByRole('link', { name: '文件', exact: true }).click()
  await expect(page).toHaveURL(/\/files$/)
  await expect(page.getByRole('list', { name: '文件目录' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('list', { name: '文件目录' })).toBeVisible()
  await nav.getByRole('link', { name: '日志', exact: true }).click()
  await expect.poll(() => api.logQueries.at(-1)?.slug).toBe(project.slug)
  await expect(page.getByRole('textbox', { name: '项目标识' })).not.toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/files$/)
  if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await page.evaluate(() => window.scrollTo(0, 0))
    await assertFits(page)
    await page.screenshot({
      path: info.outputPath(`detail-${colorScheme}.png`),
      animations: 'disabled',
    })
  }
})

// 验证草稿不改变正式版本、更新说明按纯文本显示，确认后才发布并保留两版。
test('预览草稿独立保留，确认发布后才替换正式版', async ({ page, api }) => {
  const project = api.projects[0]
  project.draft = {
    id: 'candidate',
    status: 'draft',
    fileName: 'next.zip',
    createdAt: date,
    notes: '<script>alert(1)</script>\n第二行说明',
    previewUrl: 'https://stack-nest--candidate.example.com/',
    files: { bytes: 500, count: 2 },
  }
  await page.goto(`/projects/${project.slug}/versions`)
  const draft = page.getByRole('article', { name: '待发布版', exact: true })
  await expect(draft.getByText('<script>alert(1)</script>', { exact: false })).toBeVisible()
  await expect(draft.locator('script')).toHaveCount(0)
  await expect(draft.getByRole('link', { name: '独立预览 ↗' })).toHaveAttribute(
    'href',
    project.draft.previewUrl!,
  )
  await expect(page.getByRole('button', { name: '上传新版本' })).toBeDisabled()
  await draft.getByRole('button', { name: '发布此版本' }).click()
  expect(project.deployments?.[0].id).toBe('current-version')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^取\s*消$/ })
    .click()
  expect(api.requests.filter((request) => request.path.endsWith('/draft/publish'))).toHaveLength(0)
  await draft.getByRole('button', { name: '发布此版本' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认发布' }).click()
  await expect(draft).not.toBeVisible()
  await expect(page.getByRole('article', { name: '当前正式版' })).toContainText('next.zip')
  expect(project.deployments?.map((version) => version.id)).toEqual([
    'candidate',
    'current-version',
  ])
  expect(project.deployments?.[0].notes).toContain('第二行说明')
})

// 验证过期确认不会误发布新草稿，并且丢弃流程与首次未发布状态可正确恢复。
test('过期发布被拒绝，丢弃草稿保留项目与正式版', async ({ page, api }) => {
  const project = api.projects[0]
  project.draft = { id: 'candidate', status: 'draft', fileName: 'next.zip', createdAt: date }
  await page.goto(`/projects/${project.slug}/versions`)
  await page.getByRole('button', { name: '发布此版本' }).click()
  project.draft.id = 'newer-candidate'
  await page.getByRole('dialog').getByRole('button', { name: '确认发布' }).click()
  await expect(page.getByRole('dialog').getByText(/项目版本已发生变化/)).toBeVisible()
  expect(project.deployments?.[0].id).toBe('current-version')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^取\s*消$/ })
    .click()
  await page.reload()
  await page
    .getByRole('article', { name: '待发布版', exact: true })
    .getByRole('button', { name: /^丢\s*弃$/ })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: '确认丢弃' }).click()
  await expect(page.getByRole('article', { name: '待发布版', exact: true })).not.toBeVisible()
  expect(project.deployments?.[0].id).toBe('current-version')
})

// 验证首版草稿无正式入口，未拥有或已经删除的项目有明确错误。
test('首次发布前与不存在项目的详情状态', async ({ page, api }) => {
  const project = api.projects[0]
  project.status = 'draft'
  project.deployments = []
  await page.goto(`/projects/${project.slug}/files`)
  await expect
    .poll(() =>
      page
        .getByText('打开正式站点 ↗', { exact: true })
        .evaluate((element) =>
          element.closest('a, button')?.matches('[disabled], [aria-disabled="true"]'),
        ),
    )
    .toBe(true)
  await expect(page.getByText('暂无版本文件，请上传待发布版')).toBeVisible()
  await page.goto('/projects/missing/versions')
  await expect(page.getByRole('alert').getByText(/项目不存在/)).toBeVisible()
  await page.getByRole('link', { name: '← 所有项目' }).click()
  await expect(page).toHaveURL('/projects')
})

// 文件比较按需加载，展示新增、同大小修改和删除，并限制为所选项目版本。
test('版本文件变化比较与窄屏布局', async ({ page, api, isMobile }, info) => {
  const project = api.projects[0]
  await page.goto(`/projects/${project.slug}/versions`)
  expect(api.requests.filter((request) => request.path.endsWith('/changes'))).toHaveLength(0)
  await page.getByRole('button', { name: '比较文件变化' }).click()
  const changes = page.getByRole('list', { name: '文件变化' })
  await expect(changes).toContainText('index.html')
  await expect(changes).toContainText('200 B → 200 B')
  await expect(changes).toContainText('new.css')
  await expect(changes).toContainText('old.css')
  if (isMobile) await page.setViewportSize({ width: 320, height: 900 })
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await page.evaluate(() => window.scrollTo(0, 0))
    await assertFits(page)
    await page.screenshot({
      path: info.outputPath(`versions-${colorScheme}.png`),
      animations: 'disabled',
      fullPage: true,
    })
  }
})
