import { useEffect, useState } from 'react'
import axios from 'axios'
import { Alert, Button, Modal } from 'antd'
import { discardUpload, getUploadStatus, type UploadStatus } from '../api/uploads'
import { formatBytes, getErrorMessage } from '../lib/format'
import {
  forgetRecovery,
  readRecoveries,
  recoveryEvent,
  type UploadRecovery,
} from '../lib/uploadRecovery'

export type RecoveredUpload = { record: UploadRecovery; status: UploadStatus }

// UploadRecoveryBanner 提供项目页内的恢复入口，读取真实进度后才允许继续。
export default function UploadRecoveryBanner({
  userId,
  onResume,
}: {
  userId: string
  onResume: (upload: RecoveredUpload) => Promise<void>
}) {
  const [records, setRecords] = useState(() => readRecoveries(userId))
  const [statuses, setStatuses] = useState<Record<string, UploadStatus>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [discard, setDiscard] = useState<UploadRecovery | null>(null)
  const identities = records.map((record) => record.id).join(',')

  useEffect(() => {
    // refresh 元数据变化时更新本页；账号独立记录不与别的账号混用。
    const refresh = () => setRecords(readRecoveries(userId))
    window.addEventListener(recoveryEvent, refresh)
    window.addEventListener('storage', refresh)
    refresh()
    return () => {
      window.removeEventListener(recoveryEvent, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [userId])

  useEffect(() => {
    const controller = new AbortController()
    // inspect 初次打开查询进度，失效任务清除恢复线索并给出明确提示。
    const inspect = async (record: UploadRecovery) => {
      try {
        const status = await getUploadStatus(record, controller.signal)
        if (!controller.signal.aborted) setStatuses((items) => ({ ...items, [record.id]: status }))
      } catch (failure) {
        if (controller.signal.aborted) return
        if (axios.isAxiosError(failure) && failure.response?.status === 404) {
          forgetRecovery(record)
          setError('上次上传记录已过期或失效，请重新上传。')
        } else setError(getErrorMessage(failure, '暂时无法查询上传进度，点击继续上传可重试。'))
      }
    }
    for (const record of readRecoveries(userId)) void inspect(record)
    return () => controller.abort()
  }, [identities, userId])

  // resume 再查一次服务端状态，以处理多标签页完成、过期和中断后的变化。
  const resume = async (record: UploadRecovery) => {
    if (busy) return
    setBusy(record.id)
    setError('')
    try {
      await onResume({ record, status: await getUploadStatus(record) })
    } catch (failure) {
      setError(getErrorMessage(failure, '恢复上传失败，请重试。'))
    } finally {
      setBusy('')
    }
  }

  // discardTask 服务端确认清理成功后移除本地记录，失败时保留重试入口。
  const discardTask = async () => {
    if (!discard || busy) return
    setBusy(discard.id)
    setError('')
    try {
      await discardUpload(discard)
      setDiscard(null)
    } catch (failure) {
      setError(getErrorMessage(failure, '放弃上传失败，请重试。'))
    } finally {
      setBusy('')
    }
  }

  if (!records.length && !error) return null
  return (
    <section className="mb-5 space-y-3" aria-label="未完成上传">
      {records.map((record) => {
        const status = statuses[record.id]
        const finished = status && status.offset === status.size
        return (
          <article
            key={record.id}
            className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">
                {finished ? '上传已传完，结果待确认' : '有未完成的上传'}
              </h2>
              <p className="mt-1 text-sm break-all">
                {record.target.kind === 'create'
                  ? `新建：${record.target.name}`
                  : `更新：${record.target.slug}`}
              </p>
              <p className="mt-1 text-xs break-all text-muted">
                {record.fileName} · {formatBytes(record.size)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {status
                  ? `服务端已接收 ${Math.floor((status.offset * 100) / status.size)}% · 有效至 ${new Date(status.expiresAt).toLocaleString('zh-CN')}`
                  : '正在查询服务端进度…'}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="primary"
                className="h-11 sm:h-8"
                loading={busy === record.id && !discard}
                disabled={!!busy}
                onClick={() => void resume(record)}
              >
                {finished ? '确认上传结果' : '继续上次上传'}
              </Button>
              <Button
                className="h-11 sm:h-8"
                danger
                disabled={!!busy}
                onClick={() => setDiscard(record)}
              >
                放弃上传
              </Button>
            </div>
          </article>
        )
      })}
      {error && (
        <Alert type="warning" showIcon title={error} closable onClose={() => setError('')} />
      )}
      <Modal
        open={!!discard}
        centered
        title="放弃未完成的上传？"
        okText="确认放弃"
        cancelText="取消"
        confirmLoading={!!busy}
        okButtonProps={{ danger: true }}
        cancelButtonProps={{ disabled: !!busy }}
        closable={!busy}
        keyboard={!busy}
        mask={{ closable: !busy }}
        onCancel={() => setDiscard(null)}
        onOk={() => void discardTask()}
      >
        <p className="mb-3 break-all">{discard?.fileName}</p>
        <p className="text-sm text-muted">
          清除已接收的分片和本机恢复记录。之后需重新上传完整文件。
        </p>
      </Modal>
    </section>
  )
}
