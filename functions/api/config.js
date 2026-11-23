export async function onRequestGet({ env }) {
  return new Response(
    JSON.stringify({
      googleClientId: env.GOOGLE_CLIENT_ID || '',
      dropboxAppKey: env.DROPBOX_APP_KEY || '',
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
