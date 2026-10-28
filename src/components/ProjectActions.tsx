import { Button, Dropdown } from 'antd'
import { navigate } from '../lib/router'
import type { Project } from '../types/project'

// ProjectActions 保留常用入口，次要操作收在支持键盘和触屏的菜单中。
export default function ProjectActions({
  project,
  canUpload,
  onEdit,
  onExport,
  onFiles,
  onAccess,
  onRelease,
  onDelete,
}: {
  project: Project
  canUpload: boolean
  onEdit: () => void
  onExport: () => void
  onFiles: () => void
  onAccess: () => void
  onRelease: (mode: 'update' | 'rollback') => void
  onDelete: () => void
}) {
  return (
    <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 sm:flex sm:flex-wrap xl:col-span-1">
      <Button
        href={project.siteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="h-11 sm:h-8"
        size="small"
        disabled={project.status !== 'online'}
      >
        打开站点 ↗
      </Button>
      <Button
        className="h-11 sm:h-8"
        size="small"
        disabled={!canUpload}
        onClick={() => onRelease('update')}
      >
        {project.draft ? '更新草稿' : '更新'}
      </Button>
      <Dropdown
        trigger={['click']}
        menu={{
          items: [
            { key: 'details', label: '项目详情' },
            { key: 'edit', label: '编辑信息' },
            {
              key: 'files',
              label: '查看文件',
              disabled: !project.deployments?.[0] && !project.draft,
            },
            {
              key: 'export',
              label: '导出 ZIP',
              disabled: !project.deployments?.[0] && !project.draft,
            },
            {
              key: 'access',
              label: project.status === 'paused' ? '恢复访问' : '暂停访问',
              disabled: !project.deployments?.length,
            },
            {
              key: 'rollback',
              label: '回退上一版',
              disabled: !project.deployments?.[1] || !!project.draft,
            },
            { type: 'divider' },
            { key: 'delete', label: '删除项目', danger: true },
          ],
          onClick: ({ key }) => {
            if (key === 'details') navigate(`/projects/${project.slug}`)
            if (key === 'edit') onEdit()
            if (key === 'export') onExport()
            if (key === 'files') onFiles()
            if (key === 'access') onAccess()
            if (key === 'rollback') onRelease('rollback')
            if (key === 'delete') onDelete()
          },
        }}
        popupRender={(menu) => (
          <div className="[&_.ant-dropdown-menu-item]:min-h-11 sm:[&_.ant-dropdown-menu-item]:min-h-9">
            {menu}
          </div>
        )}
      >
        <Button className="h-11 sm:h-8" size="small" aria-label={`更多操作：${project.name}`}>
          更多 ▾
        </Button>
      </Dropdown>
    </div>
  )
}
