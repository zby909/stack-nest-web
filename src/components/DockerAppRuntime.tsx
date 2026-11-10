import { Progress, Tag, Tooltip } from 'antd'
import { formatBytes } from '../lib/format'
import type { AppView } from '../types/app'

// DockerAppRuntime 区分进程状态和服务可用性，展示当前采样而不把未知值当成零。
export default function DockerAppRuntime({ view }: { view: AppView }) {
  const { runtime } = view
  if (runtime?.state !== 'running') return null
  const usage = runtime.usage
  const memoryPercent =
    usage && usage.memoryLimitBytes > 0
      ? Math.min(100, Math.round((usage.memoryBytes / usage.memoryLimitBytes) * 1000) / 10)
      : undefined
  const http = runtime.healthCheck === 'http'
  const healthy = runtime.health === 'healthy'
  const unhealthy = runtime.health === 'unhealthy'
  const label = healthy
    ? http
      ? 'HTTP 正常'
      : '端口可连接'
    : unhealthy
      ? http
        ? 'HTTP 检查失败'
        : '端口无法连接'
      : '健康状态未知'

  return (
    <div className="mb-4 rounded-lg bg-subtle p-3 text-xs text-muted" aria-label="应用运行情况">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Tag color={healthy ? 'success' : unhealthy ? 'warning' : 'default'}>{label}</Tag>
        <span>{http ? 'HTTP 检查要求返回 2xx' : '端口连通不代表业务正常'}</span>
      </div>
      {usage ? (
        <>
          <div className="mb-3 rounded-lg border border-line bg-panel p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Tooltip title="当前运行容器的内存用量，已扣除非活跃文件缓存；上限为该容器实际生效的限制。">
                <span tabIndex={0} className="font-medium text-ink">
                  内存用量 ⓘ
                </span>
              </Tooltip>
              <span className="tabular-nums">
                {formatBytes(usage.memoryBytes)} /{' '}
                {usage.memoryLimitBytes > 0 ? formatBytes(usage.memoryLimitBytes) : '上限未知'}
              </span>
            </div>
            {memoryPercent !== undefined && (
              <Progress
                aria-label="内存使用率"
                aria-valuenow={memoryPercent}
                percent={memoryPercent}
                size="small"
                status={memoryPercent >= 90 ? 'exception' : 'normal'}
                format={() => `${memoryPercent}%`}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Tooltip title="100% 表示占用一个 CPU 核心；数值没有按应用配额归一化。">
              <span>
                CPU {usage.cpuPercent === undefined ? '—' : usage.cpuPercent.toFixed(1) + '%'}
              </span>
            </Tooltip>
            <Tooltip title="包括容器的进程和内核线程。">
              <span>进程 / 线程 {usage.pids}</span>
            </Tooltip>
            <span className="text-dim">页面可见时自动刷新</span>
          </div>
        </>
      ) : (
        <p className="text-dim">暂时无法获取用量，稍后自动重试。</p>
      )}
    </div>
  )
}
