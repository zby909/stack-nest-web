import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Empty, Spin, Tag, Typography } from 'antd'
import { listActivity } from '../api/operations'
import { formatBytes, getErrorMessage } from '../lib/format'
import type { ActivityEvent } from '../types/operations'

// ActivityLog 提供可复制请求编号的操作记录，删除项目后记录仍可查询。
export default function ActivityLog() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // refresh 手动重新获取最新结果，避免后台持续轮询日志。
  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setEvents(await listActivity())
    } catch (failure) {
      setError(getErrorMessage(failure, '操作日志加载失败'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <section className="rounded-panel border border-line bg-panel p-4.5 shadow-panel">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">操作日志</h2>
          <p className="mt-1 text-xs text-muted">
            最近 100 条上传、更新、回退与删除结果，可用请求编号排查失败原因。
          </p>
        </div>
        <Button onClick={() => void refresh()} loading={loading}>
          刷新
        </Button>
      </div>
      {error && <Alert className="mb-4" type="error" showIcon title={error} />}
      {loading ? (
        <div className="py-12 text-center">
          <Spin />
        </div>
      ) : !error && events.length === 0 ? (
        <Empty description="还没有操作记录" />
      ) : (
        <div className="divide-y divide-line">
          {events.map((event) => (
            <article key={event.id} className="py-4 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <Tag color={event.status === 'succeeded' ? 'success' : 'error'}>
                  {{ upload: '上传', update: '更新', rollback: '回退', delete: '删除' }[
                    event.action
                  ] ?? event.action}
                  {event.status === 'succeeded' ? '成功' : '失败'}
                </Tag>
                <strong className="text-sm break-all">
                  {event.slug || event.fileName || '未指定项目'}
                </strong>
                <time className="text-xs text-muted">
                  {new Date(event.createdAt).toLocaleString('zh-CN')}
                </time>
              </div>
              <p className="mt-2 text-sm break-all">{event.message}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span>操作人：{event.actor || '未知'}</span>
                <span>耗时：{(event.durationMs / 1000).toFixed(2)} 秒</span>
                {(event.action === 'upload' || event.action === 'update') && (
                  <>
                    <span>已接收：{formatBytes(event.archiveBytes)}</span>
                    {event.status === 'succeeded' && (
                      <span>
                        解压后：{formatBytes(event.expandedBytes)} · {event.fileCount} 个文件
                      </span>
                    )}
                  </>
                )}
              </div>
              {event.fileName && (
                <p className="mt-1 text-xs break-all text-muted">文件：{event.fileName}</p>
              )}
              <div className="mt-2 text-xs break-all text-dim">
                请求编号：
                <Typography.Text copyable={{ text: event.id }} className="text-xs! text-dim!">
                  {event.id}
                </Typography.Text>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
