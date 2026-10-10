import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Pagination, Spin, Tag } from 'antd'
import { http } from '../lib/http'
import { formatBytes, getErrorMessage } from '../lib/format'
import type { Project } from '../types/project'

type Change = {
  path: string
  kind: 'added' | 'modified' | 'deleted'
  beforeBytes: number
  afterBytes: number
}
const labels = { added: '新增', modified: '修改', deleted: '删除' }

// ProjectChanges 按需对比实际文件内容，不把仅同名或同大小误判为未改变。
export default function ProjectChanges({ project }: { project: Project }) {
  const [expanded, setExpanded] = useState(false)
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; changes: Change[]; error?: string } | null>(
    null,
  )
  const target = project.draft ?? project.deployments?.[0]
  const base = project.deployments?.[project.draft ? 0 : 1]
  const key = `${target?.id}-${base?.id}-${revision}`
  useEffect(() => {
    if (!expanded || !target) return
    const controller = new AbortController()
    void http
      .get<{ changes: Change[] }>(`/api/projects/${project.slug}/changes`, {
        params: { deploymentId: target.id, baseId: base?.id },
        signal: controller.signal,
        timeout: 35_000,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) setResult({ key, changes: data.changes })
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            changes: [],
            error: getErrorMessage(failure, '文件比较失败，请刷新后重试'),
          })
      })
    return () => controller.abort()
  }, [expanded, project.slug, target, base, key])
  if (!target) return null
  const current = result?.key === key ? result : null
  return (
    <section className="mt-5 rounded-panel border border-line bg-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">文件变化</h2>
          <p className="mt-1 text-xs text-muted">
            {project.draft ? '待发布版与当前正式版比较' : '当前正式版与上一正式版比较'}
            {!base ? '；没有基线，全部视为新增。' : '，相同大小的内容修改也会识别。'}
          </p>
        </div>
        <Button
          onClick={() => {
            if (!expanded) setExpanded(true)
            else {
              setRevision((value) => value + 1)
              setPage(1)
            }
          }}
        >
          {expanded ? '重新比较' : '比较文件变化'}
        </Button>
      </div>
      {expanded && (
        <div className="mt-4">
          {!current ? (
            <div className="grid min-h-24 place-items-center">
              <Spin />
            </div>
          ) : current.error ? (
            <Alert type="error" showIcon title={current.error} />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {(['added', 'modified', 'deleted'] as const).map((kind) => (
                  <Tag key={kind}>
                    {labels[kind]} {current.changes.filter((item) => item.kind === kind).length}
                  </Tag>
                ))}
              </div>
              {!current.changes.length ? (
                <Empty description="文件内容没有变化" />
              ) : (
                <ul aria-label="文件变化" className="divide-y divide-line">
                  {current.changes.slice((page - 1) * 30, page * 30).map((item) => (
                    <li key={item.path} className="flex min-w-0 items-start gap-2 py-2 text-sm">
                      <Tag>{labels[item.kind]}</Tag>
                      <span className="min-w-0 flex-1 break-all">{item.path}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {formatBytes(item.beforeBytes)} → {formatBytes(item.afterBytes)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {current.changes.length > 30 && (
                <Pagination
                  className="mt-3"
                  simple
                  current={page}
                  pageSize={30}
                  total={current.changes.length}
                  onChange={setPage}
                  showSizeChanger={false}
                />
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
