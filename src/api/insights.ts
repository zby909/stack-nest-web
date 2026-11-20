import { http } from '../lib/http'

export type TrafficDay = {
  date: string
  requests: number
  pages: number
  clientErrors: number
  serverErrors: number
}
export type Traffic = { available: boolean; since?: string; updatedAt?: string; days: TrafficDay[] }
export type AppExport = {
  state: 'not_configured' | 'no_backup' | 'preparing' | 'no_data' | 'unsupported' | 'ready'
  createdAt?: string
  bytes?: number
  snapshot?: string
}

// getTraffic 分别读取项目或应用的已授权概况。
export async function getTraffic(kind: 'projects' | 'apps', id: string, signal: AbortSignal) {
  return (await http.get<Traffic>(`/api/${kind}/${encodeURIComponent(id)}/traffic`, { signal }))
    .data
}

// appExportPath 将下载固定到用户看到的备份时间，直接交给浏览器流式下载。
export function appExportPath(id: string, snapshot?: string) {
  const path = `/api/apps/${encodeURIComponent(id)}/data-export`
  return snapshot ? `${path}?download=${encodeURIComponent(snapshot)}` : path
}

// getAppExport 仅读取摘要，不会触发备份或下载。
export async function getAppExport(id: string, signal: AbortSignal) {
  return (await http.get<AppExport>(appExportPath(id), { signal })).data
}
