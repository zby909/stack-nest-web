import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Form, Input, Modal, Select, Spin, Upload } from 'antd'
import { deleteProject, getProject, listProjects } from '../api/projects'
import { getStorage } from '../api/operations'
import { formatBytes, getErrorMessage } from '../lib/format'
import { isAdmin } from '../lib/permissions'
import { validateProjectDescription, validateProjectName } from '../lib/projectMetadata'
import { sortProjects, type ProjectSort } from '../lib/projectUsage'
import { navigate, projectRoute, usePathname } from '../lib/router'
import { siteUploadAccept, supportedSiteFile } from '../lib/siteUpload'
import { recoverTarget } from '../lib/uploadRecovery'
import { usePolling } from '../lib/usePolling'
import { useResumableUpload } from '../lib/useResumableUpload'
import type { AuthUser } from '../types/auth'
import type { StorageStatus } from '../types/operations'
import type { CreateProjectForm, Project } from '../types/project'
import LazyPanel from './LazyPanel'
import PageHeading from './PageHeading'
import ProjectActions from './ProjectActions'
import ProjectUsage from './ProjectUsage'
import RouteLink from './RouteLink'
import StatCard from './StatCard'
import StorageCard from './StorageCard'
import UploadProgress from './UploadProgress'
import UploadRecoveryBanner, { type RecoveredUpload } from './UploadRecoveryBanner'

const ProjectDetail = lazy(() => import('./ProjectDetail'))
const ProjectReleaseModal = lazy(() => import('./ProjectReleaseModal'))
const ProjectEditModal = lazy(() => import('./ProjectEditModal'))
const ProjectExportModal = lazy(() => import('./ProjectExportModal'))
const ProjectAccessModal = lazy(() => import('./ProjectAccessModal'))
const ProjectFilesModal = lazy(() => import('./ProjectFilesModal'))

// ProjectsPage 管理静态项目、版本和上传恢复，离开项目页后释放本页请求。
export default function ProjectsPage({ user }: { user: AuthUser }) {
  const pathname = usePathname()
  const detail = projectRoute(pathname)
  const showList = !detail
  const [form] = Form.useForm<CreateProjectForm>()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const listRead = useRef<AbortController | null>(null)
  const [detailRevision, setDetailRevision] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createRecovery, setCreateRecovery] = useState<RecoveredUpload | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [createError, setCreateError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<ProjectSort>('updated')
  const [editTarget, setEditTarget] = useState<Project | null>(null)
  const [exportTarget, setExportTarget] = useState<Project | null>(null)
  const [filesTarget, setFilesTarget] = useState<Project | null>(null)
  const upload = useResumableUpload(user.id)
  const [accessTarget, setAccessTarget] = useState<Project | null>(null)
  const [releaseTarget, setReleaseTarget] = useState<{
    project: Project
    mode: 'update' | 'rollback'
    recovery?: RecoveredUpload
  } | null>(null)

  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null)
  const [storageError, setStorageError] = useState('')
  const [storageLoading, setStorageLoading] = useState(true)
  const maxUploadBytes = storageStatus?.maxUploadBytes ?? 90 * 1024 * 1024
  const canUpload = storageStatus?.uploadAllowed === true && !storageError

  // readStorage 按服务端实际磁盘状态同步上传入口。
  const readStorage = useCallback(async (signal: AbortSignal) => {
    setStorageLoading(true)
    try {
      const next = await getStorage(signal)
      if (signal.aborted) return
      setStorageStatus(next)
      setStorageError('')
    } catch (failure) {
      if (signal.aborted) return
      setStorageStatus(null)
      setStorageError(getErrorMessage(failure, '暂时无法连接服务，已暂停上传和更新，请重新检查'))
    } finally {
      if (!signal.aborted) setStorageLoading(false)
    }
  }, [])

  const loadStorage = usePolling(readStorage, 30_000)

  // 从后端读取项目列表，并同步页面加载状态。
  const loadProjects = useCallback(async () => {
    listRead.current?.abort()
    const controller = new AbortController()
    listRead.current = controller
    setLoading(true)
    setError('')
    try {
      const next = await listProjects(controller.signal)
      if (!controller.signal.aborted) setProjects(next)
    } catch (requestError) {
      if (!controller.signal.aborted) setError(getErrorMessage(requestError, '项目列表加载失败'))
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!showList) return
    document.title = '项目 · StackNest'
    void loadProjects()
    return () => {
      listRead.current?.abort()
      listRead.current = null
    }
  }, [loadProjects, showList])

  // recordProject 同步列表；详情自身已经收到的结果无需重新读取。
  const recordProject = (updated: Project) => {
    setProjects((items) => [updated, ...items.filter((item) => item.id !== updated.id)])
  }

  // applyProjectChange 让当前详情接收弹窗操作的结果，保留标签页状态。
  const applyProjectChange = (updated: Project) => {
    recordProject(updated)
    if (projectRoute(window.location.pathname)?.slug === updated.slug)
      setDetailRevision((value) => value + 1)
  }

  const filteredProjects = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const matched = projects.filter((item) =>
      [
        item.name,
        item.slug,
        item.description ?? '',
        ...(isAdmin(user) ? [item.ownerEmail] : []),
      ].some((value) => value.toLowerCase().includes(keyword)),
    )
    return sortProjects(matched, sort)
  }, [projects, query, sort, user])

  const restoreCreate = upload.restore
  useEffect(() => {
    if (!showCreate || !createRecovery) return
    const { record, status } = createRecovery
    form.setFieldsValue({
      name: record.target.name ?? '',
      slug: record.target.slug ?? '',
      description: record.target.description ?? '',
      notes: record.target.notes ?? '',
    })
    restoreCreate(record, status)
  }, [createRecovery, form, restoreCreate, showCreate])

  // resumeUpload 打开原任务对应弹窗，更新任务先重新验证项目和当前版本。
  const resumeUpload = async (recovery: RecoveredUpload) => {
    if (recovery.record.target.kind === 'create') {
      setCreateRecovery(recovery)
      setSelectedFile(null)
      setCreateError('')
      setShowCreate(true)
    } else {
      const project = await getProject(recovery.record.target.slug!)
      if (!recovery.status.completed) recoverTarget(recovery.record, project)
      setReleaseTarget({ project, mode: 'update', recovery })
    }
  }

  // 关闭创建弹窗并清空尚未提交的表单与文件状态。
  const closeCreateModal = () => {
    setShowCreate(false)
    setCreateRecovery(null)
    setSelectedFile(null)
    upload.reset()
    setCreateError('')
    form.resetFields()
  }

  // 提交项目基本信息和上传文件，完成一次静态项目部署。
  const handleSubmit = async (values: CreateProjectForm) => {
    if (submitting) return
    if (!selectedFile && !upload.readyToComplete) {
      setCreateError('请选择 ZIP、RAR 或 HTML 文件')
      return
    }
    if (selectedFile && selectedFile.size > maxUploadBytes) {
      setCreateError(`上传文件不能超过 ${formatBytes(maxUploadBytes)}`)
      return
    }

    setSubmitting(true)
    setCreateError('')
    try {
      if (!upload.readyToComplete) {
        const latestStorage = await getStorage()
        setStorageStatus(latestStorage)
        if (!latestStorage.uploadAllowed) throw new Error(latestStorage.reason)
      }
      const result = upload.readyToComplete
        ? await upload.complete()
        : await upload.start(selectedFile!, { kind: 'create', preview: true, ...values })
      if (!result) return
      closeCreateModal()
      if (window.location.pathname === pathname) navigate(`/projects/${result.slug}/versions`)
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
      if (projectRoute(window.location.pathname)?.slug === deleteTarget.slug) navigate('/projects')
      else if (listRead.current) await loadProjects()
    } catch (requestError) {
      setDeleteError(getErrorMessage(requestError, '删除失败'))
    } finally {
      setDeleting(false)
      void loadStorage()
    }
  }

  return (
    <>
      {!detail && (
        <PageHeading
          heading="你的静态项目，都放在这里。"
          description="上传 ZIP、RAR 或单个 HTML，StackNest 会校验并生成预览，确认后发布站点。"
          action={
            <Button
              type="primary"
              className="h-11 w-full shrink-0 sm:h-8 sm:w-auto"
              disabled={!canUpload}
              onClick={() => setShowCreate(true)}
            >
              ＋ 部署静态项目
            </Button>
          }
        />
      )}
      {!showCreate && !releaseTarget && (
        <UploadRecoveryBanner userId={user.id} onResume={resumeUpload} />
      )}
      {detail ? (
        <LazyPanel>
          <ProjectDetail
            key={detail.slug}
            slug={detail.slug}
            tab={detail.tab}
            canUpload={canUpload}
            refreshKey={detailRevision}
            onChanged={(updated) => {
              recordProject(updated)
              void loadStorage()
            }}
            onAction={(project, action) => {
              if (action === 'update' || action === 'rollback')
                setReleaseTarget({ project, mode: action })
              if (action === 'edit') setEditTarget(project)
              if (action === 'export') setExportTarget(project)
              if (action === 'access') setAccessTarget(project)
              if (action === 'delete') {
                setDeleteError('')
                setDeleteTarget(project)
              }
            }}
          />
        </LazyPanel>
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

          <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="项目概览">
            <StatCard label="项目总数" value={projects.length} description="已登记静态项目" />
            <StatCard
              label="开放访问"
              value={projects.filter((project) => project.status === 'online').length}
              description="已发布且未暂停的项目"
            />
            <StatCard
              label="部署方式"
              value="HTML / ZIP / RAR"
              description={`单包最大 ${formatBytes(maxUploadBytes)}`}
              compactOnMobile
            />
          </section>

          {isAdmin(user) ? (
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
                <Button size="small" loading={storageLoading} onClick={() => void loadStorage()}>
                  重新检查
                </Button>
              }
            />
          ) : null}
          <section
            className="rounded-panel border border-line bg-panel p-4 shadow-panel sm:p-5"
            id="projects"
          >
            <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-base font-bold">项目</h2>
                <p className="mt-1 text-sm text-muted sm:text-xs">
                  {isAdmin(user) ? '查看和管理所有用户的项目。' : '搜索、打开或删除自己的项目。'}
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
                <Input
                  className="min-w-36 flex-1 sm:w-52"
                  size="large"
                  allowClear
                  aria-label="搜索项目"
                  placeholder="搜索项目..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <Select<ProjectSort>
                  className="w-40"
                  size="large"
                  aria-label="项目排序"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: 'updated', label: '按最新更新' },
                    { value: 'largest', label: '占用从大到小' },
                    { value: 'smallest', label: '占用从小到大' },
                  ]}
                />
                <Button size="large" loading={loading} onClick={() => void loadProjects()}>
                  刷新项目
                </Button>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              空间合计包含当前版、上一版和待发布版。按占用排序时，统计暂不可用的项目排在最后。
            </p>

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
                    : '上传单个 HTML，或包含 index.html 的 ZIP / RAR 开始部署。'}
                </span>
                {!query.trim() && (
                  <Button disabled={!canUpload} onClick={() => setShowCreate(true)}>
                    创建第一个项目
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-3 xl:space-y-0 xl:divide-y xl:divide-line xl:overflow-hidden xl:rounded-xl xl:border xl:border-line">
                {filteredProjects.map((project) => {
                  const latest = project.draft ?? project.deployments?.[0]
                  return (
                    <article
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-line p-3.5 transition-colors duration-200 hover:bg-panel-hover xl:grid-cols-[minmax(0,1.8fr)_auto_minmax(0,1.1fr)_auto] xl:items-center xl:gap-3.5 xl:rounded-none xl:border-0"
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
                            className="text-sm font-semibold break-all xl:truncate"
                            title={project.name}
                          >
                            <RouteLink
                              to={`/projects/${project.slug}`}
                              active={false}
                              className="hover:underline focus-visible:underline"
                            >
                              {project.name}
                            </RouteLink>
                          </div>
                          <div className="mt-1 text-xs break-all text-muted xl:truncate">
                            {project.slug}
                            {project.description ? ` · ${project.description}` : ''}
                          </div>
                          {isAdmin(user) && (
                            <div
                              className="mt-1 text-xs break-all text-muted xl:truncate"
                              title={project.ownerEmail}
                            >
                              所属：{project.ownerEmail}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1.25 text-xs font-semibold whitespace-nowrap ${project.status === 'paused' ? 'bg-subtle text-muted' : 'bg-success-soft text-success'}`}
                        >
                          <i className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                          {project.status === 'paused'
                            ? '已暂停'
                            : project.status === 'draft'
                              ? '待发布'
                              : project.draft
                                ? '已发布 · 有草稿'
                                : '已发布'}
                        </span>
                      </div>
                      <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs xl:col-span-1 xl:block">
                        <strong
                          className="min-w-0 font-semibold break-all xl:block xl:truncate"
                          title={latest?.fileName}
                        >
                          {latest?.fileName ?? 'Static'}
                        </strong>
                        <span className="text-xs text-dim xl:mt-1 xl:block">
                          {new Date(project.updatedAt).toLocaleString('zh-CN')}
                        </span>
                        <ProjectUsage project={project} />
                      </div>
                      <ProjectActions
                        project={project}
                        canUpload={canUpload}
                        onEdit={() => setEditTarget(project)}
                        onExport={() => setExportTarget(project)}
                        onFiles={() => setFilesTarget(project)}
                        onAccess={() => setAccessTarget(project)}
                        onRelease={(mode) => setReleaseTarget({ project, mode })}
                        onDelete={() => {
                          setDeleteError('')
                          setDeleteTarget(project)
                        }}
                      />
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
      <Modal
        open={showCreate}
        centered
        title="部署静态项目"
        footer={null}
        destroyOnHidden
        closable={!submitting && !upload.discarding}
        keyboard={!submitting && !upload.discarding}
        mask={{ closable: !submitting && !upload.discarding }}
        onCancel={closeCreateModal}
      >
        <p className="-mt-1 mb-4.5 text-xs text-muted">
          可上传单个 HTML，或根目录 / 唯一一级目录中包含 index.html 的压缩包。文件不超过{' '}
          {formatBytes(maxUploadBytes)}
          ，解压不超过 200 MiB。
        </p>
        {createError && <Alert className="mb-4" type="error" showIcon title={createError} />}
        <Form<CreateProjectForm>
          form={form}
          disabled={submitting || upload.hasSession}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => void handleSubmit(values)}
        >
          <div className="grid grid-cols-1 gap-x-3.5 sm:grid-cols-2">
            <Form.Item
              label="项目名称"
              name="name"
              rules={[
                { required: true, whitespace: true, message: '请输入项目名称' },
                { validator: validateProjectName },
              ]}
            >
              <Input size="large" placeholder="例如：landing-page" />
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
              <Input
                size="large"
                maxLength={52}
                placeholder="例如：demo，对应 stack-nest-demo 子域名"
              />
            </Form.Item>
            <Form.Item
              className="col-span-full"
              label="项目说明（可选）"
              name="description"
              rules={[{ validator: validateProjectDescription }]}
            >
              <Input size="large" placeholder="活动页、Demo、文档站..." />
            </Form.Item>
            <Form.Item
              className="col-span-full"
              label="更新说明（可选）"
              name="notes"
              rules={[{ validator: validateProjectDescription }]}
            >
              <Input.TextArea rows={3} placeholder="记录首版内容或更新内容" />
            </Form.Item>
            <Form.Item className="col-span-full" label="静态项目文件" required>
              <Upload.Dragger
                disabled={submitting}
                accept={siteUploadAccept}
                maxCount={1}
                beforeUpload={(file) => {
                  if (!supportedSiteFile(file.name)) {
                    setCreateError('请选择 ZIP、RAR 或 HTML 文件')
                    return Upload.LIST_IGNORE
                  }
                  if (file.size > maxUploadBytes) {
                    setCreateError(`上传文件不能超过 ${formatBytes(maxUploadBytes)}`)
                    return Upload.LIST_IGNORE
                  }
                  setCreateError('')
                  setSelectedFile(file)
                  return false
                }}
                onRemove={() => setSelectedFile(null)}
              >
                <p className="mx-auto mb-2 inline-grid h-7.5 w-16 place-items-center rounded-lg border border-line-strong bg-panel text-caption font-bold text-muted">
                  静态文件
                </p>
                <p className="text-base">选择或拖入 HTML / ZIP / RAR 文件</p>
                <p className="mt-1 text-sm text-muted">
                  支持普通 HTML 或 Vite / React 构建后的 dist 压缩包
                </p>
              </Upload.Dragger>
            </Form.Item>
          </div>
          <div className="rounded-lg bg-subtle px-3 py-2.5 text-caption text-dim">
            单个 HTML 将作为 index.html 发布，资源请内嵌或使用外部地址；多文件项目上传 ZIP /
            RAR，RAR 仅支持未加密单卷文件。
          </div>
          <UploadProgress upload={upload} />
          {!canUpload && !submitting && (
            <Alert
              className="mt-4"
              type="warning"
              title={storageError || storageStatus?.reason || '正在检查磁盘空间'}
            />
          )}
          <div className="mt-4.5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              className="h-11 sm:h-8"
              disabled={submitting || upload.discarding}
              onClick={closeCreateModal}
            >
              取消
            </Button>
            <Button
              type="primary"
              className="h-11 sm:h-8"
              htmlType="submit"
              loading={submitting}
              disabled={
                (!canUpload && !upload.readyToComplete) ||
                (!selectedFile && !upload.readyToComplete) ||
                upload.discarding
              }
            >
              {upload.readyToComplete
                ? '确认上传结果'
                : upload.hasSession
                  ? '继续上传'
                  : '创建待发布版'}
            </Button>
          </div>
        </Form>
      </Modal>
      <Modal
        open={deleteTarget !== null}
        centered
        title={<span className="break-all">删除项目 “{deleteTarget?.name ?? ''}”？</span>}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true, className: 'h-11 sm:h-8' }}
        cancelButtonProps={{ disabled: deleting, className: 'h-11 sm:h-8' }}
        confirmLoading={deleting}
        closable={!deleting}
        keyboard={!deleting}
        mask={{ closable: !deleting }}
        onOk={() => void removeProject()}
        onCancel={() => setDeleteTarget(null)}
      >
        <p className="mb-4">项目记录、当前版、上一版和待发布版文件都会被删除，此操作不可撤销。</p>
        {deleteError && <Alert type="error" showIcon title={deleteError} />}
      </Modal>
      {editTarget && (
        <LazyPanel floating>
          <ProjectEditModal
            key={editTarget.id}
            project={editTarget}
            onClose={() => setEditTarget(null)}
            onComplete={(updated) => {
              setEditTarget(null)
              applyProjectChange(updated)
            }}
          />
        </LazyPanel>
      )}
      {exportTarget && (
        <LazyPanel floating>
          <ProjectExportModal
            key={exportTarget.id}
            project={exportTarget}
            onClose={() => setExportTarget(null)}
          />
        </LazyPanel>
      )}
      {filesTarget && (
        <LazyPanel floating>
          <ProjectFilesModal project={filesTarget} onClose={() => setFilesTarget(null)} />
        </LazyPanel>
      )}
      {releaseTarget && (
        <LazyPanel floating>
          <ProjectReleaseModal
            key={`${releaseTarget.project.id}-${releaseTarget.mode}`}
            project={releaseTarget.project}
            userId={user.id}
            mode={releaseTarget.mode}
            recovery={releaseTarget.recovery}
            maxUploadBytes={maxUploadBytes}
            onClose={() => setReleaseTarget(null)}
            onComplete={(updated) => {
              setReleaseTarget(null)
              applyProjectChange(updated)
              void loadStorage()
              if (releaseTarget.mode === 'update') navigate(`/projects/${updated.slug}/versions`)
            }}
          />
        </LazyPanel>
      )}
      {accessTarget && (
        <LazyPanel floating>
          <ProjectAccessModal
            project={accessTarget}
            onClose={() => setAccessTarget(null)}
            onComplete={(updated) => {
              setAccessTarget(null)
              applyProjectChange(updated)
            }}
          />
        </LazyPanel>
      )}
    </>
  )
}
