import { useState } from 'react'
import { Alert, Button, Checkbox, Collapse, Input, Tabs, Tag } from 'antd'
import { ipv4Subnet, parseNetworkOutput } from '../lib/networkImport'
import type { ImportedNetwork } from '../lib/networkImport'

type Props = { disabled: boolean; onAdd: (networks: string[]) => void }

// NetworkImport 计算虚拟机外的局域网范围，仅在用户选择后补充到待保存配置。
export default function NetworkImport({ disabled, onAdd }: Props) {
  const [address, setAddress] = useState('')
  const [mask, setMask] = useState('')
  const [output, setOutput] = useState('')
  const [candidates, setCandidates] = useState<ImportedNetwork[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // addManual 核验地址与掩码，不通过 DNS 或默认 /24 猜测范围。
  const addManual = () => {
    setNotice('')
    setError('')
    try {
      const cidr = ipv4Subnet(address, mask)
      onAdd([cidr])
      setNotice('已加入待保存网段：' + cidr + '。保存网络配置后才会生效。')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '网络信息无效。')
    }
  }

  // parse 将粘贴内容在浏览器内解析，多网卡不默认全选。
  const parse = () => {
    setNotice('')
    setError('')
    setSelected([])
    try {
      const result = parseNetworkOutput(output)
      setCandidates(result.candidates)
      setWarnings(result.warnings)
    } catch (failure) {
      setCandidates([])
      setWarnings([])
      setError(failure instanceof Error ? failure.message : '网络信息无效。')
    }
  }

  // addSelected 合并明确勾选的范围，保持现有规则和 DNS 不变。
  const addSelected = () => {
    const networks = [...new Set(selected.map((index) => candidates[index].cidr))]
    setError('')
    setNotice('')
    try {
      onAdd(networks)
      setNotice('已加入待保存网段：' + networks.join('、') + '。保存网络配置后才会生效。')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '网络信息无效。')
    }
  }

  return (
    <Collapse
      className="mb-5"
      items={[
        {
          key: 'import',
          label: '补充家庭网络 / 虚拟机外的局域网（可选）',
          children: (
            <div className="min-w-0 space-y-3">
              <p className="text-sm text-muted">
                Hyper-V 等 NAT 虚拟机可能访问宿主电脑所在的网络。补充 Windows 的 IPv4
                地址和子网掩码即可；直接部署在 Linux 上通常只需选择上方网卡。
              </p>
              <Tabs
                items={[
                  {
                    key: 'manual',
                    label: '填写 IP 和掩码',
                    children: (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="min-w-0 space-y-1 text-sm">
                            <span>电脑的 IPv4 地址</span>
                            <Input
                              aria-label="电脑的 IPv4 地址"
                              placeholder="例如 192.168.2.10"
                              maxLength={15}
                              value={address}
                              disabled={disabled}
                              onChange={(event) => setAddress(event.target.value)}
                            />
                          </label>
                          <label className="min-w-0 space-y-1 text-sm">
                            <span>子网掩码 / 前缀长度</span>
                            <Input
                              aria-label="子网掩码 / 前缀长度"
                              placeholder="例如 255.255.255.0 或 24"
                              maxLength={15}
                              value={mask}
                              disabled={disabled}
                              onChange={(event) => setMask(event.target.value)}
                            />
                          </label>
                        </div>
                        <Button disabled={disabled} onClick={addManual}>
                          计算并添加网段
                        </Button>
                      </div>
                    ),
                  },
                  {
                    key: 'paste',
                    label: '粘贴 ipconfig',
                    children: (
                      <div className="space-y-3">
                        <p className="text-sm text-muted">
                          在 Windows 终端运行 ipconfig，粘贴输出后选择实际连接家庭或公司网络的网卡。
                        </p>
                        <Input.TextArea
                          aria-label="ipconfig 输出"
                          placeholder="粘贴包含 IPv4 地址和子网掩码的网络信息，中英文均可。"
                          rows={6}
                          maxLength={32768}
                          value={output}
                          disabled={disabled}
                          onChange={(event) => {
                            setOutput(event.target.value)
                            setCandidates([])
                            setSelected([])
                            setWarnings([])
                            setNotice('')
                            setError('')
                          }}
                        />
                        <Button disabled={disabled || !output.trim()} onClick={parse}>
                          识别网卡
                        </Button>
                        {warnings.length > 0 && (
                          <Alert type="warning" showIcon title={warnings.join(' ')} />
                        )}
                        {candidates.length > 0 && (
                          <>
                            <Checkbox.Group
                              className="grid w-full gap-2"
                              value={selected}
                              disabled={disabled}
                              onChange={(values) => setSelected(values as number[])}
                            >
                              {candidates.map((item, index) => (
                                <Checkbox key={item.adapter + ':' + item.cidr} value={index}>
                                  <span className="text-sm break-all">
                                    {item.adapter} · {item.address}
                                    <Tag className="ml-2">{item.cidr}</Tag>
                                  </span>
                                </Checkbox>
                              ))}
                            </Checkbox.Group>
                            <Button disabled={disabled || !selected.length} onClick={addSelected}>
                              添加选中网段
                            </Button>
                          </>
                        )}
                        <p className="text-xs text-dim">
                          粘贴内容仅在当前页面解析，保存时只提交选中的网段。DNS
                          和网关不会被当成保护范围。
                        </p>
                      </div>
                    ),
                  },
                ]}
              />
              <p className="text-xs text-dim">
                Windows 的 ipconfig 通常不含 IPv6 前缀；额外 IPv6 网络请在高级设置填写。
              </p>
              {error && <Alert type="error" showIcon title={error} />}
              {notice && <Alert type="info" showIcon title={notice} />}
            </div>
          ),
        },
      ]}
    />
  )
}
