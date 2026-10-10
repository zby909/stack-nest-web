export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'user'
  createdAt: string
}

export interface UserListResponse {
  users: AuthUser[]
  invitationLoginUrl?: string
}

export interface AddUserResponse extends AuthUser {
  invitation: 'not_requested' | 'sent' | 'failed'
}
