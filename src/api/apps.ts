import { http } from '../lib/http'
import type { AppAction, AppInput, AppList, AppView } from '../types/app'

// listApps 读取有权限的应用，不把敏感配置放进浏览器存储。
export async function listApps(signal?: AbortSignal) {
  return (await http.get<AppList>('/api/apps', { signal })).data
}
// saveApp 将镜像地址与受限配置提交为持久化后台任务。
export async function saveApp(input: AppInput, id?: string) {
  return (
    id
      ? await http.put<AppView>(`/api/apps/${id}`, input)
      : await http.post<AppView>('/api/apps', input)
  ).data
}
// operateApp 传递页面代次，拒绝旧页面覆盖新的操作。
export async function operateApp(view: AppView, action: AppAction) {
  return (
    await http.post<AppView>(`/api/apps/${view.app.id}/actions`, {
      action,
      generation: view.app.generation,
    })
  ).data
}
// appLogs 获取有界的纯文本输出，程序内容不作为 HTML 执行。
export async function appLogs(id: string, signal?: AbortSignal) {
  return (await http.get<{ text: string }>(`/api/apps/${id}/logs`, { signal })).data.text
}
