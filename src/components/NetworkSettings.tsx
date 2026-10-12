import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Collapse, Form, Modal, Select, Spin, Tag } from 'antd'
import NetworkImport from './NetworkImport'
import NetworkAdvanced from './NetworkAdvanced'
import { getNetwork, updateNetwork } from '../api/network'
import { getErrorMessage } from '../lib/format'
import type { NetworkConfig, NetworkException, NetworkView } from '../types/network'

type Values = {
  lanInterfaces: string[]
  blocked: string
  dns: string
  allow: NetworkException[]
}

// lines 接受每行一个地址，去掉空行，保持提交内容易于核对。
function lines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

// NetworkSettings 仅向超管展示宿主策略，保存确认后才改变实际规则。
export default function NetworkSettings() {
  const [form] = Form.useForm<Values>()
  const blocked = Form.useWatch('blocked', { form, preserve: true }) as string | undefined
  const extraNetworks = [...new Set(lines(blocked ?? ''))]
  const [view, setView] = useState<NetworkView | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pending, setPending] = useState<NetworkConfig | null>(null)

  // applyView 同步版本和服务器规范化后的配置，不定时覆盖未保存的输入。
  const applyView = useCallback(
    (next: NetworkView) => {
      setView(next)
      form.setFieldsValue({
        lanInterfaces: next.config.lanInterfaces,
        blocked: next.config.blockedCIDRs.join('\n'),
        dns: next.config.dnsServers.join('\n'),
        allow: next.config.allow,
      })
    },
    [form],
  )

  // load 由首次进入或用户主动刷新触发，失败时禁止提交旧配置。
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      applyView(await getNetwork())
    } catch (failure) {
      setView(null)
      setError(getErrorMessage(failure, '宿主网络服务暂时不可用'))
    } finally {
      setLoading(false)
    }
  }, [applyView])

  useEffect(() => {
    void load()
  }, [load])

  // addNetworks 合并识别结果，不覆盖旧网段或自动调整 DNS。
  const addNetworks = (networks: string[]) => {
    const merged = [...new Set([...lines(form.getFieldValue('blocked') ?? ''), ...networks])]
    if (merged.length > 128 || merged.join('\n').length > 8192) {
      throw new Error('额外网段过多，请先在高级设置中整理现有范围。')
    }
    form.setFieldValue('blocked', merged.join('\n'))
  }

  // confirm 先展示具体配置，取消不会向服务器发送变更。
  const confirm = (values: Values) => {
    setError('')
    setSuccess('')
    setPending({
      lanInterfaces: values.lanInterfaces,
      blockedCIDRs: lines(values.blocked ?? ''),
      dnsServers: lines(values.dns ?? ''),
      allow: values.allow ?? [],
    })
  }

  // save 使用读取版本提交，成功后展示实际生效范围，失败时保留输入。
  const save = async () => {
    if (!pending || !view || saving) return
    setSaving(true)
    try {
      const next = await updateNetwork(pending, view.revision)
      applyView(next)
      setPending(null)
      setError('')
      setSuccess(
        next.dnsChanged
          ? '网络规则已保存并生效。DNS 配置将在重新部署应用后生效。'
          : '网络规则已保存并生效。',
      )
    } catch (failure) {
      setPending(null)
      setError(getErrorMessage(failure, '网络配置保存失败'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label="容器网络配置" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          此配置影响本实例全部 Docker 应用，静态站点在浏览器发出的请求不受影响。
        </p>
        <Button
          className="min-h-11 sm:min-h-8"
          loading={loading}
          disabled={saving}
          onClick={() => void load()}
        >
          刷新配置
        </Button>
      </div>
      {error && <Alert type="error" showIcon title={error} />}
      {success && <Alert type="success" showIcon title={success} />}
      {!view && loading && (
        <div className="py-12 text-center">
          <Spin /> 正在读取宿主配置…
        </div>
      )}
      {view && (
        <>
          <div className="rounded-panel border border-line bg-panel p-4 shadow-panel sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="font-semibold">当前保护状态</strong>
              <Tag color={view.ready ? 'success' : 'error'}>
                {view.ready ? '规则已生效' : '规则未就绪'}
              </Tag>
              <span className="text-xs text-dim">
                最近核验：{new Date(view.checkedAt).toLocaleString('zh-CN')}
              </span>
            </div>
            {view.error && <Alert className="mt-3" type="warning" showIcon title={view.error} />}
            <p className="mt-3 text-sm text-muted">
              允许公网和 Linux 自身可达的服务；阻止应用直接访问以下网段中的其他设备。
            </p>
            <div className="mt-2 flex flex-wrap gap-1" aria-label="实际拦截网段">
              {view.effectiveBlockedCIDRs.map((cidr) => (
                <Tag key={cidr} className="break-all">
                  {cidr}
                </Tag>
              ))}
            </div>
          </div>
          <Form
            form={form}
            layout="vertical"
            onFinish={confirm}
            disabled={loading || saving}
            className="rounded-panel border border-line bg-panel p-4 shadow-panel sm:p-5"
          >
            <h2 className="mb-4 text-base font-semibold">网络访问策略</h2>
            <Form.Item
              name="lanInterfaces"
              label="服务器所在网络"
              rules={[{ required: true, type: 'array', min: 1, message: '请至少选择一个接口' }]}
              extra="已自动读取服务器网卡。选择连接家庭或公司网络的网卡，自动保护其 IPv4 和 IPv6 网段；Linux 本机服务仍允许访问。"
            >
              <Select
                mode="multiple"
                aria-label="服务器所在网络"
                options={view.interfaces
                  .filter((item) => item.eligible || view.config.lanInterfaces.includes(item.name))
                  .map((item) => ({
                    value: item.name,
                    label: item.name + ' · ' + item.addresses.join('、'),
                  }))}
              />
            </Form.Item>
            <div className="mb-5">
              <p className="mb-2 text-sm font-medium">额外保护的局域网</p>
              <div className="flex flex-wrap gap-2" aria-label="待保存的额外网段">
                {extraNetworks.length ? (
                  extraNetworks.map((cidr) => (
                    <Tag
                      key={cidr}
                      className="max-w-full break-all"
                      closable={!loading && !saving}
                      onClose={() =>
                        form.setFieldValue(
                          'blocked',
                          extraNetworks.filter((item) => item !== cidr).join('\n'),
                        )
                      }
                    >
                      {cidr}
                    </Tag>
                  ))
                ) : (
                  <span className="text-sm text-muted">
                    尚未补充，服务器选定网卡的网段仍会自动保护。
                  </span>
                )}
              </div>
            </div>
            <NetworkImport key={view.revision} disabled={loading || saving} onAdd={addNetworks} />
            <Collapse
              className="mb-5"
              items={[
                {
                  key: 'advanced',
                  label: '高级设置：手动网段、DNS和端口例外',
                  forceRender: true,
                  children: <NetworkAdvanced disabled={loading || saving} />,
                },
              ]}
            />
            <Button
              type="primary"
              htmlType="submit"
              className="min-h-11 w-full sm:w-auto"
              disabled={!view.revision || loading || saving}
            >
              保存网络配置
            </Button>
          </Form>
        </>
      )}
      <Modal
        open={pending !== null}
        title="确认修改网络策略"
        centered
        onCancel={() => !saving && setPending(null)}
        onOk={() => void save()}
        okText="确认保存并应用"
        confirmLoading={saving}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
        maskClosable={!saving}
        styles={{ body: { maxHeight: '65dvh', overflowY: 'auto' } }}
      >
        <p className="mb-4 text-sm text-muted">
          保存后立即影响全部 Docker 应用的直接网络访问。Linux 自身服务仍按现有权限访问。
        </p>
        {pending && (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted">服务器网卡（自动保护其全部 IPv4 / IPv6 网段）</dt>
              <dd className="mt-1 break-all">
                {view?.interfaces
                  .filter((item) => pending.lanInterfaces.includes(item.name))
                  .map((item) => item.name + ' · ' + item.addresses.join('、'))
                  .join('；')}
              </dd>
            </div>
            <div>
              <dt className="text-muted">额外禁止网段</dt>
              <dd className="mt-1 break-all">{pending.blockedCIDRs.join('、') || '无'}</dd>
            </div>
            <div>
              <dt className="text-muted">公网 DNS</dt>
              <dd className="mt-1 break-all">{pending.dnsServers.join('、')}</dd>
            </div>
            <div>
              <dt className="text-muted">允许例外</dt>
              <dd className="mt-1 break-all">
                {pending.allow
                  .map((item) => `${item.address} · ${item.protocol.toUpperCase()}/${item.port}`)
                  .join('；') || '无'}
              </dd>
            </div>
          </dl>
        )}
      </Modal>
    </section>
  )
}
