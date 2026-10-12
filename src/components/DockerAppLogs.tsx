import { Button, Modal } from 'antd'
import type { AppView } from '../types/app'
import DockerAppLogPanel from './DockerAppLogPanel'
import RouteLink from './RouteLink'

// DockerAppLogs 复用日志面板，关闭弹窗时停止请求。
export default function DockerAppLogs({
  target,
  onClose,
}: {
  target: AppView
  onClose: () => void
}) {
  return (
    <Modal
      open
      title={`运行日志 · ${target.app.name}`}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      width={800}
    >
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
      <DockerAppLogPanel key={target.app.id} id={target.app.id} />
    </Modal>
  )
}
