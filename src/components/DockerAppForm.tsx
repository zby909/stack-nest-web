import { useState } from 'react'
import { Alert, Checkbox, Collapse, Form, Input, InputNumber, Modal } from 'antd'
import { parseEnv } from '../lib/appEnvironment'
import { saveApp } from '../api/apps'
import { getErrorMessage } from '../lib/format'
import type { AppInput, AppView } from '../types/app'

type Values = Omit<AppInput, 'env' | 'registry'> & {
  envText?: string
  registryUsername?: string
  registryPassword?: string
}

// DockerAppForm 每次打开都重新创建，关闭时销毁未提交的敏感值。
export default function DockerAppForm({
  target,
  maxMemoryMiB,
  onClose,
  onSaved,
}: {
  target: AppView | null
  maxMemoryMiB: number
  onClose: () => void
  onSaved: () => void
}) {
  const [form] = Form.useForm<Values>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const replacing = Form.useWatch('replaceEnv', form)
  const app = target?.app

  // submit 保留未替换的配置，仓库密码不会从服务端回填。
  const submit = async () => {
    let values: Values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    setSaving(true)
    setError('')
    try {
      const { envText, registryUsername, registryPassword, ...fields } = values
      if (fields.clearRegistry && (registryUsername || registryPassword))
        throw new Error('不能同时填写并清除仓库凭据。')
      if (!!registryUsername !== !!registryPassword)
        throw new Error('请同时填写仓库用户名与密码 / 令牌。')
      await saveApp(
        {
          ...fields,
          dataPath: fields.dataPath ?? '',
          healthPath: fields.healthPath ?? '',
          env: parseEnv(envText ?? ''),
          replaceEnv: !app || fields.replaceEnv === true,
          clearRegistry: fields.clearRegistry === true,
          registry:
            registryUsername && registryPassword
              ? { username: registryUsername, password: registryPassword }
              : undefined,
          generation: app?.generation,
        },
        app?.id,
      )
      onSaved()
      onClose()
    } catch (failure) {
      setError(getErrorMessage(failure, '提交应用失败'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title={app ? '更新 Docker 应用' : '部署 Docker 应用'}
      okText={app ? '提交更新' : '开始部署'}
      cancelText="取消"
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={() => {
        if (!saving) onClose()
      }}
      closable={!saving}
      mask={{ closable: !saving }}
      keyboard={!saving}
      destroyOnHidden
    >
      <p className="mb-4 text-sm text-muted">
        填写已构建的 Linux amd64 镜像。部署在后台执行，完成前可以关闭页面。
      </p>
      {error && <Alert type="error" showIcon title={error} className="mb-4" />}
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          name: app?.name ?? '',
          slug: app?.slug ?? '',
          image: app?.image ?? '',
          port: app?.port ?? 3000,
          memoryMiB: app?.memoryMiB ?? 256,
          cpus: app?.cpus ?? 0.5,
          dataPath: app?.dataPath ?? '',
          healthPath: app?.healthPath ?? '',
          replaceEnv: false,
          clearRegistry: false,
        }}
      >
        <Form.Item
          name="name"
          label="应用名称"
          rules={[{ required: true, whitespace: true, message: '请输入应用名称' }, { max: 100 }]}
        >
          <Input maxLength={100} autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="slug"
          label="应用标识"
          extra="用于分配独立域名，创建后不变。"
          rules={[
            {
              required: true,
              pattern: /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/,
              message: '使用 1–32 位小写字母、数字或连字符',
            },
          ]}
        >
          <Input disabled={!!app} maxLength={32} autoComplete="off" placeholder="my-app" />
        </Form.Item>
        <Form.Item
          name="image"
          label="镜像地址"
          rules={[{ required: true, whitespace: true, message: '请输入镜像地址' }, { max: 256 }]}
        >
          <Input autoComplete="off" placeholder="docker.io/用户名/应用:版本" />
        </Form.Item>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
          <Form.Item name="port" label="容器端口" rules={[{ required: true }]}>
            <InputNumber min={1} max={65535} precision={0} className="w-full" />
          </Form.Item>
          <Form.Item
            name="memoryMiB"
            label="内存上限 (MiB)"
            rules={[
              { required: true },
              {
                type: 'number',
                min: 64,
                max: maxMemoryMiB,
                message: `内存须为 64–${maxMemoryMiB} MiB`,
              },
            ]}
          >
            <InputNumber min={64} max={maxMemoryMiB} step={64} precision={0} className="w-full" />
          </Form.Item>
          <Form.Item name="cpus" label="CPU 上限 (核)" rules={[{ required: true }]}>
            <InputNumber min={0.1} max={1} step={0.1} precision={1} className="w-full" />
          </Form.Item>
        </div>
        <Form.Item
          name="healthPath"
          label="HTTP 健康检查路径（可选）"
          extra="例如 /health。部署时最多等待 60 秒返回 2xx；留空仅检查端口，不会自动重启异常应用。"
          rules={[
            { max: 256 },
            {
              pattern: /^(?:$|\/(?!\/)[^\\\s?#%]*)$/,
              message: '填写 /health 形式的路径，不包含地址、查询参数或片段',
            },
          ]}
        >
          <Input autoComplete="off" placeholder="/health" maxLength={256} />
        </Form.Item>
        <Form.Item
          name="dataPath"
          label="持久化目录（可选）"
          extra="例如 /app/data。仅此目录在更新和重建后保留；永久删除应用会删除数据。"
        >
          <Input autoComplete="off" placeholder="/app/data" />
        </Form.Item>
        {app && (
          <Form.Item name="replaceEnv" valuePropName="checked">
            <Checkbox>替换环境变量（默认保留现有配置）</Checkbox>
          </Form.Item>
        )}
        {app && (
          <p className="mb-3 text-xs break-words text-muted">
            已配置变量：{app.envKeys.join('、') || '无'}；值不回显。
          </p>
        )}
        <Form.Item
          name="envText"
          label="环境变量"
          extra="每行 KEY=value，不需要引号。替换时留空会清除全部变量。"
        >
          <Input.TextArea
            rows={4}
            disabled={!!app && !replacing}
            autoComplete="off"
            placeholder={'NODE_ENV=production\nPORT=3000'}
          />
        </Form.Item>
        <Collapse
          items={[
            {
              key: 'registry',
              label: app?.hasRegistry ? '私有仓库（已有凭据，留空保留）' : '私有仓库（可选）',
              children: (
                <>
                  <Form.Item name="registryUsername" label="仓库用户名">
                    <Input autoComplete="off" />
                  </Form.Item>
                  <Form.Item name="registryPassword" label="仓库密码 / 访问令牌">
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                  {app?.hasRegistry && (
                    <Form.Item name="clearRegistry" valuePropName="checked">
                      <Checkbox>清除已保存的仓库凭据</Checkbox>
                    </Form.Item>
                  )}
                </>
              ),
            },
          ]}
        />
      </Form>
    </Modal>
  )
}
