# EdgeOne 分支说明

这个 `edgeone` 分支不是把 Cloudflare Worker API 硬搬到 EdgeOne，而是按 **EdgeOne Pages / Node Functions** 的运行模型重写的可部署版本。

## 这套实现为什么是“实际可行”的

我采用的是 EdgeOne 当前最稳妥的落地方式：

- **Pages Node Functions**：负责 WebSocket + TCP 出站 + 订阅/API
- **Pages KV**：负责配置与优选 IP 列表
- **WebSocketPair + node:net**：用于隧道核心
- **DoH**：用于 DNS 查询，避免依赖 UDP 原生转发
- **xhttp POST 流式转发**：用于承接原项目的 xhttp 思路
- **ECH 参数下发 + DoH 诊断**：用于承接原项目的 ECH 能力
- **ECH KV 缓存 + 多 DoH 回退**：用于增强 EdgeOne 环境下的 ECH 稳定性

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
- ECH 第二版真实接入
- Trojan 服务端 WS 支持

---

## 第一组已完成

### 1. Trojan 服务端补完
- 订阅里的 Trojan 节点不再只是“看起来有”
- 现在服务端已支持 Trojan WS 握手解析与 TCP 转发
- Trojan 密码：
  - 若配置 `tp`，则使用自定义密码
  - 否则默认使用 `u`（UUID）
- `/api/status` 会显示：
  - `trojan=true/false`
  - `trojanPasswordSource=custom/uuid`

### 2. xhttp 路由已收紧
- 现在不会再把任意非 API 的 POST 当成 xhttp
- xhttp 只在专属路径生效：
  - `xhttpPath = /${uuid前8位}`
- `/api/status` 与 `/api/clients` 都会明确返回 `xhttpPath`

### 3. `/api/status` 增加 `serverReady`
- 现在状态接口会明确返回：
  - `vless`
  - `trojan`
  - `xhttp`
  - `wsPath`
  - `xhttpPath`
  - `trojanPasswordSource`
  - `notes`

---

## A2 第二版：ECH 当前实现说明

这次不是“只加一个开关”，而是补了一套更完整的真实可用 ECH 第二版：

### 已实现
- 新增配置项：
  - `echDomain`
  - `echCacheTTL`
- `ech=yes` 时，VLESS / Trojan / xhttp 节点会附带：
  - `ech=${echDomain}+${primaryDoh}`
- 订阅接口会返回诊断响应头：
  - `X-ECH-Status`
  - `X-ECH-Domain`
  - `X-ECH-DoH`
  - `X-ECH-Used-DoH`
  - `X-ECH-Source`
  - `X-ECH-Detail`
- 状态接口会返回：
  - ECH 状态
  - DoH 列表
  - 实际使用的 DoH
  - 来源（cache/network/config）
  - 缓存时间与过期时间
- 管理页新增：
  - 强制测试 ECH 按钮
- ECH 结果会写入 KV 缓存
- `doh` 现支持多个地址，逗号分隔，失败自动切换

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
- `POST {xhttpPath}` 的 xhttp 流式入口（启用 `ex=yes` 后生效）
- `p` 覆盖 ProxyIP
- `wk` 覆盖地区
- `s` 覆盖 SOCKS5
- `rm=no` 关闭地区智能匹配
- `qj=no` 开启 direct -> SOCKS5 -> fallback 的降级链路
- `ech=yes` 后对 VLESS / Trojan / xhttp 节点下发 ECH 参数
- 订阅和状态接口返回 ECH 诊断
- Trojan 服务端握手与转发已就绪

---

## 新增/更新接口

### 查看状态（默认走缓存）
```bash
curl "https://your-domain/{UUID或路径}/api/status"
```

### 强制重新测试 ECH（跳过缓存）
```bash
curl "https://your-domain/{UUID或路径}/api/ech-test"
```

### 查看客户端链接
```bash
curl "https://your-domain/{UUID或路径}/api/clients"
```

返回中会包含：
- `wsPath`
- `xhttpPath`
- 各客户端快速链接

---

## 建议你的测试顺序

1. 先部署并确保 `/api/status` 正常
2. 设置：
   - `et=yes`
   - `ex=yes`
   - `ech=yes`
3. 查看 `/api/status` 中：
   - `serverReady`
   - `ech.status`
4. 先测 Trojan-WS
5. 再测 xhttp（仅专属路径）
6. 最后叠加 ECH 验证

---

## 分支目的

这个分支的目标不是“完全追平 Cloudflare Worker 所有高级特性”，而是给你一个：

- 能导入 EdgeOne Pages
- 能跑 Node Functions
- 能用 KV
- 能提供订阅
- 能跑 WebSocket 隧道
- 能跑 Trojan-WS
- 能跑 xhttp 第一版
- 能跑 ECH 第二版
- 能做基础运维与备份恢复

的 **第一版可部署 EdgeOne 实现**。
