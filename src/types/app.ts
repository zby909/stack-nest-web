export type ContainerApp = {
  id: string
  ownerId: string
  ownerEmail: string
  name: string
  slug: string
  image: string
  port: number
  memoryMiB: number
  cpus: number
  dataPath: string
  healthPath?: string
  envKeys: string[]
  hasRegistry: boolean
  generation: number
  status: 'pending' | 'deploying' | 'ready' | 'stopped' | 'error'
  action?: string
  error?: string
  imageId?: string
  createdAt: string
  updatedAt: string
  url: string
}
export type AppProgress = {
  generation: number
  stage: string
  failedStage?: string
  downloadedBytes?: number
  totalBytes?: number
  updatedAt: string
}
export type AppLimitsView = {
  maxApps: number
  totalMemoryMiB: number
  revision: number
  usedApps: number
  allocatedMemoryMiB: number
  maxTotalMemoryMiB: number
}
export type DiskArea = {
  usedBytes?: number
  limitBytes?: number
  usedInodes?: number
  limitInodes?: number
  source: 'xfs' | 'docker-estimate' | 'quota-disabled' | 'unavailable'
}
export type AppView = {
  progress?: AppProgress
  app: ContainerApp
  runtime?: {
    state: string
    oomKilled: boolean
    exitCode: number
    containerId: string
    imageId: string
    health?: 'healthy' | 'unhealthy' | 'stopped'
    healthCheck?: 'tcp' | 'http'
    disk?: { writable: DiskArea; persistent?: DiskArea; sampledAt: string }
    usage?: {
      cpuPercent?: number
      memoryBytes: number
      memoryLimitBytes: number
      pids: number
      sampledAt: string
    }
  }
}
export type AppList = {
  apps: AppView[]
  available: boolean
  limits: { maxApps: number; totalMemoryMiB: number; maxMemoryMiB: number }
}
export type AppInput = {
  name: string
  slug?: string
  image: string
  port: number
  memoryMiB: number
  cpus: number
  dataPath: string
  healthPath?: string
  env: Record<string, string>
  replaceEnv: boolean
  clearRegistry: boolean
  registry?: { username: string; password: string }
  generation?: number
}
export type AppAction = 'start' | 'stop' | 'restart' | 'delete'
