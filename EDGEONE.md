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

### 诊断逻辑
- 使用你配置的 `doh` 列表按顺序尝试
- 自动补齐 `name` 与 `type=65`
- 优先解析 JSON 响应的 `Answer`
- 若无法解析 JSON，则退回文本识别：
  - `ech=`
  - `echconfig`
  - `echconfiglist`
- 结果状态可能为：
  - `SUCCESS`
  - `UNKNOWN`
  - `FAILED`
  - `DISABLED`

### 缓存逻辑
- 使用 KV 保存 ECH 探测结果
- 默认缓存：`3600` 秒
- 强制测试接口会跳过缓存，重新探测

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

### 查看订阅响应头里的 ECH 信息
```bash
curl -I "https://your-domain/{UUID或路径}/sub"
```

---

## 环境变量新增
| 变量 | 说明 |
| --- | --- |
| `ech` | 是否启用 ECH，默认 `no` |
| `echDomain` | ECH 目标域名，默认 `cloudflare-ech.com` |
| `echCacheTTL` | ECH 缓存秒数，默认 `3600` |
| `doh` | DoH 地址，支持多个逗号分隔 |

例如：

```env
ech=yes
echDomain=cloudflare-ech.com
echCacheTTL=3600
doh=https://dns.google/dns-query,https://cloudflare-dns.com/dns-query
```

---

## 建议你的测试顺序

1. 先部署并确保 `/api/status` 正常
2. 设置：
   - `ech=yes`
   - `echDomain=cloudflare-ech.com`
   - `echCacheTTL=3600`
   - `doh=https://dns.google/dns-query,https://cloudflare-dns.com/dns-query`
3. 查看 `/api/status` 中 `ech.status`
4. 点击管理页里的“强制测试 ECH”
5. 查看 `/sub` 响应头中的 `X-ECH-*`
6. 再用 sing-box / v2ray-core 系客户端验证节点

---

## 分支目的

这个分支的目标不是“完全追平 Cloudflare Worker 所有高级特性”，而是给你一个：

- 能导入 EdgeOne Pages
- 能跑 Node Functions
- 能用 KV
- 能提供订阅
- 能跑 WebSocket 隧道
- 能跑 xhttp 第一版
- 能跑 ECH 第二版
- 能做基础运维与备份恢复

的 **第一版可部署 EdgeOne 实现**。
