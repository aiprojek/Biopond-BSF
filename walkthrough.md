# Security Summary

**Reviewed Files**: 14 (`index.html`, `src/main.tsx`, `src/core/sanitizers.ts`, `src/core/backupCrypto.ts`, `src/core/syncHelpers.ts`, `src/core/metrics.ts`, `src/core/core.test.ts`, `functions/api/sync.js`, `functions/api/register.js`, `functions/api/config.js`, `vite.config.ts`, `package.json`, `metadata.json`, `README.md`)
**Issues Resolved**: 9

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Predictable Default Workspace ID & Weak Pairing RNG | `index.html`, `src/core/sanitizers.ts` | 5492, 6218, 7424 | Default Cloudflare sync workspace fell back to a guessable string (`farm-utama`), and pairing PIN/ID generation used `Math.random()`. | Medium | Fixed | Generated cryptographically random `kebun-xxxxxxxxxx` defaults via `crypto.getRandomValues()`, added **Acak ID** UI + warning banner when `farm-utama` is active without `SYNC_TOKEN`, and switched pairing generation to `crypto.getRandomValues()`. |
| Unencrypted Backup Exports Containing Auth Metadata | `index.html`, `src/core/backupCrypto.ts` | 4334, 12049, 12137 | Full database backups were exported only as plaintext JSON without optional password encryption. | Medium | Fixed | Added `#modal-backup-crypto` supporting **AES-256-GCM + PBKDF2-SHA256** (`150,000` iterations, `.bsfbackup` envelope) while keeping legacy unencrypted JSON exports free of PIN/recovery hashes. |
| Deleted Record Resurrection & Sync Payload Overflow | `index.html`, `src/core/syncHelpers.ts` | 6778, 11851 | Hard deletes disappeared from local snapshots and allowed stale remote devices to re-insert deleted items; large log photos could exceed Cloudflare KV limits. | Medium | Fixed | Converted all 5 entity delete flows to `deletedAt` soft-delete tombstones, propagated tombstones with 90-day pruning, added automatic 18 MB oldest-photo trimming on cloud push, and added manual >30 day photo pruning. |
| Owner PIN Drift Across Multi-Device Sync | `index.html`, `src/core/syncHelpers.ts` | 7424, 7547 | Owner PIN and recovery updates did not synchronize reliably by timestamp across devices or pairing setups. | Low | Fixed | Tracked `ownerPinUpdatedAt` on PIN set/removal and synchronized PIN & recovery hashes deterministically via `resolvePinSyncState()` across cloud sync and pairing. |
| Unbounded Sync & Pairing Relay Payloads | `functions/api/sync.js` | 152, 205 | `PUT /api/sync` accepted unlimited request body sizes and allowed overwriting an active unexpired `?pair=` slot. | Medium | Fixed | Enforced 16 KB limit for `?pair=` and 20 MB limit for workspace sync (`413` response), and blocked overwriting unexpired pairing slots (`409`). |
| Non-Constant-Time Token Comparison | `functions/api/sync.js` | 26 | Bearer `SYNC_TOKEN` validation used direct `===` string comparison. | Low | Fixed | Switched to `timingSafeEqualStr()` constant-time comparison across string characters and lengths. |
| Unvalidated Image Data URLs in Sync & Preview | `index.html`, `src/core/sanitizers.ts` | 5463, 6705, 9343, 12668 | Restored/synced `daily_logs[].photoDataUrl` values were assigned directly to `<img src>` without checking image format/scheme. | Medium | Fixed | Added `sanitizeImageDataUrl()` allowing only base64 WebP/PNG/JPEG data URLs and applied it on import, remote sync merge, preview modal, and AI attachment. |
| Unvalidated Sync & Pairing Endpoint URLs | `index.html`, `src/core/sanitizers.ts` | 5470, 7230, 7525, 7547, 7639 | WebDAV URLs, Cloudflare sync endpoints, and scanned `BSFPAIR:v1:` pairing payloads did not validate URL schemes before `fetch()`. | Medium | Fixed | Added `sanitizeSyncUrl()` restricting WebDAV URLs to `http:`/`https:` and Cloudflare sync endpoints to relative `/...` or `http:`/`https:`, and validated pairing payloads before saving or joining. |
| Worker-Mode Enforcement & Pairing Token Cleanup | `index.html` | 7424, 11851, 12049, 12137 | Owner-only actions relied primarily on hidden DOM containers, and generated pairing tokens lingered after closing Settings. | Medium | Fixed | Added explicit `requireOwnerAccess()` guards inside sensitive settings, backup, pruning, and pairing functions and cleared generated pairing tokens/QR previews on modal/tab exit. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| HTML Rendering & AI Formatting | `index.html`, `src/core/sanitizers.ts` | Dynamic strings, operator names, container labels, QR outputs, and AI markdown responses pass through `escapeHTML()` before rendering. |
| Server-Side Secrets | `functions/api/register.js`, `functions/api/config.js` | `GAS_WEBHOOK_URL` and `SYNC_TOKEN` are read solely on the server from Cloudflare `env`; only public OAuth client IDs are exposed via `/api/config`. |
| Local PIN & Lockout | `index.html` | Owner/staff PINs and recovery answers are hashed with SHA-256 (`crypto.subtle.digest`) and protected with progressive lockout cooldowns (30s / 5m). |
| Encrypted Backup Format | `src/core/backupCrypto.ts` | `.bsfbackup` envelopes encrypt serialized backup JSON with per-export random 16-byte salt, 12-byte IV, 150,000 PBKDF2-SHA256 iterations, and AES-256-GCM authenticated encryption. |
| Automated Core Test Suite | `src/core/core.test.ts` | Unit tests verify sanitizers, AES-GCM backup roundtrip & wrong-password rejection, tombstone merge precedence, photo payload trimming, and bioconversion metrics. |

---

## PoC Verification

### 1. Image Data URL Sanitization on Sync / Restore
#### Summary
| Field | Value |
|---|---|
| Issue Type | Unvalidated Image Source Injection |
| Impact | Medium |
| Affected File | `index.html:5463` / `src/core/sanitizers.ts` |
| Test Scenario | A tampered sync/backup JSON containing `photoDataUrl: "https://tracker.example/pixel.png"` or `"javascript:alert(1)"` in `daily_logs` |

#### How It Was Fixed
Implemented `sanitizeImageDataUrl()` matching only `^data:image\/(webp|png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$` in `src/core/sanitizers.ts` (with offline fallback in `index.html`) and wired it into `mergeRemoteSnapshot()`, `importDatabaseJSON()`, `exportDatabaseJSON()`, `openPhotoPreviewModal()`, and the AI photo attachment loader.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Tampered `daily_logs` entry arrives via `importDatabaseJSON()` or `mergeRemoteSnapshot()` | Entry enters collection processing |
| 2 | `sanitizeImageDataUrl(l.photoDataUrl)` evaluates regex at `index.html:6705` | Non-base64-image schemes fail check and return `""` |
| 3 | `openPhotoPreviewModal()` re-checks `sanitizeImageDataUrl()` at `index.html:9343` before setting `img.src` | **Handled Safely** (blocked with error toast, no external request) |

#### Conclusion
**Fix Verified** — Non-image or external URLs can no longer be stored or assigned to `photo-preview-img`.

### 2. Malicious Scheme Rejection in Scanned Pairing Token
#### Summary
| Field | Value |
|---|---|
| Issue Type | Unvalidated Sync Endpoint Scheme |
| Impact | Medium |
| Affected File | `index.html:7547` |
| Test Scenario | `BSFPAIR:v1:...` payload with `syncConfig: { provider: "webdav", wdUrl: "javascript:fetch(...)" }` or `cfEndpoint: "//evil.example/api"` |

#### How It Was Fixed
Implemented `sanitizeSyncUrl()` requiring `http:`/`https:` (and disallowing protocol-relative `//` paths) in `applyPairingObject()`, `joinWithPairingInput()`, `createDevicePairing()`, `wdSyncPull()`, `wdSyncPush()`, `cfSyncPull()`, and `cfSyncPush()`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Scanned pairing token is decoded into `applyPairingObject()` at `index.html:7547` | `parsed.syncConfig` enters validation |
| 2 | `sanitizeSyncUrl()` parses protocol and rejects `javascript:` and `//` at `index.html:7552-7555` | Validation returns empty string |
| 3 | `applyPairingObject()` throws validation error before `saveSyncConfig()` or `fetch()` runs | **Handled Safely** (pairing rejected before modifying config) |

#### Conclusion
**Fix Verified** — Invalid URL schemes in pairing tokens or sync settings are blocked before any storage or network request.

### 3. Password-Protected Backup Encryption & Tamper Rejection
#### Summary
| Field | Value |
|---|---|
| Issue Type | Sensitive Backup Exposure Without Encryption |
| Impact | Medium |
| Affected File | `src/core/backupCrypto.ts` & `index.html:12049` |
| Test Scenario | Exporting a `.bsfbackup` file with a user password, then attempting decryption with both the wrong password and the valid password |

#### How It Was Fixed
Added `encryptBackupPayload()` and `decryptBackupPayload()` using Web Crypto PBKDF2-SHA256 (`150,000` iterations) and AES-256-GCM authenticated encryption, triggered from `#modal-backup-crypto`. Wrong passwords or modified ciphertexts fail GCM tag verification cleanly without altering local IndexedDB data.

#### Conclusion
**Fix Verified** — Validated via unit tests (`bun test`) verifying roundtrip decryption and authentication failure on wrong passwords.

### 4. Pairing Slot Overwrite & Oversized Payload Rejection in `/api/sync`
#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Size Limit & Active Pairing Overwrite |
| Impact | Medium |
| Affected File | `functions/api/sync.js:153` |
| Test Scenario | `PUT /api/sync?pair=AB12` sent with >16 KB body or targeting an active unexpired `pairId` |

#### How It Was Fixed
Added `MAX_PAIR_BYTES` (16 KB) and `MAX_SYNC_BYTES` (20 MB) checks returning HTTP `413`, plus an existing-key TTL check returning HTTP `409` if an active pairing code is still valid. On the client, `cfSyncPush()` trims oldest log photos cleanly at 18 MB before sending.

#### Conclusion
**Fix Verified** — Oversized payloads and active pairing overwrites are rejected at the edge worker before storage writes.
