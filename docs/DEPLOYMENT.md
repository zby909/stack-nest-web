# StackNest Web 构建与部署

本文负责管理端的构建、配置和更新。首次部署整个 StackNest，请按 [后端与联合部署文档](https://github.com/zby909/stack-nest-server/blob/main/docs/DEPLOYMENT.md) 操作；数据库、域名、HTTPS、数据卷和备份只在该文档维护。

可选邀请邮件需要 API 0.4.2 或更新版本。邮箱列表接口返回固定邀请地址，未配置时页面禁用发送邀请；添加接口支持 `sendInvitation`（默认 false），并返回独立发送结果。应与后端一起发布此功能，SMTP 和登录地址配置只留在后端。

所有前端命令均在 `web/` 目录执行；下文标明的 Compose 命令在同级 `server/` 执行。

当前管理功能需要配套 API 0.9.0：项目详情、草稿预览与确认发布、更新说明、文件变化、保留版本统计与占用排序、站点暂停/恢复、服务端日志组合查询和分页，以及已有的编辑、ZIP 导出和管理员备份摘要。前后端须一起发布，无新增前端环境变量。登录、管理页面和低频弹窗使用独立模块，必须完整部署同一次构建的 `dist`；旧页面遇到失效模块时会提示手动刷新。

发布前运行 `pnpm check`，完成类型、Lint、生产构建及浏览器回归。首次需要安装测试浏览器，具体步骤见 [自动化回归](TESTING.md)。浏览器使用模拟接口，部署后仍需检查真实登录、项目 API 与站点访问。

## 1. 先区分三个运行方式

| 场景             | 入口                                    | 后端与静态项目                                                           |
| ---------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| 日常开发         | `pnpm dev`，访问终端显示的 Vite 地址    | 先启动 Go API；Vite 将 `/api` 和 `/sites` 代理到 `http://localhost:8080` |
| 本地检查构建结果 | `pnpm build` 后运行 `pnpm preview`      | API 仍需单独启动；仅用于检查构建产物                                     |
| 生产部署         | `server/compose.yaml` 中的 `nginx` 服务 | Nginx 提供管理页面、反代 API，并通过项目子域名提供静态文件               |

`pnpm dev` 和 `pnpm preview` 都不是生产入口。[Vite 官方部署说明](https://vite.dev/guide/static-deploy.html) 将 preview 定位为本地构建检查工具。

## 2. 构建前端

本地建议使用 Node.js 24，与 [Dockerfile](../Dockerfile) 一致；pnpm 版本以 [package.json](../package.json) 的 `packageManager` 为准（当前为 10.32.1）。已有对应版本 pnpm 即可；使用 Corepack 的环境可先执行 `corepack enable`。

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

预期输出为 `dist/index.html` 和 `dist/assets/`。只发布 `dist/` 中的构建结果，不发布源码或 `node_modules/`。生产管理端部署在域名根路径 `/`；当前未配置子路径部署。

需要单独检查镜像构建时，可在 `web/` 执行：

```bash
docker build -t stacknest-web:local .
```

镜像内使用锁文件安装依赖并执行构建，宿主机无需先安装 Node.js 或生成 `dist/`。

## 3. API 地址和环境变量

默认不设置 `VITE_API_BASE`。浏览器从同源 `/api/auth/*`、`/api/projects` 和 `/api/users` 调用后端，由 Vite 开发代理或生产 Nginx 转发到 Go。登录使用 HttpOnly Cookie；同源部署也满足后端写接口的来源校验。

| 配置                     | 何时生效               | 本项目约定                                                             |
| ------------------------ | ---------------------- | ---------------------------------------------------------------------- |
| `VITE_API_BASE`          | Vite 开发启动或构建时  | 默认空；API 调用本身已带 `/api`，不要再设为 `/api`                     |
| `STACKNEST_ADMIN_DOMAIN` | Nginx 容器启动时       | 在 `server/.env` 配置管理域名                                          |
| `STACKNEST_BASE_DOMAIN`  | Nginx 和 Go 容器启动时 | 在 `server/.env` 配置项目基础域名；项目使用 `stack-nest-{slug}` 子域名 |

Vite 会把 `VITE_*` 值写入浏览器代码，不能存放密码或服务端密钥。它们是[构建时配置](https://vite.dev/guide/env-and-mode.html)，给已经构建的 Nginx 容器传入 `VITE_API_BASE` 不会改变前端 API 地址。

当前 Dockerfile 不提供自定义 API 地址的 build arg，且 `.dockerignore` 排除了 `.env*`。推荐沿用同源代理；若改成跨域 API，还需要自行处理后端 CORS，当前 Go API 没有提供 CORS 配置。

修改 `server/.env` 后应通过 Compose 更新相关容器，使新环境变量进入容器；单纯 restart 不会应用修改后的环境变量。默认同源方案下，修改部署域名无需改变前端 API 地址。

## 4. 联合部署和前端更新

目录必须并排：

```text
workspace/
  server/  # compose.yaml、API、数据库迁移、Nginx 模板
  web/     # 前端源码和 Dockerfile
```

`nginx` 镜像由 `web/Dockerfile` 构建。运行时由 server 仓库提供：

- `deploy/nginx/default.conf.template`：HTTP 管理域名、API 代理、项目泛域名和 SPA fallback；Cloudflare Full (strict) 时改用 `cloudflare.conf.template`。
- `STACKNEST_ADMIN_DOMAIN`、`STACKNEST_BASE_DOMAIN`：Nginx 模板变量。
- `stacknest-data` 数据卷：以只读方式挂载到 `/data`，提供已发布项目。

镜像已移除默认 Nginx 站点配置，因此裸跑这个镜像不能获得完整管理入口。首次部署按 [联合部署文档](https://github.com/zby909/stack-nest-server/blob/main/docs/DEPLOYMENT.md) 完成环境配置和服务启动。

**仅修改前端，且已有健康的后端、数据库和有效 Nginx 配置时**，在 `server/` 执行：

```bash
docker compose up -d --build --no-deps nginx
docker compose exec nginx nginx -t
docker compose ps nginx
```

随后在浏览器检查验证码登录、项目列表、搜索、部署弹窗和管理员邮箱界面。手机或至少 320px 宽的窗口中检查顶部导航、长文本换行及弹窗，确认页面没有横向溢出；桌面导航只出现在侧栏。添加邮箱时需经过确认弹窗，邀请默认不勾选，取消不能触发添加或发信。涉及 API、数据库迁移或域名配置的更新，使用联合部署文档中的完整升级流程。

项目页的未完成上传恢复入口复用 API 0.9.0，无新增迁移或环境变量，可单独更新前端。升级前仅保存任务编号的旧记录仍可按相同信息和原文件手动续传，不能自动补回此前未保存的表单。

项目版本流程需与 API 0.9.0、`release_notes` 迁移和两份 Nginx 模板一起发布。上传先生成草稿与独立预览地址，确认发布才替换正式版；网址与归属不变。保留当前和上一正式版，另允许一个草稿；已有草稿需先发布或丢弃才能继续上传或回退。界面携带正式版和草稿编号，409 表示页面已过期，需要刷新再操作。删除项目会同时删除全部保留文件；完整规则见 [项目需求](https://github.com/zby909/stack-nest-server/blob/main/docs/REQUIREMENTS.md)。

## 5. 常见问题

| 现象                                | 优先检查                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 开发时 `/api/projects` 代理连接失败 | Go API 是否在 `127.0.0.1:8080` 运行，数据库是否已迁移；默认 Vite 代理目标未随意变更                             |
| 页面能打开，但列表报错              | 检查 `/api/projects` 的响应和后端日志；只打开首页或调用健康接口不足以确认数据库可用                             |
| 登录页显示但收不到验证码            | 检查后端邮箱名单、SMTP 配置和日志；未知邮箱也会得到统一的发送提示                                               |
| 用服务器 IP 打开得到 404            | 生产 Nginx 按 Host 匹配；使用配置的管理域名，或按联合部署文档中带 Host 请求头的 curl 示例检查                   |
| `docker run` 后没有页面             | 镜像需要运行时站点模板和环境变量；优先通过 server 的 Compose 启动                                               |
| 改容器环境变量后 API 地址没变化     | `VITE_*` 是构建时变量；默认同源方案只需保持 Nginx 的 API 代理正确                                               |
| 站点上传成功，但本地预览资源 404    | 使用返回的 `stack-nest-{slug}.localhost:当前端口/`；确认 Go 与 Vite 均已更新，不要继续使用后台 `/sites/` 旧链接 |
| 上传按钮不可用                      | 检查存储卡提示；服务器达到 90%、无法预留处理空间或磁盘探测失败时会暂停上传                                      |
| 上传进度到 100% 但尚未完成          | 100% 表示文件传输完成，后台仍需解压、校验和发布；等待结果，失败后在弹窗或操作日志查看原因                       |
| 修改代码后页面仍是旧版              | 重建 `nginx` 镜像并更新容器，再检查浏览器缓存；单纯 restart 不会重新构建前端                                    |

功能与上线标准统一见 [需求文档](https://github.com/zby909/stack-nest-server/blob/main/docs/REQUIREMENTS.md)。

Docker 应用页面位于 /apps，需配合 API 0.10.0、独立运行器和更新后的 Nginx 配置部署。普通用户仅管理自己的应用，详情见后端 docs/DOCKER_APPS.md。
