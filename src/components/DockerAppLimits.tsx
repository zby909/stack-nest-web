import { useEffect, useState } from 'react'
import { Alert, Button, Form, InputNumber, Modal, Spin } from 'antd'
import { appLimits, updateAppLimits } from '../api/apps'
import { getErrorMessage } from '../lib/format'
import type { AppLimitsView } from '../types/app'

type Values = { maxApps: number; totalMemoryMiB: number }

// DockerAppLimits 只由超管打开，配置影响新任务的准入而不修改已有容器。
export default function DockerAppLimits({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [form] = Form.useForm<Values>()
  const [view, setView] = useState<AppLimitsView | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    // load 保留服务端版本，刷新配置后重新核对预留量。
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const value = await appLimits(controller.signal)
        if (!controller.signal.aborted) {
          setView(value)
          form.setFieldsValue(value)
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(getErrorMessage(failure, '资源配置加载失败'))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [form, refresh])

  // save 使用打开弹窗时的版本，冲突或配额变化时保留输入并提示重新加载。
  const save = async (values: Values) => {
    if (!view || saving) return
    setSaving(true)
    setError('')
    try {
      await updateAppLimits({ ...values, expectedRevision: view.revision })
      onSaved()
      onClose()
    } catch (failure) {
      setError(getErrorMessage(failure, '资源配置保存失败'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      title="Docker 资源配置"
      okText="保存配置"
      cancelText="取消"
      confirmLoading={saving}
      okButtonProps={{ disabled: loading || !view, 'aria-label': '保存配置' }}
      cancelButtonProps={{ disabled: saving }}
      closable={!saving}
      keyboard={!saving}
      mask={{ closable: !saving }}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <p className="mb-4 text-sm leading-relaxed text-muted">
        全实例共用这份预算。保存后新部署按新额度检查，已有容器的资源限制保持原值。
      </p>
      {error && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          title={error}
          action={
            <Button
              size="small"
              disabled={saving || loading}
              onClick={() => setRefresh((value) => value + 1)}
            >
              重新加载
            </Button>
          }
        />
      )}
      {loading && !view ? (
        <div className="grid min-h-40 place-items-center">
          <Spin />
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          disabled={saving || loading}
          onFinish={(values) => void save(values)}
        >
          {view && (
            <div className="mb-4 rounded-xl bg-subtle p-3 text-sm leading-relaxed">
              <p>
                已预留：{view.usedApps} 个应用，{view.allocatedMemoryMiB} MiB 内存。
              </p>
              <p className="mt-1 text-xs text-muted">
                停止的应用仍预留额度；永久删除或降低应用内存后才会释放。
              </p>
            </div>
          )}
          <Form.Item
            name="maxApps"
            label="应用总数上限"
            rules={[
              {
                required: true,
                type: 'integer',
                min: Math.max(1, view?.usedApps ?? 0),
                max: 100,
                message: `上限须在 ${Math.max(1, view?.usedApps ?? 0)}–100 之间`,
              },
            ]}
          >
            <InputNumber className="w-full" min={1} max={100} precision={0} />
          </Form.Item>
          <Form.Item
            name="totalMemoryMiB"
            label="应用内存总预算（MiB）"
            extra={`当前服务器允许的最高预算：${view?.maxTotalMemoryMiB ?? '—'} MiB；已为系统和平台预留空间。`}
            rules={[
              {
                required: true,
                type: 'integer',
                min: Math.max(64, view?.allocatedMemoryMiB ?? 0),
                max: view?.maxTotalMemoryMiB ?? 131072,
                message: '预算须不低于已预留内存，且不超过服务器允许的上限',
              },
            ]}
          >
            <InputNumber
              className="w-full"
              min={64}
              max={view?.maxTotalMemoryMiB ?? 131072}
              precision={0}
            />
          </Form.Item>
          <p className="text-xs leading-relaxed text-muted">
            单个应用仍限制为 64–512 MiB、0.1–1 核。应用正在执行操作时暂不能修改实例预算。
          </p>
        </Form>
      )}
    </Modal>
  )
}
