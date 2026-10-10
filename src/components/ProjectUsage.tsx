import { useState } from 'react'
import { Popover } from 'antd'
import { formatBytes } from '../lib/format'
import { totalProjectBytes } from '../lib/projectUsage'
import type { Deployment, Project } from '../types/project'

// versionUsage 分别展示文件缺失、没有上一版和正常统计三种状态。
function versionUsage(deployment: Deployment | undefined, previous = false) {
  if (!deployment && previous) return '无'
  if (!deployment?.files) return '统计暂不可用'
  return `${formatBytes(deployment.files.bytes)} · ${deployment.files.count.toLocaleString('zh-CN')} 个文件`
}

// ProjectUsage 仅平铺合计，通过可悬浮、聚焦和点按的图标展示版本详情。
export default function ProjectUsage({ project }: { project: Project }) {
  const total = totalProjectBytes(project)
  const [open, setOpen] = useState(false)
  return (
    <div
      className="mt-1 flex w-full items-center gap-1 text-xs text-muted"
      aria-label="项目文件占用"
    >
      <span>
        合计{' '}
        <span className="font-medium text-ink">
          {total === null ? '统计暂不可用' : formatBytes(total)}
        </span>
      </span>
      <Popover
        title="版本文件占用"
        placement="top"
        trigger="hover"
        open={open}
        onOpenChange={setOpen}
        content={
          <dl
            className="grid max-w-[calc(100vw-4rem)] gap-2 text-xs text-muted"
            aria-label="版本空间详情"
          >
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <dt>当前版</dt>
              <dd className="font-medium text-ink">
                {versionUsage(project.deployments?.[0], true)}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <dt>上一版</dt>
              <dd className="font-medium text-ink">
                {versionUsage(project.deployments?.[1], true)}
              </dd>
            </div>
            {project.draft && (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <dt>待发布版</dt>
                <dd className="font-medium text-ink">{versionUsage(project.draft)}</dd>
              </div>
            )}
          </dl>
        }
      >
        <button
          type="button"
          aria-label="查看版本空间详情"
          aria-expanded={open}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-muted hover:bg-nav-active hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink desktop:size-7"
          // 键盘聚焦主动打开，触屏聚焦交给点击事件，避免一次点按连续开关。
          onFocus={(event) => {
            if (event.currentTarget.matches(':focus-visible')) setOpen(true)
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              event.stopPropagation()
            }
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5m0-8h.01" />
          </svg>
        </button>
      </Popover>
    </div>
  )
}
