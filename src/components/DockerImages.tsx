import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Modal, Spin, Tag } from 'antd'
import { deleteDockerImage, dockerImages } from '../api/appMaintenance'
import type { DockerImage, ImageInventory } from '../types/appMaintenance'
import { formatBytes, getErrorMessage } from '../lib/format'

// DockerImages 展示超管清理清单，删除需确认且每次都由服务端重新验证引用。
export default function DockerImages({ onClose }: { onClose: () => void }) {
  const [inventory, setInventory] = useState<ImageInventory | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [selected, setSelected] = useState<DockerImage | null>(null)
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    // load 清单失效时禁用删除，避免把上次结果当作当前检查。
    const load = async () => {
      setLoading(true)
      try {
        const value = await dockerImages(controller.signal)
        if (!controller.signal.aborted) {
          setInventory(value)
          setError('')
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(getErrorMessage(failure, '镜像空间暂时无法读取'))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [refresh])

  // remove 删除指定快照中的镜像；失败后要求刷新清单，禁止沿用旧的清理资格。
  const remove = async () => {
    if (!selected || deleting) return
    setDeleting(true)
    setNotice('')
    try {
      await deleteDockerImage(selected.id)
      setNotice('镜像已清理，正在重新统计空间。')
      setSelected(null)
      setRefresh((value) => value + 1)
    } catch (failure) {
      setSelected(null)
      setError(getErrorMessage(failure, '清理未完成，请刷新清单后重试'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      open
      title="Docker 镜像空间"
      width={760}
      onCancel={onClose}
      closable={!deleting}
      keyboard={!deleting}
      mask={{ closable: !deleting }}
      footer={
        <Button disabled={deleting} onClick={onClose}>
          关闭
        </Button>
      }
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-medium">
          镜像层合计 {inventory ? formatBytes(inventory.totalBytes) : '—'}
        </p>
        <Button
          loading={loading}
          disabled={deleting}
          onClick={() => {
            setSelected(null)
            setRefresh((value) => value + 1)
          }}
        >
          刷新清单
        </Button>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-muted">
        清理范围限于本实例新拉取且已无应用或容器引用的镜像。旧镜像与多重引用需要人工检查。单项大小包含共享层，实际释放空间以清理后的统计为准。
      </p>
      {error && <Alert className="mb-3" showIcon type="error" title={error} />}
      {notice && <Alert className="mb-3" showIcon type="success" title={notice} />}
      {loading && !inventory && <Spin />}
      {inventory?.images.length === 0 && <Empty description="暂无镜像" />}
      <ul className="space-y-3">
        {inventory?.images.map((item) => (
          <li key={item.id} className="rounded-lg border border-line p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm break-all">{item.tags.join('、') || '未命名镜像'}</p>
                <p className="mt-1 text-xs break-all text-dim">{item.id}</p>
              </div>
              <strong className="shrink-0 text-sm">{formatBytes(item.sizeBytes)}</strong>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Tag color={item.removable ? 'green' : 'default'}>{item.reason}</Tag>
              <Button
                danger
                disabled={!item.removable || loading || !!error || deleting}
                onClick={() => setSelected(item)}
              >
                清理镜像
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {selected && (
        <Modal
          open
          title="确认清理这个镜像？"
          okText="确认清理"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          confirmLoading={deleting}
          cancelButtonProps={{ disabled: deleting }}
          closable={!deleting}
          keyboard={!deleting}
          mask={{ closable: !deleting }}
          onOk={() => void remove()}
          onCancel={() => {
            if (!deleting) setSelected(null)
          }}
        >
          <p className="break-all">{selected.tags.join('、') || selected.id}</p>
          <p className="mt-3 text-sm text-muted">
            清理后再次部署该版本需要重新下载。提交时会重新核对引用。
          </p>
        </Modal>
      )}
    </Modal>
  )
}
