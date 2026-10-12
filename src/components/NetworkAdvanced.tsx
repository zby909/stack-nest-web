import { Button, Form, Input, InputNumber, Select } from 'antd'

// NetworkAdvanced 保留手动网段、DNS 和端口例外，简单配置无需展开。
export default function NetworkAdvanced({ disabled }: { disabled: boolean }) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
        <Form.Item
          name="blocked"
          label="额外禁止网段"
          extra="每行一个 CIDR，例如 192.168.2.0/24。虚拟机 NAT 外的家庭网络需要在此填写。"
        >
          <Input.TextArea
            rows={4}
            maxLength={8192}
            placeholder={'192.168.2.0/24\nfd12:3456:789a::/64'}
          />
        </Form.Item>
        <Form.Item
          name="dns"
          label="公网 DNS"
          rules={[{ required: true, whitespace: true, message: '请填写至少一个公网 DNS' }]}
          extra="每行一个，最多 3 个。修改 DNS 后需重新部署应用；其他策略保存后立即生效。"
        >
          <Input.TextArea rows={4} maxLength={256} placeholder={'1.1.1.1\n223.5.5.5'} />
        </Form.Item>
      </div>
      <div className="mb-3">
        <h3 className="font-semibold">允许例外</h3>
        <p className="mt-1 text-sm text-muted">
          需要连接局域网数据库等服务时，仅放行目标 IP 的指定端口。
        </p>
      </div>
      <Form.List name="allow">
        {(fields, { add, remove }) => (
          <div className="mb-5 space-y-3">
            {fields.map(({ key, name, ...rest }) => (
              <div
                key={key}
                className="grid grid-cols-2 items-start gap-2 rounded-lg border border-line p-3 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_auto]"
              >
                <Form.Item
                  {...rest}
                  name={[name, 'address']}
                  label="目标 IP"
                  className="col-span-2 mb-0 sm:col-span-1"
                  rules={[{ required: true, whitespace: true, message: '填写目标 IP' }]}
                >
                  <Input
                    aria-label={`例外 ${name + 1} 目标 IP`}
                    placeholder="192.168.2.3"
                    maxLength={45}
                  />
                </Form.Item>
                <Form.Item
                  {...rest}
                  name={[name, 'port']}
                  label="端口"
                  className="mb-0"
                  rules={[
                    {
                      required: true,
                      type: 'number',
                      min: 1,
                      max: 65535,
                      message: '端口 1 至 65535',
                    },
                  ]}
                >
                  <InputNumber
                    aria-label={`例外 ${name + 1} 端口`}
                    min={1}
                    max={65535}
                    precision={0}
                    className="w-full"
                  />
                </Form.Item>
                <Form.Item
                  {...rest}
                  name={[name, 'protocol']}
                  label="协议"
                  className="mb-0"
                  rules={[{ required: true }]}
                >
                  <Select
                    aria-label={`例外 ${name + 1} 协议`}
                    options={[
                      { value: 'tcp', label: 'TCP' },
                      { value: 'udp', label: 'UDP' },
                    ]}
                  />
                </Form.Item>
                <Button
                  danger
                  className="col-span-2 min-h-11 sm:col-span-1 sm:mt-7 sm:min-h-8"
                  aria-label={`删除例外 ${name + 1}`}
                  disabled={disabled}
                  onClick={() => remove(name)}
                >
                  删除
                </Button>
              </div>
            ))}
            <Button
              onClick={() => add({ address: '', port: 443, protocol: 'tcp' })}
              disabled={disabled || fields.length >= 128}
            >
              添加允许例外
            </Button>
          </div>
        )}
      </Form.List>
    </div>
  )
}
