export function escapeHTML(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeImageDataUrl(val: unknown): string {
  const s = String(val ?? '').trim();
  if (!s) return '';
  return /^data:image\/(webp|png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : '';
}

export function sanitizeSyncUrl(rawUrl: unknown, allowRelative = false): string {
  const s = String(rawUrl ?? '').trim();
  if (!s) return '';
  if (allowRelative && s.startsWith('/') && !s.startsWith('//')) return s;
  try {
    const parsed = new URL(s);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return s;
  } catch {
    // invalid URL
  }
  return '';
}

export function generateRandomWorkspaceId(prefix = 'kebun'): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let suffix = '';
  for (let i = 0; i < bytes.length; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  const cleanPrefix =
    String(prefix || 'kebun')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '') || 'kebun';
  return `${cleanPrefix}-${suffix}`;
}
