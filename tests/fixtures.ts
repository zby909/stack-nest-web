import { readFile } from 'node:fs/promises'
import { test as base, expect } from '@playwright/test'
import type { NetworkView } from '../src/types/network.ts'
import type { AuthUser } from '../src/types/auth.ts'
import type { Project } from '../src/types/project.ts'
import { admin, date, original, successfulBackup } from './data.ts'
import { mockUploads, type UploadMock } from './upload-mock.ts'

export const archivePath = new URL('./fixtures/site.zip', import.meta.url)
type RecordedRequest = {
  path: string
  method: string
  body: unknown
  match?: string
  offset?: string
}
type MockAPI = {
  role: 'superadmin' | 'admin' | 'user' | 'guest'
  network: NetworkView
  networkConflict: boolean
  projects: Project[]
  users: AuthUser[]
  requests: RecordedRequest[]
  unexpected: string[]
  editError: boolean
  accessError: boolean
  exportError: boolean
  backupError: boolean
  invitation: 'sent' | 'failed'
  uploadAllowed: boolean
  backup: typeof successfulBackup
  logQueries: Record<string, string>[]
  uploads: UploadMock
  filesError: boolean
}

// 独立浏览器上下文中的所有 API 都被拦截，未知接口与外部请求直接使测试失败。
export const test = base.extend<{ api: MockAPI }>({
  api: [
    async ({ context, baseURL }, use) => {
      const zip = await readFile(archivePath)
      const state: MockAPI = {
        role: 'admin',
        networkConflict: false,
        network: {
          config: {
            lanInterfaces: ['eth0'],
            blockedCIDRs: ['192.168.2.0/24'],
            allow: [],
            dnsServers: ['1.1.1.1', '223.5.5.5'],
          },
          revision: 'revision-1',
          ready: true,
          checkedAt: date,
          effectiveBlockedCIDRs: ['172.21.32.0/20', '192.168.2.0/24', 'fe80::/64'],
          interfaces: [
            {
              name: 'eth0',
              addresses: ['172.21.47.248/20', 'fe80::215:5dff:fefc:8400/64'],
              eligible: true,
            },
          ],
        },
        projects: [structuredClone(original)],
        users: [structuredClone(admin)],
        requests: [],
        unexpected: [],
        editError: false,
        accessError: false,
        exportError: false,
        backupError: false,
        invitation: 'sent',
        uploadAllowed: true,
        backup: structuredClone(successfulBackup),
        logQueries: [],
        uploads: {
          records: new Map(),
          failOffset: null,
          dropResponseOnce: false,
          dropCompletionOnce: false,
          publishCount: 0,
        },
        filesError: false,
      }
      await context.route('**/*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        if (url.origin !== baseURL) {
          state.unexpected.push(`external: ${url.origin}${url.pathname}`)
          return route.abort('blockedbyclient')
        }
        if (!url.pathname.startsWith('/api/')) return route.continue()
        const path = url.pathname
        const method = request.method()
        const body = request.headers()['content-type']?.includes('application/json')
          ? request.postDataJSON()
          : null
        state.requests.push({
          path,
          method,
          body,
          match: request.headers()['if-match'],
          offset: request.headers()['upload-offset'],
        })
        if (path.startsWith('/api/uploads'))
          return mockUploads(route, state.uploads, state.projects)
        // reply 为模拟响应加固定请求编号，验证界面的错误定位提示。
        const reply = (data: unknown, status = 200) =>
          route.fulfill({
            status,
            contentType: 'application/json',
            headers: { 'X-Request-ID': 'regression-request' },
            body: JSON.stringify(data),
          })
        if (path === '/api/network') {
          if (state.role !== 'superadmin')
            return reply({ error: '仅超级管理员可配置容器网络' }, 403)
          if (method === 'GET') return reply(state.network)
          if (method === 'PUT') {
            if (state.networkConflict || body.expectedRevision !== state.network.revision)
              return reply({ error: '配置已被更新，请刷新后重试' }, 409)
            const dnsChanged =
              JSON.stringify(body.config.dnsServers) !==
              JSON.stringify(state.network.config.dnsServers)
            state.network = {
              ...state.network,
              config: body.config,
              revision: 'revision-2',
              effectiveBlockedCIDRs: ['172.21.32.0/20', ...body.config.blockedCIDRs, 'fe80::/64'],
              dnsChanged,
            }
            return reply(state.network)
          }
        }
        if (path === '/api/auth/session' && method === 'GET') {
          return state.role === 'guest'
            ? reply({ error: '请先登录' }, 401)
            : reply({ ...admin, role: state.role })
        }
        if (path === '/api/auth/logout' && method === 'POST') {
          state.role = 'guest'
          return route.fulfill({ status: 204 })
        }
        if (path === '/api/storage' && method === 'GET') {
          return reply({
            ...(state.role === 'admin' || state.role === 'superadmin'
              ? {
                  totalBytes: 40 * 1024 ** 3,
                  freeBytes: 25 * 1024 ** 3,
                  usedPercent: 37.5,
                  maxUsedPercent: 90,
                }
              : {}),
            uploadAllowed: state.uploadAllowed,
            reason: state.uploadAllowed ? '' : '磁盘空间不足，暂停上传',
            maxUploadBytes: 90 * 1024 ** 2,
            maxExpandedBytes: 200 * 1024 ** 2,
            maxFiles: 5000,
          })
        }
        if (path === '/api/projects' && method === 'GET') return reply({ projects: state.projects })
        const slug = path.split('/')[3]
        const index = state.projects.findIndex((project) => project.slug === slug)
        const project = state.projects[index]
        if (path === `/api/projects/${slug}` && method === 'GET')
          return project ? reply(project) : reply({ error: '项目不存在' }, 404)
        if (project) {
          if (path.endsWith('/changes') && method === 'GET')
            return reply({
              changes: [
                { path: 'new.css', kind: 'added', beforeBytes: 0, afterBytes: 100 },
                { path: 'index.html', kind: 'modified', beforeBytes: 200, afterBytes: 200 },
                { path: 'old.css', kind: 'deleted', beforeBytes: 30, afterBytes: 0 },
              ],
            })

          if (path.endsWith('/draft/publish') && method === 'POST') {
            if (
              body.draftId !== project.draft?.id ||
              body.expectedId !== (project.deployments?.[0]?.id ?? '')
            )
              return reply({ error: '项目版本已发生变化，请刷新后重试' }, 409)
            project.deployments = [
              { ...project.draft!, status: 'succeeded' },
              ...(project.deployments ?? []).slice(0, 1),
            ]
            delete project.draft
            if (project.status === 'draft') project.status = 'online'
            project.updatedAt = new Date().toISOString()
            return reply(project)
          }
          if (path.endsWith('/draft') && method === 'DELETE') {
            if (url.searchParams.get('draftId') !== project.draft?.id)
              return reply({ error: '草稿已变化' }, 409)
            delete project.draft
            return reply(project)
          }
          if (path === `/api/projects/${slug}` && method === 'DELETE') {
            state.projects.splice(index, 1)
            return route.fulfill({ status: 204 })
          }
          if (path.endsWith('/files') && method === 'GET') {
            if (state.filesError) return reply({ error: '项目版本已发生变化，请刷新后重试' }, 409)
            return reply({
              files:
                url.searchParams.get('deploymentId') === 'previous-version'
                  ? [
                      { path: 'index.html', bytes: 100 },
                      { path: 'old.css', bytes: 40 },
                    ]
                  : [
                      { path: 'index.html', bytes: 100 },
                      { path: 'assets/main.js', bytes: 200 },
                      { path: 'assets/nested/theme.css', bytes: 30 },
                      { path: '<script>alert(1)</script>.txt', bytes: 12 },
                    ],
            })
          }
          if (path === `/api/projects/${slug}` && method === 'PATCH') {
            if (state.editError)
              return reply({ error: '项目版本已发生变化，请刷新项目列表后重试' }, 409)
            state.projects[index] = { ...project, ...body, updatedAt: '2026-10-01T08:00:00Z' }
            return reply(state.projects[index])
          }
          if (path.endsWith('/access') && method === 'PUT') {
            if (state.accessError) return reply({ error: '模拟失败，请重试' }, 500)
            project.status = body.paused ? 'paused' : 'online'
            project.updatedAt = '2026-10-01T08:00:00Z'
            return reply(project)
          }
          if (path.endsWith('/export') && method === 'GET') {
            if (state.exportError)
              return reply({ error: '服务器空间不足，暂时无法生成导出文件' }, 507)
            return route.fulfill({
              status: 200,
              contentType: 'application/zip',
              headers: { 'Content-Length': String(zip.length) },
              body: zip,
            })
          }
          if (path.endsWith('/deployments') && method === 'POST') {
            project.deployments = [
              {
                id: 'updated-version',
                fileName: 'site.zip',
                status: 'succeeded',
                createdAt: date,
                files: { bytes: 8192, count: 4 },
              },
              project.deployments![0],
            ]
            project.updatedAt = '2026-10-01T08:00:00Z'
            return reply(project)
          }
          if (path.endsWith('/rollback') && method === 'POST') {
            project.deployments = [project.deployments![1], project.deployments![0]]
            return reply(project)
          }
        }
        if (path.startsWith('/api/users/') && path.endsWith('/role') && method === 'PUT') {
          const input = request.postDataJSON() as { role: 'admin' | 'user'; expectedRole: string }
          const target = state.users.find((u) => path === `/api/users/${u.id}/role`)
          if (state.role !== 'superadmin') return reply({ error: '禁止修改角色' }, 403)
          if (!target) return reply({ error: '用户不存在' }, 404)
          if (target.role !== input.expectedRole) return reply({ error: '角色已变化，请刷新' }, 409)
          target.role = input.role
          return reply(target)
        }
        if (path === '/api/users' && method === 'POST') {
          const user: AuthUser = {
            id: `user-${state.users.length}`,
            role: body.role === 'admin' && state.role === 'superadmin' ? 'admin' : 'user',
            email: body.email,
            createdAt: date,
          }
          state.users.push(user)
          return reply(
            { ...user, invitation: body.sendInvitation ? state.invitation : 'not_requested' },
            201,
          )
        }
        if (path === '/api/users' && method === 'GET')
          return reply({ users: state.users, invitationLoginUrl: 'https://example.com/login' })
        if (path === '/api/activity' && method === 'GET') {
          const query = Object.fromEntries(url.searchParams)
          state.logQueries.push(query)
          const page = Number(query.page || 1),
            pageSize = Number(query.pageSize || 50),
            total = query.slug ? 1 : 125
          const events = Array.from(
            { length: Math.max(0, Math.min(pageSize, total - (page - 1) * pageSize)) },
            (_, i) => ({
              id: `event-${(page - 1) * pageSize + i + 1}`,
              message: `记录 ${(page - 1) * pageSize + i + 1}`,
              action: 'pause',
              actor: admin.email,
              slug: query.slug || 'demo',
              status: 'succeeded',
              durationMs: 10,
              createdAt: date,
            }),
          )
          return reply({ events, total, page, pageSize })
        }
        if (path === '/api/system' && method === 'GET')
          return reply({
            cpuPercent: 6.5,
            cpuCores: 2,
            memoryTotalBytes: 2 * 1024 ** 3,
            memoryAvailableBytes: 1.2 * 1024 ** 3,
            memoryUsedPercent: 40,
            uptimeSeconds: 548971,
            diskTotalBytes: 40 * 1024 ** 3,
            diskFreeBytes: 25 * 1024 ** 3,
            diskUsedPercent: 37.5,
          })
        if (path === '/api/backups/status' && method === 'GET')
          return state.backupError
            ? reply({ error: '备份状态暂时无法读取，请检查备份任务' }, 503)
            : reply(state.backup)
        state.unexpected.push(`${method} ${path}`)
        return reply({ error: 'Unexpected mock endpoint' }, 501)
      })
      await use(state)
      expect(state.unexpected, '所有请求必须匹配本机测试的模拟接口').toEqual([])
    },
    { auto: true },
  ],
})
export { expect }
