import { Button, Modal } from 'antd'
import type { AppView } from '../types/app'
import DockerAppLogPanel from './DockerAppLogPanel'
import RouteLink from './RouteLink'

// DockerAppLogs 复用日志面板，关闭弹窗时停止请求。
export default function DockerAppLogs({
  target,
  kind = 'runtime',
  onClose,
}: {
  target: AppView
  kind?: 'runtime' | 'deployment'
  onClose: () => void
}) {
  return (
    <Modal
      open
      title={`${kind === 'deployment' ? '失败详情' : '运行日志'} · ${target.app.name}`}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      width={800}
    >
      {kind === 'runtime' && (
        <div className="mb-3">
          <RouteLink
            to={`/apps/${target.app.id}/logs`}
            active={false}
            onNavigate={onClose}
            className="text-sm underline"
          >
            在详情页查看日志
          </RouteLink>
        </div>
      )}
      <DockerAppLogPanel
        key={`${target.app.id}-${kind}-${target.app.generation}`}
        id={target.app.id}
        kind={kind}
        generation={target.app.generation}
      />
    </Modal>
  )
}
