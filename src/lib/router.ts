import { useSyncExternalStore } from 'react'

export type Page = 'projects' | 'apps' | 'activity' | 'users' | 'system' | 'network'

const navigationEvent = 'stacknest:navigate'

// navigate 更新同源页面地址，并通知所有使用路由的组件。
export function navigate(path: string, replace = false) {
  if (window.location.pathname === path) return
  window.history[replace ? 'replaceState' : 'pushState'](null, '', path)
  window.dispatchEvent(new Event(navigationEvent))
}

// subscribe 同时监听应用导航和浏览器前进、后退。
function subscribe(listener: () => void) {
  window.addEventListener(navigationEvent, listener)
  window.addEventListener('popstate', listener)
  return () => {
    window.removeEventListener(navigationEvent, listener)
    window.removeEventListener('popstate', listener)
  }
}

// getPathname 提供当前 URL 路径给 React 外部状态订阅。
function getPathname() {
  return window.location.pathname
}

// usePathname 在浏览器导航时同步刷新页面内容。
export function usePathname() {
  return useSyncExternalStore(subscribe, getPathname)
}

// pageFromPath 将固定的管理端地址映射为页面。
export function pageFromPath(path: string): Page | null {
  if (projectRoute(path)) return 'projects'
  if (appRoute(path)) return 'apps'
  switch (path) {
    case '/projects':
      return 'projects'
    case '/apps':
      return 'apps'
    case '/activity':
      return 'activity'
    case '/users':
      return 'users'
    case '/system':
      return 'system'
    case '/network':
      return 'network'
    default:
      return null
  }
}

// appRoute 使用应用 UUID 区分详情，日志页具有独立可收藏地址。
export function appRoute(path: string): { id: string; tab: 'overview' | 'logs' } | null {
  const match =
    /^\/apps\/([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})(?:\/(overview|logs))?$/.exec(path)
  return match ? { id: match[1], tab: match[2] === 'logs' ? 'logs' : 'overview' } : null
}

export type ProjectTab = 'overview' | 'versions' | 'files' | 'activity' | 'settings'

// projectRoute 验证详情页与标签页地址，保留可刷新、分享及前后退的真实路由。
export function projectRoute(path: string): { slug: string; tab: ProjectTab } | null {
  const match =
    /^\/projects\/([a-z0-9](?:[a-z0-9-]{0,50}[a-z0-9])?)(?:\/(overview|versions|files|activity|settings))?$/.exec(
      path,
    )
  return match ? { slug: match[1], tab: (match[2] ?? 'overview') as ProjectTab } : null
}
