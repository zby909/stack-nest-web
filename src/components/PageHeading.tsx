import type { ReactNode } from 'react'

// PageHeading 统一管理页面标题的排版与操作位置。
export default function PageHeading({
  heading,
  description,
  action,
}: {
  heading: string
  description: string
  action?: ReactNode
}) {
  return (
    <header
      className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end desktop:mb-6"
      id="overview"
    >
      <div className="min-w-0">
        <span className="hidden text-xs text-dim desktop:inline">StackNest · 项目控制中心</span>
        <h1 className="mb-2 text-2xl leading-tight font-bold tracking-tight desktop:mt-1.25 desktop:text-[1.75rem]">
          {heading}
        </h1>
        <p className="text-sm leading-relaxed text-muted desktop:text-xs">{description}</p>
      </div>
      {action}
    </header>
  )
}
