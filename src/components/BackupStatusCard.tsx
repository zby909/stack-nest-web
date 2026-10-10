import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Spin, Tag } from 'antd'
import { getBackupStatus } from '../api/operations'
import { formatBytes, getErrorMessage } from '../lib/format'
import type { BackupStatus } from '../types/operations'

const labels: Record<BackupStatus['state'], string> = {
  not_configured: '未配置',
  never: '尚无记录',
  running: '正在备份',
  succeeded: '最近备份成功',
  failed: '最近备份失败',
  interrupted: '备份可能中断',
}
const stages: Record<string, string> = {
  initialize: '初始化',
  stop: '暂停写入',
  'apps-freeze': '停止 Docker 应用写入',
  'apps-restore': '恢复 Docker 应用',
  database: '数据库备份',
  files: '站点文件备份',
  verify: '验证备份',
  publish: '保存完整备份',
  prune: '清理过期备份',
  restart: '恢复服务',
  completed: '完成',
}

// BackupStatusCard 独立读取备份摘要，失败时保留上次快照并明确标注。
export default function BackupStatusCard() {
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // refresh 与资源快照互不影响，页面离开后停止轮询。
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await getBackupStatus())
      setError('')
    } catch (failure) {
      setError(getErrorMessage(failure, '备份状态暂时无法读取'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const last = status?.lastSuccess
  const failed = status?.state === 'failed' || status?.state === 'interrupted'
  return (
    <section
      aria-label="备份状态"
      className="mt-5 rounded-panel border border-line bg-panel p-4 shadow-panel sm:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">备份状态</h2>
          <p className="mt-1 text-sm text-muted sm:text-xs">数据库和已部署文件的完整备份</p>
        </div>
        <Button className="h-11 shrink-0 sm:h-8" loading={loading} onClick={() => void refresh()}>
          刷新
        </Button>
      </div>
      {error && (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          title={error}
          description={status ? '下面显示上次读取结果，尚未确认当前状态。' : undefined}
        />
      )}
      {!status && loading && (
        <div className="py-6 text-center">
          <Spin />
        </div>
      )}
      {status && (
        <>
          <Tag color={failed ? 'error' : status.state === 'succeeded' ? 'success' : 'default'}>
            {labels[status.state]}
          </Tag>
          {failed && (
            <Alert
              className="mt-3"
              type="error"
              showIcon
              title="请检查服务器上的备份任务日志"
              description={`异常阶段：${stages[status.lastAttempt?.stage ?? ''] ?? '未知'}；已有的成功备份仍可保留。`}
            />
          )}
          {status.overdue && (
            <Alert
              className="mt-3"
              type="warning"
              showIcon
              title="超过 48 小时没有新的成功备份，请检查定时任务"
            />
          )}
          {(status.state === 'never' || status.state === 'not_configured') && (
            <p className="mt-3 text-sm text-muted">尚未读取到备份结果，请先配置并运行备份任务。</p>
          )}
          <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">最近成功时间</dt>
              <dd className="mt-1.5 font-medium">
                {last ? new Date(last.createdAt).toLocaleString('zh-CN') : '暂无成功备份'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">最近完整备份大小</dt>
              <dd className="mt-1.5 font-medium">{last ? formatBytes(last.totalBytes) : '—'}</dd>
              {last && (
                <p className="mt-1 text-xs text-dim">
                  数据库 {formatBytes(last.databaseBytes)} · 文件 {formatBytes(last.filesBytes)}
                </p>
              )}
            </div>
            <div>
              <dt className="text-xs text-muted">已保留完整备份</dt>
              <dd className="mt-1.5 font-medium">
                {status.retainedCount} 份 · {formatBytes(status.retainedBytes)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">最近尝试</dt>
              <dd className="mt-1.5 font-medium">
                {status.lastAttempt
                  ? new Date(status.lastAttempt.startedAt).toLocaleString('zh-CN')
                  : '暂无记录'}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-dim">
            备份保存在同一台服务器。若要防止服务器丢失导致数据丢失，还需将备份复制到其他位置。
          </p>
        </>
      )}
    </section>
  )
}
