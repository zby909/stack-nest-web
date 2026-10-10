import { lazy, useEffect, useState } from 'react'
import axios from 'axios'
import { Alert, Button, Spin } from 'antd'
import { getSession, logout } from '../api/auth'
import { http } from '../lib/http'
import { navigate, pageFromPath, usePathname } from '../lib/router'
import { clearLoginTarget, consumeLoginTarget, rememberLoginTarget } from '../lib/loginRedirect'
import type { AuthUser } from '../types/auth'
import LazyPanel from './LazyPanel'

const App = lazy(() => import('../App'))
const Login = lazy(() => import('./Login'))

// AuthGate 在显示管理内容前确认服务端会话。
function AuthGate() {
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  // 从 HttpOnly Cookie 恢复已登录用户。
  const loadSession = async () => {
    setLoading(true)
    setError('')
    try {
      setUser(await getSession())
    } catch (requestError) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 401) {
        setUser(null)
      } else {
        setError('无法连接服务，请检查网络后重试。')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSession()
  }, [])

  useEffect(() => {
    const interceptor = http.interceptors.response.use(
      (response) => response,
      (requestError: unknown) => {
        if (
          axios.isAxiosError(requestError) &&
          requestError.response?.status === 401 &&
          requestError.config?.url !== '/api/auth/session'
        ) {
          setUser(null)
        }
        return Promise.reject(requestError)
      },
    )
    return () => http.interceptors.response.eject(interceptor)
  }, [])

  // 未登录时保存目标页；已登录后恢复目标页并校验管理员页面权限。
  useEffect(() => {
    if (loading || (error && !user)) return
    if (!user) {
      if (pathname !== '/login') {
        if (pageFromPath(pathname)) rememberLoginTarget(pathname)
        navigate('/login', true)
      }
      return
    }
    if (pathname === '/' || pathname === '/login') {
      const target = consumeLoginTarget()
      const page = pageFromPath(target)
      navigate(
        page && (user.role === 'admin' || (page !== 'users' && page !== 'system'))
          ? target
          : '/projects',
        true,
      )
      return
    }
    const page = pageFromPath(pathname)
    if (!page || (user.role !== 'admin' && (page === 'users' || page === 'system'))) {
      navigate('/projects', true)
    }
  }, [loading, error, user, pathname])

  // 主动撤销服务端会话；失败时保留当前登录状态。
  const handleLogout = async () => {
    setLoggingOut(true)
    setError('')
    try {
      await logout()
      clearLoginTarget()
      navigate('/login', true)
      setUser(null)
    } catch {
      setError('退出登录失败，请重试。')
    } finally {
      setLoggingOut(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-3 text-sm text-dim">
        <Spin /> 正在检查登录状态...
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-5">
        <Alert type="error" showIcon title={error} />
        <Button onClick={() => void loadSession()}>重试</Button>
      </div>
    )
  }

  if (!user) {
    if (pathname !== '/login') return null
    return (
      <LazyPanel>
        <Login onLogin={setUser} />
      </LazyPanel>
    )
  }

  const page = pageFromPath(pathname)
  if (!page || (user.role !== 'admin' && (page === 'users' || page === 'system'))) return null

  return (
    <>
      {error && (
        <Alert
          className="fixed top-4 right-4 left-4 z-50 sm:left-auto sm:max-w-md"
          type="error"
          showIcon
          title={error}
        />
      )}
      <LazyPanel>
        <App user={user} page={page} onLogout={() => void handleLogout()} loggingOut={loggingOut} />
      </LazyPanel>
    </>
  )
}

export default AuthGate
