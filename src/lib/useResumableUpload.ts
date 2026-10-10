import { useCallback, useEffect, useRef, useState } from 'react'
import {
  confirmUpload,
  discardUpload,
  uploadProject,
  type UploadProgress,
  type UploadSession,
  type UploadTarget,
  type UploadStatus,
} from '../api/uploads'
import { getErrorMessage } from './format'
import { rememberRecovery, type UploadRecovery } from './uploadRecovery'

// useResumableUpload 统一创建和更新的暂停、恢复、清理与离开提醒。
export function useResumableUpload(userId: string) {
  const [state, setState] = useState<UploadProgress>({ phase: 'idle', percent: 0 })
  const [error, setError] = useState('')
  const [discarding, setDiscarding] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [recovery, setRecovery] = useState<UploadRecovery | null>(null)
  const [readyToComplete, setReadyToComplete] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const session = useRef<UploadSession | undefined>(undefined)
  const mounted = useRef(true)
  const busy = ['hashing', 'uploading', 'retrying', 'publishing'].includes(state.phase)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      controller.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (!busy) return
    // warn 在刷新或关闭时提示仍有传输或发布，刷新后须重新选择原文件。
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  // restore 恢复原任务参数，进度和有效期使用刚查询到的服务端状态。
  const restore = useCallback(
    (record: UploadRecovery, status: UploadStatus) => {
      if (controller.current || record.userId !== userId) return
      const current = { ...record, offset: status.offset, expiresAt: status.expiresAt }
      session.current = current
      setHasSession(true)
      setRecovery(current)
      setReadyToComplete(status.offset === status.size)
      setState({ phase: 'paused', percent: Math.floor((status.offset * 100) / status.size) })
      setError('')
      rememberRecovery(current)
    },
    [userId],
  )

  // notify 同步传输状态，文件已全部接收后允许直接确认结果。
  const notify = (next: UploadProgress) => {
    if (!mounted.current) return
    setState(next)
    if (next.phase === 'publishing') setReadyToComplete(true)
  }

  // run 统一处理暂停与请求失败，始终保留可供重试的原任务编号。
  const run = async (
    work: (signal: AbortSignal) => Promise<import('../types/project').Project>,
  ) => {
    if (controller.current) return null
    const active = new AbortController()
    controller.current = active
    setError('')
    try {
      const project = await work(active.signal)
      if (mounted.current) {
        setHasSession(false)
        setRecovery(null)
        setReadyToComplete(false)
      }
      session.current = undefined
      return project
    } catch (failure) {
      if (mounted.current) {
        setState((current) => ({ ...current, phase: active.signal.aborted ? 'paused' : 'error' }))
        if (!active.signal.aborted)
          setError(getErrorMessage(failure, '连接中断或处理结果尚待确认，请继续原上传以确认结果'))
      }
      return null
    } finally {
      controller.current = null
    }
  }

  // start 失败时保留会话，恢复任务时要求文件和参数与原上传完全一致。
  const start = (file: File, target: UploadTarget) =>
    run((signal) =>
      uploadProject(
        userId,
        file,
        target,
        signal,
        notify,
        (next) => {
          session.current = next
          if (mounted.current) setHasSession(true)
        },
        session.current,
        recovery ?? undefined,
      ),
    )

  // complete 直接确认已传完的任务，不重新传输或创建另一版本。
  const complete = () => {
    if (!session.current || !readyToComplete) return Promise.resolve(null)
    const current = session.current
    return run((signal) => confirmUpload(current, signal, notify))
  }

  // pause 只中断传输，已完成的分片继续保留。
  const pause = () => {
    if (state.phase !== 'publishing') controller.current?.abort()
  }
  // reset 清空当前弹窗状态，本机保存的恢复线索保留至成功或主动放弃。
  const reset = () => {
    if (!controller.current) {
      setState({ phase: 'idle', percent: 0 })
      setError('')
      session.current = undefined
      setHasSession(false)
      setRecovery(null)
      setReadyToComplete(false)
    }
  }
  // discard 先确认服务端删除成功再忘记会话，网络错误时仍可重试清理。
  const discard = async () => {
    if (!session.current || busy || discarding) return
    setDiscarding(true)
    try {
      await discardUpload(session.current)
      reset()
    } catch (failure) {
      setError(getErrorMessage(failure, '暂时无法放弃上传，请重试'))
    } finally {
      setDiscarding(false)
    }
  }
  return {
    ...state,
    error,
    busy,
    discarding,
    hasSession,
    recovery,
    readyToComplete,
    restore,
    complete,
    start,
    pause,
    reset,
    discard,
  }
}
