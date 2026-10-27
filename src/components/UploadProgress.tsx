import { Alert, Button, Progress } from 'antd'
import { formatBytes } from '../lib/format'
import type { useResumableUpload } from '../lib/useResumableUpload'

// UploadProgress 明确区分传输和发布，并提供保留分片的暂停与彻底放弃。
export default function UploadProgress({
  upload,
}: {
  upload: ReturnType<typeof useResumableUpload>
}) {
  const labels = {
    idle: '',
    hashing: '正在核对文件，查找可继续的上传…',
    uploading: '正在上传，已完成的分片会保留。',
    retrying: '连接暂时中断，正在查询进度并重试…',
    publishing: '文件已传完，正在校验和处理。',
    paused: upload.readyToComplete
      ? '文件已传完，点击确认上传结果可继续处理。'
      : '已暂停。点击继续上传可从已完成分片接着传。',
    error: '本次进度已保留，可用同一文件继续或放弃上传。',
    done: '上传处理完成。',
  }
  return (
    <div className="mt-4 space-y-3" aria-live="polite">
      {upload.recovery && (
        <Alert
          type="info"
          showIcon
          title={upload.readyToComplete ? '文件已传完，可直接确认处理结果' : '已恢复上次上传信息'}
          description={
            <span className="break-all">
              {upload.recovery.fileName} · {formatBytes(upload.recovery.size)}
              {!upload.readyToComplete &&
                '。请重新选择原文件，校验一致后继续；表单信息已自动恢复。'}
            </span>
          }
        />
      )}
      {upload.phase !== 'idle' && (
        <>
          <Progress
            percent={upload.percent}
            status={upload.phase === 'error' ? 'exception' : upload.busy ? 'active' : 'normal'}
          />
          <p className="text-xs text-muted">
            {upload.phase === 'error' && !upload.hasSession
              ? '尚未开始传输，请检查错误提示后重试。'
              : labels[upload.phase]}
          </p>
          {upload.phase === 'uploading' && upload.confirmedPercent !== undefined && (
            <p className="text-xs text-muted">
              服务器已确认 {upload.confirmedPercent}%；当前分片发送完毕后仍需等待服务器确认。
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {upload.busy && upload.phase !== 'publishing' && (
              <Button className="h-11 sm:h-8" disabled={false} onClick={upload.pause}>
                暂停上传
              </Button>
            )}
            {!upload.busy && upload.hasSession && (
              <Button
                className="h-11 sm:h-8"
                danger
                disabled={upload.discarding}
                loading={upload.discarding}
                onClick={() => void upload.discard()}
              >
                放弃本次上传
              </Button>
            )}
          </div>
        </>
      )}
      <p className="text-xs leading-relaxed text-muted">
        支持断点续传，未完成上传保留 24
        小时。刷新或重新打开页面后，可在项目页恢复信息并重新选择原文件继续。
      </p>
      {upload.error && <Alert type="error" showIcon title={upload.error} />}
    </div>
  )
}
