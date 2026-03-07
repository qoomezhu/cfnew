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
- ECH 第一版真实接入

---

## A2：ECH 当前实现说明

这次不是“只加一个开关”，而是补了一套真实可用的 ECH 第一版：

### 已实现
- 新增配置项：`echDomain`
- `ech=yes` 时，VLESS / Trojan / xhttp 节点会附带：
  - `ech=${echDomain}+${doh}`
- 订阅接口会返回诊断响应头：
  - `X-ECH-Status`
  - `X-ECH-Domain`
  - `X-ECH-DoH`
  - `X-ECH-Detail`
- 状态接口会返回 ECH 诊断结果
- 管理页会显示 ECH 状态 / 域名 / DoH / 说明

### 诊断逻辑
- 会使用你配置的 `doh`
- 以 `type=65` 查询你配置的 `echDomain`
- 尝试在返回文本中识别：
  - `ech=`
  - `echconfig`
  - `echconfiglist`

### 当前限制
- 这是第一版 ECH 真实接入，重点是：
  - 节点参数真实下发
  - DoH 真实检测
  - 响应头/状态页真实反馈
- 还没有做更重的：
  - 多 DoH 自动切换
  - ECH 结果缓存
  - 更细颗粒度结构化解析

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
- `ech=yes` 后对 VLESS / Trojan / xhttp 节点下发 ECH 参数
- 订阅和状态接口返回 ECH 诊断

---

## 部署方式

### 环境变量新增
| 变量 | 说明 |
| --- | --- |
| `ech` | 是否启用 ECH，默认 `no` |
| `echDomain` | ECH 目标域名，默认 `cloudflare-ech.com` |
| `doh` | DoH 地址，默认 `https://dns.google/dns-query` |

例如：

```env
ech=yes
echDomain=cloudflare-ech.com
doh=https://dns.google/dns-query
```

---

## API 示例

### 查看 ECH 状态
```bash
curl "https://your-domain/{UUID或路径}/api/status"
```

你会在返回 JSON 里看到：
- `ech.status`
- `ech.domain`
- `ech.doh`
- `ech.detail`

### 查看订阅响应头里的 ECH 信息
```bash
curl -I "https://your-domain/{UUID或路径}/sub"
```

你会看到：
- `X-ECH-Status`
- `X-ECH-Domain`
- `X-ECH-DoH`
- `X-ECH-Detail`

---

## 建议你的测试顺序

1. 先部署并确保 `/api/status` 正常
2. 设置：
   - `ech=yes`
   - `echDomain=cloudflare-ech.com`
   - `doh=https://dns.google/dns-query`
3. 查看 `/api/status` 中 `ech.status`
4. 查看 `/sub` 响应头中的 `X-ECH-*`
5. 再用 sing-box / v2ray-core 系客户端验证节点

---

## 分支目的

这个分支的目标不是“完全追平 Cloudflare Worker 所有高级特性”，而是给你一个：

- 能导入 EdgeOne Pages
- 能跑 Node Functions
- 能用 KV
- 能提供订阅
- 能跑 WebSocket 隧道
- 能跑 xhttp 第一版
- 能跑 ECH 第一版
- 能做基础运维与备份恢复

的 **第一版可部署 EdgeOne 实现**。
