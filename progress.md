# 任务进度

方案见 `../plans/rustdesk-server-pro-features.md`。本期范围 P0 + P1。

## 已完成

- [x] 初始化 `libs/hbb_common` 子模块（commit `69cea8da`）
- [x] HTTP 骨架：`src/api/` 挂 axum 于 21114（rendezvous 端口 − 2），自写 SPA fallback 托管 `console/dist`
- [x] 数据库：新增 `users` / `tokens` / `settings` / `audit` 表；`peer` 表加 `user_name` / `device_group_name` / `last_seen` 列（幂等迁移）
- [x] 认证：`/api/login`（bcrypt + 随机 token 落 `tokens` 表）、`/api/logout`、`/api/currentUser`、`/api/users`、`/api/login-options`
- [x] 2FA：`totp-rs` TOTP；登录返回 `tfa_check`，二次校验签发 token；`/api/me/2fa/{setup,enable,disable}`
- [x] 策略：`settings` 表 + `modified_at`，`/api/heartbeat` 下发 `strategy.config_options`
- [x] 审计：rendezvous 打洞（connect）/ 断连（disconnect）埋点；`/api/audit`、`/api/audit/{type}`
- [x] 设备：`/api/devices`（读 `peer` 表）、备注 / 分组 / 用户名 / 删除
- [x] sysinfo：`/api/sysinfo`（合并写入 peer.info）、`/api/sysinfo_ver`
- [x] 控制台前端：`console/`（React 18 + Vite + TS + antd + axios），`npm run build` 通过
- [x] 端到端验证：登录 / 2FA 全流程 / 用户 CRUD（按 name 或 id）/ 策略下发 / SPA fallback

## 进行中 / 待办

- [x] 前端联调（Playwright 实测）：登录 / 概览 / 设备 / 用户管理 / 策略设置 / 审计日志 / 个人 2FA 页均正常渲染；设置与用户表单新增落库并刷新可见；零 console 错误、零失败请求
- [x] 审计埋点实测：连接 rendezvous 端口 21116 后 `/api/audit` 出现 `disconnect` 记录（ip 127.0.0.1）
- [ ] 生产部署：`console/dist` 被 `.gitignore` 忽略，部署前需在 `console/` 执行 `npm run build`
- [ ] P2 通讯录、P3 权限（本期未做）

## 构建环境

见工作区 `../AGENTS.md` 的「Rust（本机 Windows）」。构建前需：

```bash
export PATH="/d/zwb/mingw64/bin:$HOME/.cargo/bin:$PATH"
cargo build --locked
```

## 关键实现位置

- `src/api/mod.rs` — 路由、`AppState`、SPA fallback、bootstrap admin（无用户时创建 `admin`，密码取 `CONSOLE_ADMIN_PASSWORD` 或随机打印）
- `src/api/auth.rs` — 登录 / 2FA 二次校验 / token 签发与鉴权辅助
- `src/api/console.rs` — 控制台 API（用户 / 设备 / 策略 / 审计 / 2FA）
- `src/api/heartbeat.rs` — 客户端心跳 / 策略下发 / sysinfo
- `src/database.rs` — 新表与查询方法（运行时 SQL，避免 sqlx 宏对编译期 schema 的依赖）
- `src/rendezvous_server.rs` — API server 启动挂载 + 审计埋点
