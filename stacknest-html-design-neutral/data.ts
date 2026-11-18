import type { AppList, AppView } from '../src/types/app.ts'
import type { AuthUser } from '../src/types/auth.ts'
import type { Deployment, Project } from '../src/types/project.ts'
import type {
  ActivityEvent,
  DiagnosticReport,
  StorageStatus,
  SystemStatus,
} from '../src/types/operations.ts'
import type { NetworkView } from '../src/types/network.ts'

export const date = '2026-10-12T08:30:00Z'
export const owner: AuthUser = {
  id: 'owner',
  email: 'owner@example.com',
  role: 'superadmin',
  createdAt: date,
}
export const member: AuthUser = {
  id: 'editor',
  email: 'editor@example.com',
  role: 'user',
  createdAt: date,
}

// 示例文件共用封面和样式，只在相邻版本中修改首页，列表统计由同一组文件生成。
function demoVersion(
  slug: string,
  status: string,
  time: string,
  notes: string,
  htmlBytes: number,
  coverBytes: number,
): Deployment {
  const id = slug + '-' + htmlBytes
  const files = [
    { path: 'index.html', bytes: htmlBytes },
    { path: 'assets/main.css', bytes: 1024 },
    { path: 'assets/cover.webp', bytes: coverBytes },
  ]
  filesByVersion.set(id, files)
  return {
    id,
    status,
    fileName: slug + '.zip',
    createdAt: time,
    notes,
    previewUrl: '/__visual/site/' + id,
    files: { count: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) },
  }
}

export const filesByVersion = new Map<string, { path: string; bytes: number }[]>()

export const projects: Project[] = [
  {
    name: '产品介绍页',
    slug: 'landing',
    description: '产品能力、更新计划与联系信息',
    bytes: 1850000,
  },
  {
    name: '团队文档',
    slug: 'handbook',
    description: '开发约定与常用流程',
    bytes: 726000,
  },
  {
    name: '作品预览',
    slug: 'portfolio',
    description: '准备发布的新作品',
    bytes: 4360000,
  },
].map((item) => {
  const version = demoVersion(
    item.slug,
    'succeeded',
    '2026-10-11T08:30:00Z',
    '更新页面内容',
    2400,
    item.bytes,
  )
  const hasDraft = item.slug === 'portfolio'
  return {
    id: item.slug,
    name: item.name,
    slug: item.slug,
    description: item.description,
    status: 'online',
    ownerId: owner.id,
    ownerEmail: owner.email,
    createdAt: '2026-10-10T08:30:00Z',
    updatedAt: date,
    siteUrl: '/__visual/site/' + item.slug,
    deployments: hasDraft
      ? [
          version,
          demoVersion(item.slug, 'succeeded', '2026-10-10T08:30:00Z', '首次发布', 2200, item.bytes),
        ]
      : [version],
    draft: hasDraft
      ? demoVersion(item.slug, 'draft', date, '调整首页排版与作品说明', 2560, item.bytes)
      : undefined,
  }
})

// demoApps 提供可公开的虚构应用及资源采样，不包含真实镜像仓库或环境变量值。
function demoApps(): AppList {
  const apps = [
    {
      id: '0c2d84bb-15a1-492b-938a-83282600c112',
      name: '团队文档 API',
      slug: 'handbook-api',
      image: 'ghcr.io/example/handbook-api:v1.2',
      memoryMiB: 256,
      dataPath: '/app/data',
    },
    {
      id: '0c2d84bb-15a1-492b-938a-83282600c113',
      name: '团队状态页',
      slug: 'status-page',
      image: 'ghcr.io/example/status-page:v1.0',
      memoryMiB: 128,
      dataPath: '',
    },
  ].map((item, index): AppView => ({
    app: {
      ...item,
      ownerId: owner.id,
      ownerEmail: owner.email,
      port: 3000,
      cpus: 0.5,
      healthPath: '/health',
      envKeys: ['NODE_ENV', 'PORT'],
      hasRegistry: false,
      generation: 1,
      status: 'ready',
      createdAt: date,
      updatedAt: date,
      url: `/__visual/site/${item.slug}`,
    },
    runtime: {
      state: 'running',
      health: 'healthy',
      healthCheck: 'http',
      oomKilled: false,
      exitCode: 0,
      containerId: `example-container-${index}`,
      imageId: 'example-image',
      usage: {
        cpuPercent: index === 0 ? 3.8 : 0.6,
        memoryBytes: (index === 0 ? 82 : 28) * 1024 ** 2,
        memoryLimitBytes: item.memoryMiB * 1024 ** 2,
        pids: index === 0 ? 14 : 5,
        sampledAt: date,
      },
      disk: {
        writable: { usedBytes: 128 * 1024 ** 2, limitBytes: 1024 ** 3, source: 'xfs' },
        persistent: item.dataPath
          ? {
              usedBytes: 32 * 1024 ** 2,
              limitBytes: 1024 ** 3,
              usedInodes: 335,
              limitInodes: 100_000,
              source: 'xfs',
            }
          : undefined,
        sampledAt: date,
      },
    },
  }))
  return { apps, available: true, limits: { maxApps: 3, totalMemoryMiB: 2048, maxMemoryMiB: 1024 } }
}

export const appList = demoApps()
export const storage = {
  totalBytes: 40 * 1024 ** 3,
  freeBytes: 25 * 1024 ** 3,
  usedPercent: 37.5,
  maxUsedPercent: 90,
  uploadAllowed: true,
  reason: '',
  maxUploadBytes: 90 * 1024 ** 2,
  maxExpandedBytes: 200 * 1024 ** 2,
  maxFiles: 5000,
} satisfies StorageStatus
export const system: SystemStatus = {
  cpuPercent: 6.5,
  cpuCores: 2,
  memoryTotalBytes: 2 * 1024 ** 3,
  memoryAvailableBytes: Math.round(1.2 * 1024 ** 3),
  memoryUsedPercent: 40,
  uptimeSeconds: 548971,
  diskTotalBytes: storage.totalBytes,
  diskFreeBytes: storage.freeBytes,
  diskUsedPercent: storage.usedPercent,
}
export const diagnostics: DiagnosticReport = {
  checks: [
    { name: 'database', status: 'pass', message: '连接正常，必要数据表存在' },
    { name: 'docker', status: 'pass', message: 'Docker 可达，存储驱动：overlay2' },
    { name: 'quota', status: 'pass', message: '应用可写层与持久化数据已启用硬配额' },
    { name: 'smtp', status: 'pass', message: 'TLS 与 SMTP 认证成功' },
  ],
  failed: false,
  checkedAt: date,
  durationMs: 380,
}
export const network: NetworkView = {
  config: {
    lanInterfaces: ['eth0'],
    blockedCIDRs: ['192.168.1.0/24'],
    allow: [],
    dnsServers: ['1.1.1.1'],
  },
  revision: 'visual-1',
  ready: true,
  checkedAt: date,
  effectiveBlockedCIDRs: ['192.168.1.0/24'],
  interfaces: [{ name: 'eth0', addresses: ['192.168.1.15/24'], eligible: true }],
}
export const events: ActivityEvent[] = (
  [
    {
      id: 'demo-3',
      action: 'draft',
      slug: 'portfolio',
      fileName: 'portfolio.zip',
      message: '已生成待发布版',
    },
    { id: 'demo-2', action: 'app-deploy', slug: 'handbook-api', message: '应用部署成功' },
    {
      id: 'demo-1',
      action: 'publish',
      slug: 'handbook',
      fileName: 'handbook.zip',
      message: '已发布正式版',
    },
  ] as const
).map((event, i) => ({
  ...event,
  actor: owner.email,
  status: 'succeeded',
  createdAt: new Date(Date.parse(date) - i * 3600000).toISOString(),
  archiveBytes: 0,
  expandedBytes: 0,
  fileCount: 0,
  durationMs: 380,
}))
