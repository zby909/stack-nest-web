import { useEffect, useState } from 'react'
import { Alert, Button, Modal, Spin } from 'antd'
import { appLogs } from '../api/apps'
import { getErrorMessage } from '../lib/format'
import type { AppView } from '../types/app'

// DockerAppLogs 按需读取有界日志，关闭时取消请求，避免后台持续轮询。
export default function DockerAppLogs({
  target,
  onClose,
}: {
  target: AppView
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    // loadLog 忽略过期请求，日志以 React 文本节点安全呈现。
    const loadLog = async () => {
      setLoading(true)
      try {
        const next = await appLogs(target.app.id, controller.signal)
        if (!controller.signal.aborted) {
          setText(next)
          setError('')
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(getErrorMessage(failure, '日志加载失败'))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void loadLog()
    return () => controller.abort()
  }, [target.app.id, refresh])
  return (
    <Modal
      open
      title={`运行日志 · ${target.app.name}`}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      width={800}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs text-muted">
          最近 200 行，最多 256 KiB。配置中的敏感值会被隐藏。
        </span>
        <Button loading={loading} onClick={() => setRefresh((value) => value + 1)}>
          刷新日志
        </Button>
      </div>
      {error && <Alert type="error" showIcon title={error} className="mb-3" />}
      {loading && !text ? (
        <Spin />
      ) : (
        <pre className="max-h-[60dvh] overflow-auto rounded-lg border border-line bg-sidebar p-4 text-xs whitespace-pre-wrap">
          {text || '暂无日志'}
        </pre>
      )}
    </Modal>
  )
}
