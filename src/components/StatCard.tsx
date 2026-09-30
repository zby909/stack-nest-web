type StatCardProps = {
  label: string
  value: string | number
  description: string
}

// StatCard 统一概览指标的结构和样式，避免重复维护整组工具类。
export default function StatCard({ label, value, description }: StatCardProps) {
  return (
    <article className="rounded-panel border border-line bg-panel p-4.5 shadow-panel transition-[transform,box-shadow] duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg">
      <span className="text-caption text-muted">{label}</span>
      <strong className="my-2 block text-[1.625rem] leading-tight font-bold">{value}</strong>
      <p className="text-xs text-dim">{description}</p>
    </article>
  )
}
