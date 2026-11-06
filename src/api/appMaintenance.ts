import { http } from '../lib/http'
import type { AppDeployment, ImageInventory } from '../types/appMaintenance'

// appHistory 获取当前用户有权查看的最近十次部署摘要。
export async function appHistory(id: string, signal?: AbortSignal) {
  return (
    await http.get<{ deployments: AppDeployment[] }>(`/api/apps/${id}/deployments`, { signal })
  ).data.deployments
}

// dockerImages 按需读取宿主镜像空间，仅超管可访问。
export async function dockerImages(signal?: AbortSignal) {
  return (await http.get<ImageInventory>('/api/apps/images', { signal })).data
}

// deleteDockerImage 按不可变编号清理单个镜像，服务端重新检查清理资格。
export async function deleteDockerImage(id: string) {
  await http.delete(`/api/apps/images/${encodeURIComponent(id)}`)
}
