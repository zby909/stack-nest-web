type StatCardProps = {
  label: string
  value: string | number
  description: string
  compactOnMobile?: boolean
}

// StatCard 统一概览指标的结构和样式，避免重复维护整组工具类。
export default function StatCard({ label, value, description, compactOnMobile }: StatCardProps) {
  return (
    <article
      className={`rounded-panel border border-line bg-panel p-4 shadow-panel transition-[transform,box-shadow] duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg sm:p-4.5 ${compactOnMobile ? 'col-span-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:col-span-1 sm:block' : ''}`}
    >
      <span className="text-xs text-muted">{label}</span>
      <strong
        className={`block leading-tight font-bold ${compactOnMobile ? 'col-start-2 row-span-2 row-start-1 text-lg sm:my-2 sm:text-[1.625rem]' : 'my-2 text-[1.625rem]'}`}
      >
        {value}
      </strong>
      <p className="text-xs text-dim">{description}</p>
    </article>
  )
}
