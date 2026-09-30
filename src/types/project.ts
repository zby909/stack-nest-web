export type Deployment = {
  id: string
  status: string
  fileName: string
  createdAt: string
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
  deployments?: Deployment[]
}

export type ProjectListResponse = {
  projects: Project[]
}

export type CreateProjectForm = {
  name: string
  slug?: string
  description?: string
}
