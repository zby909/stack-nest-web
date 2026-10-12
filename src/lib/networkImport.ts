export type ImportedNetwork = { adapter: string; address: string; cidr: string }

const privateRanges = [
  { start: 0x0a000000, end: 0x0affffff },
  { start: 0xac100000, end: 0xac1fffff },
  { start: 0xc0a80000, end: 0xc0a8ffff },
]

// ipv4Number 严格解析 IPv4，不将 DNS、域名或不完整地址猜成网段。
function ipv4Number(value: string) {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value)) {
    throw new Error('请填写完整的 IPv4 地址，例如 192.168.2.10。')
  }
  const parts = value.split('.').map(Number)
  if (parts.some((part) => part > 255)) throw new Error('IPv4 地址每一段须为 0 至 255。')
  return parts.reduce((total, part) => (total * 256 + part) >>> 0, 0)
}

// ipv4Subnet 根据地址和连续掩码计算完整私有网段，拒绝缺失或过大的范围。
export function ipv4Subnet(rawAddress: string, rawMask: string) {
  const address = ipv4Number(rawAddress.trim())
  const mask = rawMask.trim().replace(/^\//, '')
  let bits: number
  if (/^(?:0|[1-9]\d?)$/.test(mask)) {
    bits = Number(mask)
  } else {
    if (!mask) throw new Error('请填写子网掩码或前缀长度，不能仅凭 IP 推断范围。')
    const binary = ipv4Number(mask).toString(2).padStart(32, '0')
    if (!/^1*0*$/.test(binary)) throw new Error('子网掩码必须连续，例如 255.255.255.0。')
    bits = binary.indexOf('0') === -1 ? 32 : binary.indexOf('0')
  }
  if (bits < 8 || bits > 32) throw new Error('前缀长度须为 8 至 32，请核对实际子网掩码。')
  const width = 2 ** (32 - bits)
  const start = Math.floor(address / width) * width
  const end = start + width - 1
  if (!privateRanges.some((range) => start >= range.start && end <= range.end)) {
    throw new Error('请使用实际局域网的私有 IPv4 地址和掩码；公网 DNS 不能用来识别局域网。')
  }
  const subnet = [24, 16, 8, 0].map((shift) => (start >>> shift) & 255).join('.')
  return subnet + '/' + bits
}

// parseNetworkOutput 按网卡配对中英文 ipconfig 的地址与掩码，忽略 DNS 和网关。
export function parseNetworkOutput(text: string) {
  if (text.length > 32768) throw new Error('网络信息过长，请只粘贴需要的 ipconfig 输出。')
  const blocks: { adapter: string; text: string }[] = [{ adapter: '粘贴的网卡', text: '' }]
  for (const line of text.split(/\r?\n/)) {
    if (
      (/^\S[^\r\n]*[:：]\s*$/.test(line) || /(?:适配器|adapter)[^:：]*[:：]\s*$/i.test(line)) &&
      !/IPv4|子网掩码|Subnet Mask/i.test(line)
    ) {
      blocks.push({ adapter: line.trim().replace(/[:：]$/, ''), text: '' })
    } else {
      blocks[blocks.length - 1].text += line + '\n'
    }
  }
  const candidates: ImportedNetwork[] = []
  const warnings: string[] = []
  for (const block of blocks) {
    const fields = block.text.matchAll(
      /(IPv4\s*(?:Address|地址)|子网掩码|Subnet\s+Mask)[^:：\r\n]*[:：]\s*(\d{1,3}(?:\s*\.\s*\d{1,3}){3})(?!\d|\s*\.\s*\d)/gi,
    )
    let address = ''
    for (const field of fields) {
      const value = field[2].replace(/\s/g, '')
      if (/IPv4/i.test(field[1])) {
        if (address) warnings.push(block.adapter + '：' + address + ' 缺少对应的子网掩码，未添加。')
        address = value
      } else if (address) {
        try {
          const cidr = ipv4Subnet(address, value)
          if (!candidates.some((item) => item.adapter === block.adapter && item.cidr === cidr)) {
            candidates.push({ adapter: block.adapter, address, cidr })
          }
        } catch (error) {
          warnings.push(
            block.adapter + '：' + (error instanceof Error ? error.message : '地址无效。'),
          )
        }
        address = ''
      }
    }
    if (address) warnings.push(block.adapter + '：' + address + ' 缺少对应的子网掩码，未添加。')
  }
  if (!candidates.length && !warnings.length) {
    warnings.push('未找到完整的 IPv4 地址和子网掩码，请粘贴 ipconfig 输出，或改用手动填写。')
  }
  return { candidates, warnings }
}
