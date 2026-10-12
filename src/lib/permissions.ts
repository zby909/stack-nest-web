import type { AuthUser } from '../types/auth'
import type { Page } from './router'

// isAdmin 让超管继承普通管理员的页面和项目管理能力。
export function isAdmin(user: AuthUser) {
  return user.role === 'admin' || user.role === 'superadmin'
}

// canOpenPage 统一导航、登录恢复和手工输入路由的权限判定。
export function canOpenPage(user: AuthUser, page: Page) {
  if (page === 'network') return user.role === 'superadmin'
  if (page === 'users' || page === 'system') return isAdmin(user)
  return true
}

// roleLabel 将实际权限显示为一致的中文角色名称。
export function roleLabel(user: AuthUser) {
  return { superadmin: '超级管理员', admin: '管理员', user: '普通用户' }[user.role]
}
