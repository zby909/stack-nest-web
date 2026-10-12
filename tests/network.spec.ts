import { test, expect } from './fixtures.ts'
import { assertFits } from './helpers.ts'

// 超管保存前核对策略，取消不写入；保存后展示实际生效范围和 DNS 提示。
test('超管配置容器网络并确认保存', async ({ page, api }) => {
  api.role = 'superadmin'
  await page.goto('/network')
  await expect(page.locator('nav:visible a[href="/network"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: '配置容器网络访问' })).toBeVisible()
  await page.getByRole('button', { name: '高级设置：手动网段、DNS和端口例外' }).click()
  await expect(page.getByRole('textbox', { name: '额外禁止网段' })).toHaveValue('192.168.2.0/24')
  await page.getByRole('textbox', { name: '额外禁止网段' }).fill('192.168.2.0/24\n192.168.50.0/24')
  await page.getByRole('textbox', { name: '公网 DNS' }).fill('1.1.1.1\n8.8.8.8')
  await page.getByRole('button', { name: '添加允许例外' }).click()
  await page.getByRole('textbox', { name: '例外 1 目标 IP' }).fill('192.168.2.3')
  await page.getByRole('spinbutton', { name: '例外 1 端口' }).fill('5432')
  await page.getByRole('button', { name: '保存网络配置', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await expect(dialog.getByText('192.168.2.3 · TCP/5432', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: /^取\s*消$/ }).click()
  expect(
    api.requests.filter((request) => request.path === '/api/network' && request.method === 'PUT'),
  ).toHaveLength(0)
  await page.getByRole('button', { name: '保存网络配置', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '确认保存并应用' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText(/DNS 配置将在重新部署应用后生效/)).toBeVisible()
  await expect(page.getByLabel('实际拦截网段')).toContainText('192.168.50.0/24')
  expect(api.requests.findLast((request) => request.method === 'PUT')?.body).toMatchObject({
    expectedRevision: 'revision-1',
    config: { allow: [{ address: '192.168.2.3', port: 5432, protocol: 'tcp' }] },
  })
  await assertFits(page)
})

// 普通管理员仍能管理服务器资源，但既没有网络菜单也不能直接打开网络页。
test('管理员和普通用户不能进入网络设置', async ({ page, api }) => {
  for (const role of ['admin', 'user'] as const) {
    api.role = role
    await page.goto('/network')
    await expect(page).toHaveURL(/\/projects$/)
    await expect(page.locator('nav:visible').locator('a[href="/network"]')).toHaveCount(0)
  }
  expect(api.requests.some((request) => request.path === '/api/network')).toBe(false)
})

// 冲突不会展示成功或覆盖输入，超管可主动刷新后重新编辑。
test('配置冲突保留输入并提示刷新', async ({ page, api }) => {
  api.role = 'superadmin'
  api.networkConflict = true
  await page.goto('/network')
  await page.getByRole('button', { name: '高级设置：手动网段、DNS和端口例外' }).click()
  await page.getByRole('textbox', { name: '额外禁止网段' }).fill('192.168.50.0/24')
  await page.getByRole('button', { name: '保存网络配置', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认保存并应用' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByText(/配置已被更新，请刷新后重试/)).toBeVisible()
  await expect(page.getByRole('textbox', { name: '额外禁止网段' })).toHaveValue('192.168.50.0/24')
  await expect(page.getByText('网络规则已保存并生效。', { exact: true })).toHaveCount(0)
})

// 小屏下网段、输入框、允许例外和确认弹窗均可操作且没有水平溢出。
test('手机超管网络设置布局', async ({ page, api }) => {
  api.role = 'superadmin'
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/network')
  await page.getByRole('button', { name: '高级设置：手动网段、DNS和端口例外' }).click()
  await expect(page.getByRole('textbox', { name: '额外禁止网段' })).toBeVisible()
  await page.getByRole('button', { name: '添加允许例外' }).click()
  await page.getByRole('textbox', { name: '例外 1 目标 IP' }).fill('192.168.2.3')
  await assertFits(page)
  await page.getByRole('button', { name: '保存网络配置', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await assertFits(page)
})

// 简单填写不猜掩码；新增与重复添加保持已有范围，取消保存不改变服务器。
test('填写 IP 和掩码补充网络，确认后才生效', async ({ page, api }) => {
  api.role = 'superadmin'
  await page.goto('/network')
  await page.getByRole('button', { name: /补充家庭网络/ }).click()
  await page.getByRole('textbox', { name: '电脑的 IPv4 地址' }).fill('192.168.50.10')
  await page.getByRole('button', { name: '计算并添加网段' }).click()
  await expect(page.getByText(/不能仅凭 IP 推断范围/)).toBeVisible()
  await page.getByRole('textbox', { name: '子网掩码 / 前缀长度' }).fill('255.0.255.0')
  await page.getByRole('button', { name: '计算并添加网段' }).click()
  await expect(page.getByText(/子网掩码必须连续/)).toBeVisible()
  await page.getByRole('textbox', { name: '子网掩码 / 前缀长度' }).fill('255.255.255.0')
  await page.getByRole('button', { name: '计算并添加网段' }).click()
  await page.getByRole('button', { name: '计算并添加网段' }).click()
  await expect(page.getByLabel('待保存的额外网段')).toContainText('192.168.50.0/24')
  await expect(page.getByLabel('待保存的额外网段')).toContainText('192.168.2.0/24')
  await assertFits(page)
  await page.screenshot({ path: test.info().outputPath('network-manual.png'), fullPage: true })
  expect(api.network.config.blockedCIDRs).toEqual(['192.168.2.0/24'])
  await page.getByRole('button', { name: '保存网络配置', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await expect(dialog.getByText('192.168.2.0/24、192.168.50.0/24', { exact: true })).toBeVisible()
  await expect(dialog.getByText(/172.21.47.248\/20/)).toBeVisible()
  await dialog.getByRole('button', { name: /^取\s*消$/ }).click()
  expect(api.requests.filter((item) => item.method === 'PUT')).toHaveLength(0)
  await page.getByRole('button', { name: '保存网络配置', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '确认保存并应用' }).click()
  await expect(dialog).not.toBeVisible()
  expect(api.network.config.blockedCIDRs).toEqual(['192.168.2.0/24', '192.168.50.0/24'])
  expect(api.network.config.dnsServers).toEqual(['1.1.1.1', '223.5.5.5'])
})

// 多网卡需主动选择，粘贴原文和 DNS 不进入保存请求；修改原文清除旧识别结果。
test('粘贴中英文 ipconfig 选择网卡，忽略 DNS 和网关', async ({ page, api }) => {
  api.role = 'superadmin'
  await page.goto('/network')
  await page.getByRole('button', { name: /补充家庭网络/ }).click()
  await page.getByRole('tab', { name: '粘贴 ipconfig' }).click()
  const output = [
    '以太网适配器 以太网:',
    '   IPv4 地址 . . . . . . : 10.21.30.5(首选)',
    '   子网掩码 . . . . . . : 255.255.252.0',
    '   默认网关 . . . . . . : 10.21.28.1',
    '   DNS 服务器 . . . . . : 223.5.5.5',
    '                          192.168.200.1',
    'Ethernet adapter vEthernet (Default Switch):',
    '   IPv4 Address. . . . . : 172.21.47.248(Preferred)',
    '   Subnet Mask . . . . . : 255.255.240.0',
  ].join('\n')
  await page.getByRole('textbox', { name: 'ipconfig 输出' }).fill(output)
  await page.getByRole('button', { name: '识别网卡' }).click()
  await expect(page.getByRole('checkbox')).toHaveCount(2)
  await expect(page.getByRole('button', { name: '添加选中网段' })).toBeDisabled()
  await page.getByRole('checkbox', { name: /以太网适配器 以太网/ }).check()
  await page.getByRole('button', { name: '添加选中网段' }).click()
  await expect(page.getByLabel('待保存的额外网段')).toContainText('10.21.28.0/22')
  await expect(page.getByLabel('待保存的额外网段')).not.toContainText('172.21.32.0/20')
  await assertFits(page)
  await page.screenshot({ path: test.info().outputPath('network-paste.png'), fullPage: true })
  await page.getByRole('textbox', { name: 'ipconfig 输出' }).fill(output + '\n')
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await page.getByRole('button', { name: '保存网络配置', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认保存并应用' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const request = api.requests.findLast((item) => item.method === 'PUT')?.body
  expect(request).toMatchObject({
    config: {
      blockedCIDRs: ['192.168.2.0/24', '10.21.28.0/22'],
      dnsServers: ['1.1.1.1', '223.5.5.5'],
    },
  })
  expect(JSON.stringify(request)).not.toContain('Default Switch')
  expect(JSON.stringify(request)).not.toContain('192.168.200.1')
})
