import { test, expect } from '@playwright/test'
import { ipv4Subnet, parseNetworkOutput } from '../src/lib/networkImport.ts'

// 不同掩码按真实边界计算，不能假设所有家庭网络都是 /24。
test('局域网网段计算覆盖不同掩码和前缀', () => {
  for (const [address, mask, expected] of [
    ['192.168.2.10', '255.255.255.0', '192.168.2.0/24'],
    ['172.21.47.248', '255.255.240.0', '172.21.32.0/20'],
    ['10.21.30.5', '/22', '10.21.28.0/22'],
    ['192.168.2.254', '32', '192.168.2.254/32'],
    ['10.255.255.254', '8', '10.0.0.0/8'],
  ])
    expect(ipv4Subnet(address, mask)).toBe(expected)
})

// 缺少掩码、非连续掩码、公网 DNS 和跨出私有范围的输入不能成为保护网段。
test('错误或过大的输入拒绝推断网段', () => {
  for (const [address, mask] of [
    ['192.168.2.10', ''],
    ['192.168.2.10', '255.0.255.0'],
    ['192.168.2.10', '8'],
    ['192.168.2.10', '33'],
    ['192.168.2.999', '24'],
    ['192.168.02.10', '24'],
    ['223.5.5.5', '24'],
    ['100.68.110.44', '24'],
  ])
    expect(() => ipv4Subnet(address, mask)).toThrow()
})

// 网卡段落内配对字段，不能拿另一张网卡的掩码补齐缺失信息。
test('识别输出不跨网卡配对，支持换行和去重', () => {
  const result = parseNetworkOutput(
    [
      '  以太网适配器 缺少掩码:',
      '   IPv4 地址 . . . . : 192.168.2.10',
      '  Ethernet adapter Empty:',
      '   Subnet Mask . . . : 255.255.255.0',
      '  无线局域网适配器 WLAN:',
      '   IPv4 地址 . . . . : 192',
      '.168.50.10(首选)',
      '   子网掩码 . . . . : 255',
      '.255.255.0',
      '   IPv4 地址 . . . . : 192.168.50.11',
      '   子网掩码 . . . . : 255.255.255.0',
      '   DNS 服务器 . . . : 192.168.99.1',
    ].join('\n'),
  )
  expect(result.candidates).toEqual([
    { adapter: '无线局域网适配器 WLAN', address: '192.168.50.10', cidr: '192.168.50.0/24' },
  ])
  expect(result.warnings.join(' ')).toContain('192.168.2.10 缺少对应的子网掩码')
})

// DNS 单独输入和 IPv6 无前缀信息时不会猜测；粘贴长度有界。
test('无完整信息的输出不生成猜测结果', () => {
  expect(parseNetworkOutput('DNS Servers . . . : 192.168.2.1').candidates).toEqual([])
  expect(parseNetworkOutput('IPv6 Address . . . : fd12::10').candidates).toEqual([])
  expect(parseNetworkOutput('IPv4 Address . . . : 192.168.2.1000').candidates).toEqual([])
  expect(() => parseNetworkOutput('x'.repeat(32769))).toThrow('网络信息过长')
})
