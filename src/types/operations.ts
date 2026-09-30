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
  action: 'upload' | 'update' | 'rollback' | 'delete'
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
