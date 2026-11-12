import { useCallback, useEffect, useRef } from 'react'

type Refresh = () => Promise<void>

// usePolling 串行刷新可见页面；不设间隔时仅初次和手动读取，版本变化会取消过期请求。
export function usePolling(
  load: (signal: AbortSignal) => Promise<void>,
  intervalMs: number | null,
  enabled = true,
  revision = 0,
) {
  const runRef = useRef<Refresh | null>(null)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending: Promise<void> | null = null
    let initialRead = true

    // run 等本次请求结束再计时，防止慢请求与手动刷新叠加。
    const run: Refresh = () => {
      clearTimeout(timer)
      if (controller.signal.aborted || document.hidden) return Promise.resolve()
      if (pending) return pending
      initialRead = false
      pending = load(controller.signal).finally(() => {
        pending = null
        if (intervalMs !== null && !controller.signal.aborted && !document.hidden)
          timer = setTimeout(() => void run(), intervalMs)
      })
      return pending
    }

    // onVisibility 恢复自动刷新或补上隐藏期间尚未开始的首次读取。
    const onVisibility = () => {
      clearTimeout(timer)
      if (!document.hidden && (intervalMs !== null || initialRead)) void run()
    }

    runRef.current = run
    document.addEventListener('visibilitychange', onVisibility)
    void run()
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      runRef.current = null
    }
  }, [load, intervalMs, enabled, revision])

  // refresh 为按钮与操作完成后的更新提供稳定入口。
  return useCallback(() => runRef.current?.() ?? Promise.resolve(), [])
}
