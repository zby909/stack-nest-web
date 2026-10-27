# StackNest Web

[StackNest](https://github.com/zby909/stack-nest-server) 的管理界面。

静态站点和 Docker 应用管理、邮箱登录、成员权限、日志、服务器状态，支持手机布局和明暗主题。

[部署平台](https://github.com/zby909/stack-nest-server/blob/main/docs/INSTALL_RELEASE.md) · [文档](https://github.com/zby909/stack-nest-server/blob/main/docs/README.md) · [使用指南](https://github.com/zby909/stack-nest-server/blob/main/docs/USAGE.md)

![项目管理](docs/images/projects-desktop.png)

[手机布局](docs/images/projects-mobile.png) · [运维与诊断](docs/images/system-desktop.png)

## 开发

准备 Node.js 24、项目指定的 pnpm，先启动 [Go API 与开发数据库](https://github.com/zby909/stack-nest-server/blob/main/docs/DEVELOPMENT.md)。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

默认访问 `http://localhost:5173`。Vite 将 API 和静态预览请求交给本地 Go。

## 检查

```bash
pnpm exec playwright install chromium
pnpm check
```

包含类型、Lint、构建和桌面 / 手机回归。[测试说明](docs/TESTING.md) · [开发约定](docs/DEVELOPMENT.md)

## 构建

```bash
pnpm build
```

输出为 `dist/`，生产由平台 Nginx 提供。整套平台使用 Server 的 Compose，无需 Node 服务。

[构建配置](docs/DEPLOYMENT.md) · [源码部署](https://github.com/zby909/stack-nest-server/blob/main/docs/GETTING_STARTED.md)

## 技术栈

React · TypeScript · Vite · Tailwind CSS 4 · Ant Design · Axios

## 许可与贡献

Copyright 2026 zby909 and StackNest contributors. 使用 [Apache-2.0](LICENSE) 许可。第三方内容保留原许可，见 [NOTICE](NOTICE)。[参与贡献](CONTRIBUTING.md)
