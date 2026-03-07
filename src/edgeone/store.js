export const CONFIG_KEY = 'cfnew:edgeone:config';
export const PREFERRED_IPS_KEY = 'cfnew:edgeone:preferred-ips';
export const ECH_CACHE_PREFIX = 'cfnew:edgeone:ech:';

export function getKV(context) {
  return context?.env?.C || context?.env?.my_kv || globalThis.C || globalThis.my_kv || null;
}

export async function kvGetText(context, key) {
  const kv = getKV(context);
  if (!kv) return null;
  const value = await kv.get(key);
  if (value == null) return null;
  return typeof value === 'string' ? value : String(value);
}

export async function kvPutText(context, key, value) {
  const kv = getKV(context);
  if (!kv) throw new Error('未找到 EdgeOne KV 绑定，请绑定变量名 C 或 my_kv');
  await kv.put(key, value);
}

export async function kvDelete(context, key) {
  const kv = getKV(context);
  if (!kv) throw new Error('未找到 EdgeOne KV 绑定，请绑定变量名 C 或 my_kv');
  if (typeof kv.delete === 'function') {
    await kv.delete(key);
    return;
  }
  await kv.put(key, '');
}

export async function kvGetJson(context, key, fallback = null) {
  const text = await kvGetText(context, key);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function kvPutJson(context, key, value) {
  await kvPutText(context, key, JSON.stringify(value));
}
