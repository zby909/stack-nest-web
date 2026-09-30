import { http } from '../lib/http'
import type { AuthUser } from '../types/auth'

// 查询当前服务端会话。
export async function getSession() {
  const { data } = await http.get<AuthUser>('/api/auth/session')
  return data
}

// 向已获准登录的邮箱发送一次性验证码。
export async function requestLoginCode(email: string) {
  await http.post('/api/auth/request-code', { email })
}

// 校验验证码并建立浏览器会话。
export async function verifyLoginCode(email: string, code: string) {
  const { data } = await http.post<AuthUser>('/api/auth/verify', { email, code })
  return data
}

// 注销当前服务端会话。
export async function logout() {
  await http.post('/api/auth/logout')
}
