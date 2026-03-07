import { ADDRESS_TYPE_DOMAIN, ADDRESS_TYPE_IPV4, ADDRESS_TYPE_IPV6, buildRuntimeConfig, concatUint8Arrays, connectTargetWithFallback, toUint8Array } from './tunnel.js';

function concatMany(parts) {
  if (!parts.length) return new Uint8Array();
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function readUntil(reader, chunks, currentLength, minLength) {
  let total = currentLength;
  while (total < minLength) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = await toUint8Array(value);
    if (!chunk.length) continue;
    chunks.push(chunk);
    total += chunk.length;
  }
  return total;
}

async function parseXhttpHeaderFromStream(readable, uuid) {
  if (!readable) throw new Error('xhttp body 不存在');
  const reader = readable.getReader();
  const chunks = [];
  let total = 0;

  total = await readUntil(reader, chunks, total, 24);
  let merged = concatMany(chunks);
  if (merged.length < 24) throw new Error('xhttp header 过短');

  const version = merged[0];
  const userBytes = merged.slice(1, 17);
  const userHex = Array.from(userBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const normalizedUuid = String(uuid).replace(/-/g, '').toLowerCase();
  if (userHex !== normalizedUuid) throw new Error('xhttp UUID 校验失败');

  const optLen = merged[17];
  const cmdIndex = 18 + optLen;
  total = await readUntil(reader, chunks, total, cmdIndex + 1 + 2 + 1);
  merged = concatMany(chunks);
  if (merged.length < cmdIndex + 4) throw new Error('xhttp header 不完整');

  const cmd = merged[cmdIndex];
  if (cmd !== 1) throw new Error(`xhttp 暂仅支持 TCP，收到命令 ${cmd}`);

  const portIndex = cmdIndex + 1;
  const port = new DataView(merged.buffer, merged.byteOffset + portIndex, 2).getUint16(0);
  let addressIndex = portIndex + 2;
  const addressType = merged[addressIndex];
  addressIndex += 1;

  let host = '';
  let headerEnd = addressIndex;
  if (addressType === ADDRESS_TYPE_IPV4) {
    total = await readUntil(reader, chunks, total, addressIndex + 4);
    merged = concatMany(chunks);
    host = Array.from(merged.slice(addressIndex, addressIndex + 4)).join('.');
    headerEnd = addressIndex + 4;
  } else if (addressType === ADDRESS_TYPE_DOMAIN) {
    total = await readUntil(reader, chunks, total, addressIndex + 1);
    merged = concatMany(chunks);
    const domainLength = merged[addressIndex];
    total = await readUntil(reader, chunks, total, addressIndex + 1 + domainLength);
    merged = concatMany(chunks);
    host = new TextDecoder().decode(merged.slice(addressIndex + 1, addressIndex + 1 + domainLength));
    headerEnd = addressIndex + 1 + domainLength;
  } else if (addressType === ADDRESS_TYPE_IPV6) {
    total = await readUntil(reader, chunks, total, addressIndex + 16);
    merged = concatMany(chunks);
    const view = new DataView(merged.buffer, merged.byteOffset + addressIndex, 16);
    const parts = [];
    for (let i = 0; i < 8; i += 1) parts.push(view.getUint16(i * 2).toString(16));
    host = parts.join(':');
    headerEnd = addressIndex + 16;
  } else {
    throw new Error(`xhttp 地址类型无效: ${addressType}`);
  }

  if (!host) throw new Error('xhttp 目标地址为空');

  return {
    version,
    host,
    port,
    addressType,
    initialData: merged.slice(headerEnd),
    reader,
  };
}

export async function handleXhttpRequest(request, context, config) {
  const runtimeConfig = buildRuntimeConfig(request, config);
  const parsed = await parseXhttpHeaderFromStream(request.body, config.u);
  const connected = await connectTargetWithFallback(parsed.host, parsed.port, parsed.initialData, runtimeConfig);
  const remoteSocket = connected.socket;
  let responseClosed = false;
  let uploadClosed = false;

  const responseHeader = new Uint8Array([parsed.version, 0]);

  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(responseHeader);

      const closeIfDone = () => {
        if (responseClosed) return;
        if (uploadClosed) {
          responseClosed = true;
          try { controller.close(); } catch {}
        }
      };

      remoteSocket.on('data', (chunk) => {
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch (error) {
          responseClosed = true;
          try { controller.error(error); } catch {}
          try { remoteSocket.destroy(error); } catch {}
        }
      });

      remoteSocket.on('end', () => {
        uploadClosed = true;
        closeIfDone();
      });

      remoteSocket.on('close', () => {
        uploadClosed = true;
        closeIfDone();
      });

      remoteSocket.on('error', (error) => {
        responseClosed = true;
        try { controller.error(error); } catch {}
      });

      (async () => {
        try {
          while (true) {
            const { value, done } = await parsed.reader.read();
            if (done) break;
            const chunk = await toUint8Array(value);
            if (chunk.length) remoteSocket.write(Buffer.from(chunk));
          }
          try { remoteSocket.end(); } catch {}
        } catch (error) {
          try { remoteSocket.destroy(error); } catch {}
        } finally {
          try { parsed.reader.releaseLock(); } catch {}
        }
      })();
    },
    cancel(reason) {
      try { remoteSocket.destroy(reason instanceof Error ? reason : undefined); } catch {}
    },
  });

  return new Response(readable, {
    status: 200,
    headers: {
      'content-type': 'application/grpc',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    },
  });
}
