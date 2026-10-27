// parseEnv 保留等号后的原值，拒绝重复名称与容易误解的无效行。
export function parseEnv(text: string): Record<string, string> {
  const result: Record<string, string> = Object.create(null) as Record<string, string>
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const index = line.indexOf('=')
    const name = line.slice(0, index).trim()
    if (index < 1 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
      throw new Error('环境变量格式应为 KEY=value，每行一个。')
    if (name in result) throw new Error(`环境变量 ${name} 重复。`)
    result[name] = line.slice(index + 1)
  }
  return result
}

export type EnvironmentRow = {
  id: string
  key: string
  existing: boolean
  action: 'keep' | 'set' | 'delete'
  value: string
}

// environmentPatch 只提交显式改动；空值是设置为空，null 才表示删除。
export function environmentPatch(rows: EnvironmentRow[]): Record<string, string | null> {
  const patch = Object.create(null) as Record<string, string | null>
  const keys = new Set<string>()
  for (const row of rows) {
    const key = row.key.trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || key.length > 128)
      throw new Error('环境变量名称须以字母或下划线开头，只能包含字母、数字和下划线。')
    if (keys.has(key)) throw new Error(`环境变量 ${key} 重复。`)
    keys.add(key)
    if (row.action === 'delete') patch[key] = null
    else if (row.action === 'set') patch[key] = row.value
  }
  if (Object.keys(patch).length > 64) throw new Error('一次最多修改 64 个环境变量。')
  if (rows.filter((row) => row.action !== 'delete').length > 64)
    throw new Error('环境变量最多 64 个。')
  return patch
}
