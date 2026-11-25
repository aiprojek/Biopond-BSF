import { describe, expect, test } from 'bun:test';
import {
  escapeHTML,
  generateRandomWorkspaceId,
  sanitizeCsvCell,
  sanitizeImageDataUrl,
  sanitizeSyncUrl,
} from './sanitizers.ts';
import {
  decryptBackupPayload,
  encryptBackupPayload,
  isEncryptedBackupEnvelope,
} from './backupCrypto.ts';
import {
  computeRecordMergePlan,
  isActiveRecord,
  mergeDailyChecklists,
  resolvePinSyncState,
  trimSnapshotPhotosForLimit,
  type SyncRecord,
} from './syncHelpers.ts';
import {
  calcBioconversionMetrics,
  calcDayAge,
  computeBatchCostAndHpp,
  computeFeedStockBalance,
  computeMonthlyTrendSeries,
  estimateDailyFeedRecommendation,
  getPondEffectiveEndDate,
  inferHasLindi,
} from './metrics.ts';

describe('sanitizers', () => {
  test('sanitizeImageDataUrl allows only base64 WebP/PNG/JPEG data URLs', () => {
    expect(sanitizeImageDataUrl('data:image/webp;base64,UklGRh4AAABXRUJQ')).toBe(
      'data:image/webp;base64,UklGRh4AAABXRUJQ'
    );
    expect(sanitizeImageDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(
      'data:image/png;base64,iVBORw0KGgo='
    );
    expect(sanitizeImageDataUrl('https://evil.example/pixel.png')).toBe('');
    expect(sanitizeImageDataUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeImageDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe('');
  });

  test('sanitizeSyncUrl allows safe http/https or relative non-protocol paths', () => {
    expect(sanitizeSyncUrl('/api/sync', true)).toBe('/api/sync');
    expect(sanitizeSyncUrl('//evil.example/api', true)).toBe('');
    expect(sanitizeSyncUrl('https://nas.example.com/dav/bsf.json', false)).toBe(
      'https://nas.example.com/dav/bsf.json'
    );
    expect(sanitizeSyncUrl('javascript:fetch(1)', true)).toBe('');
  });

  test('generateRandomWorkspaceId produces unique non-guessable IDs', () => {
    const a = generateRandomWorkspaceId('kebun');
    const b = generateRandomWorkspaceId('kebun');
    expect(a).toMatch(/^kebun-[a-z0-9]{10}$/);
    expect(a).not.toBe(b);
  });

  test('escapeHTML escapes dangerous markup characters', () => {
    expect(escapeHTML('<script>"test" & \'x\'</script>')).toBe(
      '&lt;script&gt;&quot;test&quot; &amp; &#39;x&#39;&lt;/script&gt;'
    );
  });

  test('sanitizeCsvCell neutralizes spreadsheet formula prefixes while keeping numbers', () => {
    expect(sanitizeCsvCell('=HYPERLINK("http://evil.com")')).toBe('"\'=HYPERLINK(""http://evil.com"")"');
    expect(sanitizeCsvCell('+SUM(A1:A2)')).toBe('"\'+SUM(A1:A2)"');
    expect(sanitizeCsvCell('@cmd')).toBe('"\'@cmd"');
    expect(sanitizeCsvCell(-15000)).toBe('"-15000"');
  });
});

describe('backupCrypto', () => {
  test('encrypts and decrypts backup snapshot with PBKDF2 + AES-256-GCM', async () => {
    const snapshot = {
      app: 'Biopond BSF',
      schemaVersion: 7,
      farmName: 'Kebun Makmur',
      data: { bioponds: [{ name: 'Wadah 1', eggGrams: 10 }] },
    };

    const envelope = await encryptBackupPayload(snapshot, 'rahasia-kandang-123');
    expect(isEncryptedBackupEnvelope(envelope)).toBe(true);
    expect(envelope.ciphertext).not.toContain('Kebun Makmur');

    const restored = await decryptBackupPayload(envelope, 'rahasia-kandang-123');
    expect(restored.farmName).toBe('Kebun Makmur');
    expect((restored.data as { bioponds: Array<{ name: string }> }).bioponds[0].name).toBe('Wadah 1');
  });

  test('rejects wrong password during decryption', async () => {
    const envelope = await encryptBackupPayload({ data: { bioponds: [] } }, 'benar123');
    await expect(decryptBackupPayload(envelope, 'salah999')).rejects.toThrow();
  });
});

describe('syncHelpers', () => {
  test('propagates soft-delete tombstones and prevents resurrection', () => {
    const localRows = [
      { id: 1, syncUid: 'uid-1', updatedAt: 2000, deletedAt: 2000, name: 'Batch A', photoDataUrl: '' },
      { id: 2, syncUid: 'uid-2', updatedAt: 1000, name: 'Batch B' },
    ];
    const remoteList = [
      // Stale remote version of uid-1 before deletion
      { syncUid: 'uid-1', updatedAt: 1500, name: 'Batch A' },
      // Remote deleted uid-2 more recently
      { syncUid: 'uid-2', updatedAt: 3000, deletedAt: 3000, name: 'Batch B' },
      // New remote record already deleted before reaching this device
      { syncUid: 'uid-3', updatedAt: 2500, deletedAt: 2500, name: 'Batch C', photoDataUrl: 'data:image/webp;base64,AA==' },
    ];

    const plan = computeRecordMergePlan(localRows, remoteList);
    expect(plan.toUpdate.length).toBe(1);
    expect(plan.toUpdate[0].syncUid).toBe('uid-2');
    expect(plan.toUpdate[0].deletedAt).toBe(3000);
    expect(isActiveRecord(plan.toUpdate[0])).toBe(false);

    // Tombstone for uid-3 is stored cleanly without photo blob and stays hidden
    expect(plan.toAdd.length).toBe(1);
    expect(plan.toAdd[0].deletedAt).toBe(2500);
    expect(plan.toAdd[0].photoDataUrl).toBe('');
  });

  test('preserves local photo when remote only trimmed photo for sync size', () => {
    const localRows: SyncRecord[] = [
      { id: 1, syncUid: 'log-1', updatedAt: 1000, photoDataUrl: 'data:image/webp;base64,ABCD' },
    ];
    const remoteList: SyncRecord[] = [
      { syncUid: 'log-1', updatedAt: 2000, photoDataUrl: '', photoTrimmedForSync: true },
    ];
    const plan = computeRecordMergePlan(localRows, remoteList);
    expect(plan.toUpdate[0].photoDataUrl).toBe('data:image/webp;base64,ABCD');
  });

  test('bidirectional owner PIN sync respects newer ownerPinUpdatedAt', () => {
    const updated = resolvePinSyncState(
      {
        ownerPinHash: 'old-hash',
        ownerRecoveryQuestion: 'Q1',
        ownerRecoveryAnswerHash: 'A1',
        ownerPinUpdatedAt: 1000,
      },
      {
        ownerPinHash: 'new-hash',
        ownerRecoveryQuestion: 'Q2',
        ownerRecoveryAnswerHash: 'A2',
        ownerPinUpdatedAt: 5000,
      }
    );
    expect(updated.changed).toBe(true);
    expect(updated.ownerPinHash).toBe('new-hash');
    expect(updated.ownerPinUpdatedAt).toBe(5000);

    const cleared = resolvePinSyncState(updated, {
      ownerPinHash: '',
      ownerPinUpdatedAt: 9000,
    });
    expect(cleared.changed).toBe(true);
    expect(cleared.ownerPinHash).toBe('');
  });

  test('trimSnapshotPhotosForLimit trims oldest photos first to fit limit', () => {
    const bigPhoto = 'data:image/webp;base64,' + 'A'.repeat(2000);
    const snapshot: { data: { daily_logs: SyncRecord[] } } = {
      data: {
        daily_logs: [
          { syncUid: 'old', createdAt: 100, updatedAt: 100, photoDataUrl: bigPhoto },
          { syncUid: 'new', createdAt: 200, updatedAt: 200, photoDataUrl: bigPhoto },
        ],
      },
    };
    const res = trimSnapshotPhotosForLimit(snapshot, 2800);
    expect(res.trimmedCount).toBe(1);
    expect(res.snapshot.data.daily_logs[0].photoDataUrl).toBe('');
    expect(res.snapshot.data.daily_logs[0].photoTrimmedForSync).toBe(true);
    expect(res.snapshot.data.daily_logs[1].photoDataUrl).toBe(bigPhoto);
  });
});

describe('metrics', () => {
  test('inferHasLindi differentiates lindi vs non-lindi container types', () => {
    expect(inferHasLindi('Ember Susun')).toBe(true);
    expect(inferHasLindi('Ember False Bottom')).toBe(true);
    expect(inferHasLindi('Ember Biasa')).toBe(false);
    expect(inferHasLindi('Bak / Rak')).toBe(false);
    expect(inferHasLindi('Rak Kustom', true)).toBe(true);
  });

  test('calcBioconversionMetrics computes FCR and WRI accurately', () => {
    const m = calcBioconversionMetrics({ totalFeedKg: 100, totalMaggotKg: 25, totalKasgotKg: 30 });
    expect(m.fcr).toBe(4);
    expect(m.maggotYieldPct).toBe(25);
    expect(m.wasteReductionIndexPct).toBe(70);
  });

  test('computeFeedStockBalance ignores deleted ledger entries', () => {
    const bal = computeFeedStockBalance([
      { type: 'in', qtyKg: 50, costDelta: 25000 },
      { type: 'out', qtyKg: 12.5 },
      { type: 'out', qtyKg: 10, deletedAt: 123456 },
    ]);
    expect(bal.stockKg).toBe(37.5);
    expect(bal.totalUsedKg).toBe(12.5);
    expect(bal.costTotal).toBe(25000);
  });

  test('getPondEffectiveEndDate and calcDayAge freeze finished cycle duration', () => {
    const pond = { id: 10, status: 'Selesai', startDate: '2026-10-01', closedDate: '2026-10-14' };
    const end = getPondEffectiveEndDate(pond, [], '2026-11-23');
    expect(end).toBe('2026-10-14');
    expect(calcDayAge(pond.startDate, end)).toBe(14);

    // Fallback to latest harvest date when closedDate is missing
    const legacyPond = { id: 11, status: 'Selesai', startDate: '2026-10-01' };
    const harvests = [
      { biopondId: 11, date: '2026-10-12' },
      { biopondId: 11, date: '2026-10-15' },
      { biopondId: 11, date: '2026-10-20', deletedAt: 999 },
    ];
    const legacyEnd = getPondEffectiveEndDate(legacyPond, harvests, '2026-11-23');
    expect(legacyEnd).toBe('2026-10-15');
    expect(calcDayAge(legacyPond.startDate, legacyEnd)).toBe(15);
  });

  test('estimateDailyFeedRecommendation calculates daily feeding curve accurately', () => {
    const recDay8 = estimateDailyFeedRecommendation(10, 8);
    expect(recDay8.recommendedKg).toBe(9.5);
    expect(recDay8.estPopulation).toBe(150000);
    expect(recDay8.minAreaM2).toBe(0.5);
  });

  test('computeBatchCostAndHpp sums feedCost + seedCost and derives batch HPP', () => {
    const res = computeBatchCostAndHpp(
      { seedCost: 25000 },
      [
        { feedKg: 40, feedCost: 20000 },
        { feedKg: 35, feedCost: 15000 },
        { feedKg: 99, feedCost: 99000, deletedAt: 100 },
      ],
      [{ maggotKg: 15, kasgotKg: 20 }]
    );
    expect(res.feedKg).toBe(75);
    expect(res.maggotKg).toBe(15);
    expect(res.totalCost).toBe(60000);
    expect(res.hppPerKg).toBe(4000);
    expect(res.fcr).toBe(5);
  });

  test('computeMonthlyTrendSeries aggregates logs and harvests chronologically', () => {
    const series = computeMonthlyTrendSeries(
      [
        { date: '2026-10-05', feedKg: 20 },
        { date: '2026-11-10', feedKg: 45 },
      ],
      [{ date: '2026-11-20', maggotKg: 10 }],
      3,
      '2026-11-23'
    );
    expect(series.length).toBe(3);
    expect(series[1].month).toBe('2026-10');
    expect(series[1].feedKg).toBe(20);
    expect(series[2].month).toBe('2026-11');
    expect(series[2].feedKg).toBe(45);
    expect(series[2].maggotKg).toBe(10);
  });

  test('mergeDailyChecklists merges per-task by newer updatedAt and prunes stale dates', () => {
    const merged = mergeDailyChecklists(
      {
        '2026-11-23': { '1-nursery-h2': true, '1-move-h6': { done: true, updatedAt: 5000 } },
        '2026-10-01': { 'old-task': { done: true, updatedAt: 100 } },
      },
      {
        '2026-11-23': { '1-nursery-h2': { done: false, updatedAt: 2000 }, '1-move-h6': { done: false, updatedAt: 3000 } },
      },
      14,
      '2026-11-23'
    );
    expect('2026-10-01' in merged).toBe(false);
    expect(merged['2026-11-23']['1-nursery-h2'].done).toBe(false);
    expect(merged['2026-11-23']['1-move-h6'].done).toBe(true);
  });
});
