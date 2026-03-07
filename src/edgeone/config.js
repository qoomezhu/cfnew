import { CONFIG_KEY, kvGetJson, kvPutJson } from './store.js';
import { isValidUUID, normalizePath } from './utils.js';

const DEFAULT_UUID = '00000000-0000-4000-8000-000000000000';
const REGION_CODES = ['US', 'SG', 'JP', 'HK', 'KR', 'DE', 'SE', 'NL', 'FI', 'GB'];

const allowedKeys = [
  'u', 'p', 's', 'd', 'wk',
  'ev', 'et', 'ex', 'tp', 'ech', 'echDomain',
  'yx', 'yxURL', 'scu', 'epd', 'epi', 'egi',
  'qj', 'dkby', 'yxby', 'rm', 'ae',
  'doh', 'fallback'
];

function readEnv(context, key, fallback = '') {
  const fromContext = context?.env?.[key];
  if (fromContext != null && fromContext !== '') return String(fromContext);
  const fromProcess = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  if (fromProcess != null && fromProcess !== '') return String(fromProcess);
  return fallback;
}

function normalizeConfig(input = {}) {
  const config = {};
  for (const key of allowedKeys) {
    if (input[key] != null) config[key] = String(input[key]).trim();
  }

  config.u = isValidUUID(config.u) ? config.u : DEFAULT_UUID;
  config.d = config.d ? normalizePath(config.d) : '';
  config.p = config.p || '';
  config.s = config.s || '';
  config.wk = (config.wk || '').toUpperCase();
  config.ev = config.ev || 'yes';
  config.et = config.et || 'no';
  config.ex = config.ex || 'no';
  config.tp = config.tp || '';
  config.ech = config.ech || 'no';
  config.echDomain = config.echDomain || 'cloudflare-ech.com';
  config.yx = config.yx || '';
  config.yxURL = config.yxURL || '';
  config.scu = config.scu || 'https://url.v1.mk/sub';
  config.epd = config.epd || 'yes';
  config.epi = config.epi || 'yes';
  config.egi = config.egi || 'yes';
  config.qj = config.qj || 'yes';
  config.dkby = config.dkby || 'no';
  config.yxby = config.yxby || 'no';
  config.rm = config.rm || 'yes';
  config.ae = config.ae || 'no';
  config.doh = config.doh || 'https://dns.google/dns-query';
  config.fallback = config.fallback || '';
  return config;
}

function buildEnvConfig(context) {
  const envConfig = {};
  for (const key of allowedKeys) {
    const value = readEnv(context, key);
    if (value !== '') envConfig[key] = value;
  }
  return envConfig;
}

export function validateConfigPayload(payload = {}) {
  const errors = [];
  if (payload.u != null && payload.u !== '' && !isValidUUID(payload.u)) {
    errors.push('u 必须是合法 UUID');
  }
  if (payload.wk != null && payload.wk !== '') {
    const wk = String(payload.wk).trim().toUpperCase();
    if (!REGION_CODES.includes(wk)) {
      errors.push(`wk 仅支持：${REGION_CODES.join(', ')}`);
    }
  }
  if (payload.doh != null && payload.doh !== '') {
    try {
      const url = new URL(String(payload.doh));
      if (!/^https?:$/.test(url.protocol)) throw new Error('bad protocol');
    } catch {
      errors.push('doh 必须是合法的 http/https URL');
    }
  }
  if (payload.echDomain != null && payload.echDomain !== '') {
    const domain = String(payload.echDomain).trim();
    if (!/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,}$/.test(domain)) {
      errors.push('echDomain 必须是合法域名');
    }
  }
  if (payload.d != null && payload.d !== '' && String(payload.d).trim() === '/') {
    errors.push('d 不能仅为 /');
  }
  return errors;
}

export async function loadConfig(context) {
  const envConfig = buildEnvConfig(context);
  const storedConfig = await kvGetJson(context, CONFIG_KEY, {});
  return normalizeConfig({ ...envConfig, ...(storedConfig || {}) });
}

export async function saveConfig(context, payload) {
  const errors = validateConfigPayload(payload || {});
  if (errors.length) {
    const error = new Error(errors.join('；'));
    error.validationErrors = errors;
    throw error;
  }

  const current = await loadConfig(context);
  const next = { ...current };
  for (const key of allowedKeys) {
    if (payload[key] != null) next[key] = payload[key];
  }
  const normalized = normalizeConfig(next);
  await kvPutJson(context, CONFIG_KEY, normalized);
  return normalized;
}

export function publicConfig(config) {
  return { ...config };
}
