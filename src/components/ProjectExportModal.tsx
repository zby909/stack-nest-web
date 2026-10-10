import { useEffect, useRef, useState } from 'react'
import { Alert, Modal, Progress, Radio } from 'antd'
import { exportProject } from '../api/projects'
import { getErrorMessage } from '../lib/format'
import type { Project } from '../types/project'

// ProjectExportModal 选择仍保留的部署版本，并支持取消 ZIP 生成或下载。
export default function ProjectExportModal({
  project,
  onClose,
}: {
  project: Project
  onClose: () => void
}) {
  const versions = [
    ...(project.deployments?.slice(0, 2) ?? []),
    ...(project.draft ? [project.draft] : []),
  ]
  const [selected, setSelected] = useState(versions[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  // download 在获得完整 ZIP 后交给浏览器保存，失败时保留所选版本。
  const download = async () => {
    if (busy || !selected) return
    setBusy(true)
    setProgress(null)
    setError('')
    const active = new AbortController()
    controller.current = active
    try {
      const data = await exportProject(project.slug, selected, active.signal, setProgress)
      if (active.signal.aborted) return
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = `${project.slug}-${selected}.zip`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 15_000)
      onClose()
    } catch (failure) {
      if (!active.signal.aborted) setError(getErrorMessage(failure, '导出失败，请稍后重试'))
    } finally {
      controller.current = null
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      centered
      title={<span className="break-all">导出项目 “{project.name}”</span>}
      okText="下载 ZIP"
      cancelText={busy ? '取消下载' : '取消'}
      onOk={() => void download()}
      onCancel={() => {
        controller.current?.abort()
        onClose()
      }}
      confirmLoading={busy}
      okButtonProps={{ disabled: !selected, className: 'h-11 sm:h-8' }}
      cancelButtonProps={{ className: 'h-11 sm:h-8' }}
      mask={{ closable: !busy }}
    >
      <p className="mb-4 text-sm leading-relaxed text-muted">
        下载已部署的静态文件，可重新上传部署。RAR 上传也会导出为 ZIP。
      </p>
      <Radio.Group
        className="w-full"
        value={selected}
        disabled={busy}
        onChange={(event) => setSelected(event.target.value)}
      >
        <div className="flex flex-col gap-2">
          {versions.map((version, index) => (
            <Radio
              key={version.id}
              value={version.id}
              className="m-0! flex! min-h-16 w-full items-center rounded-lg border border-line p-3 [&_.ant-radio-label]:min-w-0"
            >
              <div className="min-w-0 text-sm">
                <strong>{index === 0 ? '当前版本' : '上一版'}</strong>
                <p className="mt-1 break-all">{version.fileName}</p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(version.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>
            </Radio>
          ))}
        </div>
      </Radio.Group>
      {versions.length < 2 && <p className="mt-3 text-xs text-dim">首次更新后可导出上一版。</p>}
      {busy && (
        <div className="mt-4">
          <p className="text-sm text-muted">
            {progress === null ? '正在生成 ZIP…' : '正在下载 ZIP…'}
          </p>
          {progress !== null && <Progress percent={progress} />}
        </div>
      )}
      {error && <Alert className="mt-4" type="error" showIcon title={error} />}
    </Modal>
  )
}
