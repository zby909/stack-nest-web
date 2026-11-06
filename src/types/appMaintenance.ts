export type AppDeployment = {
  generation: number
  image: string
  imageId?: string
  actorEmail: string
  source: 'web' | 'automation'
  status: 'pending' | 'deploying' | 'succeeded' | 'failed' | 'canceled'
  message?: string
  queuedAt: string
  startedAt?: string
  finishedAt?: string
}

export type DockerImage = {
  id: string
  tags: string[]
  sizeBytes: number
  managed: boolean
  removable: boolean
  reason: string
}

export type ImageInventory = { totalBytes: number; images: DockerImage[] }
