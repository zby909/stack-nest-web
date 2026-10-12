import { http } from '../lib/http'
import type { AppAction, AppInput, AppList, AppView, AppLimitsView } from '../types/app'

// listApps 读取有权限的应用，不把敏感配置放进浏览器存储。
export async function listApps(signal?: AbortSignal) {
  return (await http.get<AppList>('/api/apps', { signal })).data
}
// getApp 详情页仅读取指定且有权限的应用及操作所需的公开限制。
export async function getApp(id: string, signal?: AbortSignal) {
  return (
    await http.get<AppView & Pick<AppList, 'available' | 'limits'>>(`/api/apps/${id}`, { signal })
  ).data
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

// appLimits 只有超管可读取全实例预留量和可配置预算上限。
export async function appLimits(signal?: AbortSignal) {
  return (await http.get<AppLimitsView>('/api/apps/limits', { signal })).data
}

// updateAppLimits 传递配置版本，防止旧弹窗覆盖其他超管修改。
export async function updateAppLimits(input: {
  maxApps: number
  totalMemoryMiB: number
  expectedRevision: number
}) {
  return (await http.put<AppLimitsView>('/api/apps/limits', input)).data
}
