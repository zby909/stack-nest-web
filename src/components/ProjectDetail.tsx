import { lazy, useEffect, useState } from 'react'
import { Alert, Button, Empty, Spin } from 'antd'
import { getProject } from '../api/projects'
import { getErrorMessage } from '../lib/format'
import type { ProjectTab } from '../lib/router'
import type { Project } from '../types/project'
import RouteLink from './RouteLink'
import LazyPanel from './LazyPanel'
import ProjectUsage from './ProjectUsage'
import ProjectVersions from './ProjectVersions'

const ActivityLog = lazy(() => import('./ActivityLog'))
const ProjectDeployTokens = lazy(() => import('./ProjectDeployTokens'))
const ProjectFilesPanel = lazy(() =>
  import('./ProjectFilesModal').then((module) => ({ default: module.ProjectFilesPanel })),
)

export type DetailAction = 'update' | 'rollback' | 'edit' | 'access' | 'delete' | 'export'
const tabs: { id: ProjectTab; label: string }[] = [
  { id: 'overview', label: '概览' },
  { id: 'versions', label: '版本' },
  { id: 'files', label: '文件' },
  { id: 'activity', label: '日志' },
  { id: 'settings', label: '设置' },
]

// ProjectDetail 独立读取项目，深链接可直接打开，切换标签不依赖列表或弹窗状态。
export default function ProjectDetail({
  slug,
  tab,
  canUpload,
  onAction,
  onChanged,
}: {
  slug: string
  tab: ProjectTab
  canUpload: boolean
  onAction: (project: Project, action: DetailAction) => void
  onChanged: (project: Project) => void
}) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ project?: Project; error?: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void getProject(slug, controller.signal)
      .then((project) => {
        if (!controller.signal.aborted) setResult({ project })
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setResult({ error: getErrorMessage(failure, '项目详情加载失败') })
      })
    return () => controller.abort()
  }, [slug, revision])
  const project = result?.project
  useEffect(() => {
    if (project)
      document.title = `${project.name} · ${tabs.find((item) => item.id === tab)?.label} · StackNest`
  }, [project, tab])
  // changed 在成功操作后立即展示新状态，并同步外层列表与空间统计。
  const changed = (updated: Project) => {
    setResult({ project: updated })
    onChanged(updated)
  }
  return (
    <div className="min-w-0">
      <RouteLink
        to="/projects"
        active={false}
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink"
      >
        ← 所有项目
      </RouteLink>
      {!result ? (
        <div className="grid min-h-60 place-items-center">
          <Spin />
        </div>
      ) : result.error ? (
        <Alert
          type="error"
          showIcon
          title={result.error}
          action={
            <Button
              onClick={() => {
                setResult(null)
                setRevision((value) => value + 1)
              }}
            >
              重试
            </Button>
          }
        />
      ) : project ? (
        <>
          <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="mb-2 text-xs text-muted">{project.slug}</p>
              <h1 className="text-2xl font-bold break-all sm:text-3xl">{project.name}</h1>
              <p className="mt-2 text-sm text-muted">
                {project.status === 'online'
                  ? '已发布'
                  : project.status === 'paused'
                    ? '已暂停'
                    : '尚未正式发布'}
                {project.draft ? ' · 有待发布版本' : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-11 sm:h-8"
                href={project.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                disabled={project.status !== 'online'}
              >
                打开正式站点 ↗
              </Button>
              <Button
                className="h-11 sm:h-8"
                type="primary"
                disabled={!canUpload || !!project.draft}
                onClick={() => onAction(project, 'update')}
              >
                上传新版本
              </Button>
            </div>
          </header>
          <nav
            aria-label="项目详情"
            className="mb-5 grid grid-cols-5 gap-1 rounded-xl border border-line bg-panel p-1"
          >
            {tabs.map((item) => (
              <RouteLink
                key={item.id}
                to={`/projects/${slug}/${item.id}`}
                active={tab === item.id}
                className={`flex min-h-11 min-w-0 items-center justify-center rounded-lg px-1 text-sm whitespace-nowrap transition-colors ${tab === item.id ? 'bg-nav-active font-semibold text-ink' : 'text-muted hover:bg-subtle'}`}
              >
                {item.label}
              </RouteLink>
            ))}
          </nav>
          <div key={tab} className="page-enter">
            {tab === 'overview' && (
              <section className="rounded-panel border border-line bg-panel p-5 shadow-panel">
                <h2 className="mb-4 text-base font-semibold">项目概览</h2>
                {project.draft && (
                  <Alert
                    className="mb-5"
                    type="info"
                    showIcon
                    title="待发布版本已就绪"
                    description={
                      <span>
                        先在独立地址验证页面，再前往{' '}
                        <RouteLink
                          to={`/projects/${slug}/versions`}
                          active={false}
                          className="underline"
                        >
                          版本
                        </RouteLink>{' '}
                        确认发布。
                      </span>
                    }
                  />
                )}
                <p className="mb-5 text-sm whitespace-pre-wrap text-muted">
                  {project.description || '暂未填写项目说明。'}
                </p>
                <dl className="grid gap-5 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="mb-1 text-muted">正式地址</dt>
                    <dd className="break-all">
                      {project.status === 'online' ? (
                        <a
                          href={project.siteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {project.siteUrl}
                        </a>
                      ) : (
                        project.siteUrl
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-muted">所有者</dt>
                    <dd className="break-all">{project.ownerEmail}</dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-muted">创建时间</dt>
                    <dd>{new Date(project.createdAt).toLocaleString('zh-CN')}</dd>
                  </div>
                  <div>
                    <dt className="mb-1 text-muted">最近更新</dt>
                    <dd>{new Date(project.updatedAt).toLocaleString('zh-CN')}</dd>
                  </div>
                </dl>
                <div className="mt-5 border-t border-line pt-4">
                  <ProjectUsage project={project} />
                </div>
              </section>
            )}
            {tab === 'versions' && (
              <ProjectVersions
                project={project}
                onChanged={changed}
                onRollback={() => onAction(project, 'rollback')}
              />
            )}
            {tab === 'files' && (
              <section className="rounded-panel border border-line bg-panel p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">项目文件</h2>
                  <Button
                    disabled={!project.draft && !project.deployments?.length}
                    onClick={() => onAction(project, 'export')}
                  >
                    导出 ZIP
                  </Button>
                </div>
                <LazyPanel>
                  <ProjectFilesPanel
                    key={`${project.draft?.id}-${project.deployments?.[0]?.id}`}
                    project={project}
                  />
                </LazyPanel>
              </section>
            )}
            {tab === 'activity' && (
              <LazyPanel>
                <ActivityLog key={slug} slug={slug} />
              </LazyPanel>
            )}
            {tab === 'settings' && (
              <section className="space-y-6 rounded-panel border border-line bg-panel p-5 shadow-panel">
                <h2 className="font-semibold">项目设置</h2>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">名称与说明</h3>
                    <p className="mt-1 text-xs text-muted">修改展示信息，项目地址保持不变。</p>
                  </div>
                  <Button onClick={() => onAction(project, 'edit')}>编辑信息</Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                  <div>
                    <h3 className="text-sm font-medium">访问状态</h3>
                    <p className="mt-1 text-xs text-muted">
                      暂停会同时关闭正式站点和所有版本预览。
                    </p>
                  </div>
                  <Button
                    disabled={!project.deployments?.length}
                    onClick={() => onAction(project, 'access')}
                  >
                    {project.status === 'paused' ? '恢复访问' : '暂停访问'}
                  </Button>
                </div>
                <LazyPanel>
                  <ProjectDeployTokens key={slug} slug={slug} />
                </LazyPanel>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                  <div>
                    <h3 className="text-sm font-medium">删除项目</h3>
                    <p className="mt-1 text-xs text-muted">永久删除项目与全部正式、待发布版本。</p>
                  </div>
                  <Button danger onClick={() => onAction(project, 'delete')}>
                    删除项目
                  </Button>
                </div>
              </section>
            )}
          </div>
        </>
      ) : (
        <Empty description="项目不存在" />
      )}
    </div>
  )
}
