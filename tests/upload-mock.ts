import type { Route } from '@playwright/test'
import type { Project } from '../src/types/project.ts'
import { date, original } from './data.ts'

type Pending = {
  id: string
  size: number
  offset: number
  chunkSize: number
  minChunkSize?: number
  completed: boolean
  expiresAt: string
  input: Record<string, string | number | boolean>
}
export type UploadMock = {
  records: Map<string, Pending>
  failOffset: number | null
  dropResponseOnce: boolean
  dropCompletionOnce: boolean
  publishCount: number
  transportLimit?: number
  legacyChunks?: boolean
}

// mockUploads 模拟服务端已提交偏移；可独立制造分片响应和发布响应丢失。
export async function mockUploads(route: Route, state: UploadMock, projects: Project[]) {
  const request = route.request()
  const path = new URL(request.url()).pathname
  const method = request.method()
  // reply 返回与实际续传接口相同的响应形状。
  const reply = (value: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
  if (path === '/api/uploads' && method === 'POST') {
    const body = request.postDataJSON()
    const target = projects.find((item) => item.slug === body.slug)
    if (!state.records.has(body.id) && body.kind === 'update') {
      if (!target) return reply({ error: '项目不存在' }, 404)
      if (
        (target.deployments?.[0]?.id ?? '') !== body.expectedId ||
        (target.draft?.id ?? '') !== (body.replaceDraftId ?? '')
      )
        return reply({ error: '项目版本已发生变化，请刷新后重试' }, 409)
    }
    const record = state.records.get(body.id) ?? {
      id: body.id,
      size: body.size,
      offset: 0,
      chunkSize: 4 * 1024 ** 2,
      ...(state.legacyChunks ? {} : { minChunkSize: 64 * 1024 }),
      completed: false,
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      input: body,
    }
    state.records.set(body.id, record)
    return reply(record, 201)
  }
  const record = state.records.get(path.split('/')[3])
  if (method === 'DELETE') {
    state.records.delete(path.split('/')[3])
    return route.fulfill({ status: 204 })
  }
  if (!record) return reply({ error: '上传记录不存在或已过期' }, 404)
  if (method === 'GET') return reply(record)
  if (method === 'PATCH') {
    const offset = Number(request.headers()['upload-offset'])
    if (state.transportLimit && (request.postDataBuffer()?.length ?? 0) > state.transportLimit)
      return route.abort('connectionfailed')
    if (state.failOffset === offset) return reply({ error: '模拟暂时断网' }, 503)
    if (offset !== record.offset) return reply({ error: '偏移冲突' }, 409)
    const length = request.postDataBuffer()?.length ?? 0
    if (
      length < Math.min(record.minChunkSize ?? record.chunkSize, record.size - offset) ||
      length > Math.min(record.chunkSize, record.size - offset)
    )
      return reply({ error: '分片长度无效' }, 400)
    record.offset += length
    if (state.dropResponseOnce) {
      state.dropResponseOnce = false
      return route.abort('connectionfailed')
    }
    return reply(record)
  }
  if (path.endsWith('/complete') && method === 'POST') {
    if (record.offset !== record.size) return reply({ error: '文件未传完' }, 409)
    let project = projects.find((item) => item.slug === record.input.slug)
    if (!record.completed) {
      if (record.input.kind === 'create') {
        project = {
          ...structuredClone(original),
          id: `project-${record.id}`,
          name: String(record.input.name),
          slug: String(record.input.slug || 'created-demo'),
          deployments: [],
        }
        projects.push(project)
      }
      if (!project) return reply({ error: '项目不存在' }, 404)
      if (
        record.input.kind === 'update' &&
        ((project.deployments?.[0]?.id ?? '') !== record.input.expectedId ||
          (project.draft?.id ?? '') !== (record.input.replaceDraftId ?? ''))
      )
        return reply({ error: '项目版本已发生变化，请刷新后重试' }, 409)
      const version = {
        id: record.input.replaceDraftId ? 'dep-' + record.id : 'updated-version',
        fileName: String(record.input.fileName),
        status: record.input.preview ? 'draft' : 'succeeded',
        createdAt: date,
        notes: String(record.input.notes ?? ''),
        previewUrl: record.input.replaceDraftId
          ? `https://stack-nest--dep-${record.id}.example.com/`
          : 'https://stack-nest--preview.example.com/',
        files: { bytes: 8192, count: 4 },
      }
      if (record.input.preview) {
        project.draft = version
        if (!project.deployments?.length) project.status = 'draft'
      } else project.deployments = [version, ...(project.deployments ?? []).slice(0, 1)]

      project.updatedAt = '2026-10-01T08:00:00Z'
      record.completed = true
      state.publishCount++
    }
    if (state.dropCompletionOnce) {
      state.dropCompletionOnce = false
      return route.abort('connectionfailed')
    }
    return reply(project)
  }
  return reply({ error: '意外的续传请求' }, 501)
}
