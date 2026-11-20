import { useCallback, useState } from 'react'
import { Button } from 'antd'
import { appExportPath, getAppExport, type AppExport } from '../api/insights'
import { formatBytes, getErrorMessage } from '../lib/format'
import { usePolling } from '../lib/usePolling'

const descriptions = {
  not_configured: '此应用未配置持久化目录。',
  no_backup: '还没有成功的实例备份。',
  preparing: '最近备份的下载文件尚未就绪。',
  no_data: '该备份中没有此应用的持久化目录。',
  unsupported: '备份中含不支持的链接或特殊文件，无法安全导出此目录。',
  ready: '',
}

// AppDataExport 显示副本时间，下载由浏览器直接写入磁盘。
export default function AppDataExport({ id, path }: { id: string; path: string }) {
  const [value, setValue] = useState<AppExport>()
  const [error, setError] = useState('')
  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        const result = await getAppExport(id, signal)
        if (!signal.aborted) {
          setValue(result)
          setError('')
        }
      } catch (failure) {
        if (!signal.aborted) {
          setValue(undefined)
          setError(getErrorMessage(failure, '读取备份失败'))
        }
      }
    },
    [id],
  )
  const refresh = usePolling(load, null, !!path)
  if (!path) return null
  return (
    <section
      className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-4"
      aria-label="持久化数据导出"
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">导出持久化数据</h3>
        <p className="mt-1 text-xs break-all text-muted">
          {path}
          {value?.createdAt && ` · 备份于 ${new Date(value.createdAt).toLocaleString('zh-CN')}`}
          {value?.bytes ? ` · ${formatBytes(value.bytes)}` : ''}
        </p>
        {(error || value?.state !== 'ready') && (
          <p className="mt-1 text-xs text-muted">
            {error || (value ? descriptions[value.state] : '正在读取备份…')}
          </p>
        )}
      </div>
      {value?.state === 'ready' && value.snapshot ? (
        <Button href={appExportPath(id, value.snapshot)} target="_blank" rel="noopener">
          下载 tar.gz
        </Button>
      ) : (
        <Button size="small" onClick={() => void refresh()}>
          刷新备份
        </Button>
      )}
    </section>
  )
}
