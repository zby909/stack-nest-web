import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Input, Modal, Spin, Tag, Tooltip } from 'antd'
import { listApps, operateApp } from '../api/apps'
import { getErrorMessage } from '../lib/format'
import type { AppAction, AppList, AppView } from '../types/app'
import type { AuthUser } from '../types/auth'
import DockerAppForm from './DockerAppForm'
import DockerAppLogs from './DockerAppLogs'
import DockerAppRuntime from './DockerAppRuntime'

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
}

// DockerApps 提供单容器 HTTP 应用管理；轮询只在可见页面执行。
export default function DockerApps({ user }: { user: AuthUser }) {
  const [result, setResult] = useState<AppList | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<{ target: AppView | null } | null>(null)
  const [logs, setLogs] = useState<AppView | null>(null)
  const [deleting, setDeleting] = useState<AppView | null>(null)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    // load 每次轮询完成后才启动下次，避免网络慢时堆积请求。
    const load = async () => {
      try {
        const next = await listApps(controller.signal)
        if (!controller.signal.aborted) {
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
        if (!controller.signal.aborted) setError(getErrorMessage(failure, '应用列表加载失败'))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    let timer: ReturnType<typeof setTimeout>
    // poll 页面隐藏时暂停获取，返回页面后继续。
    const poll = async () => {
      if (!document.hidden) await load()
      if (!controller.signal.aborted) timer = setTimeout(() => void poll(), 4000)
    }
    void poll()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [refresh])

  // act 立即展示新代次的排队状态，禁止反复提交同一操作。
  const act = async (target: AppView, action: AppAction) => {
    setBusyId(target.app.id)
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
      if (action === 'delete') setDeleting(null)
      setRefresh((value) => value + 1)
    } catch (failure) {
      setError(getErrorMessage(failure, `${actionLabel[action]}应用失败`))
    } finally {
      setBusyId('')
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
      <div className="mb-4 rounded-xl border border-line bg-panel p-4 text-sm leading-relaxed text-muted">
        单个 HTTP 服务，最多 {result?.limits.maxApps ?? 3} 个应用，内存总额{' '}
        {result?.limits.totalMemoryMiB ?? 768} MiB。
        容器使用独立内网，当前不能主动访问互联网；浏览器通过应用域名访问。
        {user.role === 'admin' && (
          <span className="mt-1 block text-xs">
            管理员可管理所有应用；普通用户仅管理自己的应用。
          </span>
        )}
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input.Search
          className="sm:max-w-xs"
          placeholder="搜索应用…"
          aria-label="搜索 Docker 应用"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          allowClear
        />
        <div className="flex gap-2">
          <Button onClick={() => setRefresh((value) => value + 1)} loading={loading}>
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
      {loading && !result ? (
        <div className="grid min-h-48 place-items-center">
          <Spin />
        </div>
      ) : !views.length ? (
        <div className="rounded-xl border border-line bg-panel p-8">
          <Empty description={query ? '没有匹配的应用' : '还没有 Docker 应用'} />
        </div>
      ) : (
        <div className="grid gap-4">
          {views.map((view) => {
            const { app, runtime } = view
            const pending = app.status === 'pending' || app.status === 'deploying'
            const running = runtime?.state === 'running'
            const disabled = pending || busyId === app.id || !result?.available
            return (
              <article
                key={app.id}
                className="min-w-0 rounded-xl border border-line bg-panel p-4 shadow-sm sm:p-5"
                aria-label={app.name}
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="mb-1 text-base font-semibold">{app.name}</h2>
                    <p className="text-xs break-all text-dim">
                      {app.slug} · {app.image}
                    </p>
                    {user.role === 'admin' && (
                      <p className="mt-1 text-xs break-all text-dim">所属：{app.ownerEmail}</p>
                    )}
                  </div>
                  <Tag
                    color={
                      pending
                        ? 'processing'
                        : running
                          ? 'success'
                          : app.status === 'error'
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
                          : phase[app.status]}
                  </Tag>
                </div>
                <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
                  <span>端口 {app.port}</span>
                  <span>内存上限 {app.memoryMiB} MiB</span>
                  <span>CPU 上限 {app.cpus} 核</span>
                  <span className="break-all">数据目录：{app.dataPath || '未启用'}</span>
                  <Tooltip title={app.envKeys.join('、') || '无环境变量'}>
                    <span>环境变量 {app.envKeys.length} 个 ⓘ</span>
                  </Tooltip>
                </div>
                <DockerAppRuntime view={view} />
                {app.error && <Alert className="mb-3" type="error" showIcon title={app.error} />}
                {runtime?.oomKilled && (
                  <Alert
                    className="mb-3"
                    type="warning"
                    showIcon
                    title="容器曾超出内存限制而退出，请检查日志或调整内存。"
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    disabled={!running}
                  >
                    打开应用 ↗
                  </Button>
                  <Button onClick={() => setLogs(view)} disabled={!runtime?.containerId}>
                    日志
                  </Button>
                  <Button onClick={() => setEditor({ target: view })} disabled={disabled}>
                    更新
                  </Button>
                  <Button
                    onClick={() => void act(view, running ? 'stop' : 'start')}
                    disabled={disabled}
                  >
                    {running ? '停止' : '启动'}
                  </Button>
                  <Button onClick={() => void act(view, 'restart')} disabled={disabled || !running}>
                    重启
                  </Button>
                  <Button danger onClick={() => setDeleting(view)} disabled={disabled}>
                    删除
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
      {editor && (
        <DockerAppForm
          target={editor.target}
          onClose={() => setEditor(null)}
          onSaved={() => setRefresh((value) => value + 1)}
        />
      )}
      {logs && <DockerAppLogs target={logs} onClose={() => setLogs(null)} />}
      {deleting && (
        <Modal
          open
          title={`删除 ${deleting.app.name}？`}
          okText="永久删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          confirmLoading={busyId === deleting.app.id}
          onOk={() => void act(deleting, 'delete')}
          onCancel={() => {
            if (!busyId) setDeleting(null)
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
