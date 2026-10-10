import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, Input, Modal, Pagination, Select, Spin } from 'antd'
import { listProjectFiles, type PublishedFile } from '../api/files'
import { formatBytes, getErrorMessage } from '../lib/format'
import type { Project } from '../types/project'

type Entry = { path: string; name: string; bytes: number; directory: boolean }

// directoryEntries 按当前目录汇总子目录，搜索时返回完整相对路径。
function directoryEntries(files: PublishedFile[], directory: string, query: string) {
  const keyword = query.trim().toLowerCase()
  const result = new Map<string, Entry>()
  for (const file of files) {
    if (keyword) {
      if (file.path.toLowerCase().includes(keyword))
        result.set(file.path, { ...file, name: file.path, directory: false })
      continue
    }
    if (!file.path.startsWith(directory)) continue
    const relative = file.path.slice(directory.length)
    const slash = relative.indexOf('/')
    const folder = slash >= 0
    const name = folder ? relative.slice(0, slash) : relative
    const path = `${directory}${name}${folder ? '/' : ''}`
    const existing = result.get(path)
    if (existing) existing.bytes += file.bytes
    else result.set(path, { path, name, bytes: file.bytes, directory: folder })
  }
  return [...result.values()].sort(
    (a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name),
  )
}

// ProjectFilesModal 复用详情页文件面板，保留列表中的快捷入口。
export default function ProjectFilesModal({
  project,
  onClose,
}: {
  project: Project
  onClose: () => void
}) {
  return (
    <Modal
      open
      centered
      width={720}
      title={<span className="block pr-8 break-all">项目文件 · {project.name}</span>}
      footer={null}
      onCancel={onClose}
    >
      <ProjectFilesPanel project={project} />
    </Modal>
  )
}

// ProjectFilesPanel 仅显示文件目录与大小，管理域名不执行上传内容。
export function ProjectFilesPanel({ project }: { project: Project }) {
  const [deploymentId, setDeploymentId] = useState(
    project.draft?.id ?? project.deployments?.[0]?.id ?? '',
  )
  const [directory, setDirectory] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{
    key: string
    files: PublishedFile[]
    error: string
  } | null>(null)
  const key = `${project.slug}:${deploymentId}:${revision}`
  const loading = result?.key !== key
  useEffect(() => {
    if (!deploymentId) return
    const controller = new AbortController()
    void listProjectFiles(project.slug, deploymentId, controller.signal)
      .then((files) => {
        if (!controller.signal.aborted) setResult({ key, files, error: '' })
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setResult({ key, files: [], error: getErrorMessage(failure, '文件目录加载失败') })
      })
    return () => controller.abort()
  }, [project.slug, deploymentId, key])
  const files = result?.key === key ? result.files : []
  const entries = useMemo(
    () => directoryEntries(result?.key === key ? result.files : [], directory, query),
    [result, key, directory, query],
  )
  const pages = entries.slice((page - 1) * 30, page * 30)
  // openDirectory 进入子目录时重置分页，保留所选版本。
  const openDirectory = (path: string) => {
    setDirectory(path)
    setPage(1)
  }

  if (!deploymentId) return <Empty description="暂无版本文件，请上传待发布版" />
  return (
    <>
      <div className="my-4 flex flex-col gap-3 sm:flex-row">
        <Select
          className="h-11 w-full sm:h-8 sm:w-52"
          aria-label="文件版本"
          value={deploymentId}
          options={[
            ...(project.draft ? [{ value: project.draft.id, label: '待发布版本' }] : []),
            ...(project.deployments?.slice(0, 2).map((version, index) => ({
              value: version.id,
              label: index === 0 ? '当前版本' : '上一版本',
            })) ?? []),
          ]}
          onChange={(id) => {
            setDeploymentId(id)
            setDirectory('')
            setQuery('')
            setPage(1)
          }}
        />
        <Input
          className="h-11 sm:h-8"
          type="search"
          allowClear
          placeholder="搜索所有文件路径"
          aria-label="搜索文件"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(1)
          }}
        />
        <Button
          className="h-11 sm:h-8"
          onClick={() => {
            setRevision((value) => value + 1)
            setPage(1)
          }}
        >
          刷新目录
        </Button>
      </div>
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted">
        <Button
          size="small"
          className="min-h-9"
          disabled={!directory && !query}
          onClick={() => {
            setDirectory('')
            setQuery('')
            setPage(1)
          }}
        >
          根目录
        </Button>
        {directory && !query && (
          <Button
            size="small"
            className="min-h-9"
            onClick={() => openDirectory(directory.replace(/[^/]+\/$/, ''))}
          >
            上一级
          </Button>
        )}
        <span className="min-w-0 break-all">{query ? '搜索全部目录' : `/${directory}`}</span>
      </div>
      {loading ? (
        <div className="grid h-48 place-items-center" role="status" aria-label="正在加载文件目录">
          <Spin />
        </div>
      ) : result?.error ? (
        <Alert type="error" showIcon title={result.error} />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">
            共 {files.length} 个文件 ·{' '}
            {formatBytes(files.reduce((sum, file) => sum + file.bytes, 0))}
          </p>
          {entries.length === 0 ? (
            <Empty description={query ? '没有匹配的文件' : '此目录为空'} />
          ) : (
            <ul
              aria-label="文件目录"
              className="max-h-[45dvh] overflow-y-auto rounded-lg border border-line"
            >
              {pages.map((entry) => (
                <li
                  key={entry.path}
                  className="flex min-h-12 items-center gap-3 border-b border-line px-3 py-2 last:border-b-0"
                >
                  <svg
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d={entry.directory ? 'M3 6h7l2 3h9v11H3Z' : 'M6 3h8l4 4v14H6ZM14 3v5h4'}
                    />
                  </svg>
                  <div className="min-w-0 flex-1">
                    {entry.directory ? (
                      <button
                        className="min-h-9 w-full cursor-pointer text-left text-sm break-all hover:underline focus-visible:outline-2"
                        aria-label={`打开目录 ${entry.name}`}
                        onClick={() => openDirectory(entry.path)}
                      >
                        {entry.name}/
                      </button>
                    ) : (
                      <span className="text-sm break-all">{entry.name}</span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted">{formatBytes(entry.bytes)}</span>
                </li>
              ))}
            </ul>
          )}
          {entries.length > 30 && (
            <Pagination
              className="mt-4"
              size="small"
              simple
              current={page}
              pageSize={30}
              total={entries.length}
              onChange={setPage}
              showSizeChanger={false}
            />
          )}
          <p className="mt-4 text-xs text-muted">
            目录大小为其中所有文件的合计。这里仅查看路径和大小；完整文件可通过“导出 ZIP”下载。
          </p>
        </>
      )}
    </>
  )
}
