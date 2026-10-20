# 任务进度

方案见 `../plans/rustdesk-server-pro-features.md`。本期范围 P0 + P1。

## 去品牌化改造（rustdesk → rd_server / rd_client）

- [x] 端口整体 +10：API 21124、NAT 21125、会合 21126（tcp/udp）、中继 21127、WS 21128/21129；`hbb_common` 常量与 `utils doctor` 自检同步
- [x] `hbb_common`（两仓副本同步改写）：`APP_NAME=RDClient`、`ORG=com.spidercloude`、默认服务器 `net.spidercloude.com`、内置公钥换为自建 `C8RvT8Leur0Q51eRyP1K5U7ggeOjIkiuSTUkYHftgUI=`、文档链接改自建
- [x] 服务端：包名 `rd_server`，bin `rd_server_id` / `rd_server_relay` / `rd_server_utils`；systemd、debian、rcd、k8s、docker-compose、Dockerfile.build 同步改名；`utils doctor` 端口表更新
- [x] 控制台：标题 `RD Server 控制台`、`TOKEN_KEY=rd_server_console_token`、JWT issuer `RD Server`、vite 代理 21124
- [x] 部署文档重写：`docs/deployment-centos9.md`（新端口、新路径 `/opt/rd_server`、systemd 新单元名、旧部署迁移与回滚步骤）
- [x] 构建验证：`cargo check` / `cargo build --bins` 通过（包 `rd_server`）；`bun install && bun run build` 控制台构建通过
- [x] 产物验证：`rd_server_id` / `rd_server_relay` / `rd_server_utils` 的 `strings` 扫描 **0 处 rustdesk**；客户端 `librd_client.dylib` 同样 **0 处**
- [x] 服务端产物 strings 扫描干净（`rd_server_id/relay/utils` 无 rustdesk 命中；仅 debug 构建含绝对路径，release 不含）
- [x] `hbb_common` 已 push 到 fork `ZavierCloud/hbb_common` 的 `rd-client` 分支（`f2e726e`），两个 `.gitmodules` 已指向该 fork
- [x] 服务器实际迁移完成：新服务 `rd-server-id/relay` 运行于 21124–21129，密钥与数据库沿用旧部署，客户端设备 `55333116` 已注册（`update_pk` 日志确认）
- [x] 旧服务已下线：`rustdesk-hbbs/hbbr` inactive，21114–21119 无监听；旧目录与备份保留可回滚：新端口放行、复制 `id_ed25519*` 与 `db_v2.sqlite3*`、切换 systemd、旧单元下线
- [x] macOS 客户端产物构建成功：`artifacts/macos/RDClient.app`（62MB, arm64）+ `rd_client-1.5.0-arm64.dmg`（29MB），bundle id `com.spidercloude.rdclient`，ad-hoc 签名后启动验证通过（FFI 初始化/事件注册正常）
- [ ] 客户端联调：Windows/macOS 客户端产物接入新端口 `21126`（需 GUI 手工连一次 `net.spidercloude.com`）

**保留项（功能必需，不得改）**：`RustDeskIddDriver Device`（虚拟显示器驱动设备名，改了功能失效）、`github.com/rustdesk` 上游 URL（libdrmtap 下载源与 issue 链接）、`LICENCE` 与上游归属说明。

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
- [x] linux/amd64 产物实际构建成功（Docker + CentOS Stream 9，仅依赖 `libc/libm/libgcc_s`，最高 `GLIBC_2.34`）；修复 `Dockerfile.build` 两处硬伤：`curl-minimal` 冲突（改 `--allowerasing`）、缺 `openssl-devel`
- [x] 部署到 CentOS Stream 9 服务器：`/opt/rustdesk/rustdesk-server` + systemd（`rustdesk-hbbs`/`rustdesk-hbbr`）+ firewalld（21114–21119/tcp、21116/udp）+ nginx 反代 `rd.spidercloude.com`→21114

## 进行中 / 待办

- [x] 前端联调（Playwright 实测）：登录 / 概览 / 设备 / 用户管理 / 策略设置 / 审计日志 / 个人 2FA 页均正常渲染；设置与用户表单新增落库并刷新可见；零 console 错误、零失败请求
- [x] 审计埋点实测：连接 rendezvous 端口 21116 后 `/api/audit` 出现 `disconnect` 记录（ip 127.0.0.1）
- [x] 生产构建方案：`Dockerfile.build` + `.dockerignore`（CentOS Stream 9 基础镜像，产出 linux/amd64 的 `hbbs`/`hbbr` 与 `console/dist`，规避 glibc 2.34 与 sqlx 编译期 DB 两个坑）
- [ ] 部署文档：systemd 单元、nginx 反代、firewalld 端口（21114–21118）整理成文
- [ ] P2 通讯录、P3 权限（本期未做）

## 构建环境

见工作区 `../AGENTS.md` 的「Rust（本机 Windows）」。构建前需：

```bash
export PATH="/d/zwb/mingw64/bin:$HOME/.cargo/bin:$PATH"
cargo build --locked
```

## 关键实现位置

- `src/api/mod.rs` — 路由、`AppState`、SPA fallback、bootstrap admin（无用户时创建 `admin`，密码取 `CONSOLE_ADMIN_PASSWORD` 或随机打印）
本机 Docker 未启用 Rosetta，amd64 容器走 QEMU，故构建时关闭 fat-LTO 提速
（产物功能不变）。完整流程、服务器部署与客户端配置见 `docs/deployment-centos9.md`。

产物：`out/{hbbs,hbbr,rustdesk-utils}` 与 `console/dist`，打包为
`dist-pkg/rustdesk-server-amd64-centos9.tar.gz`。

- `src/api/auth.rs` — 登录 / 2FA 二次校验 / token 签发与鉴权辅助
- `src/api/console.rs` — 控制台 API（用户 / 设备 / 策略 / 审计 / 2FA）
- `src/api/heartbeat.rs` — 客户端心跳 / 策略下发 / sysinfo
- `src/database.rs` — 新表与查询方法（运行时 SQL，避免 sqlx 宏对编译期 schema 的依赖）
- `src/rendezvous_server.rs` — API server 启动挂载 + 审计埋点
