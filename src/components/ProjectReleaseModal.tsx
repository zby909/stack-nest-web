import { useEffect, useState } from 'react'
import { Alert, Input, Modal, Upload } from 'antd'
import { rollbackProject } from '../api/projects'
import { useResumableUpload } from '../lib/useResumableUpload'
import UploadProgress from './UploadProgress'
import type { RecoveredUpload } from './UploadRecoveryBanner'
import { getStorage } from '../api/operations'
import { formatBytes, getErrorMessage } from '../lib/format'
import type { Project } from '../types/project'

// ProjectReleaseModal 确认更新或回退，明确保留范围并锁定正在执行的发布操作。
export default function ProjectReleaseModal({
  project,
  userId,
  mode,
  recovery,
  maxUploadBytes,
  onClose,
  onComplete,
}: {
  project: Project
  userId: string
  mode: 'update' | 'rollback'
  recovery?: RecoveredUpload
  maxUploadBytes: number
  onClose: () => void
  onComplete: (project: Project) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const upload = useResumableUpload(userId)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState(recovery?.record.target.notes ?? '')
  const current = project.deployments?.[0]
  const previous = project.deployments?.[1]
  const revert = mode === 'rollback'
  const restore = upload.restore
  useEffect(() => {
    if (recovery) restore(recovery.record, recovery.status)
  }, [recovery, restore])

  // submit 先检查最新上传策略；回退只切换现有文件，不要求预留上传空间。
  const submit = async () => {
    if (busy || (revert && !current) || (!revert && !file && !upload.readyToComplete)) return
    if (new TextEncoder().encode(notes).length > 4096) {
      setError('更新说明不能超过 4096 字节')
      return
    }
    setBusy(true)
    setError('')
    try {
      let result: Project
      if (revert) {
        result = await rollbackProject(project.slug, current!.id)
      } else {
        if (!upload.readyToComplete) {
          const storage = await getStorage()
          if (!storage.uploadAllowed) throw new Error(storage.reason)
        }
        const uploaded = upload.readyToComplete
          ? await upload.complete()
          : await upload.start(file!, {
              kind: 'update',
              preview: true,
              notes,
              slug: project.slug,
              expectedId: recovery?.record.target.expectedId ?? current?.id ?? '',
            })
        if (!uploaded) return
        result = uploaded
      }
      onComplete(result)
    } catch (failure) {
      setError(getErrorMessage(failure, revert ? '回退失败' : '更新失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      centered
      title={
        <span className="block pr-7 break-all">
          {revert ? '回退' : '更新'}项目 “{project.name}”
        </span>
      }
      okText={
        revert
          ? '确认回退'
          : upload.readyToComplete
            ? '确认上传结果'
            : upload.hasSession
              ? '继续上传'
              : '上传待发布版'
      }
      cancelText="取消"
      onOk={() => void submit()}
      onCancel={onClose}
      confirmLoading={busy}
      okButtonProps={{
        disabled:
          upload.discarding ||
          (!upload.readyToComplete && !!project.draft) ||
          (revert ? !previous : !file && !upload.readyToComplete),
        className: 'h-11 sm:h-8',
      }}
      cancelButtonProps={{ disabled: busy || upload.discarding, className: 'h-11 sm:h-8' }}
      closable={!busy && !upload.discarding}
      keyboard={!busy && !upload.discarding}
      mask={{ closable: !busy && !upload.discarding }}
    >
      <p className="mb-4 text-sm text-muted">项目网址和归属保持不变。</p>
      <div className="mb-4 space-y-2 rounded-lg bg-subtle p-3 text-sm">
        <p className="break-all">当前版本：{current?.fileName ?? '尚未发布'}</p>
        {previous && (
          <p className="break-all text-muted">
            上一版：{previous.fileName} · {new Date(previous.createdAt).toLocaleString('zh-CN')}
          </p>
        )}
      </div>
      {revert ? (
        <Alert
          type="info"
          showIcon
          title="将恢复上面列出的上一版"
          description="当前版本会保留为新的上一版。如果回退后改变主意，可以再回退一次。"
        />
      ) : (
        <>
          <label className="mb-2 block text-sm" htmlFor="release-notes">
            更新说明（可选）
          </label>
          <Input.TextArea
            id="release-notes"
            className="mb-4"
            rows={3}
            value={notes}
            disabled={busy || upload.hasSession}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="这次更新了什么？"
            maxLength={4096}
          />
          <Upload.Dragger
            disabled={busy}
            accept=".zip,.rar"
            maxCount={1}
            beforeUpload={(next) => {
              if (!/\.(zip|rar)$/i.test(next.name)) {
                setError('请选择 ZIP 或 RAR 文件')
                return Upload.LIST_IGNORE
              }
              if (next.size > maxUploadBytes) {
                setError(`压缩包不能超过 ${formatBytes(maxUploadBytes)}`)
                return Upload.LIST_IGNORE
              }
              setError('')
              setFile(next)
              return false
            }}
            onRemove={() => setFile(null)}
          >
            <p className="text-base">选择或拖入新的 ZIP / RAR 文件</p>
            <p className="mt-2 text-sm text-muted">
              最大 {formatBytes(maxUploadBytes)}，须包含 index.html
            </p>
          </Upload.Dragger>
          <p className="mt-3 text-xs text-muted">
            上传后先生成独立预览，确认发布才会替换站点。保留当前正式版、上一正式版，另保留一个待发布版。
          </p>
        </>
      )}
      {!revert && <UploadProgress upload={upload} />}
      {error && <Alert className="mt-4" type="error" showIcon title={error} />}
    </Modal>
  )
}
