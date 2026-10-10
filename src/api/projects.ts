import type { Project, ProjectListResponse } from '../types/project'
import { http } from '../lib/http'
import axios from 'axios'

// 获取静态项目列表。
export async function listProjects() {
  const { data } = await http.get<ProjectListResponse>('/api/projects')
  return data.projects ?? []
}

// 删除项目以及后端关联的发布文件。
export async function deleteProject(slug: string) {
  await http.delete(`/api/projects/${encodeURIComponent(slug)}`)
}

// 在原网址恢复上一版，并将操作前的当前版保留为新的上一版。
export async function rollbackProject(slug: string, currentId: string) {
  const { data } = await http.post<Project>(
    `/api/projects/${encodeURIComponent(slug)}/rollback`,
    null,
    { headers: { 'If-Match': JSON.stringify(currentId) }, timeout: 60_000 },
  )
  return data
}

// editProject 校验页面更新时间，仅保存项目名称与说明。
export async function editProject(project: Project, values: { name: string; description: string }) {
  const { data } = await http.patch<Project>(
    `/api/projects/${encodeURIComponent(project.slug)}`,
    { name: values.name.trim(), description: values.description.trim() },
    { headers: { 'If-Match': JSON.stringify(project.updatedAt) } },
  )
  return data
}

// setProjectAccess 使用项目更新时间避免旧页面覆盖新的访问状态。
export async function setProjectAccess(project: Project, paused: boolean) {
  const { data } = await http.put<Project>(
    `/api/projects/${encodeURIComponent(project.slug)}/access`,
    { paused },
    { headers: { 'If-Match': JSON.stringify(project.updatedAt) } },
  )
  return data
}

// exportProject 获取所选部署的 ZIP，下载取消时终止请求，保留 JSON 错误提示。
export async function exportProject(
  slug: string,
  deploymentId: string,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
) {
  try {
    const { data } = await http.get<Blob>(`/api/projects/${encodeURIComponent(slug)}/export`, {
      params: { deploymentId },
      responseType: 'blob',
      signal,
      timeout: 10 * 60_000,
      onDownloadProgress: ({ loaded, total }) => {
        if (total) onProgress(Math.min(100, Math.round((loaded * 100) / total)))
      },
    })
    return data
  } catch (failure) {
    if (axios.isAxiosError(failure) && failure.response?.data instanceof Blob) {
      const body = failure.response.data
      if (body.size <= 8192 && body.type.includes('application/json')) {
        try {
          failure.response.data = JSON.parse(await body.text())
        } catch {
          // 非法 JSON 沿用统一代理错误提示。
        }
      }
    }
    throw failure
  }
}

// getProject 读取单个详情，服务端独立验证访问权限。
export async function getProject(slug: string, signal?: AbortSignal) {
  const { data } = await http.get<Project>(`/api/projects/${encodeURIComponent(slug)}`, { signal })
  return data
}

// publishDraft 确认草稿与当前正式版本编号，避免过期页面覆盖新内容。
export async function publishDraft(project: Project) {
  const { data } = await http.post<Project>(
    `/api/projects/${encodeURIComponent(project.slug)}/draft/publish`,
    { draftId: project.draft?.id, expectedId: project.deployments?.[0]?.id ?? '' },
    { timeout: 60_000 },
  )
  return data
}

// discardDraft 删除指定草稿，正式版保持不变。
export async function discardDraft(project: Project) {
  const { data } = await http.delete<Project>(
    `/api/projects/${encodeURIComponent(project.slug)}/draft`,
    { params: { draftId: project.draft?.id } },
  )
  return data
}
