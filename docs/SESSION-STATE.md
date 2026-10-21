# 会话状态快照（Session State）

> 新会话请先读本文件，再读各仓库 `progress.md`。本文件是当前进度的唯一权威快照。

更新时间：2026-10-20

## 目标

把 RustDesk 去品牌化为 `rd_client` / `rd_server`：产物不被识别为 rustdesk，功能不变，端口 +10（21124–21129），不保留与官方生态互通。

## 仓库与提交

| 仓库 | 位置 | 当前提交 | 说明 |
| --- | --- | --- | --- |
| 客户端 | `rustdesk/` | `fdaeb0953` | 已 push 到 `ZavierCloud/rustdesk` master |
| 服务端 | `rustdesk-server/` | `9adf6c4` | 已 push 到 `ZavierCloud/rustdesk-server` master |
| 共享库 | 两端 `libs/hbb_common` | `f2e726e` / `e376512` | fork `ZavierCloud/hbb_common` 的 `rd-client` / `rd-server` 分支 |

## 已完成

- 品牌/产物改名：`rd_client`、`RDClient.exe`、`RDClient.app`、`librd_client.*`（macOS/Linux）、`rd_client.dll`（Windows）、bundle `com.spidercloude.rdclient`
- 端口 +10：API 21124、NAT 21125、会合 21126(tcp+udp)、中继 21127、WS 21128/21129
- 内置服务器 `net.spidercloude.com` + 公钥 `C8RvT8Leur0Q51eRyP1K5U7ggeOjIkiuSTUkYHftgUI=`
- 图标全平台替换（png/ico/icns/mipmap/svg）
- macOS 产物构建并启动验证（62MB，ad-hoc 签名后 FFI 初始化正常）
- 服务器迁移上线：`rd-server-id/relay` 跑在 21124–21129，密钥/数据库沿用，设备 `55333116` 已注册；旧服务已停、旧端口与防火墙规则已清理
- 验证：客户端 dylib 与服务端三个 bin `strings` 扫描 0 命中；服务端 `cargo test` 全通过

## 进行中

**Windows CI**：`.github/workflows/windows-build.yml`（手动触发 `Build Windows (unsigned)`）。已修 4 轮：vcpkg manifest 模式 → 库名 `vpx/yuv.lib` → rustfmt 组件 → cdylib 名 `rd_client.dll`。**待重跑验证**（必须 Run workflow，不是 Re-run；日志应含 `workflow-rev: ...-v6`）。

## 待办

1. Windows 产物跑通 + `strings` 验收
2. 代码签名：Windows OV/EV 或 Azure Trusted Signing；macOS Developer ID + notarization
3. 客户端 GUI 手工连 `net.spidercloude.com` 做端到端验证（另一台设备输入 `55333116`）
4. 本地家用部署（`LOCAL-DEPLOY.md` 已写，暂不执行；需路由器 21124–21129 + 21126/udp 映射）

## 关键文档

| 文件 | 内容 |
| --- | --- |
| `RENAME-PLAN.md` | 改造全记录、9 个构建坑、保留项白名单 |
| `WINDOWS-BUILD.md`（`rustdesk/` 内也有） | Windows 环境、bridge 生成、接续指引、坑清单 |
| `LOCAL-DEPLOY.md` | 家用部署、端口映射、密钥迁移、DDNS |
| `rustdesk-server/progress.md` | 服务端迁移与验证记录（已提交） |
| `migrate-to-rd-server.sh` / `verify-strings.sh` | 迁移脚本 / 产物验收脚本 |

## 保留项（不能改）

`RustDeskIddDriver Device`、`RustDeskPrinterDriver`（驱动名）、`github.com/rustdesk*` 与 `rustdesk-org` 依赖源、`LICENCE` / `Copyright Purslane`（AGPL 归属）、`updater.rs` 的 `repo != "rustdesk"`。
