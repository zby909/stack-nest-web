# 开发入口

这里是 StackNest 管理界面，面向个人与小团队；后端在独立的 `stack-nest-server` 仓库，通常并排放在 `../server/`。

## 按任务阅读

- 开发、目录与样式：[开发约定](docs/DEVELOPMENT.md)。
- 行为变更：[浏览器回归](docs/TESTING.md)；构建部署：[构建配置](docs/DEPLOYMENT.md)。
- 功能边界：[产品范围](https://github.com/zby909/stack-nest-server/blob/main/docs/REQUIREMENTS.md)；接口以 Server 的 `openapi/` 契约为准，本地有仓库时直接读取。

## 修改约定

- 先检查 Git 状态，保留已有改动；未经用户授权不提交、推送或发布。
- 新增函数、方法附简短中文注释；修改后的单个代码文件不超过 1000 行。
- 样式优先 Tailwind，复用现有主题与组件；兼顾明暗模式、手机和桌面。
- 完成前运行 `pnpm typecheck`、`pnpm lint`；行为变化补相关浏览器检查，报告未运行项。
- 权限由服务端校验，不把隐藏按钮当作授权；凭据不写进仓库或日志。
- 使用方式变化时更新对应文档，避免重复维护说明。
