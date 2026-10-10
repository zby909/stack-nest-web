// validateProjectName 与后端使用相同的 UTF-8 字节上限。
export function validateProjectName(_: unknown, value?: string) {
  return new TextEncoder().encode(value?.trim() ?? '').length > 256
    ? Promise.reject(new Error('项目名称的 UTF-8 编码不能超过 256 字节'))
    : Promise.resolve()
}

// validateProjectDescription 中文与表情按真实编码大小校验，空值允许清除说明。
export function validateProjectDescription(_: unknown, value?: string) {
  return new TextEncoder().encode(value?.trim() ?? '').length > 4096
    ? Promise.reject(new Error('项目说明的 UTF-8 编码不能超过 4096 字节'))
    : Promise.resolve()
}
