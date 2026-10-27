import { useCallback, useEffect, useRef } from 'react'

type Refresh = () => Promise<void>

// usePolling 串行刷新可见页面，离开后取消请求，手动刷新复用正在进行的请求。
export function usePolling(
  load: (signal: AbortSignal) => Promise<void>,
  intervalMs: number,
  enabled = true,
) {
  const runRef = useRef<Refresh | null>(null)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let pending: Promise<void> | null = null

    // run 等本次请求结束再计时，防止慢请求与手动刷新叠加。
    const run: Refresh = () => {
      clearTimeout(timer)
      if (controller.signal.aborted || document.hidden) return Promise.resolve()
      if (pending) return pending
      pending = load(controller.signal).finally(() => {
        pending = null
        if (!controller.signal.aborted && !document.hidden)
          timer = setTimeout(() => void run(), intervalMs)
      })
      return pending
    }

    // onVisibility 返回页面时立即刷新，隐藏时停止下一次定时任务。
    const onVisibility = () => {
      clearTimeout(timer)
      if (!document.hidden) void run()
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
  }, [load, intervalMs, enabled])

  // refresh 为按钮与操作完成后的更新提供稳定入口。
  return useCallback(() => runRef.current?.() ?? Promise.resolve(), [])
}
