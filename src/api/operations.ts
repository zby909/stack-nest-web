import { http } from '../lib/http'
import type {
  BuildInfo,
  DiagnosticReport,
  ActivityPage,
  ActivityQuery,
  BackupStatus,
  StorageStatus,
  SystemStatus,
} from '../types/operations'

// getVersion 查询管理员可见的后端构建身份。
export async function getVersion(signal?: AbortSignal) {
  return (await http.get<BuildInfo>('/api/version', { signal, timeout: 10_000 })).data
}

// runDiagnostics 由超管主动发起有时限的只读检查。
export async function runDiagnostics(signal?: AbortSignal) {
  return (
    await http.post<DiagnosticReport>('/api/system/diagnostics', null, { signal, timeout: 35_000 })
  ).data
}

// getStorage 查询磁盘状态和服务端的统一上传限制。
export async function getStorage(signal?: AbortSignal) {
  const { data } = await http.get<StorageStatus>('/api/storage', { signal, timeout: 10_000 })
  return data
}

// getSystem 查询仅管理员可见的主机与数据卷状态。
export async function getSystem(signal?: AbortSignal) {
  const { data } = await http.get<SystemStatus>('/api/system', { signal })
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
export async function getBackupStatus(signal?: AbortSignal) {
  const { data } = await http.get<BackupStatus>('/api/backups/status', { signal, timeout: 10_000 })
  return data
}
