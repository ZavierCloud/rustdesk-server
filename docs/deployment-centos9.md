# RD Server 构建与部署（CentOS Stream 9 / x86_64）

去品牌化后的服务端（`rd_server`：ID/会合 + 中继 + 控制台 API）在 **arm64 macOS 上交叉编译**、
部署到 **CentOS Stream 9 x86_64** 的完整流程。端口已整体平移 +10：**21124–21129**。

---

## 一、构建

目标产物 `linux/amd64`，最高只依赖 `GLIBC_2.34`，必须用 **CentOS Stream 9 基础镜像**编译
（更新发行版会带更高 glibc 符号，目标机报 `GLIBC_2.35 not found`）。本机 Apple Silicon 走 QEMU，
关闭 fat-LTO 提速（功能不变）。

### 方式 A：仓库自带 `Dockerfile.build`（推荐）

```bash
docker buildx build --platform linux/amd64 \
  --target export --output type=local,dest=./out \
  --build-arg CARGO_PROFILE_RELEASE_LTO=false \
  -f Dockerfile.build .
```

产物：`out/rd_server_id`、`out/rd_server_relay` 与 `console/dist/`
（`export` 阶段不含 `rd_server_utils`，需要时从构建阶段取出）。

### 方式 B：持久化编译容器（便于增量/重试）

```bash
docker rm -f rd-build
docker create --name rd-build --platform linux/amd64 \
  -v "$PWD":/src -v rd_cargo:/root/.cargo -v rd_target:/target \
  quay.io/centos/centos:stream9 sleep infinity
docker start rd-build

docker exec rd-build sh -c \
  'dnf install -y --allowerasing gcc gcc-c++ cmake make perl git curl which sqlite openssl-devel'
docker exec rd-build sh -c \
  'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal'

docker exec rd-build bash -c \
  'cd /src && PATH=/root/.cargo/bin:$PATH CARGO_HOME=/root/.cargo CARGO_TARGET_DIR=/target cargo fetch --locked'
docker exec rd-build bash -c \
  'cd /src && PATH=/root/.cargo/bin:$PATH CARGO_HOME=/root/.cargo CARGO_TARGET_DIR=/target \
   CARGO_PROFILE_RELEASE_LTO=false cargo build --release --locked'

mkdir -p out
for b in rd_server_id rd_server_relay rd_server_utils; do
  docker cp rd-build:/target/release/$b ./out/$b
done
```

> `Dockerfile.build` 的两个历史坑已修复：基础镜像 `curl-minimal` 与 `dnf install curl` 冲突
> （需 `--allowerasing`）、缺 `openssl-devel`（`hbb_common → native-tls → openssl-sys` 必需）。

### 控制台前端

```bash
docker run --rm --platform linux/amd64 \
  -v "$PWD/console":/web -v rd_node_modules:/web/node_modules -w /web \
  node:20-bookworm bash -c 'npm ci && npm run build'
# 产物：console/dist/
```

### 打包

```bash
mkdir -p dist-pkg/rd_server/console
cp out/rd_server_id out/rd_server_relay out/rd_server_utils dist-pkg/rd_server/
cp -r console/dist dist-pkg/rd_server/console/dist
tar -C dist-pkg -czf dist-pkg/rd_server-amd64-centos9.tar.gz rd_server
```

> macOS 打包会带入 `._*`（AppleDouble），解包后 `find /opt/rd_server -name "._*" -delete`。

---

## 二、服务器部署

目标机：CentOS Stream 9 / x86_64 / 2C2G / systemd 252，firewalld 开启。

### 目录布局

```
/opt/rd_server/
├── rd_server_id          # ID/会合服务 + API/控制台（原 hbbs）
├── rd_server_relay       # 中继服务（原 hbbr）
├── rd_server_utils
├── console/dist/         # 控制台前端（rd_server_id 按 cwd 相对路径托管）
├── id_ed25519(.pub)      # 密钥对，必须持久化
└── db_v2.sqlite3         # SQLite 数据库
```

`rd_server_id` 通过**工作目录**下的 `console/dist` 托管控制台，`WorkingDirectory` 必须指向该目录。

### 端口

| 端口 | 用途 |
| --- | --- |
| 21124/tcp | 控制台 / API |
| 21125/tcp | NAT 类型测试 |
| 21126/tcp+udp | 会合服务 |
| 21127/tcp | 中继 TCP |
| 21128/tcp | WebSocket（会合） |
| 21129/tcp | WebSocket（中继） |

```bash
for p in 21124/tcp 21125/tcp 21126/tcp 21126/udp 21127/tcp 21128/tcp 21129/tcp; do
  firewall-cmd --permanent --add-port=$p
done
firewall-cmd --reload
```

### systemd 单元

`/etc/systemd/system/rd-server-id.service`：

```ini
[Unit]
Description=RD Server ID/Rendezvous Server (rd_server_id)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/rd_server
ExecStart=/opt/rd_server/rd_server_id
Restart=always
RestartSec=3
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/rd-server-relay.service`：Same，`ExecStart=/opt/rd_server/rd_server_relay`。

```bash
systemctl daemon-reload
systemctl enable --now rd-server-id rd-server-relay
```

### nginx 反代控制台

```nginx
server {
    listen 443 ssl;
    server_name rd.spidercloude.com;
    ssl_certificate     /etc/nginx/ssl/spidercloude/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/spidercloude/spidercloude.key;
    location / {
        proxy_pass http://127.0.0.1:21124;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

### 客户端配置

- ID 服务器：`net.spidercloude.com`（或 `149.88.68.22`）
- 中继服务器：`net.spidercloude.com`
- 公钥：`C8RvT8Leur0Q51eRyP1K5U7ggeOjIkiuSTUkYHftgUI=`（已内置为客户端默认值）
- 客户端默认端口已由 `hbb_common::config` 常量改为 21126/21127，无需手工填写

---

## 三、从旧部署迁移（rustdesk → rd_server）

旧的 `/opt/rustdesk/rustdesk-server`（hbbs/hbbr，端口 21114–21119）与新部署**可并存**，
按下面顺序切换，任何一步失败都能回滚：

```bash
# 1) 停新服务，保留旧服务运行
systemctl stop rd-server-id rd-server-relay 2>/dev/null || true

# 2) 复制身份与数据（关键：密钥决定客户端是否信任本服务器）
mkdir -p /opt/rd_server
cp -a /opt/rustdesk/rustdesk-server/id_ed25519 /opt/rustdesk/rustdesk-server/id_ed25519.pub /opt/rd_server/
cp -a /opt/rustdesk/rustdesk-server/db_v2.sqlite3* /opt/rd_server/ 2>/dev/null || true
cp -a /opt/rustdesk/rustdesk-server/console /opt/rd_server/ 2>/dev/null || true
cp out/rd_server_id out/rd_server_relay out/rd_server_utils /opt/rd_server/
chmod +x /opt/rd_server/rd_server_*

# 3) 放行新端口（21124–21129），启动新服务
firewall-cmd --permanent --add-port=21124-21129/tcp
firewall-cmd --permanent --add-port=21126/udp
firewall-cmd --reload
systemctl daemon-reload
systemctl enable --now rd-server-id rd-server-relay

# 4) 验证新服务（app 端口 21124、会合 21126）
ss -lntup | grep -E '2112[4-9]'
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:21124/

# 5) 客户端切到新端口后验证连接；确认无误再停旧服务
systemctl disable --now rustdesk-hbbs rustdesk-hbbr
```

> 迁移失败回滚：`systemctl start rustdesk-hbbs rustdesk-hbbr`，客户端改回旧端口即可。
> 旧数据目录在切换期间**不要删除**，至少保留到客户端全部验证通过。

---

## 四、上线校验

```bash
# 端口与进程
ss -lntup | grep -E '2112[4-9]'

# 控制台 API
curl -s http://127.0.0.1:21124/api/login-options

# 服务器自检（可执行文件在 /opt/rd_server）
/opt/rd_server/rd_server_utils doctor net.spidercloude.com
```

客户端侧：填 `net.spidercloude.com`、公钥留空（已内置），连接成功即说明会合 + 中继链路正常。

## 五、运维备注

- 密钥与数据库由进程工作目录决定，**重启前确认 cwd 仍是 `/opt/rd_server`**，否则会生成新密钥导致客户端全部失联
- 日志：`journalctl -u rd-server-id -f`、`journalctl -u rd-server-relay -f`
- 控制台与 API 同端口（21124），SPA fallback 与 API 路由顺序敏感，改路由前先读 `src/api/mod.rs`
- 生产包只能由 Docker（CentOS Stream 9 / amd64）产出，macOS 本地 `cargo build` 的二进制**不是**线上可用包
