import ProjectChanges from './ProjectChanges'
import { useState } from 'react'
import { Alert, Button, Empty, Modal, Tag, Typography } from 'antd'
import { discardDraft, publishDraft } from '../api/projects'
import { formatBytes, getErrorMessage } from '../lib/format'
import type { Project } from '../types/project'

// ProjectVersions 分开展示草稿与两版正式内容，发布和丢弃均需明确确认。
export default function ProjectVersions({
  project,
  onChanged,
  onRollback,
  onUpdate,
  canUpload,
}: {
  project: Project
  onChanged: (project: Project) => void
  onRollback: () => void
  onUpdate: () => void
  canUpload: boolean
}) {
  const [confirmation, setConfirmation] = useState<{
    action: 'publish' | 'discard'
    project: Project
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const versions = [
    ...(project.draft ? [{ version: project.draft, label: '待发布版', color: 'gold' }] : []),
    ...(project.deployments?.slice(0, 2).map((version, index) => ({
      version,
      label: index ? '上一正式版' : '当前正式版',
      color: index ? 'default' : 'green',
    })) ?? []),
  ]
  // confirm 捕获用户确认时的版本；服务器拒绝已经失效的草稿或正式版编号。
  const confirm = async () => {
    if (!confirmation || busy) return
    setBusy(true)
    setError('')
    try {
      const updated = await (confirmation.action === 'publish'
        ? publishDraft(confirmation.project)
        : discardDraft(confirmation.project))
      setConfirmation(null)
      onChanged(updated)
    } catch (failure) {
      setError(getErrorMessage(failure, '操作失败，请刷新项目后重试'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <p className="mb-4 text-sm leading-relaxed text-muted">
        保留当前正式版和上一正式版，另可保留一个待发布版。版本预览地址在该版本保留期间有效；持有地址即可访问。
      </p>
      {project.status === 'paused' && (
        <Alert
          className="mb-4"
          type="info"
          showIcon
          title="项目已暂停，正式站点和预览均已关闭；发布不会自动恢复访问。"
        />
      )}
      {!versions.length && <Empty description="尚无版本，请上传待发布版" />}
      <div className="space-y-4">
        {versions.map(({ version, label, color }) => (
          <article
            key={version.id}
            aria-label={label}
            className="rounded-panel border border-line bg-panel p-4 shadow-panel sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Tag color={color}>{label}</Tag>
                <h2 className="mt-2 text-base font-semibold break-all">{version.fileName}</h2>
                <p className="mt-2 text-xs text-muted">
                  {new Date(version.createdAt).toLocaleString('zh-CN')} ·{' '}
                  {version.files
                    ? `${formatBytes(version.files.bytes)} · ${version.files.count} 个文件`
                    : '文件统计暂不可用'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="h-11 sm:h-8"
                  href={version.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  disabled={!version.previewUrl || project.status === 'paused'}
                >
                  独立预览 ↗
                </Button>
                {version.status === 'draft' ? (
                  <>
                    <Button className="h-11 sm:h-8" disabled={!canUpload} onClick={onUpdate}>
                      更新待发布版
                    </Button>
                    <Button
                      type="primary"
                      className="h-11 sm:h-8"
                      onClick={() => {
                        setError('')
                        setConfirmation({ action: 'publish', project })
                      }}
                    >
                      发布此版本
                    </Button>
                    <Button
                      danger
                      className="h-11 sm:h-8"
                      onClick={() => {
                        setError('')
                        setConfirmation({ action: 'discard', project })
                      }}
                    >
                      丢弃
                    </Button>
                  </>
                ) : (
                  label === '上一正式版' && (
                    <Button className="h-11 sm:h-8" disabled={!!project.draft} onClick={onRollback}>
                      回退到此版本
                    </Button>
                  )
                )}
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-subtle p-3">
              <h3 className="mb-2 text-xs text-muted">更新说明</h3>
              <p className="text-sm break-words whitespace-pre-wrap">
                {version.notes || '未填写更新说明'}
              </p>
            </div>
            {version.previewUrl && (
              <div className="mt-3 min-w-0 text-xs text-muted">
                <Typography.Text
                  copyable={{ text: version.previewUrl }}
                  className="text-xs! break-all text-muted!"
                >
                  {version.previewUrl}
                </Typography.Text>
              </div>
            )}
          </article>
        ))}
      </div>
      <ProjectChanges project={project} />
      {project.draft && project.deployments?.[1] && (
        <p className="mt-3 text-xs text-muted">需要回退时，请先处理待发布版。</p>
      )}
      <Modal
        open={!!confirmation}
        centered
        title={confirmation?.action === 'publish' ? '发布待发布版本？' : '丢弃待发布版本？'}
        okText={confirmation?.action === 'publish' ? '确认发布' : '确认丢弃'}
        cancelText="取消"
        confirmLoading={busy}
        closable={!busy}
        keyboard={!busy}
        mask={{ closable: !busy }}
        cancelButtonProps={{ disabled: busy }}
        okButtonProps={{ danger: confirmation?.action === 'discard' }}
        onCancel={() => setConfirmation(null)}
        onOk={() => void confirm()}
      >
        <p className="mb-3 break-all">{confirmation?.project.draft?.fileName}</p>
        <p className="text-sm text-muted">
          {confirmation?.action === 'publish'
            ? '正式地址将使用这个版本。当前正式版保留为上一版，更早的正式版会被清理。'
            : '该草稿及其预览地址会被永久删除，正式站点不受影响。'}
        </p>
        {error && <Alert className="mt-4" type="error" showIcon title={error} />}
      </Modal>
    </>
  )
}
