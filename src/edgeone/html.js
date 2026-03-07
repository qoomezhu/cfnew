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
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0b1220; color: #e5eefb; }
    .wrap { max-width: 1080px; margin: 0 auto; padding: 32px 20px 48px; }
    .hero { margin-bottom: 24px; }
    .hero h1 { margin: 0 0 8px; font-size: 30px; }
    .hero p { margin: 0; color: #9fb0d3; line-height: 1.7; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 18px; }
    .card { background: #121a2b; border: 1px solid #26324d; border-radius: 16px; padding: 20px; }
    .card h2 { margin: 0 0 12px; font-size: 20px; }
    .muted { color: #9fb0d3; }
    textarea { width: 100%; min-height: 320px; background: #0b1220; color: #e5eefb; border: 1px solid #26324d; border-radius: 12px; padding: 14px; font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; resize: vertical; box-sizing: border-box; }
    .small { min-height: 220px; }
    button { cursor: pointer; border: 0; background: #2563eb; color: white; padding: 10px 14px; border-radius: 10px; margin-right: 12px; }
    button.secondary { background: #334155; }
    .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    pre { background: #0b1220; border: 1px solid #26324d; border-radius: 12px; padding: 14px; overflow: auto; }
    .tips { margin-top: 12px; line-height: 1.7; color: #9fb0d3; }
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
      </section>

      <section class="card">
        <h2>配置 JSON</h2>
        <div class="muted">可直接编辑后保存。常用字段：<code>u</code>、<code>d</code>、<code>p</code>、<code>s</code>、<code>wk</code>、<code>ev</code>、<code>et</code>、<code>yx</code>、<code>yxURL</code>、<code>ae</code>、<code>qj</code>、<code>doh</code>。</div>
        <textarea id="configBox">${configJson}</textarea>
        <div class="row" style="margin-top: 12px;">
          <button onclick="saveConfig()">保存配置</button>
          <button class="secondary" onclick="location.reload()">刷新页面</button>
        </div>
      </section>

      <section class="card">
        <h2>优选 IP / 域名管理</h2>
        <div class="muted">每行一个，格式：<code>1.2.3.4:443#香港节点</code> 或 <code>proxy.example.com:443#自定义名称</code>。保存此列表需要 <code>ae=yes</code>。</div>
        <textarea id="preferredBox" class="small" placeholder="1.1.1.1:443#节点A\n8.8.8.8:443#节点B"></textarea>
        <div class="row" style="margin-top: 12px;">
          <button onclick="loadPreferred()">加载列表</button>
          <button onclick="replacePreferred()">整表替换</button>
          <button class="secondary" onclick="clearPreferred()">清空列表</button>
        </div>
      </section>
    </div>
  </div>

  <script>
    const BASE = ${JSON.stringify(routeBase)};

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
      } catch (error) {
        alert('保存失败：' + error.message);
      }
    }

    async function loadPreferred() {
      try {
        const response = await fetch(BASE + '/api/preferred-ips');
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '加载失败');
        const lines = (data.items || []).map((item) => `${item.host}:${item.port}#${item.name || ''}`.replace(/#$/, ''));
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

    loadPreferred();
  </script>
</body>
</html>`;
}
