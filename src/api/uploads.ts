import axios from 'axios'
import { http } from '../lib/http'
import type { Project } from '../types/project'
import { forgetRecovery, rememberRecovery, type UploadRecovery } from '../lib/uploadRecovery'

export type UploadTarget = {
  preview?: boolean
  notes?: string
  kind: 'create' | 'update'
  name?: string
  description?: string
  slug?: string
  expectedId?: string
}
export type UploadPhase =
  'idle' | 'hashing' | 'uploading' | 'retrying' | 'publishing' | 'paused' | 'error' | 'done'
export type UploadProgress = { phase: UploadPhase; percent: number }
export type UploadSession = { id: string; key: string; userId: string }
export type UploadStatus = {
  id: string
  offset: number
  size: number
  chunkSize: number
  completed: boolean
  expiresAt: string
}
const fingerprints = new WeakMap<File, Promise<string>>()

// digest 使用整个文件的 SHA-256，避免同名同大小文件接错上传记录。
async function digest(file: File) {
  if (!crypto.subtle) throw new Error('断点续传需要通过 HTTPS 或 localhost 访问')
  let pending = fingerprints.get(file)
  if (!pending) {
    pending = file
      .arrayBuffer()
      .then((buffer) => crypto.subtle.digest('SHA-256', buffer))
      .then(toHex)
    fingerprints.set(file, pending)
  }
  return pending
}

// toHex 输出固定长度的十六进制摘要。
function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

// rememberSession 存储不可执行的会话编号；隐私模式拒绝存储时仍可在本页续传。
function rememberSession(key: string, userId: string, fallback?: UploadSession) {
  let id = fallback?.key === key ? fallback.id : ''
  try {
    id ||= localStorage.getItem(key) ?? ''
  } catch {
    /* 继续使用内存状态。 */
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))
    id = crypto.randomUUID()
  try {
    localStorage.setItem(key, id)
  } catch {
    /* 不影响当前页面上传。 */
  }
  return { id, key, userId }
}

// forgetSession 成功或主动放弃后移除本机恢复线索。
function forgetSession(session: UploadSession) {
  forgetRecovery(session)
}

// retryable 只重试网络中断、进度冲突和暂时繁忙，权限及内容错误必须交给用户处理。
function retryable(error: unknown) {
  return (
    axios.isAxiosError(error) &&
    !axios.isCancel(error) &&
    (!error.response || [408, 409, 429, 502, 503, 504].includes(error.response.status))
  )
}

// waitRetry 支持立即暂停重试等待，避免关闭页面后继续发送分片。
function waitRetry(delay: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted()
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, delay)
    // abort 清理计时器并向上传循环传递取消。
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('已暂停', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
  })
}

// checkStatus 防止异常响应让客户端死循环或切片越界。
function checkStatus(status: UploadStatus, size: number, id: string) {
  if (
    status.id !== id ||
    status.size !== size ||
    !Number.isSafeInteger(status.offset) ||
    status.offset < 0 ||
    status.offset > size ||
    status.chunkSize !== 4 * 1024 * 1024 ||
    typeof status.completed !== 'boolean' ||
    !Number.isFinite(Date.parse(status.expiresAt))
  )
    throw new Error('服务器返回的上传进度无效')
  return status
}

// uploadProject 以服务器已提交偏移为准顺序传片，并用同一会话编号重试发布。
export async function uploadProject(
  userId: string,
  file: File,
  target: UploadTarget,
  signal: AbortSignal,
  notify: (state: UploadProgress) => void,
  onSession: (session: UploadSession) => void,
  previous?: UploadSession,
  recovery?: UploadRecovery,
) {
  notify({ phase: 'hashing', percent: 0 })
  const sha256 = await digest(file)
  signal.throwIfAborted()
  const normalized = {
    preview: target.preview ?? false,
    notes: target.notes?.trim() ?? '',
    kind: target.kind,
    name: target.name?.trim() ?? '',
    description: target.description?.trim() ?? '',
    slug: target.slug ?? '',
    expectedId: target.expectedId ?? '',
    fileName: file.name,
    size: file.size,
    sha256,
  }
  const identity = new TextEncoder().encode(JSON.stringify([userId, normalized]))
  const key = `stacknest:upload:${toHex(await crypto.subtle.digest('SHA-256', identity))}`
  signal.throwIfAborted()
  if (
    (previous && previous.key !== key) ||
    (recovery &&
      (recovery.userId !== userId ||
        recovery.key !== key ||
        recovery.fileName !== file.name ||
        recovery.size !== file.size ||
        recovery.sha256 !== sha256))
  )
    throw new Error('选中的文件与原上传不一致，请重新选择原文件；原上传进度仍保留。')
  const session = rememberSession(key, userId, previous)
  let saved: UploadRecovery = {
    ...session,
    target: normalized,
    fileName: file.name,
    size: file.size,
    sha256,
    offset: recovery?.offset ?? 0,
    expiresAt: recovery?.expiresAt ?? new Date(Date.now() + 86400_000).toISOString(),
    savedAt: Date.now(),
  }
  // checkpoint 只保存服务端确认的偏移，不保存浏览器发出但尚未确认的进度。
  const checkpoint = (next: UploadStatus) => {
    saved = { ...saved, offset: next.offset, expiresAt: next.expiresAt }
    rememberRecovery(saved)
  }
  rememberRecovery(saved)
  onSession(session)
  const path = `/api/uploads/${encodeURIComponent(session.id)}`
  let status = checkStatus(
    (await http.post<UploadStatus>('/api/uploads', { id: session.id, ...normalized }, { signal }))
      .data,
    file.size,
    session.id,
  )
  checkpoint(status)
  let failures = 0
  while (status.offset < file.size && !status.completed) {
    signal.throwIfAborted()
    const offset = status.offset
    notify({ phase: 'uploading', percent: Math.floor((offset * 100) / file.size) })
    try {
      status = checkStatus(
        (
          await http.patch<UploadStatus>(path, file.slice(offset, offset + status.chunkSize), {
            signal,
            timeout: 5 * 60_000,
            headers: {
              'Content-Type': 'application/octet-stream',
              'Upload-Offset': String(offset),
            },
            onUploadProgress: ({ loaded }) =>
              notify({
                phase: 'uploading',
                percent: Math.min(99, Math.floor(((offset + loaded) * 100) / file.size)),
              }),
          })
        ).data,
        file.size,
        session.id,
      )
      if (status.offset <= offset) throw new Error('服务器没有推进上传进度，请稍后继续')
      checkpoint(status)
      failures = 0
    } catch (error) {
      if (!retryable(error) || ++failures > 3) throw error
      notify({ phase: 'retrying', percent: Math.floor((offset * 100) / file.size) })
      await waitRetry(failures * 1500, signal)
      status = checkStatus(
        (await http.get<UploadStatus>(path, { signal })).data,
        file.size,
        session.id,
      )
      checkpoint(status)
    }
  }
  return confirmUpload(session, signal, notify)
}

// getUploadStatus 恢复入口查询真实进度，不依据浏览器保存的百分比继续传输。
export async function getUploadStatus(record: UploadRecovery, signal?: AbortSignal) {
  const { data } = await http.get<UploadStatus>(`/api/uploads/${encodeURIComponent(record.id)}`, {
    signal,
    timeout: 15_000,
  })
  return checkStatus(data, record.size, record.id)
}

// confirmUpload 文件已传完时无需重新选文件，用原任务编号确认已开始的处理结果。
export async function confirmUpload(
  session: UploadSession,
  signal: AbortSignal,
  notify: (state: UploadProgress) => void,
) {
  const path = `/api/uploads/${encodeURIComponent(session.id)}`
  notify({ phase: 'publishing', percent: 100 })
  for (let attempt = 0; ; attempt++) {
    try {
      const { data } = await http.post<Project>(`${path}/complete`, null, {
        signal,
        timeout: 6 * 60_000,
      })
      forgetSession(session)
      notify({ phase: 'done', percent: 100 })
      return data
    } catch (error) {
      // 发布可能已提交，始终重试同一会话，禁止重新创建或覆盖新版本。
      if (!retryable(error) || attempt >= 2) throw error
      await waitRetry(1500 * (attempt + 1), signal)
    }
  }
}

// discardUpload 删除临时记录，已成功发布的项目不会被删除。
export async function discardUpload(session: UploadSession) {
  await http.delete(`/api/uploads/${encodeURIComponent(session.id)}`, { timeout: 15_000 })
  forgetSession(session)
}
