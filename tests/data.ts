import type { AuthUser } from '../src/types/auth.ts'
import type { Project } from '../src/types/project.ts'

export const date = '2026-09-30T08:00:00.123456Z'
export const admin: AuthUser = {
  id: 'admin',
  email: 'admin-with-a-long-email-address@example.com',
  role: 'admin',
  createdAt: date,
}
export const original: Project = {
  id: 'demo',
  ownerId: admin.id,
  ownerEmail: admin.email,
  name: '很长的项目名称，用来验证手机上统计和操作是否能够正常换行',
  slug: 'project-fd2c8041-943c-48ce-b87d-9537fcbc7354',
  description: '当前版和上一版的空间统计应与选定的部署编号一致。',
  status: 'online',
  siteUrl: 'https://example.com/',
  createdAt: date,
  updatedAt: date,
  deployments: [
    {
      id: 'current-version',
      fileName: 'very-long-static-project-output-build-current.zip',
      status: 'succeeded',
      createdAt: date,
      files: { bytes: 2048, count: 3 },
    },
    {
      id: 'previous-version',
      fileName: 'previous.rar',
      status: 'succeeded',
      createdAt: date,
      files: { bytes: 1024, count: 2 },
    },
  ],
}
export const successfulBackup = {
  state: 'succeeded',
  lastAttempt: { startedAt: date, finishedAt: date, stage: 'completed' },
  lastSuccess: { createdAt: date, databaseBytes: 10240, filesBytes: 51200, totalBytes: 61440 },
  retainedCount: 4,
  retainedBytes: 204800,
  overdue: false,
}
