import axios from 'axios'

// formatBytes 使用与后端限制一致的二进制单位展示大小。
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KiB', 'MiB', 'GiB', 'TiB']
  let value = bytes / 1024
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`
}

// getErrorMessage 兼容应用 JSON 和代理 HTML 错误，并附上可查日志的请求编号。
export function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    const detail = error.response?.data?.error
    const message =
      typeof detail === 'string'
        ? detail
        : error.response?.status === 413
          ? '文件超过当前访问入口允许的大小，请缩小压缩包后重试'
          : fallback
    const id = error.response?.headers['x-request-id']
    return typeof id === 'string' ? `${message}（请求编号：${id}）` : message
  }
  return error instanceof Error ? error.message : fallback
}
