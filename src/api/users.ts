import { http } from '../lib/http'
import type { AuthUser, UserListResponse } from '../types/auth'

// 管理员查询获准登录的邮箱。
export async function listUsers() {
  const { data } = await http.get<UserListResponse>('/api/users')
  return data.users
}

// 管理员添加普通用户邮箱。
export async function addUser(email: string) {
  const { data } = await http.post<AuthUser>('/api/users', { email })
  return data
}

// 管理员移除普通用户邮箱。
export async function deleteUser(id: string) {
  await http.delete(`/api/users/${encodeURIComponent(id)}`)
}
