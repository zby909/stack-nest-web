export type Deployment = {
  notes?: string
  previewUrl?: string
  id: string
  status: string
  fileName: string
  createdAt: string
  files?: { bytes: number; count: number }
}

export type Project = {
  id: string
  ownerId: string
  ownerEmail: string
  name: string
  slug: string
  description?: string
  status: string
  siteUrl: string
  createdAt: string
  updatedAt: string
  draft?: Deployment
  deployments?: Deployment[]
}

export type ProjectListResponse = {
  projects: Project[]
}

export type CreateProjectForm = {
  notes?: string
  name: string
  slug?: string
  description?: string
}
