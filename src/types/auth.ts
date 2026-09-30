export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'user'
  createdAt: string
}

export interface UserListResponse {
  users: AuthUser[]
}
