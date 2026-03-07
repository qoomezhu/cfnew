# EdgeOne 分支说明

这个 `edgeone` 分支不是把 Cloudflare Worker API 硬搬到 EdgeOne，而是按 **EdgeOne Pages / Node Functions** 的运行模型重写的可部署版本。

## 这套实现为什么是“实际可行”的

我采用的是 EdgeOne 当前最稳妥的落地方式：

- **Pages Node Functions**：负责 WebSocket + TCP 出站 + 订阅/API
- **Pages KV**：负责配置与优选 IP 列表
- **WebSocketPair + node:net**：用于隧道核心
- **DoH**：用于 DNS 查询，避免依赖 UDP 原生转发

这套设计绕开了 Cloudflare 专属的：

- `cloudflare:sockets`
- `request.cf`
- Workers KV 绑定方式

同时保留了原项目最关键的几项能力：

- VLESS / Trojan 订阅生成
- 根路径 WS 隧道
- `p / wk / s / rm` path 参数覆盖
- KV 存储配置
- 优选 IP 列表 API
- 自定义路径 `d`
- SOCKS5 降级
- DoH DNS 处理

---

## 当前分支已实现的能力

### 已实现
- `GET /` 健康检查页
- `GET /{UUID或自定义路径}` 管理页
- `GET /{UUID或自定义路径}/sub` Base64 订阅
- `GET/PUT /{路径}/api/config` 配置读写
- `GET/POST/DELETE /{路径}/api/preferred-ips` 优选列表管理
- `WS /?ed=2048` 隧道入口
- `p` 覆盖 ProxyIP
- `wk` 覆盖地区
- `s` 覆盖 SOCKS5
- `rm=no` 关闭地区智能匹配
- `qj=no` 开启 direct -> SOCKS5 -> fallback 的降级链路

### 暂未实现
- xhttp
- ECH 自动拉取与下发
- 原项目那套完整前端图形化大界面
- Cloudflare 专属 `request.cf` 行为

---

## 部署方式

### 1. 用 EdgeOne Pages 导入这个分支
仓库分支选择：`edgeone`

### 2. 绑定 KV
在 EdgeOne Pages 控制台绑定 KV Namespace：

- 推荐变量名：`C`
- 兼容变量名：`my_kv`

### 3. 设置环境变量
至少建议设置：

| 变量 | 说明 |
| --- | --- |
| `u` | 你的 UUID，必填，作为访问路径和鉴权用户 |
| `d` | 自定义路径，可选，例如 `/mypath` |
| `p` | 默认 ProxyIP，可选 |
| `s` | 默认 SOCKS5，可选，格式 `user:pass@host:port` 或 `host:port` |
| `wk` | 默认地区，可选，例如 `HK` / `JP` / `SG` |
| `ev` | 是否启用 VLESS，默认 `yes` |
| `et` | 是否启用 Trojan，默认 `no` |
| `ae` | 是否允许 API 管理优选 IP，默认 `no` |
| `qj` | 设为 `no` 启用 direct -> SOCKS -> fallback |
| `doh` | DoH 地址，默认 `https://dns.google/dns-query` |

### 4. 访问路径
假设你的 Pages 域名是：

`https://your-project.edgeone.app`

那么：

- 管理页：`https://your-project.edgeone.app/{UUID}`
- 订阅：`https://your-project.edgeone.app/{UUID}/sub`
- WS：`wss://your-project.edgeone.app/?ed=2048`

如果设置了 `d=/mypath`：

- 管理页：`https://your-project.edgeone.app/mypath`
- 订阅：`https://your-project.edgeone.app/mypath/sub`

### 5. 自定义域名 / WebSocket
如果你给 Pages 绑定了自己的域名，确保前置链路允许 WebSocket。

如果你是在 EdgeOne 站点加速层再套一层：

- 打开 WebSocket 支持
- 不要缓存 `/{路径}/sub`
- 不要缓存 WS 入口

---

## API 示例

### 保存一批优选节点
```bash
curl -X POST "https://your-domain/{UUID或路径}/api/preferred-ips?mode=replace" \
  -H "Content-Type: text/plain; charset=utf-8" \
  --data-binary $'1.1.1.1:443#节点1\n8.8.8.8:443#节点2'
```

### 查询优选列表
```bash
curl "https://your-domain/{UUID或路径}/api/preferred-ips"
```

### 清空优选列表
```bash
curl -X DELETE "https://your-domain/{UUID或路径}/api/preferred-ips" \
  -H "Content-Type: application/json" \
  -d '{"all": true}'
```

### 保存配置
```bash
curl -X PUT "https://your-domain/{UUID或路径}/api/config" \
  -H "Content-Type: application/json" \
  -d '{
    "et": "yes",
    "ae": "yes",
    "qj": "no",
    "doh": "https://dns.google/dns-query"
  }'
```

---

## 与原 Cloudflare 版的关键差异

### 1. 隧道运行时不同
原版依赖 `cloudflare:sockets`，这个分支改为：

- `WebSocketPair()`
- `node:net`
- `SOCKS5 handshake`
- `DoH DNS`

### 2. GEO 获取不同
当前分支的地区识别优先使用：

- `x-eo-country`
- `x-geo-country`
- 其它常见国家码头
- 最终默认 `HK`

所以如果你后面还要在 EdgeOne 站点规则层做国家透传，也能兼容。

### 3. DNS 不再走原始 UDP 转发
为了提高 EdgeOne 兼容性，这里把 DNS 改成了 **DoH**。

---

## 建议你的上线顺序

1. 先只配置 `u`
2. 部署成功后访问 `/{u}`
3. 打开管理页确认配置读写正常
4. 再开启 `ae=yes`
5. 再加 `qj=no` 和 `s=` 做降级
6. 最后再上自定义域名

---

## 分支目的

这个分支的目标不是“完全追平 Cloudflare Worker 所有高级特性”，而是给你一个：

- 能导入 EdgeOne Pages
- 能跑 Node Functions
- 能用 KV
- 能提供订阅
- 能跑 WebSocket 隧道

的 **第一版可部署 EdgeOne 实现**。
