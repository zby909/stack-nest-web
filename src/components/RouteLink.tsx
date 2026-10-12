import type { MouseEvent, ReactNode } from 'react'
import { navigate } from '../lib/router'

// RouteLink 保留链接的打开新标签页能力，同时让普通点击在应用内导航。
export default function RouteLink({
  to,
  active,
  className,
  children,
  onNavigate,
}: {
  to: string
  active: boolean
  className: string
  children: ReactNode
  onNavigate?: () => void
}) {
  // handleClick 仅拦截未按修饰键的鼠标左键点击。
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    navigate(to)
    onNavigate?.()
  }

  return (
    <a
      href={to}
      aria-current={active ? 'page' : undefined}
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  )
}
