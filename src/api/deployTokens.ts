import { http } from '../lib/http'
import type { DeployToken, TokenInput } from '../types/deployToken'
export type { DeployToken, TokenInput } from '../types/deployToken'

// tokenPath 统一编码项目标识，凭据管理使用现有登录会话。
function tokenPath(slug: string) {
  return `/api/projects/${encodeURIComponent(slug)}/deploy-tokens`
}

// listDeployTokens 只获取元数据，已有凭据不可再次读取。
export async function listDeployTokens(slug: string, signal?: AbortSignal) {
  const { data } = await http.get<{ tokens: DeployToken[] }>(tokenPath(slug), { signal })
  return data.tokens
}

// createDeployToken 创建指定权限的项目凭据，仅本次响应包含原文。
export async function createDeployToken(slug: string, input: TokenInput) {
  const { data } = await http.post<{ token: DeployToken; secret: string }>(tokenPath(slug), input)
  return data
}

// revokeDeployToken 撤销后续请求，不影响已发布内容。
export async function revokeDeployToken(slug: string, id: string) {
  await http.delete(`${tokenPath(slug)}/${encodeURIComponent(id)}`)
}
