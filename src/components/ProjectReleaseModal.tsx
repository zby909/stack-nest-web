import { useState } from 'react'
import { Alert, Modal, Progress, Upload } from 'antd'
import { rollbackProject, updateProject } from '../api/projects'
import { getStorage } from '../api/operations'
import { formatBytes, getErrorMessage } from '../lib/format'
import type { Project } from '../types/project'

// ProjectReleaseModal 确认更新或回退，明确保留范围并锁定正在执行的发布操作。
export default function ProjectReleaseModal({
  project,
  mode,
  maxUploadBytes,
  onClose,
  onComplete,
}: {
  project: Project
  mode: 'update' | 'rollback'
  maxUploadBytes: number
  onClose: () => void
  onComplete: (project: Project) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const current = project.deployments?.[0]
  const previous = project.deployments?.[1]
  const revert = mode === 'rollback'

  // submit 先检查最新上传策略；回退只切换现有文件，不要求预留上传空间。
  const submit = async () => {
    if (busy || !current || (!revert && !file)) return
    setBusy(true)
    setError('')
    setProgress(0)
    try {
      let result: Project
      if (revert) {
        result = await rollbackProject(project.slug, current.id)
      } else {
        const storage = await getStorage()
        if (!storage.uploadAllowed) throw new Error(storage.reason)
        result = await updateProject(project.slug, current.id, file!, setProgress)
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
      title={`${revert ? '回退' : '更新'}项目 “${project.name}”`}
      okText={revert ? '确认回退' : '更新并部署'}
      cancelText="取消"
      onOk={() => void submit()}
      onCancel={onClose}
      confirmLoading={busy}
      okButtonProps={{ disabled: !current || (revert ? !previous : !file) }}
      cancelButtonProps={{ disabled: busy }}
      closable={!busy}
      keyboard={!busy}
      mask={{ closable: !busy }}
    >
      <p className="mb-4 text-sm text-muted">项目网址和归属保持不变。</p>
      <div className="mb-4 space-y-2 rounded-lg bg-subtle p-3 text-sm">
        <p className="break-all">当前版本：{current?.fileName ?? '未知'}</p>
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
            校验通过后替换站点，当前版保留用于回退。仅保留两版，更早的文件会被清理。
          </p>
        </>
      )}
      {busy && !revert && (
        <div className="mt-4" aria-live="polite">
          <Progress percent={progress} status="active" />
          <p className="text-xs text-muted">
            {progress >= 100 ? '文件已传输，正在校验和发布…' : '正在上传新版本…'}
          </p>
        </div>
      )}
      {error && <Alert className="mt-4" type="error" showIcon title={error} />}
    </Modal>
  )
}
