import type { AppView } from '../types/app'
import DeployTokens from './DeployTokens'
import ProjectAIDeploy from './ProjectAIDeploy'

// DockerAppAutomation 将应用级授权与最短使用说明放在可直接打开的详情页。
export default function DockerAppAutomation({ app }: { app: AppView['app'] }) {
  return (
    <section
      className="min-w-0 rounded-xl border border-line bg-panel p-4 sm:p-5"
      aria-label="应用自动部署"
    >
      <h2 className="mb-3 text-base font-semibold break-all">{app.name} · 自动部署</h2>
      <p className="mb-3 text-sm leading-relaxed text-muted">
        先在 CI 构建并推送镜像，再调用 CLI。默认等待部署及健康检查完成，失败会让工作流返回失败。
      </p>
      <pre className="mb-3 overflow-x-auto rounded-lg bg-subtle p-3 text-xs">
        <code>stacknest-deploy app deploy --image 仓库@sha256:镜像摘要</code>
      </pre>
      <p className="mb-5 text-xs leading-relaxed text-muted">
        GitHub Actions 配置管理端地址 STACKNEST_URL，并将下方创建的应用 Token 存为 Secret
        STACKNEST_DEPLOY_TOKEN。 私有镜像的拉取凭据仍在后台配置。更新不回退应用数据库。
      </p>
      <DeployTokens
        resource={app.id}
        kind="app"
        actions={<ProjectAIDeploy kind="app" appId={app.id} slug={app.slug} />}
      />
    </section>
  )
}
