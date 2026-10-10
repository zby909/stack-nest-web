import { http } from '../lib/http'
import type {
  ActivityPage,
  ActivityQuery,
  BackupStatus,
  StorageStatus,
  SystemStatus,
} from '../types/operations'

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

// listActivity 在所有保留日志中查询当前页，切换筛选或离开页面时可以取消。
export async function listActivity(params: ActivityQuery, signal?: AbortSignal) {
  const { data } = await http.get<ActivityPage>('/api/activity', {
    params,
    signal,
    timeout: 15_000,
  })
  return data
}

// getBackupStatus 获取仅管理员可见的备份摘要。
export async function getBackupStatus() {
  const { data } = await http.get<BackupStatus>('/api/backups/status', { timeout: 10_000 })
  return data
}
