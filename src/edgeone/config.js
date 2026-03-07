import { CONFIG_KEY, kvGetJson, kvPutJson } from './store.js';
import { isValidUUID, normalizePath } from './utils.js';

const DEFAULT_UUID = '00000000-0000-4000-8000-000000000000';

const allowedKeys = [
  'u', 'p', 's', 'd', 'wk',
  'ev', 'et', 'ex', 'tp', 'ech',
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

export async function loadConfig(context) {
  const envConfig = buildEnvConfig(context);
  const storedConfig = await kvGetJson(context, CONFIG_KEY, {});
  return normalizeConfig({ ...envConfig, ...(storedConfig || {}) });
}

export async function saveConfig(context, payload) {
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
