import { http } from '../lib/http'

export type PublishedFile = { path: string; bytes: number }

// listProjectFiles 指定部署版本，关闭弹窗或切换版本时可取消旧请求。
export async function listProjectFiles(slug: string, deploymentId: string, signal: AbortSignal) {
  const { data } = await http.get<{ files: PublishedFile[] }>(
    `/api/projects/${encodeURIComponent(slug)}/files`,
    { params: { deploymentId }, signal },
  )
  return data.files
}
