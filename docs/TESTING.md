# 浏览器回归

在 `web/` 使用 Node.js 24 和项目指定的 pnpm。

## 运行

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm check
```

Linux 安装系统依赖时用 `pnpm exec playwright install --with-deps chromium`。Playwright 更新后重新安装浏览器。

检查包含类型、Lint、构建和桌面 / 手机回归，失败即停止。测试服务监听 `127.0.0.1:4175`，无需真实后端、数据库或邮箱。

只运行一部分：

```bash
pnpm test:e2e --project=mobile
pnpm test:e2e tests/projects.spec.ts
```

## 范围

| 场景 | 重点                                         |
| ---- | -------------------------------------------- |
| 上传 | 单 HTML / 压缩包、暂停、刷新恢复、响应丢失和重复提交 |
| 项目 | 草稿、预览、发布、回退、文件及编辑冲突       |
| 应用 | 配置、部署阶段、资源、日志和失败提示         |
| 权限 | 入口、角色、邮箱和邀请确认                   |
| 布局 | 窄屏、弹窗、主题和外观持久化                 |
| 运维 | 日志筛选、备份、网络和实例预算               |

常规回归的 API 由 tests/fixtures.ts 模拟，未知接口或外部请求使测试失败。不会发邮件或修改线上数据。

例如故意丢弃分片响应，再检查浏览器查询服务端进度后继续，避免重复上传或发布。

发布镜像时还会运行 `scripts/release-smoke.ts`：通过真实 Nginx、Go、PostgreSQL 和临时 SMTP 收件箱，验证邮件登录、分片上传、单 HTML、预览、发布、更新及回退。由后端 `deploy/check_release.py` 创建和清理隔离容器，命令见[发布指南](https://github.com/zby909/stack-nest-server/blob/main/docs/RELEASING.md)。生产邮箱、DNS 和 HTTPS 仍需部署后验收。

## 文档截图

运行 `pnpm screenshots`，用本地虚构数据生成桌面、手机和深色模式截图，保存到 `docs/images/`。无需线上账号，不读取服务器配置。

## 报告

```bash
pnpm exec playwright show-report
```

报告在 `playwright-report/`，截图和轨迹在 `test-results/`。默认不自动重试。

GitHub Actions 执行同一套检查，失败报告保留 7 天。[后端集成测试](https://github.com/zby909/stack-nest-server/blob/main/docs/DEVELOPMENT.md#检查与测试)
