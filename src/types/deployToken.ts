export type DeployToken = {
  id: string
  name: string
  canPublish: boolean
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
  createdBy: string
}

export type TokenInput = { name: string; expiresInDays: number; canPublish: boolean }
