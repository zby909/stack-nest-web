import { http } from '../lib/http'
import type { ActivityEvent, StorageStatus, SystemStatus } from '../types/operations'

// getStorage 查询磁盘状态和服务端的统一上传限制。
export async function getStorage() {
  const { data } = await http.get<StorageStatus>('/api/storage', { timeout: 10_000 })
  return data
}

// getSystem 查询仅管理员可见的主机与数据卷状态。
export async function getSystem() {
  const { data } = await http.get<SystemStatus>('/api/system')
  return data
}

// listActivity 查询最近一百条业务操作记录。
export async function listActivity() {
  const { data } = await http.get<{ events: ActivityEvent[] }>('/api/activity')
  return data.events
}
