import { useCallback, useState } from 'react'
import { Alert, Button, Progress, Spin } from 'antd'
import { getSystem } from '../api/operations'
import { formatBytes, getErrorMessage } from '../lib/format'
import type { SystemStatus } from '../types/operations'
import BackupStatusCard from './BackupStatusCard'
import PlatformDiagnostics from './PlatformDiagnostics'
import PlatformVersion from './PlatformVersion'
import type { AuthUser } from '../types/auth'
import { usePolling } from '../lib/usePolling'

// formatUptime 将服务器运行秒数转换为易读的天、小时和分钟。
function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${days} 天 ${hours} 小时 ${minutes} 分钟`
}

// MetricCard 显示单个资源的占用比例和补充说明。
function MetricCard({
  title,
  percent,
  detail,
}: {
  title: string
  percent: number
  detail: string
}) {
  return (
    <article className="rounded-panel border border-line bg-panel p-4 shadow-panel transition-[transform,box-shadow] duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg sm:p-5">
      <span className="text-xs text-muted">{title}</span>
      <strong className="mt-2 block text-2xl font-bold tabular-nums">{percent.toFixed(1)}%</strong>
      <Progress percent={Number(percent.toFixed(1))} showInfo={false} className="mt-3" />
      <p className="mt-2 text-sm leading-relaxed text-muted sm:text-xs">{detail}</p>
    </article>
  )
}

// SystemOverview 仅在管理员页面轮询服务器资源快照。
export default function SystemOverview({ user }: { user: AuthUser }) {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  // readSystem 获取当前主机资源信息；失败时保留上次快照供参考。
  const readSystem = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    try {
      const next = await getSystem(signal)
      if (signal.aborted) return
      setStatus(next)
      setUpdatedAt(new Date())
      setError('')
    } catch (failure) {
      if (!signal.aborted) setError(getErrorMessage(failure, '服务器状态暂时无法读取'))
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [])

  const loadSystem = usePolling(readSystem, 30_000)

  return (
    <section aria-label="服务器状态">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-dim">
          {updatedAt ? `最近更新：${updatedAt.toLocaleTimeString('zh-CN')}` : '正在读取服务器状态'}
        </p>
        <Button className="h-11 sm:h-8" onClick={() => void loadSystem()} loading={loading}>
          刷新
        </Button>
      </div>
      {error && <Alert className="mb-4" type="warning" showIcon title={error} />}
      {!status && loading && (
        <div className="rounded-panel border border-line bg-panel p-8 text-center text-muted">
          <Spin /> 正在读取服务器状态…
        </div>
      )}
      {status && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard
              title="CPU 使用率"
              percent={status.cpuPercent}
              detail={`${status.cpuCores} 个逻辑核心 · 最近 200 毫秒平均值`}
            />
            <MetricCard
              title="内存使用率"
              percent={status.memoryUsedPercent}
              detail={`可用 ${formatBytes(status.memoryAvailableBytes)} / 总量 ${formatBytes(status.memoryTotalBytes)}`}
            />
            <MetricCard
              title="数据卷所在磁盘"
              percent={status.diskUsedPercent}
              detail={`可用 ${formatBytes(status.diskFreeBytes)} / 总量 ${formatBytes(status.diskTotalBytes)}`}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-panel border border-line bg-panel p-4 text-sm shadow-panel sm:p-5">
            <span className="text-muted">服务器运行时间</span>
            <strong className="font-semibold tabular-nums">
              {formatUptime(status.uptimeSeconds)}
            </strong>
          </div>
          <p className="mt-3 text-xs text-dim">
            CPU 与内存来自服务器主机；磁盘为项目数据卷所在文件系统。
          </p>
        </>
      )}
      <BackupStatusCard />
      <PlatformVersion />
      {user.role === 'superadmin' && <PlatformDiagnostics />}
    </section>
  )
}
