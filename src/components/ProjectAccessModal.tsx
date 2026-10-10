import { useState } from 'react'
import { Alert, Modal } from 'antd'
import { setProjectAccess } from '../api/projects'
import { getErrorMessage } from '../lib/format'
import type { Project } from '../types/project'

// ProjectAccessModal 在暂停或恢复访问前说明影响，失败时保留可重试的弹窗。
export default function ProjectAccessModal({
  project,
  onClose,
  onComplete,
}: {
  project: Project
  onClose: () => void
  onComplete: (value: Project) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pause = project.status !== 'paused'

  // submit 由服务端检查归属和过期页面，操作不删除文件或部署记录。
  const submit = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      onComplete(await setProjectAccess(project, pause))
    } catch (failure) {
      setError(getErrorMessage(failure, '访问状态修改失败，请刷新项目后重试'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      centered
      title={pause ? '暂停站点访问？' : '恢复站点访问？'}
      okText={pause ? '暂停访问' : '恢复访问'}
      cancelText="取消"
      confirmLoading={busy}
      onOk={() => void submit()}
      onCancel={onClose}
      closable={!busy}
      keyboard={!busy}
      mask={{ closable: !busy }}
      okButtonProps={{ className: 'h-11 sm:h-8' }}
      cancelButtonProps={{ disabled: busy, className: 'h-11 sm:h-8' }}
    >
      <p className="mb-3 font-semibold break-all">{project.name}</p>
      <p className="mb-3 text-sm leading-relaxed">
        {pause
          ? '暂停后，站点页面和资源将无法继续从服务器访问。文件、地址和版本保留，仍可更新、回退和导出；这些操作不会自动恢复访问。'
          : '恢复后，访客可通过原地址访问当前版本。'}
      </p>
      {pause && (
        <p className="mb-3 text-xs text-muted">已经下载或被浏览器、CDN 缓存的内容无法撤回。</p>
      )}
      {error && <Alert type="error" showIcon title={error} />}
    </Modal>
  )
}
