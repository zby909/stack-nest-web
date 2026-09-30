import type { CreateProjectForm, Project, ProjectListResponse } from '../types/project'
import { http } from '../lib/http'

// 获取静态项目列表。
export async function listProjects() {
  const { data } = await http.get<ProjectListResponse>('/api/projects')
  return data.projects ?? []
}

// 创建并上传一个静态项目。
export async function createProject(
  values: CreateProjectForm,
  file: File,
  onProgress?: (percent: number) => void,
) {
  const form = new FormData()
  form.append('name', values.name)
  if (values.slug) form.append('slug', values.slug)
  if (values.description) form.append('description', values.description)
  form.append('file', file)

  const { data } = await http.post<Project>('/api/projects', form, {
    timeout: 10 * 60_000,
    onUploadProgress: ({ loaded, total }) => {
      if (total) onProgress?.(Math.min(100, Math.round((loaded * 100) / total)))
    },
  })
  return data
}

// 删除项目以及后端关联的发布文件。
export async function deleteProject(slug: string) {
  await http.delete(`/api/projects/${encodeURIComponent(slug)}`)
}

// 更新原项目并携带页面版本，避免旧页面覆盖其他人的新发布。
export async function updateProject(
  slug: string,
  currentId: string,
  file: File,
  onProgress?: (percent: number) => void,
) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await http.post<Project>(
    `/api/projects/${encodeURIComponent(slug)}/deployments`,
    form,
    {
      headers: { 'If-Match': JSON.stringify(currentId) },
      timeout: 10 * 60_000,
      onUploadProgress: ({ loaded, total }) => {
        if (total) onProgress?.(Math.min(100, Math.round((loaded * 100) / total)))
      },
    },
  )
  return data
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
