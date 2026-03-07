# EdgeOne 分支说明

这个 `edgeone` 分支不是把 Cloudflare Worker API 硬搬到 EdgeOne，而是按 **EdgeOne Pages / Node Functions** 的运行模型重写的可部署版本。

## 这套实现为什么是“实际可行”的

我采用的是 EdgeOne 当前最稳妥的落地方式：

- **Pages Node Functions**：负责 WebSocket + TCP 出站 + 订阅/API
- **Pages KV**：负责配置与优选 IP 列表
- **WebSocketPair + node:net**：用于隧道核心
- **DoH**：用于 DNS 查询，避免依赖 UDP 原生转发
- **xhttp POST 流式转发**：用于承接原项目的 xhttp 思路

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
- xhttp 第一版真实接入

---

## A 阶段已补强内容

### 已新增
- 更完整的管理页
- `GET /{路径}/api/status` 状态诊断接口
- 配置保存前校验
- 请求 ID 响应头 `x-request-id`
- 客户端快速链接接口 `GET /{路径}/api/clients`
- 配置导入/导出接口
- 部署专用 `edgeone.json`
- `.env.edgeone.example`
- xhttp 第一版服务端接入

### 当前仍然不做伪实现
- ECH：若未真正补齐获取/缓存/下发链路，也会是伪实现

所以这个分支的原则是：**先交付 EdgeOne 上真实可跑的能力，再继续迭代协议层。**

---

## 当前分支已实现的能力

### 已实现
- `GET /` 健康检查页
- `GET /{UUID或自定义路径}` 管理页
- `GET /{UUID或自定义路径}/sub` Base64 订阅
- `GET/PUT /{路径}/api/config` 配置读写
- `GET /{路径}/api/status` 状态诊断
- `GET /{路径}/api/clients` 客户端快速链接
- `GET /{路径}/api/export` 导出配置与优选列表
- `POST /{路径}/api/import` 导入配置与优选列表
- `GET/POST/DELETE /{路径}/api/preferred-ips` 优选列表管理
- `WS /?ed=2048` 隧道入口
- `POST /*` 的 xhttp 流式入口（启用 `ex=yes` 后生效，且不会拦截 `/api/*`）
- `p` 覆盖 ProxyIP
- `wk` 覆盖地区
- `s` 覆盖 SOCKS5
- `rm=no` 关闭地区智能匹配
- `qj=no` 开启 direct -> SOCKS5 -> fallback 的降级链路

### 暂未实现
- ECH 自动拉取与下发
- 原项目那套完整前端图形化大界面
- Cloudflare 专属 `request.cf` 行为

---

## xhttp 当前实现说明

这次不是“只生成 xhttp 链接”，而是做了第一版真实服务端接入：

- 订阅生成时，`ex=yes` 会生成 `type=xhttp` 的 VLESS 节点
- 服务端接收 `POST` 请求体
- 解析 VLESS 头后，建立 TCP 出站连接
- 将请求体剩余数据继续上传到远端
- 将远端返回数据以流式响应回传客户端
- 复用已有的：
  - ProxyIP 覆盖
  - SOCKS5 降级
  - fallback 逻辑

### 当前限制
- 暂只支持 TCP，不支持 UDP
- xhttp 为第一版真实接入，建议先小范围验证客户端兼容性
- 推荐先配合 sing-box / v2ray-core 系客户端测试

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
| `ex` | 是否启用 xhttp，默认 `no` |
| `ae` | 是否允许 API 管理优选 IP，默认 `no` |
| `qj` | 设为 `no` 启用 direct -> SOCKS -> fallback |
| `doh` | DoH 地址，默认 `https://dns.google/dns-query` |
| `scu` | 订阅转换服务，默认 `https://url.v1.mk/sub` |

也可直接参考仓库根目录：

- `.env.edgeone.example`

---

## API 示例

### 查看客户端链接
```bash
curl "https://your-domain/{UUID或路径}/api/clients"
```

返回中会包含：
- `raw`
- `converterBase`
- `xhttpPath`
- 各客户端快速链接

---

## 建议你的上线顺序

1. 先只配置 `u`
2. 部署成功后访问 `/{u}`
3. 打开管理页确认配置读写正常
4. 再开启 `ae=yes`
5. 再加 `qj=no` 和 `s=` 做降级
6. 再验证 `api/clients` 和 `api/export`
7. 最后开启 `ex=yes` 测 xhttp

---

## 分支目的

这个分支的目标不是“完全追平 Cloudflare Worker 所有高级特性”，而是给你一个：

- 能导入 EdgeOne Pages
- 能跑 Node Functions
- 能用 KV
- 能提供订阅
- 能跑 WebSocket 隧道
- 能跑 xhttp 第一版
- 能做基础运维与备份恢复

的 **第一版可部署 EdgeOne 实现**。
