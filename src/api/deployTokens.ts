import { http } from '../lib/http'
import type { DeployToken, TokenInput } from '../types/deployToken'
export type { DeployToken, TokenInput } from '../types/deployToken'

// tokenPath 统一编码项目标识，凭据管理使用现有登录会话。
function tokenPath(resource: string, kind: 'project' | 'app') {
  return `/api/${kind === 'app' ? 'apps' : 'projects'}/${encodeURIComponent(resource)}/deploy-tokens`
}

// listDeployTokens 只获取元数据，已有凭据不可再次读取。
export async function listDeployTokens(
  resource: string,
  signal?: AbortSignal,
  kind: 'project' | 'app' = 'project',
) {
  const { data } = await http.get<{ tokens: DeployToken[] }>(tokenPath(resource, kind), { signal })
  return data.tokens
}

// createDeployToken 创建指定权限的项目凭据，仅本次响应包含原文。
export async function createDeployToken(
  resource: string,
  input: TokenInput,
  kind: 'project' | 'app' = 'project',
) {
  const body = kind === 'app' ? { name: input.name, expiresInDays: input.expiresInDays } : input
  const { data } = await http.post<{ token: DeployToken; secret: string }>(
    tokenPath(resource, kind),
    body,
  )
  return data
}

// revokeDeployToken 撤销后续请求，不影响已发布内容。
export async function revokeDeployToken(
  resource: string,
  id: string,
  kind: 'project' | 'app' = 'project',
) {
  await http.delete(`${tokenPath(resource, kind)}/${encodeURIComponent(id)}`)
}
