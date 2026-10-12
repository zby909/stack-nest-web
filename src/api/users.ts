import { http } from '../lib/http'
import type { AuthUser, AddUserResponse, UserListResponse } from '../types/auth'

// 管理员查询获准登录的邮箱。
export async function listUsers() {
  const { data } = await http.get<UserListResponse>('/api/users')
  return data
}

// 管理员添加普通用户邮箱，默认不发送邀请。
export async function addUser(
  email: string,
  sendInvitation = false,
  role: 'user' | 'admin' = 'user',
) {
  const { data } = await http.post<AddUserResponse>('/api/users', {
    email,
    sendInvitation,
    ...(role === 'admin' ? { role } : {}),
  })
  return data
}

// changeUserRole 只有超管可修改角色，附带原角色以识别过期确认。
export async function changeUserRole(
  id: string,
  role: 'user' | 'admin',
  expectedRole: 'user' | 'admin',
) {
  return (
    await http.put<AuthUser>(`/api/users/${encodeURIComponent(id)}/role`, { role, expectedRole })
  ).data
}

// 管理员移除普通用户邮箱。
export async function deleteUser(id: string) {
  await http.delete(`/api/users/${encodeURIComponent(id)}`)
}
