import { lazy, useCallback, useState } from 'react'
import { Alert, Button, Dropdown, Empty, Input, Modal, Spin, Tag, Tooltip } from 'antd'
import { getApp, listApps, operateApp } from '../api/apps'
import { getErrorMessage } from '../lib/format'
import type { AppAction, AppList, AppView } from '../types/app'
import { isAdmin } from '../lib/permissions'
import type { AuthUser } from '../types/auth'
import { navigate } from '../lib/router'
import { usePolling } from '../lib/usePolling'
import RouteLink from './RouteLink'
import DockerAppDisk from './DockerAppDisk'
import DockerAppLogPanel from './DockerAppLogPanel'
import DockerAppForm from './DockerAppForm'
import DockerAppLogs from './DockerAppLogs'
import DockerAppRuntime from './DockerAppRuntime'
import DockerAppProgress from './DockerAppProgress'
import DockerAppLimits from './DockerAppLimits'
import LazyPanel from './LazyPanel'

const DockerAppAutomation = lazy(() => import('./DockerAppAutomation'))
const DockerImages = lazy(() => import('./DockerImages'))
const DockerAppHistory = lazy(() => import('./DockerAppHistory'))

const phase = {
  pending: '等待执行',
  deploying: '正在执行',
  ready: '已部署',
  stopped: '已停止',
  error: '操作失败',
}
const actionLabel: Record<AppAction, string> = {
  start: '启动',
  stop: '停止',
  restart: '重启',
  delete: '删除',
  cancel: '取消部署',
}

// DockerApps 提供单容器 HTTP 应用管理；轮询只在可见页面执行。
export default function DockerApps({
  user,
  detail,
}: {
  user: AuthUser
  detail?: { id: string; tab: 'overview' | 'logs' | 'automation' } | null
}) {
  const detailId = detail?.id
  const [result, setResult] = useState<AppList | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<{ target: AppView | null } | null>(null)
  const [logs, setLogs] = useState<{ view: AppView; kind: 'runtime' | 'deployment' } | null>(null)
  const [deleting, setDeleting] = useState<AppView | null>(null)
  const [cancelling, setCancelling] = useState<AppView | null>(null)
  const [busyIds, setBusyIds] = useState(() => new Set<string>())
  const [showLimits, setShowLimits] = useState(false)
  const [showImages, setShowImages] = useState(false)
  const [history, setHistory] = useState<AppView | null>(null)

  // load 只读取当前路由的应用，并保留已经收到的新代次。
  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        const item = detailId ? await getApp(detailId, signal) : null
        const next = item
          ? { apps: [item], available: item.available, limits: item.limits }
          : await listApps(signal)
        if (!signal.aborted) {
          setResult((current) => ({
            ...next,
            apps: next.apps.map((item) => {
              const previous = current?.apps.find((old) => old.app.id === item.app.id)
              return previous && previous.app.generation > item.app.generation ? previous : item
            }),
          }))
          setError('')
        }
      } catch (failure) {
        if (!signal.aborted) {
          setError(
            getErrorMessage(
              failure,
              detailId ? '应用不存在、无权查看或暂时无法加载' : '应用列表加载失败',
            ),
          )
        }
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [detailId],
  )
  const refresh = usePolling(
    load,
    !detail || detail.tab === 'overview' ? 4000 : null,
    true,
    revision,
  )

  // act 立即展示新代次的排队状态，禁止反复提交同一操作。
  const act = async (target: AppView, action: AppAction) => {
    const id = target.app.id
    if (busyIds.has(id)) return
    setBusyIds((current) => new Set(current).add(id))
    setError('')
    try {
      const updated = await operateApp(target, action)
      setResult((current) =>
        current
          ? {
              ...current,
              apps: current.apps.map((item) => (item.app.id === updated.app.id ? updated : item)),
            }
          : current,
      )
      if (action === 'delete') {
        setDeleting(null)
        if (detailId) navigate('/apps')
      }
      if (action === 'cancel') setCancelling(null)
      setRevision((value) => value + 1)
    } catch (failure) {
      setError(getErrorMessage(failure, `${actionLabel[action]}应用失败`))
    } finally {
      setBusyIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }

  const views =
    result?.apps.filter(({ app }) =>
      `${app.name} ${app.slug} ${app.image}`.toLowerCase().includes(query.trim().toLowerCase()),
    ) ?? []
  return (
    <section aria-label="Docker 应用">
      {error && <Alert className="mb-4" type="error" showIcon title={error} />}
      {result && !result.available && (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          title="Docker 运行器不可用，暂时不能操作应用。"
        />
      )}
      {detail && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <RouteLink to="/apps" active={false} className="text-sm underline">
            ← 应用列表
          </RouteLink>
          <nav aria-label="应用详情标签" className="flex gap-4 text-sm">
            <RouteLink
              to={`/apps/${detail.id}`}
              active={detail.tab === 'overview'}
              className="rounded px-2 py-2 aria-[current=page]:bg-subtle"
            >
              概览与配置
            </RouteLink>
            <RouteLink
              to={`/apps/${detail.id}/logs`}
              active={detail.tab === 'logs'}
              className="rounded px-2 py-2 aria-[current=page]:bg-subtle"
            >
              运行日志
            </RouteLink>
            <RouteLink
              to={`/apps/${detail.id}/automation`}
              active={detail.tab === 'automation'}
              className="rounded px-2 py-2 aria-[current=page]:bg-subtle"
            >
              自动部署
            </RouteLink>
          </nav>
        </div>
      )}
      {!detail && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input.Search
            className="sm:max-w-xs"
            placeholder="搜索应用…"
            aria-label="搜索 Docker 应用"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            allowClear
          />
          <div className="flex flex-wrap gap-2">
            {user.role === 'superadmin' && (
              <>
                <Button onClick={() => setShowImages(true)}>镜像空间</Button>
                <Button onClick={() => setShowLimits(true)}>资源配置</Button>
              </>
            )}
            <Button onClick={() => void refresh()} loading={loading}>
              刷新
            </Button>
            <Button
              type="primary"
              className="flex-1 sm:flex-none"
              disabled={!result?.available}
              onClick={() => setEditor({ target: null })}
            >
              ＋ 部署应用
            </Button>
          </div>
        </div>
      )}
      {!detail && result?.available && (
        <p className="mb-3 text-xs text-muted">
          应用上限 {result.limits.maxApps} 个 · 内存总预算 {result.limits.totalMemoryMiB} MiB
        </p>
      )}
      {loading && !result ? (
        <div className="grid min-h-48 place-items-center">
          <Spin />
        </div>
      ) : !views.length ? (
        <div className="rounded-xl border border-line bg-panel p-8">
          <Empty
            description={
              detail ? '应用无法加载或已删除' : query ? '没有匹配的应用' : '还没有 Docker 应用'
            }
          />
        </div>
      ) : detail?.tab === 'automation' ? (
        <LazyPanel>
          <DockerAppAutomation key={detail.id} app={views[0].app} />
        </LazyPanel>
      ) : detail?.tab === 'logs' ? (
        <div className="min-w-0 rounded-xl border border-line bg-panel p-4 sm:p-5">
          <h2 className="mb-4 text-base font-semibold break-all">{views[0].app.name} · 运行日志</h2>
          <DockerAppLogPanel key={detail.id} id={detail.id} />
        </div>
      ) : (
        <div className="grid gap-4">
          {views.map((view) => {
            const { app, runtime } = view
            const pending = app.status === 'pending' || app.status === 'deploying'
            const running = runtime?.state === 'running'
            const disabled = pending || busyIds.has(app.id) || !result?.available
            return (
              <article
                key={app.id}
                className="min-w-0 rounded-xl border border-line bg-panel p-4 shadow-sm sm:p-5"
                aria-label={app.name}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="mb-1 text-base font-semibold break-all">
                      {detail ? (
                        app.name
                      ) : (
                        <RouteLink
                          to={`/apps/${app.id}`}
                          active={false}
                          className="hover:underline focus-visible:underline"
                        >
                          {app.name}
                          <span
                            aria-hidden="true"
                            className="ml-2 text-xs font-normal text-muted underline underline-offset-4"
                          >
                            详情
                          </span>
                        </RouteLink>
                      )}
                    </h2>
                    <p
                      className={
                        detail ? 'text-xs break-all text-muted' : 'truncate text-xs text-muted'
                      }
                      title={detail ? undefined : app.image}
                    >
                      {app.slug} · {app.image}
                    </p>
                    {isAdmin(user) && (
                      <p className="mt-1 text-xs break-all text-dim">所属：{app.ownerEmail}</p>
                    )}
                  </div>
                  <Tag
                    className="m-0 shrink-0"
                    color={
                      pending
                        ? 'processing'
                        : running
                          ? 'success'
                          : app.status === 'error' && !app.canceled
                            ? 'error'
                            : 'default'
                    }
                  >
                    {pending
                      ? phase[app.status]
                      : running
                        ? '运行中'
                        : runtime
                          ? '已停止'
                          : app.canceled
                            ? '部署已取消'
                            : phase[app.status]}
                  </Tag>
                </div>
                {detail && (
                  <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
                    <span>端口 {app.port}</span>
                    <span>内存上限 {app.memoryMiB} MiB</span>
                    <span>CPU 上限 {app.cpus} 核</span>
                    <span className="break-all">数据目录：{app.dataPath || '未启用'}</span>
                  </div>
                )}
                <DockerAppProgress view={view} />
                <DockerAppRuntime view={view} compact={!detail} />
                {detail && <DockerAppDisk view={view} />}
                {detail && (
                  <dl className="mb-4 grid gap-2 rounded-lg bg-subtle p-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="text-muted">健康检查</dt>
                      <dd className="mt-1 break-all">{app.healthPath || 'TCP 端口检查'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">环境变量名称（不显示值）</dt>
                      <dd className="mt-1 break-all">{app.envKeys.join('、') || '无'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">配置版本</dt>
                      <dd className="mt-1">{app.generation}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">最近更新</dt>
                      <dd className="mt-1">{new Date(app.updatedAt).toLocaleString('zh-CN')}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-muted">镜像标识</dt>
                      <dd className="mt-1 break-all">
                        {runtime?.imageId || app.imageId || '等待部署'}
                      </dd>
                    </div>
                  </dl>
                )}
                {app.error && (
                  <Alert
                    className="mb-3"
                    type={app.canceled ? 'info' : 'error'}
                    showIcon
                    title={app.error}
                  />
                )}
                {runtime?.oomKilled && (
                  <Alert
                    className="mb-3"
                    type="warning"
                    showIcon
                    title="容器曾超出内存限制而退出，请检查日志或调整内存。"
                  />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {pending && app.action === 'deploy' && (
                    <Tooltip
                      title={
                        view.progress?.canCancel || app.status === 'pending'
                          ? '取消后可修改镜像地址重新部署'
                          : '已进入容器切换或正在结束任务，请等待完成'
                      }
                    >
                      <Button
                        className="h-11 sm:h-8"
                        danger
                        disabled={
                          busyIds.has(app.id) ||
                          !result?.available ||
                          !(view.progress?.canCancel || app.status === 'pending')
                        }
                        onClick={() => setCancelling(view)}
                      >
                        取消部署
                      </Button>
                    </Tooltip>
                  )}
                  <Button
                    className="h-11 sm:h-8"
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    disabled={!running}
                  >
                    打开应用 ↗
                  </Button>
                  {app.error && !app.canceled && (
                    <Button
                      className="h-11 sm:h-8"
                      onClick={() => setLogs({ view, kind: 'deployment' })}
                    >
                      失败详情
                    </Button>
                  )}
                  <Button
                    className="h-11 sm:h-8"
                    onClick={() => setEditor({ target: view })}
                    disabled={disabled}
                  >
                    更新
                  </Button>
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        {
                          key: 'logs',
                          label: '运行日志',
                          disabled: !runtime?.containerId,
                          onClick: () => setLogs({ view, kind: 'runtime' }),
                        },
                        {
                          key: 'history',
                          label: '部署记录',
                          onClick: () => setHistory(view),
                        },
                        ...(!detail
                          ? [
                              {
                                key: 'automation',
                                label: '自动部署',
                                onClick: () => navigate('/apps/' + app.id + '/automation'),
                              },
                            ]
                          : []),
                        { type: 'divider' },
                        {
                          key: 'start-stop',
                          label: running ? '停止' : '启动',
                          disabled,
                          onClick: () => void act(view, running ? 'stop' : 'start'),
                        },
                        {
                          key: 'restart',
                          label: '重启',
                          disabled: disabled || !running,
                          onClick: () => void act(view, 'restart'),
                        },
                        {
                          key: 'delete',
                          label: '删除应用',
                          disabled,
                          danger: true,
                          onClick: () => setDeleting(view),
                        },
                      ],
                    }}
                    popupRender={(menu) => (
                      <div className="[&_.ant-dropdown-menu-item]:min-h-11 sm:[&_.ant-dropdown-menu-item]:min-h-9">
                        {menu}
                      </div>
                    )}
                  >
                    <Button className="h-11 sm:h-8" aria-label={'更多操作：' + app.name}>
                      更多 ▾
                    </Button>
                  </Dropdown>
                </div>
              </article>
            )
          })}
        </div>
      )}
      {showImages && (
        <LazyPanel>
          <DockerImages onClose={() => setShowImages(false)} />
        </LazyPanel>
      )}
      {history && (
        <LazyPanel>
          <DockerAppHistory
            id={history.app.id}
            name={history.app.name}
            onClose={() => setHistory(null)}
          />
        </LazyPanel>
      )}
      {showLimits && (
        <DockerAppLimits
          maxMemoryMiB={result?.limits.maxMemoryMiB}
          onClose={() => setShowLimits(false)}
          onSaved={() => setRevision((value) => value + 1)}
        />
      )}
      {editor && result && (
        <DockerAppForm
          target={editor.target}
          maxMemoryMiB={result.limits.maxMemoryMiB}
          onClose={() => setEditor(null)}
          onSaved={() => setRevision((value) => value + 1)}
        />
      )}
      {logs && <DockerAppLogs target={logs.view} kind={logs.kind} onClose={() => setLogs(null)} />}
      {cancelling && (
        <Modal
          open
          title={`取消部署 ${cancelling.app.name}？`}
          okText="确认取消部署"
          cancelText="继续部署"
          okButtonProps={{ danger: true }}
          confirmLoading={busyIds.has(cancelling.app.id)}
          onOk={() => void act(cancelling, 'cancel')}
          onCancel={() => {
            if (!busyIds.has(cancelling.app.id)) setCancelling(null)
          }}
        >
          <p className="text-sm leading-relaxed">
            停止本次排队或镜像拉取，之后可以修改配置重新部署。已运行的版本会继续提供服务。
          </p>
        </Modal>
      )}
      {deleting && (
        <Modal
          open
          title={`删除 ${deleting.app.name}？`}
          okText="永久删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          confirmLoading={busyIds.has(deleting.app.id)}
          onOk={() => void act(deleting, 'delete')}
          onCancel={() => {
            if (!busyIds.has(deleting.app.id)) setDeleting(null)
          }}
        >
          <p className="text-sm leading-relaxed">
            将永久删除此应用的容器、专属网络和持久化数据，无法撤销。镜像不会做全局清理。
          </p>
        </Modal>
      )}
    </section>
  )
}
