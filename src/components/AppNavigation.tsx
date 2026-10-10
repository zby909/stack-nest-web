import { Button } from 'antd'
import RouteLink from './RouteLink'
import ThemeSwitcher from './ThemeSwitcher'
import type { AuthUser } from '../types/auth'
import type { Page } from '../lib/router'

const pages: { page: Page; label: string; mobileLabel: string; adminOnly?: boolean }[] = [
  { page: 'projects', label: '项目', mobileLabel: '项目' },
  { page: 'apps', label: 'Docker 应用', mobileLabel: '应用' },
  { page: 'activity', label: '操作日志', mobileLabel: '日志' },
  { page: 'users', label: '用户邮箱', mobileLabel: '邮箱', adminOnly: true },
  { page: 'system', label: '服务器状态', mobileLabel: '状态', adminOnly: true },
]

// AppNavigation 在桌面使用侧栏，在手机和平板使用顶部导航，统一权限和路由入口。
export default function AppNavigation({
  user,
  page,
  onRequestLogout,
  loggingOut,
}: {
  user: AuthUser
  page: Page
  onRequestLogout: () => void
  loggingOut: boolean
}) {
  const visiblePages = pages.filter((item) => !item.adminOnly || user.role === 'admin')

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-sidebar px-4 py-5.5 desktop:flex">
        <div className="flex items-center gap-3 px-1.5 pt-1 pb-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink font-bold text-panel">
            S
          </div>
          <div>
            <strong className="block text-base font-bold">StackNest</strong>
            <span className="mt-0.5 block text-xs text-dim">项目控制中心</span>
          </div>
        </div>
        <nav className="grid gap-1" aria-label="页面导航">
          {visiblePages.map((item) => (
            <RouteLink
              key={item.page}
              to={`/${item.page}`}
              active={page === item.page}
              className={`rounded-lg p-2.5 text-left text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${page === item.page ? 'bg-nav-active font-semibold text-ink' : 'text-muted hover:bg-nav-active hover:text-ink'}`}
            >
              {item.label}
            </RouteLink>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-line bg-panel p-3">
          <strong className="block truncate text-xs" title={user.email}>
            {user.email}
          </strong>
          <p className="mt-1 text-xs text-dim">{user.role === 'admin' ? '管理员' : '普通用户'}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button className="min-h-11" onClick={onRequestLogout} loading={loggingOut}>
              退出登录
            </Button>
            <ThemeSwitcher compact />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line bg-sidebar pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-3 pl-[max(1rem,env(safe-area-inset-left))] desktop:hidden">
        <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink font-bold text-panel">
              S
            </div>
            <div className="min-w-0">
              <strong className="block text-sm font-bold">StackNest</strong>
              <span className="mt-0.5 block truncate text-xs text-muted" title={user.email}>
                {user.email}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeSwitcher compact />
            <Button
              className="min-h-11"
              onClick={onRequestLogout}
              loading={loggingOut}
              aria-label="退出登录"
            >
              退出
            </Button>
          </div>
        </div>
        <nav
          className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-nav-active p-1"
          aria-label="页面导航"
        >
          {visiblePages.map((item) => (
            <RouteLink
              key={item.page}
              to={`/${item.page}`}
              active={page === item.page}
              className={`flex min-h-11 items-center justify-center rounded-lg px-2 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${page === item.page ? 'bg-panel font-semibold text-ink shadow-sm' : 'text-muted hover:bg-panel hover:text-ink'}`}
            >
              {item.mobileLabel}
            </RouteLink>
          ))}
        </nav>
      </header>
    </>
  )
}
