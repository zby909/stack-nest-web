export type BuildInfo = { version: string; revision: string }

export type DiagnosticReport = {
  checks: { name: string; status: 'pass' | 'warn' | 'fail'; message: string }[]
  failed: boolean
  checkedAt: string
  durationMs: number
}

export type StorageStatus = {
  totalBytes?: number
  freeBytes?: number
  usedPercent?: number
  maxUsedPercent?: number
  uploadAllowed: boolean
  reason: string
  maxUploadBytes: number
  maxExpandedBytes: number
  maxFiles: number
  reservedUploadBytes?: number
}

export type SystemStatus = {
  cpuPercent: number
  cpuCores: number
  memoryTotalBytes: number
  memoryAvailableBytes: number
  memoryUsedPercent: number
  uptimeSeconds: number
  diskTotalBytes: number
  diskFreeBytes: number
  diskUsedPercent: number
}

export type ActivityEvent = {
  id: string
  createdAt: string
  action:
    | 'upload'
    | 'update'
    | 'rollback'
    | 'delete'
    | 'edit'
    | 'export'
    | 'pause'
    | 'resume'
    | 'draft'
    | 'publish'
    | 'discard'
    | 'app-deploy'
    | 'app-start'
    | 'app-stop'
    | 'app-restart'
    | 'app-delete'
    | 'network'
    | 'app-limits'
    | 'user-add'
    | 'user-role'
    | 'token-create'
    | 'token-revoke'
  tokenName?: string
  tokenId?: string
  actor: string
  slug?: string
  fileName?: string
  archiveBytes: number
  expandedBytes: number
  fileCount: number
  status: 'succeeded' | 'failed'
  message: string
  durationMs: number
}

export type BackupStatus = {
  state: 'not_configured' | 'never' | 'running' | 'succeeded' | 'failed' | 'interrupted'
  lastAttempt?: { startedAt: string; finishedAt?: string; stage: string }
  lastSuccess?: { createdAt: string; databaseBytes: number; filesBytes: number; totalBytes: number }
  retainedCount: number
  retainedBytes: number
  overdue: boolean
}

export type ActivityQuery = {
  page: number
  pageSize: number
  slug?: string
  action?: ActivityEvent['action']
  status?: ActivityEvent['status']
  actor?: string
  q?: string
  from?: string
  to?: string
}

export type ActivityPage = {
  events: ActivityEvent[]
  total: number
  page: number
  pageSize: number
}
