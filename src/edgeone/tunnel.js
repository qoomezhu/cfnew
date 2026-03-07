import net from 'node:net';
import { detectRegion, parseAddressAndPort, pickBackupEndpoint, isValidUUID } from './utils.js';

const ADDRESS_TYPE_IPV4 = 1;
const ADDRESS_TYPE_DOMAIN = 2;
const ADDRESS_TYPE_IPV6 = 3;
const hexTable = Array.from({ length: 256 }, (_, i) => (i + 256).toString(16).slice(1));

function decodeBase64UrlToUint8Array(input) {
  if (!input) return null;
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return new Uint8Array(Buffer.from(padded, 'base64'));
  } catch {
    return null;
  }
}

function concatUint8Arrays(a, b) {
  const left = a instanceof Uint8Array ? a : new Uint8Array(a);
  const right = b instanceof Uint8Array ? b : new Uint8Array(b);
  const result = new Uint8Array(left.length + right.length);
  result.set(left, 0);
  result.set(right, left.length);
  return result;
}

async function toUint8Array(data) {
  if (data == null) return new Uint8Array();
  if (data instanceof Uint8Array) return data;
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof Blob !== 'undefined' && data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (typeof data === 'string') return new TextEncoder().encode(data);
  return new Uint8Array(data);
}

function formatIdentifier(arr, offset = 0) {
  const id = (
    hexTable[arr[offset]] + hexTable[arr[offset + 1]] + hexTable[arr[offset + 2]] + hexTable[arr[offset + 3]] + '-' +
    hexTable[arr[offset + 4]] + hexTable[arr[offset + 5]] + '-' +
    hexTable[arr[offset + 6]] + hexTable[arr[offset + 7]] + '-' +
    hexTable[arr[offset + 8]] + hexTable[arr[offset + 9]] + '-' +
    hexTable[arr[offset + 10]] + hexTable[arr[offset + 11]] + hexTable[arr[offset + 12]] + hexTable[arr[offset + 13]] +
    hexTable[arr[offset + 14]] + hexTable[arr[offset + 15]]
  ).toLowerCase();

  if (!isValidUUID(id)) {
    throw new TypeError('invalid user id');
  }
  return id;
}

function parseVlessHeader(chunk, expectedUserId) {
  if (!(chunk instanceof Uint8Array)) chunk = new Uint8Array(chunk);
  if (chunk.byteLength < 24) throw new Error('invalid data');

  const version = chunk.slice(0, 1);
  const userId = formatIdentifier(chunk.slice(1, 17));
  if (userId !== expectedUserId) throw new Error('invalid user');

  const optLen = chunk[17];
  const cmd = chunk[18 + optLen];
  const portIndex = 19 + optLen;
  const port = new DataView(chunk.buffer, chunk.byteOffset + portIndex, 2).getUint16(0);
  let addressIndex = portIndex + 2;
  const addressType = chunk[addressIndex];
  addressIndex += 1;

  let host = '';
  if (addressType === ADDRESS_TYPE_IPV4) {
    host = Array.from(chunk.slice(addressIndex, addressIndex + 4)).join('.');
    addressIndex += 4;
  } else if (addressType === ADDRESS_TYPE_DOMAIN) {
    const length = chunk[addressIndex];
    addressIndex += 1;
    host = new TextDecoder().decode(chunk.slice(addressIndex, addressIndex + length));
    addressIndex += length;
  } else if (addressType === ADDRESS_TYPE_IPV6) {
    const view = new DataView(chunk.buffer, chunk.byteOffset + addressIndex, 16);
    const parts = [];
    for (let i = 0; i < 8; i += 1) parts.push(view.getUint16(i * 2).toString(16));
    host = parts.join(':');
    addressIndex += 16;
  } else {
    throw new Error(`invalid address type: ${addressType}`);
  }

  if (!host) throw new Error('empty address');

  return {
    version,
    command: cmd,
    port,
    host,
    rawData: chunk.slice(addressIndex),
  };
}

function parseSocksConfig(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const atIndex = raw.lastIndexOf('@');
  let auth = '';
  let addressPart = raw;
  if (atIndex > 0) {
    auth = raw.slice(0, atIndex);
    addressPart = raw.slice(atIndex + 1);
  }
  const { address, port } = parseAddressAndPort(addressPart);
  if (!address || !port) return null;
  const [username = '', password = ''] = auth ? auth.split(':') : [];
  return { host: address, port: Number(port), username, password };
}

function readOnce(socket, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
    };
    const onData = (data) => {
      cleanup();
      resolve(data);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      cleanup();
      reject(new Error('socket closed during handshake'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('socket handshake timeout'));
    }, timeoutMs);

    socket.once('data', onData);
    socket.once('error', onError);
    socket.once('close', onClose);
  });
}

function connectDirect(host, port, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port: Number(port) });
    const onError = (error) => {
      socket.destroy();
      reject(error);
    };

    socket.setNoDelay(true);
    socket.setKeepAlive(true, 20000);
    socket.setTimeout(timeoutMs, () => {
      socket.destroy(new Error('connect timeout'));
    });
    socket.once('error', onError);
    socket.once('connect', () => {
      socket.off('error', onError);
      socket.setTimeout(0);
      resolve(socket);
    });
  });
}

async function connectViaSocks5(socks, targetHost, targetPort) {
  const socket = await connectDirect(socks.host, socks.port);

  const methods = [0x00];
  if (socks.username || socks.password) methods.push(0x02);
  socket.write(Buffer.from([0x05, methods.length, ...methods]));

  const greeting = await readOnce(socket);
  if (!greeting || greeting[1] === 0xff) {
    socket.destroy();
    throw new Error('SOCKS5 鉴权方法协商失败');
  }

  if (greeting[1] === 0x02) {
    const userBytes = Buffer.from(socks.username || '');
    const passBytes = Buffer.from(socks.password || '');
    socket.write(Buffer.concat([
      Buffer.from([0x01, userBytes.length]),
      userBytes,
      Buffer.from([passBytes.length]),
      passBytes,
    ]));
    const authReply = await readOnce(socket);
    if (!authReply || authReply[1] !== 0x00) {
      socket.destroy();
      throw new Error('SOCKS5 用户名密码认证失败');
    }
  }

  let addressField;
  if (net.isIP(targetHost) === 4) {
    addressField = Buffer.from([0x01, ...targetHost.split('.').map((v) => Number(v))]);
  } else {
    const hostBytes = Buffer.from(targetHost);
    addressField = Buffer.concat([Buffer.from([0x03, hostBytes.length]), hostBytes]);
  }

  const portField = Buffer.from([(targetPort >> 8) & 0xff, targetPort & 0xff]);
  socket.write(Buffer.concat([
    Buffer.from([0x05, 0x01, 0x00]),
    addressField,
    portField,
  ]));

  const reply = await readOnce(socket);
  if (!reply || reply[1] !== 0x00) {
    socket.destroy();
    throw new Error('SOCKS5 CONNECT 失败');
  }

  return socket;
}

function buildRuntimeConfig(request, config) {
  const url = new URL(request.url);
  const search = url.searchParams;
  const proxyOverrideRaw = search.get('p') || config.p || '';
  const proxyOverride = proxyOverrideRaw ? parseAddressAndPort(proxyOverrideRaw) : null;
  const workerRegion = (search.get('wk') || config.wk || detectRegion(request, config.wk || '')).toUpperCase();
  const enableRegionMatching = String(search.get('rm') || config.rm || 'yes').toLowerCase() !== 'no';
  const socks = parseSocksConfig(search.get('s') || config.s || '');

  return {
    proxyOverride: proxyOverride?.address ? proxyOverride : null,
    socks,
    workerRegion,
    enableRegionMatching,
    fallback: config.fallback || '',
    fallbackEnabled: String(config.qj || 'yes').toLowerCase() === 'no',
    dohURL: config.doh || 'https://dns.google/dns-query',
  };
}

function buildAttempts(targetHost, targetPort, runtimeConfig) {
  const attempts = [];
  const seen = new Set();

  const push = (mode, host, port, label) => {
    const key = `${mode}:${host}:${port}`;
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push({ mode, host, port, label });
  };

  if (runtimeConfig.proxyOverride?.address) {
    push('direct', runtimeConfig.proxyOverride.address, runtimeConfig.proxyOverride.port || targetPort, 'proxyip');
    if (runtimeConfig.socks) {
      push('socks', runtimeConfig.proxyOverride.address, runtimeConfig.proxyOverride.port || targetPort, 'proxyip-socks');
    }
    return attempts;
  }

  push('direct', targetHost, targetPort, 'target');
  if (runtimeConfig.socks) push('socks', targetHost, targetPort, 'target-socks');

  if (runtimeConfig.fallbackEnabled) {
    if (runtimeConfig.fallback) {
      const parsed = parseAddressAndPort(runtimeConfig.fallback);
      if (parsed.address) {
        push('direct', parsed.address, parsed.port || targetPort, 'fallback-env');
        if (runtimeConfig.socks) push('socks', parsed.address, parsed.port || targetPort, 'fallback-env-socks');
      }
    } else {
      const backup = pickBackupEndpoint(runtimeConfig.workerRegion, runtimeConfig.enableRegionMatching);
      if (backup?.domain) {
        push('direct', backup.domain, backup.port || targetPort, 'fallback-region');
        if (runtimeConfig.socks) push('socks', backup.domain, backup.port || targetPort, 'fallback-region-socks');
      }
    }
  }

  return attempts;
}

async function openByAttempt(attempt, runtimeConfig) {
  if (attempt.mode === 'socks') {
    return connectViaSocks5(runtimeConfig.socks, attempt.host, attempt.port);
  }
  return connectDirect(attempt.host, attempt.port);
}

export async function handleWebSocketTunnel(request, context, config) {
  const runtimeConfig = buildRuntimeConfig(request, config);
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();

  let remoteSocket = null;
  let isClosed = false;
  let isDnsMode = false;
  let vlessResponseHeader = null;
  let handshakeDone = false;

  const closeAll = () => {
    if (isClosed) return;
    isClosed = true;
    try {
      remoteSocket?.destroy();
    } catch {}
    try {
      if (server.readyState === 1 || server.readyState === 2) server.close();
    } catch {}
  };

  const sendToClient = (chunk) => {
    if (isClosed || server.readyState !== 1) return;
    const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    const payload = vlessResponseHeader ? concatUint8Arrays(vlessResponseHeader, data) : data;
    vlessResponseHeader = null;
    server.send(payload);
  };

  const bindRemoteSocket = (socket) => {
    remoteSocket = socket;
    socket.on('data', (chunk) => {
      try {
        sendToClient(new Uint8Array(chunk));
      } catch (error) {
        console.error('remote->ws send error:', error);
        closeAll();
      }
    });
    socket.on('close', closeAll);
    socket.on('error', (error) => {
      console.error('remote socket error:', error);
      closeAll();
    });
  };

  const handleDnsQuery = async (payload) => {
    const response = await fetch(runtimeConfig.dohURL, {
      method: 'POST',
      headers: {
        accept: 'application/dns-message',
        'content-type': 'application/dns-message',
      },
      body: payload,
    });
    if (!response.ok) throw new Error(`DoH 查询失败: ${response.status}`);
    const result = new Uint8Array(await response.arrayBuffer());
    sendToClient(result);
  };

  const establishConnection = async (targetHost, targetPort, initialData) => {
    const attempts = buildAttempts(targetHost, targetPort, runtimeConfig);
    let lastError = null;

    for (const attempt of attempts) {
      try {
        const socket = await openByAttempt(attempt, runtimeConfig);
        bindRemoteSocket(socket);
        if (initialData?.length) socket.write(Buffer.from(initialData));
        return;
      } catch (error) {
        lastError = error;
        console.error(`connect attempt failed [${attempt.label}] ${attempt.host}:${attempt.port}`, error);
      }
    }

    throw lastError || new Error('所有连接尝试均失败');
  };

  const processChunk = async (chunk) => {
    if (isClosed) return;
    const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    if (!handshakeDone) {
      const parsed = parseVlessHeader(data, config.u);
      handshakeDone = true;
      vlessResponseHeader = new Uint8Array([parsed.version[0], 0]);

      if (parsed.command === 2) {
        if (parsed.port !== 53) throw new Error('UDP 仅支持 DNS 53 端口');
        isDnsMode = true;
        await handleDnsQuery(parsed.rawData);
        return;
      }

      if (parsed.command !== 1) throw new Error('仅支持 TCP 和 DNS-UDP');
      await establishConnection(parsed.host, parsed.port, parsed.rawData);
      return;
    }

    if (isDnsMode) {
      await handleDnsQuery(data);
      return;
    }

    if (!remoteSocket || remoteSocket.destroyed) throw new Error('远端连接不存在');
    remoteSocket.write(Buffer.from(data));
  };

  server.addEventListener('message', async (event) => {
    try {
      const chunk = await toUint8Array(event.data);
      if (chunk.length) await processChunk(chunk);
    } catch (error) {
      console.error('websocket message error:', error);
      closeAll();
    }
  });

  server.addEventListener('close', closeAll);
  server.addEventListener('error', closeAll);

  const earlyData = decodeBase64UrlToUint8Array(request.headers.get('sec-websocket-protocol') || '');
  if (earlyData?.length) {
    processChunk(earlyData).catch((error) => {
      console.error('early data error:', error);
      closeAll();
    });
  }

  return new Response(null, { status: 101, webSocket: client });
}
