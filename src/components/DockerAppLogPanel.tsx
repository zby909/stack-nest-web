import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Input, Spin } from 'antd'
import { appLogs, appDeploymentLogs } from '../api/apps'
import { getErrorMessage } from '../lib/format'
import { usePolling } from '../lib/usePolling'
import type { AppView } from '../types/app'
import DockerAppReport from './DockerAppReport'

// DockerAppLogPanel 只在可见页面串行刷新，搜索和跟随不改变日志内容或执行其中的代码。
export default function DockerAppLogPanel({
  id,
  generation,
  kind = 'runtime',
  view,
}: {
  id: string
  generation?: number
  kind?: 'runtime' | 'deployment'
  view?: AppView
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [automatic, setAutomatic] = useState(kind === 'runtime')
  const [follow, setFollow] = useState(true)
  const [query, setQuery] = useState('')
  const [updated, setUpdated] = useState('')
  const output = useRef<HTMLPreElement>(null)
  // loadLog 读取当前日志快照，失败时保留上次成功的内容。
  const loadLog = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true)
      try {
        if (kind === 'deployment' && !generation) throw new Error('无法确定任务代次，请刷新后重试')
        const next =
          kind === 'deployment'
            ? await appDeploymentLogs(id, generation!, signal)
            : await appLogs(id, signal)
        if (!signal.aborted) {
          setText(next)
          setError('')
          setUpdated(new Date().toLocaleTimeString('zh-CN'))
        }
      } catch (failure) {
        if (!signal.aborted) setError(getErrorMessage(failure, '日志加载失败'))
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    },
    [id, generation, kind],
  )
  const refresh = usePolling(loadLog, automatic ? 5000 : null)
  const lines = query.trim()
    ? text
        .split('\n')
        .filter((line) => line.toLowerCase().includes(query.trim().toLowerCase()))
        .join('\n')
    : text
  useEffect(() => {
    if (follow && output.current) output.current.scrollTop = output.current.scrollHeight
  }, [lines, follow])
  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-muted">
        {kind === 'deployment'
          ? '候选容器清理前保存的状态与启动日志，最多 256 KiB。仅保留最近一次失败，配置中的敏感值会被隐藏。'
          : '最近 200 行，最多 256 KiB；搜索仅针对当前快照。配置中的敏感值会被隐藏，自动刷新间隔 5 秒。'}
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          className="min-w-40 flex-1"
          aria-label={kind === 'deployment' ? '搜索失败详情' : '搜索运行日志'}
          placeholder="搜索当前日志…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          allowClear
        />
        <Button loading={loading} onClick={() => void refresh()}>
          刷新日志
        </Button>
        {kind === 'deployment' && view && (
          <DockerAppReport view={view} text={text} disabled={loading || !!error || !text} />
        )}
        <Checkbox checked={automatic} onChange={(event) => setAutomatic(event.target.checked)}>
          自动刷新
        </Checkbox>
        <Checkbox checked={follow} onChange={(event) => setFollow(event.target.checked)}>
          跟随最新
        </Checkbox>
      </div>
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          description={text ? '保留上次成功读取的内容。' : undefined}
          className="mb-3"
        />
      )}
      {loading && !text ? (
        <Spin />
      ) : (
        <pre
          ref={output}
          aria-label={kind === 'deployment' ? '失败详情内容' : '运行日志内容'}
          tabIndex={0}
          onScroll={(event) => {
            const element = event.currentTarget
            if (follow && element.scrollHeight - element.scrollTop - element.clientHeight > 24)
              setFollow(false)
          }}
          className="max-h-[55dvh] min-h-32 overflow-auto rounded-lg border border-line bg-sidebar p-4 text-xs break-all whitespace-pre-wrap"
        >
          {lines || (query.trim() ? '没有匹配的日志' : '暂无日志')}
        </pre>
      )}
      <p className="mt-2 text-xs text-muted">
        {updated ? `上次刷新：${updated}` : '尚未获取日志'}
        {!follow && ' · 已暂停跟随，可以自由查看上方内容'}
      </p>
    </div>
  )
}
