import type { Project } from '../types/project'

export type ProjectSort = 'updated' | 'largest' | 'smallest'

// totalProjectBytes 仅在两版统计完整时计算合计，缺失文件不当作零占用。
export function totalProjectBytes(project: Project): number | null {
  const versions = [...(project.deployments ?? []), ...(project.draft ? [project.draft] : [])]
  if (!versions.length) return 0
  let total = 0
  for (const deployment of versions) {
    if (!deployment.files) return null
    total += deployment.files.bytes
  }
  return total
}

// sortProjects 保留原数组，容量未知的项目在升降序中都排最后。
export function sortProjects(projects: Project[], sort: ProjectSort): Project[] {
  return [...projects].sort((a, b) => {
    if (sort !== 'updated') {
      const left = totalProjectBytes(a)
      const right = totalProjectBytes(b)
      if (left === null && right !== null) return 1
      if (right === null && left !== null) return -1
      if (left !== null && right !== null && left !== right) {
        return sort === 'largest' ? right - left : left - right
      }
    }
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.slug.localeCompare(b.slug)
  })
}
