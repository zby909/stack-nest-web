import { Button, Input, Select } from 'antd'
import type { EnvironmentRow } from '../lib/appEnvironment'

// DockerAppEnvironment 编辑键名与改动，不请求、不保存已有敏感值。
export default function DockerAppEnvironment({
  rows,
  onChange,
}: {
  rows: EnvironmentRow[]
  onChange: (rows: EnvironmentRow[]) => void
}) {
  // update 仅替换当前行，切回保留或删除时立即丢弃尚未提交的值。
  const update = (id: string, change: Partial<EnvironmentRow>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...change } : row)))

  return (
    <div className="mb-6">
      <p className="mb-2">环境变量</p>
      <p className="mb-3 text-xs text-muted">
        已有值不回显；未修改的变量会保留。选择修改后留空表示保存为空字符串。
      </p>
      <div className="mb-3 space-y-3">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="rounded-lg border border-line p-3"
            data-testid="environment-row"
          >
            <div className="flex gap-2">
              <Input
                aria-label={`变量名称 ${index + 1}`}
                value={row.key}
                readOnly={row.existing}
                autoComplete="off"
                placeholder="KEY"
                maxLength={128}
                onChange={(event) => update(row.id, { key: event.target.value })}
              />
              {row.existing ? (
                <Select
                  virtual={false}
                  aria-label={`${row.key} 操作`}
                  value={row.action}
                  className="min-w-24"
                  options={[
                    { value: 'keep', label: '保留' },
                    { value: 'set', label: '修改' },
                    { value: 'delete', label: '删除' },
                  ]}
                  onChange={(action: EnvironmentRow['action']) =>
                    update(row.id, { action, value: '' })
                  }
                />
              ) : (
                <Button
                  danger
                  aria-label={`移除变量 ${index + 1}`}
                  onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
                >
                  移除
                </Button>
              )}
            </div>
            {row.action === 'set' && (
              <Input.Password
                className="mt-2"
                aria-label={`${row.key || `变量 ${index + 1}`} 新值`}
                placeholder="新值（允许为空）"
                autoComplete="new-password"
                value={row.value}
                onChange={(event) => update(row.id, { value: event.target.value })}
              />
            )}
            {row.action === 'delete' && (
              <p className="mt-2 mb-0 text-xs text-red-500">提交更新后删除此变量。</p>
            )}
          </div>
        ))}
      </div>
      <Button
        onClick={() =>
          onChange([
            ...rows,
            { id: crypto.randomUUID(), key: '', value: '', existing: false, action: 'set' },
          ])
        }
        disabled={rows.length >= 128 ? true : undefined}
      >
        添加环境变量
      </Button>
    </div>
  )
}
