# Security Summary

**Reviewed Files**: 14 (`index.html`, `src/main.tsx`, `src/core/sanitizers.ts`, `src/core/backupCrypto.ts`, `src/core/syncHelpers.ts`, `src/core/metrics.ts`, `src/core/core.test.ts`, `functions/api/sync.js`, `functions/api/register.js`, `functions/api/config.js`, `vite.config.ts`, `package.json`, `metadata.json`, `README.md`)
**Issues Resolved**: 14

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Worker-to-Owner Escalation via Team Form | `index.html` | 13058 | While locked in Worker Mode, `#form-add-operator` allowed creating a new operator with `role = 'owner'` and switching into it without Owner PIN verification. | High | Fixed | Enforced `requireOwnerAccess()` at the top of `addOperatorRecord()` so creating any operator requires Owner PIN verification when locked. |
| Missing Lockout on Recovery Question Form | `index.html` | 12970 | PIN verification had progressive brute-force cooldowns, but the forgot-PIN recovery answer form did not enforce attempt throttling. | Medium | Fixed | Added `recovery_<key>` lockout tracking (5 failures → 30s cooldown, 10+ → 5m cooldown) inside `form-recovery-pin` submit handling. |
| Wildcard CORS on Authenticated Sync API | `functions/api/sync.js` | 25 | `/api/sync` returned `Access-Control-Allow-Origin: *` even when `SYNC_TOKEN` Bearer auth was enabled, and measured payload length by UTF-16 code units instead of UTF-8 bytes. | Medium | Fixed | Replaced `*` with `buildCorsHeaders()` permitting only same-origin, localhost dev origins, or `env.SYNC_ALLOWED_ORIGIN` (with `Vary: Origin`), and switched size checks to UTF-8 byte lengths. |
| CSV Spreadsheet Formula Injection | `index.html`, `src/core/sanitizers.ts` | 9597 | `exportMonthlyCSV()` quoted cells without neutralizing leading `=`, `+`, `-`, `@`, tab, or CR characters in notes, farm names, or operator names. | Medium | Fixed | Added `sanitizeCsvCell()` prefixing `'` to formula-prefixed strings while preserving numeric negative values, plus unit test coverage. |
| Missing Owner Guards on Finance, Reports & Sync Actions | `index.html` | 9429, 9591, 13423, 13680 | Financial submission (`form-transaction`), monthly PDF/CSV report exports, plain JSON export, and manual cloud sync controls relied mainly on hidden UI sections in Worker Mode. | Medium | Fixed | Added explicit `isWorkerLocked()` / `requireOwnerAccess()` guards inside `form-transaction`, `printMonthlyReport()`, `exportMonthlyCSV()`, `btn-backup-export-plain`, and manual sync controls. |
| Active-Record Filtering & Restore Input Validation | `index.html`, `functions/api/register.js` | 5047, 5193, 9357, 12084 | Operator PIN lookups, monthly report fallbacks, container matching, and backup restores did not consistently filter soft-deleted tombstones or validate restored hash shapes, and `/api/register` did not cap request body size. | Low | Fixed | Filtered all operator/report/container lookups with `isActiveRecord`, sanitized restored arrays and PIN hash formats in `applyRestoredBackupObject()`, replaced `Math.random()` ID fallbacks with `crypto.getRandomValues()`, and bounded `/api/register` payloads to 8 KB. |
| Predictable Default Workspace ID & Weak Pairing RNG | `index.html`, `src/core/sanitizers.ts` | 5498, 6230, 7458 | Default Cloudflare sync workspace fell back to a guessable string (`farm-utama`), and pairing PIN/ID generation used `Math.random()`. | Medium | Fixed | Generated cryptographically random `kebun-xxxxxxxxxx` defaults via `crypto.getRandomValues()`, added **Acak ID** UI + warning banner, and switched pairing generation to `crypto.getRandomValues()`. |
| Unencrypted Backup Exports Containing Auth Metadata | `index.html`, `src/core/backupCrypto.ts` | 4334, 12077, 12165 | Full database backups were exported only as plaintext JSON without optional password encryption. | Medium | Fixed | Added `#modal-backup-crypto` supporting **AES-256-GCM + PBKDF2-SHA256** (`150,000` iterations, `.bsfbackup` envelope) while excluding PIN hashes from unencrypted JSON exports. |
| Deleted Record Resurrection & Sync Payload Overflow | `index.html`, `src/core/syncHelpers.ts` | 6812, 11885 | Hard deletes disappeared from local snapshots and allowed stale remote devices to re-insert deleted items; large log photos could exceed Cloudflare KV limits. | Medium | Fixed | Converted all 5 entity delete flows to `deletedAt` soft-delete tombstones, propagated tombstones with 90-day pruning, added automatic 18 MB oldest-photo trimming on cloud push, and added manual >30 day photo pruning. |
| Owner PIN Drift Across Multi-Device Sync | `index.html`, `src/core/syncHelpers.ts` | 7458, 7581 | Owner PIN and recovery updates did not synchronize reliably by timestamp across devices or pairing setups. | Low | Fixed | Tracked `ownerPinUpdatedAt` on PIN set/removal and synchronized PIN & recovery hashes deterministically via `resolvePinSyncState()`. |
| Unbounded Sync & Pairing Relay Payloads | `functions/api/sync.js` | 201, 285 | `PUT /api/sync` accepted unlimited request body sizes and allowed overwriting an active unexpired `?pair=` slot. | Medium | Fixed | Enforced 16 KB limit for `?pair=` and 20 MB limit for workspace sync (`413` response), and blocked overwriting unexpired pairing slots (`409`). |
| Non-Constant-Time Token Comparison | `functions/api/sync.js` | 60 | Bearer `SYNC_TOKEN` validation used direct `===` string comparison. | Low | Fixed | Switched to `timingSafeEqualStr()` constant-time comparison across string characters and lengths. |
| Unvalidated Image Data URLs in Sync & Preview | `index.html`, `src/core/sanitizers.ts` | 5476, 6739, 9377 | Restored/synced `daily_logs[].photoDataUrl` values were assigned directly to `<img src>` without checking image format/scheme. | Medium | Fixed | Added `sanitizeImageDataUrl()` allowing only base64 WebP/PNG/JPEG data URLs and applied it on import, remote sync merge, preview modal, and AI attachment. |
| Unvalidated Sync & Pairing Endpoint URLs | `index.html`, `src/core/sanitizers.ts` | 5483, 7264, 7581 | WebDAV URLs, Cloudflare sync endpoints, and scanned `BSFPAIR:v1:` pairing payloads did not validate URL schemes before `fetch()`. | Medium | Fixed | Added `sanitizeSyncUrl()` restricting WebDAV URLs to `http:`/`https:` and Cloudflare sync endpoints to relative `/...` or `http:`/`https:`, and validated pairing payloads before saving or joining. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| HTML Rendering & AI Formatting | `index.html`, `src/core/sanitizers.ts` | Dynamic strings, operator names, container labels, QR outputs, and AI markdown responses pass through `escapeHTML()` before rendering. |
| Server-Side Secrets | `functions/api/register.js`, `functions/api/config.js` | `GAS_WEBHOOK_URL`, `SYNC_TOKEN`, and `SYNC_ALLOWED_ORIGIN` are read solely on the server from Cloudflare `env`; only public OAuth client IDs are exposed via `/api/config`. |
| Local PIN & Lockout | `index.html` | Owner/staff PINs and recovery answers are hashed with SHA-256 and protected with progressive lockout cooldowns on both PIN verification and recovery forms. |
| Encrypted Backup Format | `src/core/backupCrypto.ts` | `.bsfbackup` envelopes encrypt serialized backup JSON with per-export random 16-byte salt, 12-byte IV, 150,000 PBKDF2-SHA256 iterations, and AES-256-GCM authenticated encryption. |
| Dependency Audit | `package.json`, `bun.lock` | `bun audit` found 0 runtime vulnerabilities and 2 moderate build-time-only advisories in `vite-plugin-pwa > workbox-build > glob/minimatch` (used only during local/CI static bundling). |

---

## PoC Verification

### 1. Worker-Mode Operator Role Escalation Blocked
#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Role Authorization on Operator Creation |
| Impact | High |
| Affected File | `index.html:13058` |
| Test Scenario | Device locked in Worker Mode submits `#form-add-operator` with `name = "AdminBaru"` and `role = "owner"` |

#### How It Was Fixed
Added an explicit `isWorkerLocked()` gate inside `addOperatorRecord()` calling `requireOwnerAccess()`, forcing verification of the active Owner PIN before any new operator record can be persisted.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `#form-add-operator` submit triggers `addOperatorRecord(nameInput.value, roleSel.value)` | Enters `addOperatorRecord()` at `index.html:13058` |
| 2 | `if (isWorkerLocked())` evaluates `true` in Worker Mode at `index.html:13059` | Delegates to `requireOwnerAccess()` |
| 3 | Owner PIN verification modal opens before any `db.operators.add()` call runs | **Handled Safely** (no owner account created without PIN) |

#### Conclusion
**Fix Verified** — A worker cannot escalate privileges by creating a PIN-less Owner operator.

### 2. Recovery Answer Brute-Force Lockout Enforced
#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Attempt Throttling on Security Question Recovery |
| Impact | Medium |
| Affected File | `index.html:12970` |
| Test Scenario | Submitting 5 consecutive wrong answers in `#form-recovery-pin` for the Owner account |

#### How It Was Fixed
Wired `getPinLockoutState('recovery_' + lockoutKey)` and `recordPinFailure()` into `#form-recovery-pin` submission handling so repeated incorrect guesses trigger progressive cooldowns (30s after 5 failures, 5m after 10 failures).

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Wrong answer submitted to `#form-recovery-pin` | Enters handler at `index.html:12970` |
| 2 | `enteredAnsHash !== expectedHash` triggers `recordPinFailure(recLockKey)` at `index.html:13004` | Increments failure counter and sets `lockedUntil` at threshold 5 |
| 3 | Subsequent attempt hits `recLockState.lockedUntil > Date.now()` at `index.html:12975` | **Handled Safely** (blocks verification until cooldown expires) |

#### Conclusion
**Fix Verified** — Forgot-PIN recovery is protected by the same progressive lockout schedule as PIN verification.

### 3. CSV Formula Injection Neutralization
#### Summary
| Field | Value |
|---|---|
| Issue Type | Spreadsheet Formula Injection in CSV Export |
| Impact | Medium |
| Affected File | `index.html:9597` / `src/core/sanitizers.ts:50` |
| Test Scenario | Exporting monthly CSV when a transaction note contains `=HYPERLINK("http://evil.example")` |

#### How It Was Fixed
Implemented `sanitizeCsvCell()` prefixing non-numeric cell strings starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with a leading `'` while preserving numeric negative amounts.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `exportMonthlyCSV()` maps transaction notes through `csvCell()` at `index.html:9597` | Invokes `sanitizeCsvCell(val)` |
| 2 | `/^[=+\-@\t\r]/.test(str)` matches `=HYPERLINK(...)` at `src/core/sanitizers.ts:55` | Prefixes leading `'` inside CSV quotes |
| 3 | Output serializes as `"'=HYPERLINK(...)"` | **Handled Safely** (treated as plain text by spreadsheet apps) |

#### Conclusion
**Fix Verified** — Formula-prefixed text fields are neutralized in CSV exports, verified via `bun test`.

### 4. Strict CORS Origin Validation on `/api/sync`
#### Summary
| Field | Value |
|---|---|
| Issue Type | Wildcard CORS on Authenticated Sync Endpoint |
| Impact | Medium |
| Affected File | `functions/api/sync.js:25` |
| Test Scenario | Cross-origin `GET /api/sync?workspace=kebun-123` with `Origin: https://untrusted.example` |

#### How It Was Fixed
Replaced static `Access-Control-Allow-Origin: *` with `buildCorsHeaders(request, env)` allowing only the request's own origin, localhost development origins, or explicit `env.SYNC_ALLOWED_ORIGIN` entries.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request with external `Origin` enters `onRequestGet()` | Calls `buildCorsHeaders(request, env)` at `functions/api/sync.js:84` |
| 2 | `getAllowedOrigin()` rejects `https://untrusted.example` at `functions/api/sync.js:1-23` | Returns empty string |
| 3 | Response omits `Access-Control-Allow-Origin` and includes `Vary: Origin` | **Handled Safely** (browser enforces same-origin policy) |

#### Conclusion
**Fix Verified** — Untrusted origins cannot read authenticated workspace sync responses cross-origin.

### 5. Image Data URL Sanitization & Scanned Pairing Validation
#### Summary
| Field | Value |
|---|---|
| Issue Type | Unvalidated Image Source & Endpoint Scheme |
| Impact | Medium |
| Affected File | `index.html:5476, 5483, 7581` |
| Test Scenario | Tampered backup/sync JSON containing `photoDataUrl: "javascript:alert(1)"` or `BSFPAIR:v1:` token with `wdUrl: "javascript:fetch(...)"` |

#### How It Was Fixed
Enforced `sanitizeImageDataUrl()` (`data:image/(webp|png|jpeg|jpg);base64,...`) and `sanitizeSyncUrl()` (`http:`/`https:` or relative non-`//` paths) across sync merges, imports, previews, and pairing handlers.

#### Conclusion
**Fix Verified** — Untrusted image URLs and unsafe sync endpoint schemes are rejected before storage, DOM rendering, or `fetch()`.
