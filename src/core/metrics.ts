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

export function calcDayAge(startDateStr?: string, endDateStr?: string | null): number {
  if (!startDateStr) return 1;
  const start = new Date(`${startDateStr}T00:00:00`);
  const effectiveEnd = endDateStr || new Date().toISOString().split('T')[0];
  const end = new Date(`${effectiveEnd}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000);
  return Math.max(1, diffDays + 1);
}

export function getPondEffectiveEndDate(
  pond: { id?: number; syncUid?: string; status?: string; startDate?: string; closedDate?: string; updatedAt?: number },
  harvests: Array<{ biopondId?: number; biopondSyncUid?: string; date?: string; deletedAt?: number }> = [],
  todayStr?: string
): string {
  const today = todayStr || new Date().toISOString().split('T')[0];
  if (pond?.status !== 'Selesai') return today;

  const isIsoDate = (val: unknown): val is string => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val);
  let endDate = '';

  if (isIsoDate(pond.closedDate)) {
    endDate = pond.closedDate;
  } else {
    const pondHarvestDates = (harvests || [])
      .filter((h) => !h?.deletedAt && ((pond.id != null && h.biopondId === pond.id) || (pond.syncUid && h.biopondSyncUid === pond.syncUid)))
      .map((h) => h.date)
      .filter(isIsoDate)
      .sort();
    if (pondHarvestDates.length > 0) {
      endDate = pondHarvestDates[pondHarvestDates.length - 1];
    } else if (pond.updatedAt && Number.isFinite(Number(pond.updatedAt))) {
      endDate = new Date(Number(pond.updatedAt)).toISOString().split('T')[0];
    }
  }

  if (!isIsoDate(endDate)) return today;
  if (isIsoDate(pond.startDate) && endDate < pond.startDate) return pond.startDate;
  if (endDate > today) return today;
  return endDate;
}

const DAILY_FEED_FACTOR_PER_GRAM = [
  0.05, 0.08, 0.12, 0.2, 0.35, 0.55, 0.8, 0.95, 1.15, 1.2, 1.15, 1.0, 0.85, 0.65, 0.45, 0.3, 0.15, 0.08,
];

export function estimateDailyFeedRecommendation(eggGrams: number, dayAge: number): {
  recommendedKg: number;
  estPopulation: number;
  minAreaM2: number;
} {
  const grams = Math.max(0, Number(eggGrams) || 0);
  const day = Math.max(1, Math.round(Number(dayAge) || 1));
  const factor = DAILY_FEED_FACTOR_PER_GRAM[Math.min(17, Math.max(0, day - 1))];
  return {
    recommendedKg: Number((grams * factor).toFixed(2)),
    estPopulation: Math.round(grams * 15000),
    minAreaM2: Number(Math.max(0.12, grams * 0.05).toFixed(2)),
  };
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

export function computeBatchCostAndHpp(
  pond: { seedCost?: number },
  pondLogs: Array<{ feedKg?: number; feedCost?: number; deletedAt?: number }>,
  pondHarvests: Array<{ maggotKg?: number; kasgotKg?: number; deletedAt?: number }>
): {
  feedKg: number;
  maggotKg: number;
  kasgotKg: number;
  feedCost: number;
  seedCost: number;
  totalCost: number;
  hppPerKg: number;
  fcr: number;
} {
  let feedKg = 0;
  let feedCost = 0;
  for (const l of pondLogs || []) {
    if (l?.deletedAt) continue;
    feedKg += Number(l.feedKg) || 0;
    feedCost += Number(l.feedCost) || 0;
  }

  let maggotKg = 0;
  let kasgotKg = 0;
  for (const h of pondHarvests || []) {
    if (h?.deletedAt) continue;
    maggotKg += Number(h.maggotKg) || 0;
    kasgotKg += Number(h.kasgotKg) || 0;
  }

  const seedCost = Math.max(0, Math.round(Number(pond?.seedCost) || 0));
  const totalCost = Math.round(feedCost) + seedCost;
  const hppPerKg = maggotKg > 0 && totalCost > 0 ? Math.round(totalCost / maggotKg) : 0;
  const fcr = maggotKg > 0 && feedKg > 0 ? Number((feedKg / maggotKg).toFixed(2)) : 0;

  return {
    feedKg: Number(feedKg.toFixed(2)),
    maggotKg: Number(maggotKg.toFixed(2)),
    kasgotKg: Number(kasgotKg.toFixed(2)),
    feedCost: Math.round(feedCost),
    seedCost,
    totalCost,
    hppPerKg,
    fcr,
  };
}

export function computeMonthlyTrendSeries(
  logs: Array<{ date?: string; feedKg?: number; deletedAt?: number }>,
  harvests: Array<{ date?: string; maggotKg?: number; deletedAt?: number }>,
  monthsCount = 6,
  refDateStr?: string
): Array<{ month: string; label: string; feedKg: number; maggotKg: number }> {
  const ref = refDateStr || new Date().toISOString().split('T')[0];
  const [yStr, mStr] = ref.split('-');
  const baseYear = Number(yStr) || new Date().getFullYear();
  const baseMonth = Number(mStr) || new Date().getMonth() + 1;
  const count = Math.max(1, Math.min(12, Math.round(monthsCount)));

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const series: Array<{ month: string; label: string; feedKg: number; maggotKg: number }> = [];
  const byMonth = new Map<string, { month: string; label: string; feedKg: number; maggotKg: number }>();

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(baseYear, baseMonth - 1 - i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const label = `${monthNames[d.getUTCMonth()]}`;
    const entry = { month: ym, label, feedKg: 0, maggotKg: 0 };
    series.push(entry);
    byMonth.set(ym, entry);
  }

  for (const l of logs || []) {
    if (l?.deletedAt || !l?.date) continue;
    const target = byMonth.get(String(l.date).slice(0, 7));
    if (target) target.feedKg = Number((target.feedKg + (Number(l.feedKg) || 0)).toFixed(1));
  }

  for (const h of harvests || []) {
    if (h?.deletedAt || !h?.date) continue;
    const target = byMonth.get(String(h.date).slice(0, 7));
    if (target) target.maggotKg = Number((target.maggotKg + (Number(h.maggotKg) || 0)).toFixed(1));
  }

  return series;
}
