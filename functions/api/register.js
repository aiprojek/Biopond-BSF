export async function onRequestGet({ env }) {
  const webhookUrl = String(env.GAS_WEBHOOK_URL || '').trim();
  return new Response(
    JSON.stringify({
      ok: true,
      configured: Boolean(webhookUrl),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function onRequestPost({ request, env }) {
  try {
    const webhookUrl = String(env.GAS_WEBHOOK_URL || '').trim();
    if (!webhookUrl) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'missing_gas_webhook_url' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rawTextBody = await request.text();
    if (new TextEncoder().encode(rawTextBody).length > 8192) {
      return new Response(JSON.stringify({ ok: false, reason: 'payload_too_large' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const body = JSON.parse(rawTextBody || '{}');
    const cleanField = (val, maxLen = 120, fallback = '') =>
      String(val || fallback)
        .replace(/[\r\n]+/g, ' ')
        .trim()
        .slice(0, maxLen);
    const payload = {
      device_id: cleanField(body?.device_id, 64),
      nama: cleanField(body?.nama, 120),
      kota: cleanField(body?.kota, 80),
      location: cleanField(body?.location || 'none', 120, 'none'),
      timezone: cleanField(body?.timezone || 'Asia/Jakarta', 64, 'Asia/Jakarta'),
    };

    const gasRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const rawText = await gasRes.text();
    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    const isHtmlRedirect = rawText.trim().startsWith('<');
    if (!gasRes.ok || isHtmlRedirect || parsed?.status === 'error') {
      return new Response(
        JSON.stringify({
          ok: false,
          status: gasRes.status,
          reason: isHtmlRedirect
            ? 'gas_auth_required_or_html_response'
            : parsed?.message || 'gas_request_failed',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ ok: true, gasStatus: parsed?.status || 'success' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, reason: String(err?.message || 'register_error') }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
