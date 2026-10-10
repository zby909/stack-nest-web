import { Alert, Button, Progress, Spin } from 'antd'
import { formatBytes } from '../lib/format'
import type { StorageStatus } from '../types/operations'

// StorageCard 展示实际磁盘余量，并说明为何暂时无法上传。
export default function StorageCard({
  status,
  error,
  loading,
  refresh,
}: {
  status: StorageStatus | null
  error: string
  loading: boolean
  refresh: () => void
}) {
  return (
    <section
      className="mb-4 rounded-panel border border-line bg-panel p-4 shadow-panel sm:p-5"
      aria-label="存储空间"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">服务器存储</h2>
        <Button className="h-11 shrink-0 sm:h-8" onClick={refresh} loading={loading}>
          刷新
        </Button>
      </div>
      {error ? (
        <Alert className="mt-3" type="warning" showIcon title={error} />
      ) : status?.totalBytes !== undefined &&
        status.freeBytes !== undefined &&
        status.usedPercent !== undefined &&
        status.maxUsedPercent !== undefined ? (
        <>
          <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted">
            <span>
              可用 {formatBytes(status.freeBytes)} / 总容量 {formatBytes(status.totalBytes)}
            </span>
            <span>已使用 {status.usedPercent.toFixed(1)}%</span>
          </div>
          <Progress
            percent={Number(status.usedPercent.toFixed(1))}
            showInfo={false}
            status={status.uploadAllowed ? 'normal' : 'exception'}
          />
          <p className="mt-1 text-xs leading-relaxed text-muted">
            归档上限 {formatBytes(status.maxUploadBytes)}，解压上限{' '}
            {formatBytes(status.maxExpandedBytes)}，最多 {status.maxFiles} 个条目。 磁盘达到{' '}
            {status.maxUsedPercent}% 或无法预留处理空间时暂停上传。
          </p>
          {!status.uploadAllowed && (
            <Alert className="mt-3" type="warning" showIcon title={status.reason} />
          )}
        </>
      ) : (
        <div className="mt-3">
          <Spin size="small" /> <span className="text-xs text-muted">正在检查空间…</span>
        </div>
      )}
    </section>
  )
}
