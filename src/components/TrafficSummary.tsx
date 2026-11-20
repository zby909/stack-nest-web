import { useCallback, useState } from 'react'
import { Button } from 'antd'
import { getTraffic, type Traffic } from '../api/insights'
import { getErrorMessage } from '../lib/format'
import { usePolling } from '../lib/usePolling'

// TrafficSummary 显示源站日计数，开始采集前的日期用短横线标明。
export default function TrafficSummary({ kind, id }: { kind: 'apps' | 'projects'; id: string }) {
  const [value, setValue] = useState<Traffic>()
  const [failure, setFailure] = useState('')
  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        const result = await getTraffic(kind, id, signal)
        if (!signal.aborted) {
          setValue(result)
          setFailure('')
        }
      } catch (err) {
        if (!signal.aborted) setFailure(getErrorMessage(err, '访问统计暂时不可用'))
      }
    },
    [kind, id],
  )
  const refresh = usePolling(load, 60_000)
  const total = value?.days.reduce((n, d) => n + d.requests, 0) ?? 0
  const peak = Math.max(1, ...(value?.days.map((d) => d.requests) ?? []))
  return (
    <section className="my-4 rounded-lg border border-line p-4" aria-label="访问概况">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">近 7 天访问</h3>
        <Button size="small" onClick={() => void refresh()}>
          刷新统计
        </Button>
      </div>
      {failure && (
        <p role="alert" className="mt-2 text-sm text-muted">
          {failure}
        </p>
      )}
      {!failure && !value && <p className="mt-2 text-sm text-muted">正在读取访问统计…</p>}
      {value && !value.available && (
        <p className="mt-2 text-sm text-muted">
          {value.updatedAt ? '采集暂不可用，以下为已保存的数据。' : '尚未收到源站采集数据。'}
        </p>
      )}
      {value?.updatedAt && (
        <>
          <p className="my-2 text-sm">
            共 <strong>{total.toLocaleString()}</strong> 次请求
          </p>
          <table className="w-full text-right text-xs tabular-nums">
            <caption className="sr-only">每日源站请求与错误数，按 UTC 分日</caption>
            <thead className="text-muted">
              <tr>
                <th className="text-left">日期</th>
                <th>请求</th>
                <th>页面</th>
                <th>4xx</th>
                <th>5xx</th>
              </tr>
            </thead>
            <tbody>
              {value.days.map((d) => {
                const recorded = !value.since || d.date >= value.since.slice(0, 10)
                return (
                  <tr key={d.date} className="border-t border-line">
                    <th scope="row" className="py-1 text-left font-normal">
                      {d.date.slice(5)}
                    </th>
                    <td>
                      <span className="relative inline-block w-full">
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-0 right-0 rounded-xs bg-current opacity-10"
                          style={{ width: `${(d.requests / peak) * 100}%` }}
                        />
                        {recorded ? d.requests.toLocaleString() : '—'}
                      </span>
                    </td>
                    {[d.pages, d.clientErrors, d.serverErrors].map((n, i) => (
                      <td key={i}>{recorded ? n.toLocaleString() : '—'}</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">
            按 UTC 分日。请求包含静态资源，页面统计浏览器导航或 HTML 请求。CDN
            直接返回的访问不计入。
          </p>
        </>
      )}
    </section>
  )
}
