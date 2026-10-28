import { supportedSiteFile } from './siteUpload'
import type { UploadSession, UploadTarget } from '../api/uploads'

export type UploadRecovery = UploadSession & {
  target: UploadTarget
  fileName: string
  size: number
  sha256: string
  offset: number
  expiresAt: string
  savedAt: number
}

export const recoveryEvent = 'stacknest:upload-recovery'
const memory = new Map<string, UploadRecovery[]>()

// recoveryKey 按账号隔离恢复信息，不保存原文件或登录凭据。
function recoveryKey(userId: string) {
  return `stacknest:upload-recovery:v1:${encodeURIComponent(userId)}`
}

// validRecovery 校验浏览器记录形状；实际进度、权限和文件内容仍由服务端确认。
function validRecovery(value: unknown, userId: string): value is UploadRecovery {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<UploadRecovery>
  const target = record.target
  return (
    record.userId === userId &&
    typeof record.id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.id) &&
    typeof record.key === 'string' &&
    /^stacknest:upload:[0-9a-f]{64}$/.test(record.key) &&
    typeof record.fileName === 'string' &&
    record.fileName.length <= 512 &&
    supportedSiteFile(record.fileName) &&
    typeof record.size === 'number' &&
    Number.isSafeInteger(record.size) &&
    record.size > 0 &&
    record.size <= 90 * 1024 ** 2 &&
    typeof record.offset === 'number' &&
    Number.isSafeInteger(record.offset) &&
    record.offset >= 0 &&
    record.offset <= record.size &&
    typeof record.sha256 === 'string' &&
    /^[0-9a-f]{64}$/.test(record.sha256) &&
    typeof record.expiresAt === 'string' &&
    Number.isFinite(Date.parse(record.expiresAt)) &&
    typeof record.savedAt === 'number' &&
    Number.isFinite(record.savedAt) &&
    !!target &&
    (target.kind === 'create' || target.kind === 'update') &&
    ['name', 'description', 'slug', 'notes', 'expectedId', 'replaceDraftId'].every(
      (key) =>
        target[key as keyof UploadTarget] === undefined ||
        typeof target[key as keyof UploadTarget] === 'string',
    ) &&
    (target.preview === undefined || typeof target.preview === 'boolean') &&
    JSON.stringify(target).length <= 24_000
  )
}

// readRecoveries 读取少量元数据；存储受限时退回本页内存，不影响上传。
export function readRecoveries(userId: string): UploadRecovery[] {
  const fallback = memory.get(userId)
  if (fallback) return fallback
  try {
    const raw = localStorage.getItem(recoveryKey(userId))
    if (!raw) return []
    if (raw.length > 200_000) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((value) => validRecovery(value, userId))
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, 8)
  } catch {
    return []
  }
}

// writeRecoveries 同步本页与其他标签页，仅保留有界的恢复线索。
function writeRecoveries(userId: string, records: UploadRecovery[]) {
  const bounded = records.slice(0, 8)
  try {
    if (bounded.length) localStorage.setItem(recoveryKey(userId), JSON.stringify(bounded))
    else localStorage.removeItem(recoveryKey(userId))
    memory.delete(userId)
  } catch {
    memory.set(userId, bounded)
  }
  window.dispatchEvent(new Event(recoveryEvent))
}

// rememberRecovery 保存原始参数和已确认偏移，恢复时不允许改接另一文件或目标。
export function rememberRecovery(record: UploadRecovery) {
  writeRecoveries(record.userId, [
    { ...record, savedAt: Date.now() },
    ...readRecoveries(record.userId).filter((item) => item.id !== record.id),
  ])
}

// forgetRecovery 任务完成或放弃后只清除当前账号的对应恢复记录。
export function forgetRecovery(session: UploadSession) {
  try {
    if (localStorage.getItem(session.key) === session.id) localStorage.removeItem(session.key)
  } catch {
    /* 存储不可用时仍清理本页内存记录。 */
  }
  writeRecoveries(
    session.userId,
    readRecoveries(session.userId).filter((item) => item.id !== session.id),
  )
}

// recoverTarget 从最新项目数据确认原更新任务仍可继续，防止过期页面改写新版本。
export function recoverTarget(record: UploadRecovery, project: import('../types/project').Project) {
  const ownVersion = 'dep-' + record.id
  const alreadyStored =
    project.draft?.id === ownVersion ||
    project.deployments?.some((version) => version.id === ownVersion)
  if (
    !alreadyStored &&
    ((project.deployments?.[0]?.id ?? '') !== record.target.expectedId ||
      (project.draft?.id ?? '') !== (record.target.replaceDraftId ?? ''))
  )
    throw new Error('项目版本已发生变化，请放弃旧上传后重新上传新版本。')
}
