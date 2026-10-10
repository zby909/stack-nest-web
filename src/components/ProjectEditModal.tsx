import { useState } from 'react'
import { Alert, Form, Input, Modal } from 'antd'
import { editProject } from '../api/projects'
import { getErrorMessage } from '../lib/format'
import { validateProjectDescription, validateProjectName } from '../lib/projectMetadata'
import type { Project } from '../types/project'

// ProjectEditModal 编辑展示信息，过期页面保留输入并提示重新读取。
export default function ProjectEditModal({
  project,
  onClose,
  onComplete,
}: {
  project: Project
  onClose: () => void
  onComplete: (project: Project) => void
}) {
  const [form] = Form.useForm<{ name: string; description: string }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // submit 使用项目更新时间防止覆盖其他页面已经保存的编辑。
  const submit = async (values: { name: string; description: string }) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      onComplete(await editProject(project, values))
    } catch (failure) {
      setError(getErrorMessage(failure, '项目信息保存失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      centered
      title="编辑项目信息"
      okText="保存"
      cancelText="取消"
      onOk={() => form.submit()}
      onCancel={onClose}
      confirmLoading={busy}
      okButtonProps={{ className: 'h-11 sm:h-8' }}
      cancelButtonProps={{ disabled: busy, className: 'h-11 sm:h-8' }}
      closable={!busy}
      keyboard={!busy}
      mask={{ closable: !busy }}
    >
      <p className="mb-4 text-sm break-all text-muted">站点地址：{project.siteUrl}</p>
      {error && <Alert type="error" showIcon title={error} className="mb-4" />}
      <Form
        form={form}
        initialValues={{ name: project.name, description: project.description ?? '' }}
        layout="vertical"
        requiredMark={false}
        disabled={busy}
        onFinish={(values) => void submit(values)}
      >
        <Form.Item
          name="name"
          label="项目名称"
          rules={[
            { required: true, whitespace: true, message: '请输入项目名称' },
            { validator: validateProjectName },
          ]}
        >
          <Input size="large" maxLength={256} autoFocus />
        </Form.Item>
        <Form.Item
          name="description"
          label="项目说明（可选）"
          rules={[{ validator: validateProjectDescription }]}
        >
          <Input.TextArea rows={3} maxLength={4096} placeholder="介绍这个项目的用途" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
