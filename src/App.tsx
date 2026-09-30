import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Form, Input, Modal, Progress, Spin, Upload } from 'antd'
import { createProject, deleteProject, listProjects } from './api/projects'
import StatCard from './components/StatCard'
import ActivityLog from './components/ActivityLog'
import StorageCard from './components/StorageCard'
import SystemOverview from './components/SystemOverview'
import RouteLink from './components/RouteLink'
import ProjectReleaseModal from './components/ProjectReleaseModal'
import { getStorage } from './api/operations'
import { formatBytes, getErrorMessage } from './lib/format'
import { navigate, type Page } from './lib/router'
import type { StorageStatus } from './types/operations'
import UserManagement from './components/UserManagement'
import type { AuthUser } from './types/auth'
import type { CreateProjectForm, Project } from './types/project'

// App 提供静态项目的上传、查询和删除入口。
function App({
  user,
  page,
  onLogout,
  loggingOut,
}: {
  user: AuthUser
  page: Page
  onLogout: () => void
  loggingOut: boolean
}) {
  const [form] = Form.useForm<CreateProjectForm>()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [createError, setCreateError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [query, setQuery] = useState('')
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [releaseTarget, setReleaseTarget] = useState<{
    project: Project
    mode: 'update' | 'rollback'
  } | null>(null)

  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null)
  const [storageError, setStorageError] = useState('')
  const [storageLoading, setStorageLoading] = useState(true)
  const [uploadProgress, setUploadProgress] = useState(0)
  const maxUploadBytes = storageStatus?.maxUploadBytes ?? 90 * 1024 * 1024
  const canUpload = storageStatus?.uploadAllowed === true && !storageError

  useEffect(() => {
    const titles: Record<Page, string> = {
      projects: '项目',
      activity: '操作日志',
      users: '用户邮箱',
      system: '服务器状态',
    }
    document.title = `${titles[page]} · StackNest`
  }, [page])

  // loadStorage 按服务端实际磁盘状态同步上传入口。
  const loadStorage = useCallback(async () => {
    setStorageLoading(true)
    try {
      setStorageStatus(await getStorage())
      setStorageError('')
    } catch (failure) {
      setStorageStatus(null)
      setStorageError(getErrorMessage(failure, '暂时无法连接服务，已暂停上传和更新，请重新检查'))
    } finally {
      setStorageLoading(false)
    }
  }, [])

  useEffect(() => {
    if (page !== 'projects') return
    void loadStorage()
    const timer = window.setInterval(() => void loadStorage(), 30_000)
    return () => window.clearInterval(timer)
  }, [page, loadStorage])

  // 从后端读取项目列表，并同步页面加载状态。
  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setProjects(await listProjects())
    } catch (requestError) {
      setError(getErrorMessage(requestError, '项目列表加载失败'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (page === 'projects') void loadProjects()
  }, [page, loadProjects])

  const filteredProjects = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return projects
    return projects.filter((item) =>
      [
        item.name,
        item.slug,
        item.description ?? '',
        ...(user.role === 'admin' ? [item.ownerEmail] : []),
      ].some((value) => value.toLowerCase().includes(keyword)),
    )
  }, [projects, query, user.role])

  // 关闭创建弹窗并清空尚未提交的表单与文件状态。
  const closeCreateModal = () => {
    setShowCreate(false)
    setSelectedFile(null)
    setUploadProgress(0)
    setCreateError('')
    form.resetFields()
  }

  // 提交项目基本信息和压缩包，完成一次静态项目部署。
  const handleSubmit = async (values: CreateProjectForm) => {
    if (submitting) return
    if (!selectedFile) {
      setCreateError('请选择 ZIP 或 RAR 文件')
      return
    }
    if (selectedFile.size > maxUploadBytes) {
      setCreateError(`压缩包不能超过 ${formatBytes(maxUploadBytes)}`)
      return
    }

    setSubmitting(true)
    setCreateError('')
    try {
      const latestStorage = await getStorage()
      setStorageStatus(latestStorage)
      if (!latestStorage.uploadAllowed) throw new Error(latestStorage.reason)
      setUploadProgress(0)
      await createProject(values, selectedFile, setUploadProgress)
      closeCreateModal()
      await loadProjects()
    } catch (requestError) {
      setCreateError(getErrorMessage(requestError, '部署失败'))
    } finally {
      setSubmitting(false)
      void loadStorage()
    }
  }

  // 删除项目以及后端保存的静态发布文件。
  const removeProject = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteProject(deleteTarget.slug)
      setDeleteTarget(null)
      await loadProjects()
    } catch (requestError) {
      setDeleteError(getErrorMessage(requestError, '删除失败'))
    } finally {
      setDeleting(false)
      void loadStorage()
    }
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 desktop:grid-cols-[14.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-sidebar px-4 py-5.5 desktop:flex">
        <div className="flex items-center gap-3 px-1.5 pt-1 pb-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink font-bold text-white">
            S
          </div>
          <div>
            <strong className="block text-base font-bold">StackNest</strong>
            <span className="mt-0.5 block text-caption text-dim">静态项目控制中心</span>
          </div>
        </div>
        <nav className="grid gap-1" aria-label="页面导航">
          <RouteLink
            to="/projects"
            active={page === 'projects'}
            className={`rounded-lg p-2.5 text-left text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${page === 'projects' ? 'bg-nav-active font-semibold text-ink' : 'text-muted hover:bg-nav-active hover:text-ink'}`}
          >
            项目
          </RouteLink>
          <RouteLink
            to="/activity"
            active={page === 'activity'}
            className={`rounded-lg p-2.5 text-left text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${page === 'activity' ? 'bg-nav-active font-semibold text-ink' : 'text-muted hover:bg-nav-active hover:text-ink'}`}
          >
            操作日志
          </RouteLink>
          {user.role === 'admin' && (
            <RouteLink
              to="/users"
              active={page === 'users'}
              className={`rounded-lg p-2.5 text-left text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${page === 'users' ? 'bg-nav-active font-semibold text-ink' : 'text-muted hover:bg-nav-active hover:text-ink'}`}
            >
              用户邮箱
            </RouteLink>
          )}
          {user.role === 'admin' && (
            <RouteLink
              to="/system"
              active={page === 'system'}
              className={`rounded-lg p-2.5 text-left text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${page === 'system' ? 'bg-nav-active font-semibold text-ink' : 'text-muted hover:bg-nav-active hover:text-ink'}`}
            >
              服务器状态
            </RouteLink>
          )}
        </nav>
        <div className="mt-auto rounded-xl border border-line bg-panel p-3">
          <strong className="block truncate text-xs" title={user.email}>
            {user.email}
          </strong>
          <p className="mt-1 text-micro text-dim">
            {user.role === 'admin' ? '管理员' : '普通用户'}
          </p>
          <Button
            className="mt-3"
            size="small"
            onClick={() => setShowLogoutConfirm(true)}
            loading={loggingOut}
          >
            退出登录
          </Button>
        </div>
      </aside>

      <main className="m-auto w-full max-w-[93.75rem] min-w-0 p-4.5 desktop:p-8">
        <div key={page} className="page-enter">
          <header
            className="mb-5.5 flex flex-col items-start justify-between gap-5 desktop:flex-row desktop:items-end"
            id="overview"
          >
            <div>
              <span className="text-xs text-dim">StackNest · Static MVP</span>
              <h1 className="mt-1.25 mb-1 text-[1.75rem] leading-tight font-bold tracking-tight">
                {page === 'projects'
                  ? '你的静态项目，都放在这里。'
                  : page === 'users'
                    ? '管理登录邮箱'
                    : page === 'activity'
                      ? '每次操作，都有记录。'
                      : '服务器运行状态'}
              </h1>
              <p className="text-xs text-muted">
                {page === 'projects'
                  ? '上传 ZIP 或 RAR，StackNest 会校验并发布站点。'
                  : page === 'users'
                    ? '只有名单中的邮箱可以接收登录验证码。'
                    : page === 'activity'
                      ? '查看发布结果、失败原因和存储用量。'
                      : '查看 CPU、内存和数据卷空间，数据每 30 秒更新。'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate(page === 'activity' ? '/projects' : '/activity')}>
                {page === 'activity' ? '返回项目' : '操作日志'}
              </Button>
              {user.role === 'admin' && (
                <Button onClick={() => navigate(page === 'users' ? '/projects' : '/users')}>
                  {page === 'users' ? '返回项目' : '用户邮箱'}
                </Button>
              )}
              {user.role === 'admin' && (
                <Button onClick={() => navigate(page === 'system' ? '/projects' : '/system')}>
                  {page === 'system' ? '返回项目' : '服务器状态'}
                </Button>
              )}
              {page === 'projects' && (
                <Button type="primary" disabled={!canUpload} onClick={() => setShowCreate(true)}>
                  ＋ 部署静态项目
                </Button>
              )}
              <Button
                className="desktop:hidden"
                onClick={() => setShowLogoutConfirm(true)}
                loading={loggingOut}
              >
                退出登录
              </Button>
            </div>
          </header>

          {page === 'users' ? (
            <UserManagement />
          ) : page === 'activity' ? (
            <ActivityLog />
          ) : page === 'system' ? (
            <SystemOverview />
          ) : (
            <>
              {error && (
                <Alert
                  className="mb-4"
                  type="error"
                  showIcon
                  title={error}
                  action={
                    <Button size="small" onClick={() => void loadProjects()}>
                      重试
                    </Button>
                  }
                />
              )}

              <section
                className="mb-4 grid grid-cols-1 gap-3.5 desktop:grid-cols-3"
                aria-label="项目概览"
              >
                <StatCard label="项目总数" value={projects.length} description="已登记静态项目" />
                <StatCard
                  label="已发布项目"
                  value={projects.filter((project) => project.status === 'online').length}
                  description="已成功发布到服务器"
                />
                <StatCard
                  label="部署方式"
                  value="ZIP / RAR"
                  description={`单包最大 ${formatBytes(maxUploadBytes)}`}
                />
              </section>

              {user.role === 'admin' ? (
                <StorageCard
                  status={storageStatus}
                  error={storageError}
                  loading={storageLoading}
                  refresh={() => void loadStorage()}
                />
              ) : !canUpload ? (
                <Alert
                  className="mb-4"
                  type={storageError || storageStatus?.uploadAllowed === false ? 'warning' : 'info'}
                  showIcon
                  title={
                    storageError || storageStatus?.uploadAllowed === false
                      ? '上传和更新已暂停'
                      : '正在检查上传条件'
                  }
                  description={
                    storageError || storageStatus?.reason || '检查完成后即可上传或更新项目。'
                  }
                  action={
                    <Button
                      size="small"
                      loading={storageLoading}
                      onClick={() => void loadStorage()}
                    >
                      重新检查
                    </Button>
                  }
                />
              ) : null}
              <section
                className="rounded-panel border border-line bg-panel p-4.5 shadow-panel"
                id="projects"
              >
                <div className="flex flex-col items-start justify-between gap-5 desktop:flex-row desktop:items-center">
                  <div>
                    <h2 className="text-base font-bold">项目</h2>
                    <p className="text-xs text-muted">
                      {user.role === 'admin'
                        ? '查看和管理所有用户的项目。'
                        : '搜索、打开或删除自己的项目。'}
                    </p>
                  </div>
                  <Input
                    className="w-full desktop:w-60"
                    size="large"
                    allowClear
                    aria-label="搜索项目"
                    placeholder="搜索项目..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>

                {loading ? (
                  <div className="flex min-h-65 flex-col items-center justify-center gap-2 text-dim">
                    <Spin />
                    <span className="text-xs">正在加载项目...</span>
                  </div>
                ) : error && projects.length === 0 ? null : filteredProjects.length === 0 ? (
                  <div className="flex min-h-65 flex-col items-center justify-center gap-2 text-dim">
                    <strong className="text-sm font-bold text-ink">
                      {query.trim() ? '没有匹配的项目' : '还没有静态项目'}
                    </strong>
                    <span className="text-xs">
                      {query.trim()
                        ? '换一个关键词试试。'
                        : '上传一个包含 index.html 的 ZIP 或 RAR 开始部署。'}
                    </span>
                    {!query.trim() && (
                      <Button disabled={!canUpload} onClick={() => setShowCreate(true)}>
                        创建第一个项目
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
                    {filteredProjects.map((project) => {
                      const latest = project.deployments?.[0]
                      return (
                        <article
                          className="grid grid-cols-1 items-center gap-3.5 p-3.5 transition-colors duration-200 hover:bg-panel-hover desktop:grid-cols-[minmax(0,1.8fr)_0.6fr_minmax(0,1.1fr)_auto]"
                          key={project.id}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div
                              className="grid size-8.5 shrink-0 place-items-center rounded-lg border border-line bg-canvas text-caption font-bold"
                              aria-hidden="true"
                            >
                              &lt;/&gt;
                            </div>
                            <div className="min-w-0">
                              <div
                                className="truncate text-[0.8125rem] font-semibold"
                                title={project.name}
                              >
                                {project.name}
                              </div>
                              <div className="mt-0.75 truncate text-caption text-dim">
                                {project.slug}
                                {project.description ? ` · ${project.description}` : ''}
                              </div>
                              {user.role === 'admin' && (
                                <div
                                  className="mt-0.75 truncate text-caption text-dim"
                                  title={project.ownerEmail}
                                >
                                  所属：{project.ownerEmail}
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-1.25 text-caption font-semibold whitespace-nowrap text-success">
                              <i className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                              已发布
                            </span>
                          </div>
                          <div className="min-w-0">
                            <strong
                              className="block truncate text-caption font-semibold"
                              title={latest?.fileName}
                            >
                              {latest?.fileName ?? 'Static'}
                            </strong>
                            <span className="mt-1 block text-micro text-dim">
                              {new Date(project.updatedAt).toLocaleString('zh-CN')}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.75">
                            <Button
                              href={project.siteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              size="small"
                            >
                              打开站点 ↗
                            </Button>
                            <Button
                              size="small"
                              disabled={!latest || !canUpload}
                              onClick={() => setReleaseTarget({ project, mode: 'update' })}
                            >
                              更新
                            </Button>
                            <Button
                              size="small"
                              disabled={!project.deployments?.[1]}
                              title={project.deployments?.[1] ? '回退到上一版' : '首次更新后可回退'}
                              onClick={() => setReleaseTarget({ project, mode: 'rollback' })}
                            >
                              回退
                            </Button>
                            <Button
                              danger
                              size="small"
                              onClick={() => {
                                setDeleteError('')
                                setDeleteTarget(project)
                              }}
                            >
                              删除
                            </Button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <Modal
        open={showLogoutConfirm}
        title="退出登录？"
        okText="退出登录"
        cancelText="取消"
        confirmLoading={loggingOut}
        closable={!loggingOut}
        keyboard={!loggingOut}
        mask={{ closable: !loggingOut }}
        onOk={onLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      >
        <p>退出后需要重新获取邮箱验证码才能进入管理页面。</p>
      </Modal>
      <Modal
        open={showCreate}
        title="部署静态项目"
        footer={null}
        destroyOnHidden
        closable={!submitting}
        keyboard={!submitting}
        mask={{ closable: !submitting }}
        onCancel={closeCreateModal}
      >
        <p className="-mt-1 mb-4.5 text-xs text-muted">
          压缩包根目录或唯一一级目录中需要包含 index.html。单包不超过 {formatBytes(maxUploadBytes)}
          ，解压不超过 200 MiB。
        </p>
        {createError && <Alert className="mb-4" type="error" showIcon title={createError} />}
        <Form<CreateProjectForm>
          form={form}
          disabled={submitting}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => void handleSubmit(values)}
        >
          <div className="grid grid-cols-1 gap-x-3.5 sm:grid-cols-2">
            <Form.Item
              label="项目名称"
              name="name"
              rules={[{ required: true, whitespace: true, message: '请输入项目名称' }]}
            >
              <Input placeholder="例如：landing-page" />
            </Form.Item>
            <Form.Item
              label="Slug（可选）"
              name="slug"
              extra="留空自动生成；纯中文等名称会使用随机标识。"
              rules={[
                {
                  pattern: /^[a-z0-9](?:[a-z0-9-]{0,50}[a-z0-9])?$/,
                  message: 'Slug 只能包含小写字母、数字和连字符，且不能以连字符开头或结尾',
                },
                {
                  max: 52,
                  message: 'Slug 不能超过 52 个字符',
                },
              ]}
            >
              <Input maxLength={52} placeholder="例如：demo，对应 stack-nest-demo 子域名" />
            </Form.Item>
            <Form.Item className="col-span-full" label="项目说明（可选）" name="description">
              <Input placeholder="活动页、Demo、文档站..." />
            </Form.Item>
            <Form.Item className="col-span-full" label="静态项目压缩包" required>
              <Upload.Dragger
                disabled={submitting}
                accept=".zip,.rar"
                maxCount={1}
                beforeUpload={(file) => {
                  if (!/\.(zip|rar)$/i.test(file.name)) {
                    setCreateError('请选择 ZIP 或 RAR 文件')
                    return Upload.LIST_IGNORE
                  }
                  if (file.size > maxUploadBytes) {
                    setCreateError(`压缩包不能超过 ${formatBytes(maxUploadBytes)}`)
                    return Upload.LIST_IGNORE
                  }
                  setCreateError('')
                  setSelectedFile(file)
                  return false
                }}
                onRemove={() => setSelectedFile(null)}
              >
                <p className="mx-auto mb-2 inline-grid h-7.5 w-16 place-items-center rounded-lg border border-line-strong bg-panel text-caption font-bold text-muted">
                  ZIP / RAR
                </p>
                <p className="text-base">选择或拖入 ZIP / RAR 文件</p>
                <p className="mt-1 text-sm text-muted">
                  支持普通 HTML 或 Vite / React 构建后的 dist 压缩包
                </p>
              </Upload.Dragger>
            </Form.Item>
          </div>
          <div className="rounded-lg bg-subtle px-3 py-2.5 text-caption text-dim">
            压缩包会进行路径、链接、文件数量和解压大小检查；RAR 仅支持未加密单卷文件。
          </div>
          {submitting && (
            <div className="mt-4" aria-live="polite">
              <Progress percent={uploadProgress} status="active" />
              <p className="text-xs text-muted">
                {uploadProgress >= 100 ? '文件已传输，正在校验、解压和发布…' : '正在上传文件…'}
              </p>
            </div>
          )}
          {!canUpload && !submitting && (
            <Alert
              className="mt-4"
              type="warning"
              title={storageError || storageStatus?.reason || '正在检查磁盘空间'}
            />
          )}
          <div className="mt-4.5 flex justify-end gap-2">
            <Button disabled={submitting} onClick={closeCreateModal}>
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              disabled={!canUpload || !selectedFile}
            >
              创建并部署
            </Button>
          </div>
        </Form>
      </Modal>
      <Modal
        open={deleteTarget !== null}
        title={`删除项目 “${deleteTarget?.name ?? ''}”？`}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        cancelButtonProps={{ disabled: deleting }}
        confirmLoading={deleting}
        closable={!deleting}
        keyboard={!deleting}
        mask={{ closable: !deleting }}
        onOk={() => void removeProject()}
        onCancel={() => setDeleteTarget(null)}
      >
        <p className="mb-4">项目记录、当前版和上一版文件都会被删除，此操作不可撤销。</p>
        {deleteError && <Alert type="error" showIcon title={deleteError} />}
      </Modal>
      {releaseTarget && (
        <ProjectReleaseModal
          key={`${releaseTarget.project.id}-${releaseTarget.mode}`}
          project={releaseTarget.project}
          mode={releaseTarget.mode}
          maxUploadBytes={maxUploadBytes}
          onClose={() => setReleaseTarget(null)}
          onComplete={(updated) => {
            setReleaseTarget(null)
            setProjects((current) => [updated, ...current.filter((item) => item.id !== updated.id)])
            void loadStorage()
          }}
        />
      )}
    </div>
  )
}

export default App
