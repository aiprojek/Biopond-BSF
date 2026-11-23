export async function onRequestPost({ request, env }) {
  try {
    const webhookUrl = env.GAS_WEBHOOK_URL;
    if (!webhookUrl) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
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

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
