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
