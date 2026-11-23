const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
};

function sanitizeWorkspace(raw) {
  const cleaned = String(raw || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .slice(0, 64);
  return cleaned || 'default';
}

function sanitizePairId(raw) {
  const cleaned = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  return cleaned.length >= 4 ? cleaned : '';
}

const MAX_PAIR_BYTES = 16 * 1024;
const MAX_SYNC_BYTES = 20 * 1024 * 1024;

function timingSafeEqualStr(a, b) {
  const s1 = String(a || '');
  const s2 = String(b || '');
  const len = Math.max(s1.length, s2.length);
  let diff = s1.length ^ s2.length;
  for (let i = 0; i < len; i++) {
    diff |= (s1.charCodeAt(i) || 0) ^ (s2.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function isAuthorized(request, env) {
  const expected = String(env.SYNC_TOKEN || '').trim();
  if (!expected) return true;
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return timingSafeEqualStr(token, expected);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const pairId = sanitizePairId(url.searchParams.get('pair'));

  // Encrypted Device Pairing Relay (PIN-encrypted AES-GCM blob, 15-min TTL, one-time read)
  if (pairId) {
    const pairKey = `bsf-pair:${pairId}`;
    try {
      let rawPair = null;
      if (env.BSF_SYNC_KV) {
        rawPair = await env.BSF_SYNC_KV.get(pairKey);
        if (rawPair) await env.BSF_SYNC_KV.delete(pairKey).catch(() => {});
      } else if (env.BSF_SYNC_R2) {
        const obj = await env.BSF_SYNC_R2.get(`${pairKey}.json`);
        if (obj) {
          rawPair = await obj.text();
          await env.BSF_SYNC_R2.delete(`${pairKey}.json`).catch(() => {});
        }
      } else {
        return new Response(JSON.stringify({ error: 'Storage KV/R2 belum dikonfigurasi.' }), {
          status: 501,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      if (!rawPair) {
        return new Response(JSON.stringify({ error: 'Kode pairing tidak ditemukan atau sudah kedaluwarsa.' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      const parsed = JSON.parse(rawPair);
      if (parsed.expiresAt && Date.now() > Number(parsed.expiresAt)) {
        return new Response(JSON.stringify({ error: 'Kode pairing sudah kedaluwarsa. Buat ulang di perangkat 1.' }), {
          status: 410,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      return new Response(rawPair, {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err?.message || 'Gagal mengambil kode pairing.' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  if (!isAuthorized(request, env)) {
    return new Response(JSON.stringify({ error: 'Token sinkronisasi tidak valid.' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const workspace = sanitizeWorkspace(url.searchParams.get('workspace'));
  const key = `bsf-sync:${workspace}`;

  try {
    if (env.BSF_SYNC_KV) {
      const value = await env.BSF_SYNC_KV.get(key);
      if (!value) {
        return new Response(JSON.stringify({ error: 'Belum ada data tersinkron.', empty: true }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      return new Response(value, {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (env.BSF_SYNC_R2) {
      const obj = await env.BSF_SYNC_R2.get(`${key}.json`);
      if (!obj) {
        return new Response(JSON.stringify({ error: 'Belum ada data tersinkron.', empty: true }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      const text = await obj.text();
      return new Response(text, {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        error: 'Binding Cloudflare KV (BSF_SYNC_KV) atau R2 (BSF_SYNC_R2) belum dikonfigurasi.',
      }),
      {
        status: 501,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || 'Gagal membaca data sync.' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestPut({ request, env }) {
  const url = new URL(request.url);
  const pairId = sanitizePairId(url.searchParams.get('pair'));

  if (pairId) {
    try {
      const rawBody = await request.text();
      if (rawBody.length > MAX_PAIR_BYTES) {
        return new Response(JSON.stringify({ error: 'Ukuran payload pairing melebihi batas (16 KB).' }), {
          status: 413,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      const parsed = JSON.parse(rawBody);
      if (!parsed || typeof parsed.encrypted !== 'string' || !parsed.iv) {
        return new Response(JSON.stringify({ error: 'Payload pairing tidak valid.' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      const pairKey = `bsf-pair:${pairId}`;

      // Cegah menimpa kode pairing aktif yang belum kedaluwarsa
      let existingRaw = null;
      if (env.BSF_SYNC_KV) {
        existingRaw = await env.BSF_SYNC_KV.get(pairKey);
      } else if (env.BSF_SYNC_R2) {
        const existingObj = await env.BSF_SYNC_R2.get(`${pairKey}.json`);
        if (existingObj) existingRaw = await existingObj.text();
      }
      if (existingRaw) {
        try {
          const existingParsed = JSON.parse(existingRaw);
          if (existingParsed?.expiresAt && Date.now() < Number(existingParsed.expiresAt)) {
            return new Response(JSON.stringify({ error: 'Kode pairing sedang dipakai. Coba buat ulang.' }), {
              status: 409,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
        } catch {
          // Abaikan bila corrupt
        }
      }

      const payload = JSON.stringify({
        encrypted: parsed.encrypted,
        iv: parsed.iv,
        salt: parsed.salt || '',
        expiresAt: Date.now() + 15 * 60 * 1000,
      });

      if (env.BSF_SYNC_KV) {
        await env.BSF_SYNC_KV.put(pairKey, payload, { expirationTtl: 900 });
        return new Response(JSON.stringify({ ok: true, pairId, storage: 'kv' }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      if (env.BSF_SYNC_R2) {
        await env.BSF_SYNC_R2.put(`${pairKey}.json`, payload, {
          httpMetadata: { contentType: 'application/json' },
        });
        return new Response(JSON.stringify({ ok: true, pairId, storage: 'r2' }), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'KV/R2 belum dikonfigurasi.' }), {
        status: 501,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err?.message || 'Gagal menyimpan pairing.' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  }

  if (!isAuthorized(request, env)) {
    return new Response(JSON.stringify({ error: 'Token sinkronisasi tidak valid.' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const workspace = sanitizeWorkspace(url.searchParams.get('workspace'));
  const key = `bsf-sync:${workspace}`;

  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_SYNC_BYTES) {
      return new Response(JSON.stringify({ error: 'Ukuran data sinkronisasi melebihi batas 20 MB.' }), {
        status: 413,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || !parsed.data) {
      return new Response(JSON.stringify({ error: 'Format payload sync tidak valid.' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const serialized = JSON.stringify(parsed);

    if (env.BSF_SYNC_KV) {
      await env.BSF_SYNC_KV.put(key, serialized);
      return new Response(JSON.stringify({ ok: true, storage: 'kv', workspace }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (env.BSF_SYNC_R2) {
      await env.BSF_SYNC_R2.put(`${key}.json`, serialized, {
        httpMetadata: { contentType: 'application/json' },
      });
      return new Response(JSON.stringify({ ok: true, storage: 'r2', workspace }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        error: 'Binding Cloudflare KV (BSF_SYNC_KV) atau R2 (BSF_SYNC_R2) belum dikonfigurasi.',
      }),
      {
        status: 501,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || 'Gagal menyimpan data sync.' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
}
