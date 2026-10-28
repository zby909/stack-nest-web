import { http } from '../lib/http'

// downloadDeploySkill 校验下载响应，避免把登录错误或旧后端的 HTML 保存成 ZIP。
export async function downloadDeploySkill(signal: AbortSignal) {
  const { data } = await http.get<Blob>('/api/deploy-tools/skill', {
    responseType: 'blob',
    signal,
    timeout: 30_000,
  })
  if (data.type !== 'application/zip')
    throw new Error('服务器未提供 Skill 下载包，请确认前后端已配套更新')
  return data
}
