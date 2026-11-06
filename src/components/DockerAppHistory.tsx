import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Modal, Spin, Tag } from 'antd'
import { appHistory } from '../api/appMaintenance'
import type { AppDeployment } from '../types/appMaintenance'
import { getErrorMessage } from '../lib/format'

const states = {
  pending: { label: '等待执行', color: 'default' },
  deploying: { label: '正在部署', color: 'processing' },
  succeeded: { label: '部署成功', color: 'success' },
  failed: { label: '部署失败', color: 'error' },
  canceled: { label: '已取消', color: 'default' },
}

// DockerAppHistory 按需展示有界历史，重新部署后仍可查看旧任务的结果。
export default function DockerAppHistory({
  id,
  name,
  onClose,
}: {
  id: string
  name: string
  onClose: () => void
}) {
  const [items, setItems] = useState<AppDeployment[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    // load 更新当前应用的记录，关闭弹窗后取消请求。
    const load = async () => {
      setLoading(true)
      try {
        const value = await appHistory(id, controller.signal)
        if (!controller.signal.aborted) {
          setItems(value)
          setError('')
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(getErrorMessage(failure, '部署记录加载失败'))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [id, refresh])
  return (
    <Modal
      open
      title={`${name} · 部署记录`}
      width={720}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">最近 10 次部署，从此功能启用后开始记录。</p>
        <Button loading={loading} onClick={() => setRefresh((value) => value + 1)}>
          刷新
        </Button>
      </div>
      {error && <Alert className="mb-3" type="error" showIcon title={error} />}
      {loading && !items && <Spin />}
      {items?.length === 0 && <Empty description="暂无部署记录" />}
      <ol className="space-y-3">
        {items?.map((item) => (
          <li key={item.generation} className="rounded-lg border border-line p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Tag color={states[item.status].color}>{states[item.status].label}</Tag>
              <span>第 {item.generation} 次任务</span>
              <span className="text-xs text-muted">
                {new Date(item.queuedAt).toLocaleString('zh-CN')}
              </span>
            </div>
            <p className="mt-2 break-all">{item.image}</p>
            {item.imageId && <p className="mt-1 text-xs break-all text-dim">{item.imageId}</p>}
            <p className="mt-2 text-xs break-words text-muted">
              {item.actorEmail} · {item.source === 'automation' ? '自动部署' : '管理后台'}
              {item.startedAt &&
                item.finishedAt &&
                ` · 耗时 ${Math.max(0, Math.round((Date.parse(item.finishedAt) - Date.parse(item.startedAt)) / 1000))} 秒`}
            </p>
            {item.message && (
              <p className="mt-2 break-words whitespace-pre-wrap text-muted">{item.message}</p>
            )}
          </li>
        ))}
      </ol>
    </Modal>
  )
}
