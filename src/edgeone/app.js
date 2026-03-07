import { loadConfig, publicConfig, saveConfig } from './config.js';
import { renderDashboard, renderHealthPage } from './html.js';
import { generateBase64Subscription } from './subscription.js';
import { kvDelete, kvGetJson, kvPutJson, PREFERRED_IPS_KEY } from './store.js';
import {
  getRouteBase,
  htmlResponse,
  isEnabled,
  isValidUUID,
  jsonResponse,
  normalizePath,
  parsePreferredList,
  textResponse,
  dedupeEndpoints,
} from './utils.js';
import { handleWebSocketTunnel } from './tunnel.js';

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function routeInfo(config) {
  const routeBase = getRouteBase(config);
  return {
    routeBase,
    subPath: normalizePath(`${routeBase}/sub`),
    configApiPath: normalizePath(`${routeBase}/api/config`),
    preferredApiPath: normalizePath(`${routeBase}/api/preferred-ips`),
  };
}

async function ensureApiEnabled(config) {
  if (!isEnabled(config.ae, false)) {
    throw new Error('当前未开启 API 管理，请先将 ae 设为 yes');
  }
}

export async function handleRequest(context) {
  const request = context.request;
  const config = await loadConfig(context);
  const url = new URL(request.url);
  const pathname = normalizePath(url.pathname);
  const routes = routeInfo(config);

  if ((request.headers.get('upgrade') || '').toLowerCase() === 'websocket') {
    return handleWebSocketTunnel(request, context, config);
  }

  if (pathname === '/' && request.method === 'GET') {
    return htmlResponse(renderHealthPage(request, config));
  }

  if (pathname === routes.routeBase && request.method === 'GET') {
    return htmlResponse(renderDashboard(request, config));
  }

  if (pathname === routes.subPath && request.method === 'GET') {
    const content = await generateBase64Subscription(request, context, config);
    return textResponse(content, 200, {
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
    });
  }

  if (pathname === routes.configApiPath) {
    if (request.method === 'GET') {
      return jsonResponse({
        routeBase: routes.routeBase,
        config: publicConfig(config),
      });
    }

    if (request.method === 'PUT' || request.method === 'POST') {
      const payload = await readJsonBody(request);
      const nextConfig = await saveConfig(context, payload || {});
      return jsonResponse({
        message: '配置已保存',
        routeBase: getRouteBase(nextConfig),
        config: publicConfig(nextConfig),
      });
    }

    return textResponse('Method Not Allowed', 405);
  }

  if (pathname === routes.preferredApiPath) {
    try {
      if (request.method === 'GET') {
        const items = await kvGetJson(context, PREFERRED_IPS_KEY, []);
        return jsonResponse({ items: Array.isArray(items) ? items : [] });
      }

      await ensureApiEnabled(config);

      if (request.method === 'POST') {
        const contentType = request.headers.get('content-type') || '';
        let incoming = [];
        let replace = url.searchParams.get('mode') === 'replace';

        if (contentType.includes('application/json')) {
          const body = await readJsonBody(request);
          if (Array.isArray(body)) incoming = body;
          else if (Array.isArray(body.items)) incoming = body.items;
          else if (body.host || body.ip) incoming = [body];
          replace = replace || Boolean(body.replace);
        } else {
          incoming = parsePreferredList(await request.text());
        }

        const normalizedIncoming = dedupeEndpoints(incoming.map((item) => ({
          host: item.host || item.ip,
          port: Number(item.port || 443),
          name: item.name || `${item.host || item.ip}:${item.port || 443}`,
        })));

        const current = replace ? [] : (await kvGetJson(context, PREFERRED_IPS_KEY, []));
        const merged = dedupeEndpoints([...(Array.isArray(current) ? current : []), ...normalizedIncoming]);
        await kvPutJson(context, PREFERRED_IPS_KEY, merged);
        return jsonResponse({ message: '保存成功', count: merged.length, items: merged });
      }

      if (request.method === 'DELETE') {
        const body = await readJsonBody(request);
        if (body?.all) {
          await kvDelete(context, PREFERRED_IPS_KEY);
          return jsonResponse({ message: '已清空优选列表', count: 0, items: [] });
        }

        const current = await kvGetJson(context, PREFERRED_IPS_KEY, []);
        const targetHost = body?.host || body?.ip;
        const targetPort = Number(body?.port || 0);
        const filtered = (Array.isArray(current) ? current : []).filter((item) => {
          if (!targetHost) return true;
          if (item.host !== targetHost) return true;
          if (!targetPort) return false;
          return Number(item.port) !== targetPort;
        });
        await kvPutJson(context, PREFERRED_IPS_KEY, filtered);
        return jsonResponse({ message: '删除完成', count: filtered.length, items: filtered });
      }
    } catch (error) {
      return jsonResponse({ error: 'api_error', message: error.message || 'API 失败' }, 400);
    }

    return textResponse('Method Not Allowed', 405);
  }

  if (config.d) {
    const uuidPath = normalizePath(`/${config.u}`);
    if (pathname === uuidPath || pathname === normalizePath(`${uuidPath}/sub`)) {
      return jsonResponse({
        error: '访问被拒绝',
        message: '当前已启用自定义路径模式，UUID 路径已禁用',
      }, 403);
    }
  } else {
    const firstSegment = pathname.split('/')[1] || '';
    if (firstSegment && isValidUUID(firstSegment) && firstSegment !== config.u) {
      return textResponse('UUID错误', 403);
    }
  }

  return textResponse('Not Found', 404);
}
