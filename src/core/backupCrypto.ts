export interface EncryptedBackupEnvelope {
  app: string;
  format: 'bsf-encrypted-backup-v1';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  salt: string;
  iv: string;
  ciphertext: string;
  exportedAt: string;
}

const BACKUP_FORMAT = 'bsf-encrypted-backup-v1';
const KDF_ITERATIONS = 150_000;

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  let b64 = String(b64url || '').replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function deriveBackupAesKey(
  password: string,
  saltBytes: Uint8Array,
  iterations = KDF_ITERATIONS
): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(String(password));
  const keyMaterial = await crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveKey']);
  const saltBuf = new Uint8Array(saltBytes).buffer;
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function isEncryptedBackupEnvelope(obj: unknown): obj is EncryptedBackupEnvelope {
  if (!obj || typeof obj !== 'object') return false;
  const rec = obj as Record<string, unknown>;
  return (
    rec.format === BACKUP_FORMAT &&
    typeof rec.ciphertext === 'string' &&
    typeof rec.iv === 'string' &&
    typeof rec.salt === 'string'
  );
}

export async function encryptBackupPayload(
  snapshot: Record<string, unknown>,
  password: string
): Promise<EncryptedBackupEnvelope> {
  const cleanPass = String(password || '');
  if (cleanPass.length < 4) {
    throw new Error('Password enkripsi backup minimal 4 karakter.');
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('Browser tidak mendukung enkripsi Web Crypto.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupAesKey(cleanPass, salt, KDF_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(snapshot));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    app: 'Biopond BSF',
    format: BACKUP_FORMAT,
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
    cipher: 'AES-256-GCM',
    salt: bytesToBase64Url(salt),
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(cipherBuf)),
    exportedAt: typeof snapshot.exportedAt === 'string' ? snapshot.exportedAt : new Date().toISOString(),
  };
}

export async function decryptBackupPayload(
  envelope: EncryptedBackupEnvelope,
  password: string
): Promise<Record<string, unknown>> {
  const cleanPass = String(password || '');
  if (!cleanPass) {
    throw new Error('Masukkan password untuk membuka file backup terenkripsi.');
  }
  if (!isEncryptedBackupEnvelope(envelope)) {
    throw new Error('Format file backup terenkripsi tidak valid.');
  }
  const iterations = Math.max(10_000, Math.min(1_000_000, Number(envelope.iterations) || KDF_ITERATIONS));
  const salt = base64UrlToBytes(envelope.salt);
  const iv = base64UrlToBytes(envelope.iv);
  const cipherBytes = base64UrlToBytes(envelope.ciphertext);
  const key = await deriveBackupAesKey(cleanPass, salt, iterations);

  try {
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv).buffer },
      key,
      new Uint8Array(cipherBytes).buffer
    );
    const jsonStr = new TextDecoder().decode(plainBuf);
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    throw new Error('Password backup salah atau file cadangan telah rusak.');
  }
}
