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

    const body = await request.json();
    const payload = {
      device_id: String(body.device_id || ''),
      nama: String(body.nama || ''),
      kota: String(body.kota || ''),
      location: String(body.location || 'none'),
      timezone: String(body.timezone || 'Asia/Jakarta'),
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
