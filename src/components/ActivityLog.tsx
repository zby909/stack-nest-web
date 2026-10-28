import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Form, Input, Pagination, Select, Spin, Tag, Typography } from 'antd'
import { listActivity } from '../api/operations'
import { formatBytes, getErrorMessage } from '../lib/format'
import type { ActivityEvent, ActivityPage, ActivityQuery } from '../types/operations'

const actions: Record<ActivityEvent['action'], string> = {
  upload: '上传',
  update: '更新',
  rollback: '回退',
  delete: '删除',
  edit: '编辑',
  export: '导出',
  pause: '暂停',
  resume: '恢复',
  draft: '待发布',
  publish: '发布',
  discard: '丢弃草稿',
  'app-deploy': '部署应用',
  'app-start': '启动应用',
  'app-stop': '停止应用',
  'app-restart': '重启应用',
  'app-delete': '删除应用',
  network: '网络配置',
  'app-limits': '应用资源配置',
  'user-add': '添加邮箱',
  'user-role': '调整用户角色',
  'token-create': '创建部署 Token',
  'token-revoke': '撤销部署 Token',
}
type Filters = {
  q?: string
  slug?: string
  actor?: string
  action?: ActivityEvent['action']
  status?: ActivityEvent['status']
  start?: string
  end?: string
}

// ActivityLog 在服务端保留的日志范围内按条件分页，旧请求不会覆盖新的查询结果。
export default function ActivityLog({ slug }: { slug?: string }) {
  const [form] = Form.useForm<Filters>()
  const [query, setQuery] = useState<ActivityQuery>({ page: 1, pageSize: 50 })
  const [result, setResult] = useState<ActivityPage>({
    events: [],
    total: 0,
    page: 1,
    pageSize: 50,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    // load 忽略已取消请求的结果，筛选变化和页面卸载时终止旧请求。
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const next = await listActivity({ ...query, slug: slug ?? query.slug }, controller.signal)
        if (!controller.signal.aborted) setResult(next)
      } catch (failure) {
        if (!controller.signal.aborted) setError(getErrorMessage(failure, '操作日志加载失败'))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [query, slug])

  // search 按浏览器所在时区转换日期，结束日期包含当天并在修改筛选时回到第一页。
  const search = (values: Filters) => {
    const from = values.start ? new Date(`${values.start}T00:00:00`) : undefined
    const to = values.end ? new Date(`${values.end}T00:00:00`) : undefined
    if (to) to.setDate(to.getDate() + 1)
    if (
      (from && Number.isNaN(from.getTime())) ||
      (to && Number.isNaN(to.getTime())) ||
      (from && to && from >= to)
    ) {
      setError('请选择有效的起止日期，结束日期不能早于开始日期')
      return
    }
    setQuery({
      page: 1,
      pageSize: query.pageSize,
      q: values.q?.trim() || undefined,
      slug: values.slug?.trim() || undefined,
      actor: values.actor?.trim() || undefined,
      action: values.action || undefined,
      status: values.status || undefined,
      from: from?.toISOString(),
      to: to?.toISOString(),
    })
  }

  // clearFilters 同步清空表单与服务端条件，重新展示第一页。
  const clearFilters = () => {
    form.resetFields()
    setQuery({ page: 1, pageSize: query.pageSize })
  }

  return (
    <section className="rounded-panel border border-line bg-panel p-4 shadow-panel sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">操作日志</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted sm:text-xs">
            查询服务器保留的操作记录；旧记录会随日志轮转清理。日期按你当前设备的时区计算。
          </p>
        </div>
        <Button
          className="h-11 shrink-0 sm:h-8"
          loading={loading}
          onClick={() => setQuery((current) => ({ ...current, page: 1 }))}
        >
          刷新
        </Button>
      </div>
      <Form form={form} layout="vertical" onFinish={search} className="mb-4" requiredMark={false}>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2 xl:grid-cols-4">
          <Form.Item label="关键词" name="q">
            <Input
              size="large"
              aria-label="搜索操作日志"
              allowClear
              maxLength={256}
              placeholder="项目、文件、请求编号或内容"
            />
          </Form.Item>
          <Form.Item label="项目标识" name="slug" hidden={!!slug}>
            <Input
              size="large"
              aria-label="筛选项目"
              allowClear
              maxLength={52}
              placeholder="完整 slug，例如 demo"
            />
          </Form.Item>
          <Form.Item label="操作类型" name="action">
            <Select
              size="large"
              aria-label="筛选操作类型"
              allowClear
              placeholder="全部操作"
              options={Object.entries(actions).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item label="操作结果" name="status">
            <Select
              size="large"
              aria-label="筛选操作结果"
              allowClear
              placeholder="全部结果"
              options={[
                { value: 'succeeded', label: '成功' },
                { value: 'failed', label: '失败' },
              ]}
            />
          </Form.Item>
          <Form.Item label="操作人邮箱" name="actor">
            <Input
              size="large"
              aria-label="筛选操作人"
              allowClear
              maxLength={254}
              placeholder="完整邮箱"
            />
          </Form.Item>
          <Form.Item label="开始日期" name="start">
            <Input size="large" type="date" aria-label="开始日期" />
          </Form.Item>
          <Form.Item label="结束日期（含当天）" name="end">
            <Input size="large" type="date" aria-label="结束日期" />
          </Form.Item>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="primary" htmlType="submit" className="h-11 sm:h-8" loading={loading}>
            查询
          </Button>
          <Button className="h-11 sm:h-8" onClick={clearFilters}>
            清除筛选
          </Button>
        </div>
      </Form>
      {error && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          title={error}
          action={<Button onClick={() => setQuery((current) => ({ ...current }))}>重试</Button>}
        />
      )}
      {loading ? (
        <div className="py-12 text-center" role="status">
          <Spin />
        </div>
      ) : error ? null : (
        <>
          <p className="mb-4 text-xs text-muted">
            共 {result.total} 条符合条件的记录，本页 {result.events.length} 条
          </p>
          {result.events.length === 0 ? (
            <Empty description="没有符合筛选条件的记录" />
          ) : (
            <div className="divide-y divide-line">
              {result.events.map((event) => (
                <article key={event.id} className="py-4 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag color={event.status === 'succeeded' ? 'success' : 'error'}>
                      {actions[event.action] ?? event.action}
                      {event.status === 'succeeded' ? '成功' : '失败'}
                    </Tag>
                    <strong className="text-sm break-all">
                      {event.slug || event.fileName || '未指定项目'}
                    </strong>
                    <time className="text-xs text-muted">
                      {new Date(event.createdAt).toLocaleString('zh-CN')}
                    </time>
                  </div>
                  <p className="mt-2 text-sm break-all">{event.message}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs break-all text-muted">
                    <span>操作人：{event.actor || '未知'}</span>
                    {event.tokenName && <span>部署 Token：{event.tokenName}</span>}
                    <span>耗时：{(event.durationMs / 1000).toFixed(2)} 秒</span>
                    {(event.action === 'upload' || event.action === 'update') && (
                      <>
                        <span>已接收：{formatBytes(event.archiveBytes)}</span>
                        {event.status === 'succeeded' && (
                          <span>
                            解压后：{formatBytes(event.expandedBytes)} · {event.fileCount} 个文件
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {event.fileName && (
                    <p className="mt-1 text-xs break-all text-muted">文件：{event.fileName}</p>
                  )}
                  <div className="mt-2 text-xs break-all text-dim">
                    请求编号：
                    <Typography.Text copyable={{ text: event.id }} className="text-xs! text-dim!">
                      {event.id}
                    </Typography.Text>
                  </div>
                </article>
              ))}
            </div>
          )}
          <Pagination
            className="mt-5 flex flex-wrap gap-y-2"
            current={query.page}
            pageSize={query.pageSize}
            total={result.total}
            showSizeChanger
            pageSizeOptions={[20, 50, 100]}
            responsive
            onChange={(page, pageSize) =>
              setQuery((current) => ({
                ...current,
                page: pageSize === current.pageSize ? page : 1,
                pageSize,
              }))
            }
          />
        </>
      )}
    </section>
  )
}
