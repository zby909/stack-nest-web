import DeployTokens from './DeployTokens'
import ProjectAIDeploy from './ProjectAIDeploy'

// ProjectDeployTokens 保留静态项目的 AI 引导与默认预览权限。
export default function ProjectDeployTokens({
  slug,
  projectId,
}: {
  slug: string
  projectId: string
}) {
  return (
    <DeployTokens
      key={projectId}
      resource={slug}
      actions={<ProjectAIDeploy slug={slug} projectId={projectId} />}
    />
  )
}
