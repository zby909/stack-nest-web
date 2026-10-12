import { Tag } from 'antd'
import { formatBytes } from '../lib/format'
import type { AppView } from '../types/app'

const stages: Record<string, string> = {
  queued: '任务已排队',
  preparing: '检查部署条件',
  pulling: '拉取镜像',
  verifying: '校验镜像',
  creating: '创建容器',
  stopping: '停止旧容器',
  starting: '启动容器',
  healthchecking: '等待健康检查',
  cleaning: '清理旧容器',
  restoring: '恢复旧容器',
  deleting: '删除容器及数据',
  completed: '操作已完成，正在保存结果',
  failed: '操作失败',
}

// DockerAppProgress 展示实际任务阶段；镜像层总量未知时不伪造百分比。
export default function DockerAppProgress({ view }: { view: AppView }) {
  const { app, progress } = view
  const pending = app.status === 'pending' || app.status === 'deploying'
  const current = progress?.generation === app.generation ? progress : undefined
  if (!pending && !(app.status === 'error' && current?.failedStage)) return null
  const label = current
    ? (stages[current.stage] ?? '正在执行')
    : app.status === 'pending'
      ? '等待运行器执行'
      : '正在执行，等待阶段反馈'
  return (
    <div
      className="mb-3 rounded-lg border border-line bg-subtle p-3 text-sm"
      aria-label="操作进度"
      role="status"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Tag color={pending ? 'processing' : 'error'}>{label}</Tag>
        {current?.failedStage && (
          <span className="text-xs text-muted">
            失败阶段：{stages[current.failedStage] ?? '执行操作'}
          </span>
        )}
      </div>
      {current?.stage === 'pulling' && (
        <p className="mt-2 text-xs text-muted">
          {current.totalBytes
            ? `镜像层下载：${formatBytes(current.downloadedBytes ?? 0)} / 当前已知 ${formatBytes(current.totalBytes)}`
            : '正在获取镜像信息或使用本地缓存；下载总量暂未提供。'}
        </p>
      )}
      {pending && (
        <p className="mt-2 text-xs text-muted">
          任务在服务器执行，关闭页面后继续。镜像下载量不代表整个部署的完成比例。
        </p>
      )}
    </div>
  )
}
