import type { Connect } from 'vite'
import {
  appList,
  date,
  diagnostics,
  events,
  filesByVersion,
  member,
  network,
  owner,
  projects,
  storage,
  system,
} from './data.ts'
import { successfulBackup } from '../tests/data.ts'

const readOnly = { error: '视觉稿仅供预览，保存、发布和删除请在实际管理台操作。' }
const guestCookie = 'stacknest_visual_guest=1'

// activityPage 应用页面实际提交的筛选条件，以便在视觉稿中查看有结果和空结果的布局。
function activityPage(query: URLSearchParams) {
  const keyword = query.get('q')?.trim().toLowerCase()
  const fields = ['slug', 'actor', 'action', 'status'] as const
  const from = query.get('from')
  const to = query.get('to')
  const filtered = events.filter(
    (event) =>
      fields.every((key) => !query.get(key) || query.get(key) === event[key]) &&
      (!keyword ||
        [event.slug, event.actor, event.message, event.id, event.fileName]
          .join(' ')
          .toLowerCase()
          .includes(keyword)) &&
      (!from || Date.parse(event.createdAt) >= Date.parse(from)) &&
      (!to || Date.parse(event.createdAt) < Date.parse(to)),
  )
  const page = Math.max(1, Number(query.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.get('pageSize')) || 50))
  return {
    events: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
  }
}

// visualAPI 为真实管理界面提供固定的本地数据，所有业务写入都在这里结束。
export const visualAPI: Connect.NextHandleFunction = (request, response, next) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  const path = url.pathname
  if (path.startsWith('/__visual/site/')) {
    response
      .writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      .end('这是视觉稿中的示例站点。关闭此标签页即可返回 StackNest。')
    return
  }
  if (path === '/__visual/login') {
    response
      .writeHead(303, {
        'Set-Cookie': guestCookie + '; Path=/; SameSite=Strict; HttpOnly',
        Location: '/login',
        'Cache-Control': 'no-store',
      })
      .end()
    return
  }
  if (path !== '/api' && !path.startsWith('/api/')) return next()
  // reply 使用真实 API 的 JSON 形状，同时避免缓存演示会话。
  const reply = (data: unknown, status = 200) => {
    response
      .writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      .end(JSON.stringify(data))
  }
  if (request.method === 'POST') {
    switch (path) {
      case '/api/auth/logout':
        response.setHeader('Set-Cookie', guestCookie + '; Path=/; SameSite=Strict; HttpOnly')
        return reply(null, 204)
      case '/api/auth/request-code':
        return reply(null, 204)
      case '/api/auth/verify':
        response.setHeader(
          'Set-Cookie',
          guestCookie + '; Max-Age=0; Path=/; SameSite=Strict; HttpOnly',
        )
        return reply(owner)
    }
  }
  if (request.headers.cookie?.split(/;\s*/).includes(guestCookie))
    return reply({ error: '请先登录演示账号' }, 401)
  if (path === '/api/system/diagnostics' && request.method === 'POST') return reply(diagnostics)
  if (request.method !== 'GET') return reply(readOnly, 405)
  switch (path) {
    case '/api/auth/session':
      return reply(owner)
    case '/api/projects':
      return reply({ projects })
    case '/api/storage':
      return reply(storage)
    case '/api/users':
      return reply({ users: [owner, member], invitationLoginUrl: '/__visual/login' })
    case '/api/activity':
      return reply(activityPage(url.searchParams))
    case '/api/system':
      return reply(system)
    case '/api/version':
      return reply({ version: 'dev', revision: 'unknown' })
    case '/api/backups/status':
      return reply({
        ...successfulBackup,
        lastAttempt: { ...successfulBackup.lastAttempt, startedAt: date, finishedAt: date },
        lastSuccess: { ...successfulBackup.lastSuccess, createdAt: date },
      })
    case '/api/network':
      return reply(network)
    case '/api/apps':
      return reply(appList)
    case '/api/apps/limits':
      return reply({
        ...appList.limits,
        revision: 1,
        usedApps: appList.apps.length,
        allocatedMemoryMiB: appList.apps.reduce((total, view) => total + view.app.memoryMiB, 0),
        maxTotalMemoryMiB: 3072,
      })
    case '/api/apps/images':
      return reply({ totalBytes: 0, images: [] })
  }
  const [, , collection, key, section, extra] = path.split('/')
  if (
    !extra &&
    section === 'traffic' &&
    ((collection === 'projects' && projects.some((project) => project.slug === key)) ||
      (collection === 'apps' && appList.apps.some((view) => view.app.id === key)))
  ) {
    const days = [36, 54, 48, 72, 57, 91, 68].map((requests, i) => ({
      date: `2026-11-${10 + i}`,
      requests,
      pages: Math.floor(requests / 3),
      clientErrors: i % 3,
      serverErrors: 0,
    }))
    return reply({
      available: true,
      since: '2026-11-10T00:00:00Z',
      updatedAt: '2026-11-16T12:00:00Z',
      days,
    })
  }
  if (!extra && collection === 'projects') {
    const project = projects.find((item) => item.slug === key)
    if (project) {
      if (!section) return reply(project)
      if (section === 'files' || section === 'changes') {
        const versions = [project.draft, ...(project.deployments ?? [])]
        // 示例版本均只修改首页，因此只比较示例文件的长度即可生成展示数据。
        const filesFor = (id: string | null) =>
          id && versions.some((version) => version?.id === id) ? filesByVersion.get(id) : undefined
        const files = filesFor(
          url.searchParams.get('deploymentId') ?? project.deployments?.[0]?.id ?? null,
        )
        if (!files) return reply({ error: '示例版本不存在' }, 404)
        if (section === 'files') return reply({ files })
        const base = filesFor(url.searchParams.get('baseId')) ?? []
        const changes = files.flatMap((file) => {
          const before = base.find((other) => other.path === file.path)
          return before?.bytes === file.bytes
            ? []
            : [
                {
                  path: file.path,
                  kind: before ? 'modified' : 'added',
                  beforeBytes: before?.bytes ?? 0,
                  afterBytes: file.bytes,
                },
              ]
        })
        return reply({ changes })
      }
      if (section === 'deploy-tokens') return reply({ tokens: [] })
      if (section === 'export') return reply(readOnly, 403)
    }
  }
  if (!extra && collection === 'apps') {
    const view = appList.apps.find((item) => item.app.id === key)
    if (view) {
      if (section === 'data-export') return reply({ state: 'no_backup' })
      if (!section) return reply({ ...view, available: appList.available, limits: appList.limits })
      if (section === 'logs') return reply({ text: 'Listening on port 3000\nGET /health 200 OK' })
      if (section === 'deployment-logs') return reply({ text: 'Image ready. Health check passed.' })
      if (section === 'deploy-tokens') return reply({ tokens: [] })
      if (section === 'deployments')
        return reply({
          deployments: [
            {
              generation: 1,
              image: view.app.image,
              actorEmail: owner.email,
              source: 'web',
              status: 'succeeded',
              queuedAt: date,
              finishedAt: date,
            },
          ],
        })
    }
  }
  if (path === '/api/deploy-tools/skill') return reply(readOnly, 403)
  return reply({ error: '视觉稿中没有这个示例。' }, 404)
}
