export function inferHasLindi(systemType: unknown, explicitVal?: unknown): boolean {
  if (typeof explicitVal === 'boolean') return explicitVal;
  if (explicitVal === 1 || explicitVal === '1' || explicitVal === 'true') return true;
  if (explicitVal === 0 || explicitVal === '0' || explicitVal === 'false') return false;
  const s = String(systemType || 'Ember Susun').trim().toLowerCase();
  if (s === 'ember biasa' || s === 'bak / rak' || s.includes('tanpa lindi') || s.includes('tanpa lubang')) {
    return false;
  }
  return true;
}

export interface BioconversionMetrics {
  fcr: number;
  maggotYieldPct: number;
  kasgotYieldPct: number;
  wasteReductionIndexPct: number;
}

export function calcBioconversionMetrics(input: {
  totalFeedKg: number;
  totalMaggotKg: number;
  totalKasgotKg?: number;
}): BioconversionMetrics {
  const feed = Math.max(0, Number(input.totalFeedKg) || 0);
  const maggot = Math.max(0, Number(input.totalMaggotKg) || 0);
  const kasgot = Math.max(0, Number(input.totalKasgotKg) || 0);
  const fcr = feed > 0 && maggot > 0 ? Number((feed / maggot).toFixed(2)) : 0;
  const maggotYieldPct = feed > 0 && maggot > 0 ? Number(((maggot / feed) * 100).toFixed(1)) : 0;
  const kasgotYieldPct = feed > 0 && kasgot > 0 ? Number(((kasgot / feed) * 100).toFixed(1)) : 0;
  const wasteReductionIndexPct =
    feed > 0 ? Number(Math.max(0, Math.min(100, ((feed - kasgot) / feed) * 100)).toFixed(1)) : 0;
  return { fcr, maggotYieldPct, kasgotYieldPct, wasteReductionIndexPct };
}

export interface FeedLedgerEntry {
  type?: string;
  qtyKg?: number;
  costDelta?: number;
  deletedAt?: number;
}

export function computeFeedStockBalance(entries: FeedLedgerEntry[], fallbackCostTotal = 0): {
  stockKg: number;
  totalUsedKg: number;
  costTotal: number;
} {
  let totalIn = 0;
  let totalOut = 0;
  let costSum = 0;

  for (const e of entries) {
    if (e?.deletedAt) continue;
    const qty = Number(e.qtyKg) || 0;
    if (e.type === 'in') {
      totalIn += qty;
      costSum += Number(e.costDelta) || 0;
    } else if (e.type === 'out') {
      totalOut += qty;
    }
  }

  return {
    stockKg: Math.max(0, Number((totalIn - totalOut).toFixed(2))),
    totalUsedKg: Number(totalOut.toFixed(2)),
    costTotal: costSum > 0 ? Math.round(costSum) : Number(fallbackCostTotal) || 0,
  };
}
