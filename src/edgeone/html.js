import { getRouteBase, safeJsonForHtml } from './utils.js';

export function renderHealthPage(request, config) {
  const routeBase = getRouteBase(config);
  const origin = new URL(request.url).origin;
  const dashboardUrl = `${origin}${routeBase}`;
  const subUrl = `${origin}${routeBase}/sub`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CFnew EdgeOne</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0b1220; color: #e5eefb; }
    .wrap { max-width: 920px; margin: 0 auto; padding: 48px 20px; }
    .card { background: #121a2b; border: 1px solid #26324d; border-radius: 16px; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
    h1 { margin: 0 0 12px; font-size: 32px; }
    p { color: #9fb0d3; line-height: 1.7; }
    code, pre { background: #0b1220; border: 1px solid #26324d; border-radius: 10px; }
    code { padding: 2px 6px; }
    pre { padding: 16px; overflow: auto; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 20px; }
    a.button { display: inline-block; padding: 12px 16px; border-radius: 10px; text-decoration: none; background: #2563eb; color: white; margin-right: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>✅ EdgeOne 版服务已就绪</h1>
      <p>这是为 <strong>EdgeOne Pages Node Functions</strong> 准备的可部署实现。根路径主要用于健康检查与跳转提示；真正的管理页与订阅页位于你的密钥路径。</p>
      <div class="grid">
        <div>
          <p><strong>管理页</strong></p>
          <pre>${dashboardUrl}</pre>
        </div>
        <div>
          <p><strong>订阅地址</strong></p>
          <pre>${subUrl}</pre>
        </div>
      </div>
      <p>
        <a class="button" href="${dashboardUrl}">打开管理页</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function renderDashboard(request, config) {
  const url = new URL(request.url);
  const routeBase = getRouteBase(config);
  const subUrl = `${url.origin}${routeBase}/sub`;
  const configJson = safeJsonForHtml(config);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CFnew EdgeOne 管理页</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0b1220; color: #e5eefb; }
    .wrap { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
    .hero { margin-bottom: 24px; }
    .hero h1 { margin: 0 0 8px; font-size: 30px; }
    .hero p { margin: 0; color: #9fb0d3; line-height: 1.7; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 18px; }
    .card { background: #121a2b; border: 1px solid #26324d; border-radius: 16px; padding: 20px; }
    .card h2 { margin: 0 0 12px; font-size: 20px; }
    .muted { color: #9fb0d3; }
    textarea { width: 100%; min-height: 320px; background: #0b1220; color: #e5eefb; border: 1px solid #26324d; border-radius: 12px; padding: 14px; font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; resize: vertical; }
    .small { min-height: 220px; }
    button, .button { cursor: pointer; border: 0; background: #2563eb; color: white; padding: 10px 14px; border-radius: 10px; margin-right: 12px; text-decoration: none; display: inline-block; }
    button.secondary, .secondary { background: #334155; }
    .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    pre { background: #0b1220; border: 1px solid #26324d; border-radius: 12px; padding: 14px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
    .tips { margin-top: 12px; line-height: 1.7; color: #9fb0d3; }
    table { width: 100%; border-collapse: collapse; }
    td, th { padding: 10px 8px; border-bottom: 1px solid #26324d; text-align: left; vertical-align: top; }
    th { color: #9fb0d3; width: 180px; font-weight: 600; }
    .ok { color: #22c55e; }
    .warn { color: #f59e0b; }
    .err { color: #ef4444; }
    .pill { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #1e293b; color: #cbd5e1; margin: 0 8px 8px 0; }
    .full { grid-column: 1 / -1; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>CFnew · EdgeOne Pages Node Functions</h1>
      <p>这不是 Cloudflare Worker 兼容层，而是按 <strong>EdgeOne 平台特性</strong> 重写的可部署版本：订阅/API/KV/WS 隧道均运行在 EdgeOne Pages 中。</p>
    </div>

    <div class="grid">
      <section class="card">
        <h2>当前地址</h2>
        <pre>管理页：${url.origin}${routeBase}
订阅：${subUrl}
WebSocket：${url.origin}/?ed=2048</pre>
        <div class="tips">说明：VLESS/Trojan 节点的 WS 路径仍然是根路径 <code>/?ed=2048</code>，管理页和订阅页走密钥路径。</div>
        <div class="row" style="margin-top:12px;">
          <a class="button" href="${subUrl}" target="_blank">打开订阅</a>
          <button class="secondary" onclick="copyText(${JSON.stringify(subUrl)})">复制订阅地址</button>
        </div>
      </section>

      <section class="card">
        <h2>运行状态</h2>
        <div id="statusBox" class="muted">正在加载状态…</div>
      </section>

      <section class="card full">
        <h2>客户端快速链接</h2>
        <div id="clientsBox" class="muted">正在生成客户端链接…</div>
      </section>

      <section class="card full">
        <h2>配置 JSON</h2>
        <div class="muted">可直接编辑后保存。常用字段：<code>u</code>、<code>d</code>、<code>p</code>、<code>s</code>、<code>wk</code>、<code>ev</code>、<code>et</code>、<code>yx</code>、<code>yxURL</code>、<code>ae</code>、<code>qj</code>、<code>doh</code>。</div>
        <textarea id="configBox">${configJson}</textarea>
        <div class="row" style="margin-top: 12px;">
          <button onclick="saveConfig()">保存配置</button>
          <button class="secondary" onclick="reloadStatus()">刷新状态</button>
        </div>
      </section>

      <section class="card full">
        <h2>优选 IP / 域名管理</h2>
        <div class="muted">每行一个，格式：<code>1.2.3.4:443#香港节点</code> 或 <code>proxy.example.com:443#自定义名称</code>。保存此列表需要 <code>ae=yes</code>。</div>
        <textarea id="preferredBox" class="small" placeholder="1.1.1.1:443#节点A\n8.8.8.8:443#节点B"></textarea>
        <div class="row" style="margin-top: 12px;">
          <button onclick="loadPreferred()">加载列表</button>
          <button onclick="replacePreferred()">整表替换</button>
          <button class="secondary" onclick="clearPreferred()">清空列表</button>
        </div>
      </section>

      <section class="card full">
        <h2>配置导入 / 导出</h2>
        <div class="muted">这里导出的 JSON 包含当前配置与优选 IP 列表，可用于整站迁移或快速回滚。</div>
        <textarea id="backupBox" class="small" placeholder="点击“导出当前配置”后会填充 JSON 备份；也可将备份 JSON 粘贴到此处后点击“导入备份”。"></textarea>
        <div class="row" style="margin-top: 12px;">
          <button onclick="exportAll()">导出当前配置</button>
          <button onclick="importAll()">导入备份</button>
          <button class="secondary" onclick="copyBackup()">复制备份 JSON</button>
        </div>
      </section>

      <section class="card full">
        <h2>配置说明</h2>
        <div>
          <span class="pill">u = UUID</span>
          <span class="pill">d = 自定义路径</span>
          <span class="pill">p = ProxyIP</span>
          <span class="pill">s = SOCKS5</span>
          <span class="pill">wk = 地区</span>
          <span class="pill">ev = VLESS</span>
          <span class="pill">et = Trojan</span>
          <span class="pill">ae = API 管理</span>
          <span class="pill">qj = 降级链路</span>
          <span class="pill">doh = DNS over HTTPS</span>
          <span class="pill">scu = 订阅转换服务</span>
        </div>
        <div class="tips">说明：当前分支优先保证 EdgeOne 平台上的可用性，因此已实现真实可运行的 WebSocket/TCP/KV/DoH 方案；xhttp 与 ECH 需要额外协议链路，当前未做伪实现。</div>
      </section>
    </div>
  </div>

  <script>
    const BASE = ${JSON.stringify(routeBase)};

    function esc(v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        alert('已复制');
      } catch (e) {
        alert('复制失败：' + e.message);
      }
    }

    function renderStatus(data) {
      const status = document.getElementById('statusBox');
      const featureEntries = Object.entries(data.features || {});
      const rows = [
        ['路由基址', data.routeBase],
        ['地区判定', data.region || '-'],
        ['KV 绑定', data.kvBound ? '<span class="ok">已绑定</span>' : '<span class="err">未绑定</span>'],
        ['当前主机', data.host || '-'],
        ['当前路径', data.path || '-'],
        ['ProxyIP', data.proxyIP || '<span class="warn">未设置</span>'],
        ['SOCKS5', data.socksEnabled ? '<span class="ok">已启用</span>' : '<span class="warn">未启用</span>'],
        ['自定义路径', data.customPath || '<span class="warn">未设置</span>'],
      ];

      const featureHtml = featureEntries.map(([k, v]) => {
        const cls = v ? 'ok' : 'warn';
        return '<span class="pill"><span class="' + cls + '">' + esc(k) + ': ' + (v ? 'on' : 'off') + '</span></span>';
      }).join('');

      status.innerHTML =
        '<table>' +
        rows.map(function (row) {
          return '<tr><th>' + row[0] + '</th><td>' + row[1] + '</td></tr>';
        }).join('') +
        '</table>' +
        '<div style="margin-top:12px;">' + featureHtml + '</div>' +
        '<div class="tips" style="margin-top:12px;">请求 ID：<code>' + esc(data.requestId || '-') + '</code></div>';
    }

    function renderClients(data) {
      const box = document.getElementById('clientsBox');
      const entries = Object.entries(data.clients || {});
      box.innerHTML =
        '<div class="tips">原始订阅：<code>' + esc(data.raw || '') + '</code></div>' +
        '<div class="tips">转换服务：<code>' + esc(data.converterBase || '') + '</code></div>' +
        '<table style="margin-top:12px;">' +
        entries.map(function (entry) {
          const name = entry[0];
          const link = entry[1];
          return '<tr><th>' + esc(name) + '</th><td><div class="mono">' + esc(link) + '</div><div style="margin-top:8px;"><button onclick="copyText(' + JSON.stringify(link) + ')">复制</button></div></td></tr>';
        }).join('') +
        '</table>';
    }

    async function reloadStatus() {
      const box = document.getElementById('statusBox');
      box.textContent = '正在加载状态…';
      try {
        const response = await fetch(BASE + '/api/status');
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '状态获取失败');
        renderStatus(data);
      } catch (error) {
        box.innerHTML = '<span class="err">状态获取失败：' + esc(error.message) + '</span>';
      }
    }

    async function loadClients() {
      const box = document.getElementById('clientsBox');
      box.textContent = '正在生成客户端链接…';
      try {
        const response = await fetch(BASE + '/api/clients');
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '客户端链接生成失败');
        renderClients(data);
      } catch (error) {
        box.innerHTML = '<span class="err">客户端链接加载失败：' + esc(error.message) + '</span>';
      }
    }

    async function saveConfig() {
      try {
        const payload = JSON.parse(document.getElementById('configBox').value);
        const response = await fetch(BASE + '/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '保存失败');
        alert('配置已保存，若你修改了 u 或 d，请用返回的新路径重新访问。');
        document.getElementById('configBox').value = JSON.stringify(data.config, null, 2);
        reloadStatus();
        loadClients();
      } catch (error) {
        alert('保存失败：' + error.message);
      }
    }

    async function loadPreferred() {
      try {
        const response = await fetch(BASE + '/api/preferred-ips');
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '加载失败');
        const lines = (data.items || []).map((item) => item.host + ':' + item.port + (item.name ? '#' + item.name : ''));
        document.getElementById('preferredBox').value = lines.join('\n');
      } catch (error) {
        alert('加载失败：' + error.message);
      }
    }

    async function replacePreferred() {
      try {
        const text = document.getElementById('preferredBox').value;
        const response = await fetch(BASE + '/api/preferred-ips?mode=replace', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          body: text,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '保存失败');
        alert('优选列表已保存，共 ' + (data.count || 0) + ' 条。');
      } catch (error) {
        alert('保存失败：' + error.message);
      }
    }

    async function clearPreferred() {
      if (!confirm('确定清空全部优选列表？')) return;
      try {
        const response = await fetch(BASE + '/api/preferred-ips', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ all: true }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '清空失败');
        document.getElementById('preferredBox').value = '';
        alert('优选列表已清空。');
      } catch (error) {
        alert('清空失败：' + error.message);
      }
    }

    async function exportAll() {
      try {
        const response = await fetch(BASE + '/api/export');
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '导出失败');
        document.getElementById('backupBox').value = JSON.stringify(data, null, 2);
      } catch (error) {
        alert('导出失败：' + error.message);
      }
    }

    async function importAll() {
      try {
        const text = document.getElementById('backupBox').value.trim();
        if (!text) throw new Error('请先粘贴备份 JSON');
        const payload = JSON.parse(text);
        const response = await fetch(BASE + '/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '导入失败');
        alert('导入完成');
        if (data.config) {
          document.getElementById('configBox').value = JSON.stringify(data.config, null, 2);
        }
        loadPreferred();
        reloadStatus();
        loadClients();
      } catch (error) {
        alert('导入失败：' + error.message);
      }
    }

    async function copyBackup() {
      const text = document.getElementById('backupBox').value;
      if (!text.trim()) return alert('没有可复制的备份内容');
      return copyText(text);
    }

    loadPreferred();
    reloadStatus();
    loadClients();
  </script>
</body>
</html>`;
}
