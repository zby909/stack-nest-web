# 构建与部署

使用平台按 [Docker 部署教程](https://github.com/zby909/stack-nest-server/blob/main/docs/INSTALL_RELEASE.md)操作。本文用于前端开发者。

## 本地构建

在 `web/` 使用 Node.js 24 和项目指定的 pnpm：

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm preview
```

产物在 `dist/`。preview 用于本地检查，生产由 Nginx 提供完整构建产物，管理页位于域名根路径。

## API 地址

默认同源 `/api`，由 Vite 或 Nginx 转发到 Go。

| 配置                     | 生效位置                                 |
| ------------------------ | ---------------------------------------- |
| `VITE_API_BASE`          | 开发 / 构建时，默认空；请求已包含 `/api` |
| `STACKNEST_ADMIN_DOMAIN` | Server 的 `.env`，Nginx 启动时           |
| `STACKNEST_BASE_DOMAIN`  | Server 的 `.env`，Nginx 和 Go 使用       |

`VITE_*` 写入浏览器代码，不保存密钥。已构建镜像不受运行时 `VITE_API_BASE` 影响；Dockerfile 不提供对应 build arg。默认同源方案无需 CORS 配置。

## 更新

仅改前端、后端健康且契约兼容时，在同级 `server/` 执行：

```bash
docker compose up -d --build --no-deps nginx
docker compose exec -T nginx nginx -t
```

同时修改 API 或迁移时，按 [完整升级](https://github.com/zby909/stack-nest-server/blob/main/docs/OPERATIONS.md#升级)更新平台。版本镜像部署使用配套发布物，不执行源码 build。

镜像使用 Server 的 Nginx 模板和运行配置，通过平台 Compose 启动。[请求分发原理](https://github.com/zby909/stack-nest-server/blob/main/docs/ARCHITECTURE.md)

## 排查

| 问题           | 检查                                   |
| -------------- | -------------------------------------- |
| 开发代理失败   | Go 的 `localhost:8080` 和数据库迁移    |
| 收不到验证码   | 后端邮箱名单、SMTP、日志及垃圾邮件箱   |
| IP 打开是 404  | 使用管理域名；Nginx 按 Host 分流       |
| 改配置后无变化 | 更新容器；restart 不重建或读取新环境   |
| 静态资源 404   | 使用返回的独立站点地址                 |
| 页面仍旧       | 完整构建产物及浏览器 / Cloudflare 缓存 |

[回归测试](TESTING.md) · [平台排障](https://github.com/zby909/stack-nest-server/blob/main/docs/OPERATIONS.md#状态与排障)
