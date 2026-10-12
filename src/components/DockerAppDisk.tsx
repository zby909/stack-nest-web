import { Alert, Progress, Tooltip } from 'antd'
import { formatBytes } from '../lib/format'
import type { AppView, DiskArea } from '../types/app'

// DiskMeter 对未知值保持明确提示，同时展示块空间与文件数量的硬限制。
function DiskMeter({ name, area }: { name: string; area?: DiskArea }) {
  const percent =
    area?.usedBytes !== undefined && area.limitBytes
      ? Math.min(100, (area.usedBytes / area.limitBytes) * 100)
      : undefined
  const inodeWarning =
    area?.usedInodes !== undefined && area.limitInodes
      ? area.usedInodes >= area.limitInodes * 0.9
      : false
  return (
    <div className="min-w-0 rounded-lg border border-line p-3">
      <div className="flex flex-wrap justify-between gap-2 text-xs">
        <strong>{name}</strong>
        <span>
          {area?.usedBytes === undefined ? '用量暂不可用' : formatBytes(area.usedBytes)}
          {area?.limitBytes ? ` / ${formatBytes(area.limitBytes)}` : ''}
        </span>
      </div>
      {percent !== undefined && (
        <Progress
          percent={Math.round(percent)}
          size="small"
          status={percent >= 90 ? 'exception' : 'normal'}
        />
      )}
      {area?.source === 'docker-estimate' && (
        <p className="mt-2 text-xs text-muted">Docker 文件大小估计；未验证硬配额。</p>
      )}
      {area?.source === 'quota-disabled' && (
        <p className="mt-2 text-xs text-muted">未启用数据硬配额，暂不统计目录大小。</p>
      )}
      {area?.limitInodes !== undefined && (
        <p className={`mt-1 text-xs ${inodeWarning ? 'text-danger' : 'text-muted'}`}>
          文件 / 目录数 {area.usedInodes?.toLocaleString() ?? '未知'} /{' '}
          {area.limitInodes.toLocaleString()}
        </p>
      )}
      {((percent !== undefined && percent >= 90) || inodeWarning) && (
        <Alert className="mt-2" type="warning" title="接近配额上限，继续写入可能失败。" />
      )}
    </div>
  )
}

// DockerAppDisk 停止的容器也显示磁盘用量，首次后台采样完成前不显示虚假的零。
export default function DockerAppDisk({ view }: { view: AppView }) {
  const disk = view.runtime?.disk
  return (
    <div className="mb-4" aria-label="应用磁盘用量">
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
        <Tooltip title="XFS 按实际占用块计量；不包含镜像共享层、容器日志和临时内存盘。">
          <span tabIndex={0}>应用磁盘 ⓘ</span>
        </Tooltip>
        <span>
          {disk
            ? `采样 ${new Date(disk.sampledAt).toLocaleTimeString('zh-CN')} · 每分钟更新`
            : '等待磁盘采样'}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <DiskMeter name="容器可写层" area={disk?.writable} />
        {disk?.persistent ? (
          <DiskMeter name="持久化数据" area={disk.persistent} />
        ) : view.app.dataPath ? (
          <DiskMeter name="持久化数据" />
        ) : (
          <p className="self-center p-3 text-xs text-muted">未挂载持久化数据目录</p>
        )}
      </div>
    </div>
  )
}
