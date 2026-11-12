import { lazy, useEffect, useState } from 'react'
import { Modal } from 'antd'
import AppNavigation from './components/AppNavigation'
import LazyPanel from './components/LazyPanel'
import PageHeading from './components/PageHeading'
import { appRoute, usePathname, type Page } from './lib/router'
import type { AuthUser } from './types/auth'

const ProjectsPage = lazy(() => import('./components/ProjectsPage'))
const DockerApps = lazy(() => import('./components/DockerApps'))
const ActivityLog = lazy(() => import('./components/ActivityLog'))
const SystemOverview = lazy(() => import('./components/SystemOverview'))
const NetworkSettings = lazy(() => import('./components/NetworkSettings'))
const UserManagement = lazy(() => import('./components/UserManagement'))

const titles: Record<Page, string> = {
  projects: '项目',
  apps: 'Docker 应用',
  activity: '操作日志',
  users: '用户邮箱',
  system: '服务器状态',
  network: '网络设置',
}

const headings = {
  apps: {
    heading: '让应用运行起来。',
    description: '填写镜像地址，部署单个 HTTP 服务并管理运行状态。',
  },
  activity: { heading: '每次操作，都有记录。', description: '查看发布结果、失败原因和存储用量。' },
  users: { heading: '管理登录邮箱', description: '只有名单中的邮箱可以接收登录验证码。' },
  system: {
    heading: '服务器运行状态',
    description: '查看 CPU、内存和数据卷空间，数据每 30 秒更新。',
  },
  network: {
    heading: '配置容器网络访问',
    description: '管理局域网保护与允许例外，仅超级管理员可修改。',
  },
}

// App 提供已登录的页面外壳、路由和退出入口。
export default function App({
  user,
  page,
  onLogout,
  loggingOut,
}: {
  user: AuthUser
  page: Page
  onLogout: () => void
  loggingOut: boolean
}) {
  const pathname = usePathname()
  const app = appRoute(pathname)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  useEffect(() => {
    document.title = `${titles[page]} · StackNest`
  }, [page])

  return (
    <div className="grid min-h-dvh grid-cols-1 grid-rows-[auto_1fr] desktop:grid-cols-[14.5rem_minmax(0,1fr)] desktop:grid-rows-1">
      <AppNavigation
        user={user}
        page={page}
        onRequestLogout={() => setShowLogoutConfirm(true)}
        loggingOut={loggingOut}
      />

      <main className="mx-auto w-full max-w-[93.75rem] min-w-0 pt-6 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] desktop:p-8">
        <div key={page} className="page-enter">
          {page !== 'projects' && <PageHeading {...headings[page]} />}
          <LazyPanel>
            {page === 'projects' && <ProjectsPage user={user} />}
            {page === 'apps' && <DockerApps key={app?.id ?? 'list'} user={user} detail={app} />}
            {page === 'users' && <UserManagement user={user} />}
            {page === 'activity' && <ActivityLog />}
            {page === 'network' && <NetworkSettings />}
            {page === 'system' && <SystemOverview user={user} />}
          </LazyPanel>
        </div>
      </main>

      <Modal
        open={showLogoutConfirm}
        centered
        title="退出登录？"
        okText="退出登录"
        cancelText="取消"
        confirmLoading={loggingOut}
        okButtonProps={{ className: 'h-11 sm:h-8' }}
        cancelButtonProps={{ disabled: loggingOut, className: 'h-11 sm:h-8' }}
        closable={!loggingOut}
        keyboard={!loggingOut}
        mask={{ closable: !loggingOut }}
        onOk={onLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      >
        <p>退出后需要重新获取邮箱验证码才能进入管理页面。</p>
      </Modal>
    </div>
  )
}
