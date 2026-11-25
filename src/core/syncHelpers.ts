export interface SyncRecord {
  id?: number;
  syncUid?: string;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number;
  photoDataUrl?: string;
  photoTrimmedForSync?: boolean;
  [key: string]: unknown;
}

export interface PinSyncState {
  ownerPinHash: string;
  ownerRecoveryQuestion: string;
  ownerRecoveryAnswerHash: string;
  ownerPinUpdatedAt: number;
}

export function isActiveRecord(record: SyncRecord | null | undefined): boolean {
  return !record?.deletedAt;
}

export function getRecordMutationTimestamp(record: SyncRecord | null | undefined): number {
  if (!record) return 0;
  return Math.max(Number(record.updatedAt) || 0, Number(record.deletedAt) || 0, Number(record.createdAt) || 0);
}

export function computeRecordMergePlan<T extends SyncRecord>(
  localRows: T[],
  remoteList: SyncRecord[],
  normalizeItem?: (item: T) => void
): { toAdd: T[]; toUpdate: T[] } {
  const toAdd: T[] = [];
  const toUpdate: T[] = [];
  if (!Array.isArray(remoteList) || remoteList.length === 0) {
    return { toAdd, toUpdate };
  }

  const byUid = new Map<string, T>();
  for (const row of localRows) {
    if (row.syncUid) byUid.set(row.syncUid, row);
  }

  for (const rawItem of remoteList) {
    const item = { ...rawItem } as T;
    if (!item.syncUid) continue;
    if (!item.updatedAt) item.updatedAt = item.createdAt || Date.now();
    if (normalizeItem) normalizeItem(item);

    const existing = byUid.get(item.syncUid);
    if (!existing) {
      const insertObj = { ...item };
      delete insertObj.id;
      if (insertObj.deletedAt) {
        insertObj.photoDataUrl = '';
      }
      toAdd.push(insertObj);
      byUid.set(item.syncUid, insertObj);
    } else {
      const remoteTs = getRecordMutationTimestamp(item);
      const localTs = getRecordMutationTimestamp(existing);
      if (remoteTs > localTs) {
        const merged = { ...existing, ...item, id: existing.id } as T;
        if (item.deletedAt) {
          merged.deletedAt = item.deletedAt;
          merged.photoDataUrl = '';
        } else {
          delete merged.deletedAt;
          if (item.photoTrimmedForSync && !item.photoDataUrl && existing.photoDataUrl) {
            merged.photoDataUrl = existing.photoDataUrl;
          }
        }
        delete merged.photoTrimmedForSync;
        toUpdate.push(merged);
        byUid.set(item.syncUid, merged);
      }
    }
  }

  return { toAdd, toUpdate };
}

export function resolvePinSyncState(localState: PinSyncState, remoteState: Partial<PinSyncState>): PinSyncState & { changed: boolean } {
  const localTs = Number(localState.ownerPinUpdatedAt) || 0;
  const remoteTs = Number(remoteState.ownerPinUpdatedAt) || 0;
  const remoteHash = typeof remoteState.ownerPinHash === 'string' ? remoteState.ownerPinHash : undefined;

  // Case 1: Remote has explicit newer timestamp (update or explicit PIN removal)
  if (remoteTs > localTs && remoteHash !== undefined) {
    return {
      ownerPinHash: remoteHash,
      ownerRecoveryQuestion:
        remoteHash === '' ? '' : String(remoteState.ownerRecoveryQuestion ?? localState.ownerRecoveryQuestion ?? ''),
      ownerRecoveryAnswerHash:
        remoteHash === '' ? '' : String(remoteState.ownerRecoveryAnswerHash ?? localState.ownerRecoveryAnswerHash ?? ''),
      ownerPinUpdatedAt: remoteTs,
      changed: true,
    };
  }

  // Case 2: Legacy fallback when local device has no PIN yet and remote provides one
  if (!localState.ownerPinHash && remoteHash) {
    return {
      ownerPinHash: remoteHash,
      ownerRecoveryQuestion: String(remoteState.ownerRecoveryQuestion || localState.ownerRecoveryQuestion || ''),
      ownerRecoveryAnswerHash: String(remoteState.ownerRecoveryAnswerHash || localState.ownerRecoveryAnswerHash || ''),
      ownerPinUpdatedAt: remoteTs || Date.now(),
      changed: true,
    };
  }

  return { ...localState, changed: false };
}

export function trimSnapshotPhotosForLimit<T extends { data?: { daily_logs?: SyncRecord[] } }>(
  snapshot: T,
  maxBytes = 18 * 1024 * 1024
): { snapshot: T; trimmedCount: number; byteSize: number } {
  const encoded = new TextEncoder().encode(JSON.stringify(snapshot)).length;
  if (encoded <= maxBytes || !Array.isArray(snapshot?.data?.daily_logs)) {
    return { snapshot, trimmedCount: 0, byteSize: encoded };
  }

  const cloned: T = JSON.parse(JSON.stringify(snapshot));
  const logs = cloned.data?.daily_logs || [];
  const withPhotos = logs
    .map((l, idx) => ({ idx, ts: Number(l.updatedAt || l.createdAt || 0), hasPhoto: Boolean(l.photoDataUrl) }))
    .filter((x) => x.hasPhoto)
    .sort((a, b) => a.ts - b.ts); // Oldest photos trimmed first

  let trimmedCount = 0;
  let currentBytes = encoded;
  for (const item of withPhotos) {
    if (currentBytes <= maxBytes) break;
    const log = logs[item.idx];
    if (log && log.photoDataUrl) {
      log.photoDataUrl = '';
      log.photoTrimmedForSync = true;
      trimmedCount++;
      if (trimmedCount % 3 === 0 || currentBytes - 80_000 <= maxBytes) {
        currentBytes = new TextEncoder().encode(JSON.stringify(cloned)).length;
      } else {
        currentBytes -= 45_000;
      }
    }
  }
  currentBytes = new TextEncoder().encode(JSON.stringify(cloned)).length;
  return { snapshot: cloned, trimmedCount, byteSize: currentBytes };
}

export interface ChecklistTaskEntry {
  done: boolean;
  updatedAt: number;
}

export type DailyChecklistMap = Record<string, Record<string, ChecklistTaskEntry | boolean>>;

export function normalizeChecklistDayMap(
  dayMap: Record<string, ChecklistTaskEntry | boolean> | null | undefined
): Record<string, ChecklistTaskEntry> {
  const normalized: Record<string, ChecklistTaskEntry> = {};
  if (!dayMap || typeof dayMap !== 'object' || Array.isArray(dayMap)) return normalized;
  for (const [taskId, rawVal] of Object.entries(dayMap)) {
    if (!taskId) continue;
    if (typeof rawVal === 'boolean') {
      normalized[taskId] = { done: rawVal, updatedAt: rawVal ? 1 : 0 };
    } else if (rawVal && typeof rawVal === 'object') {
      normalized[taskId] = {
        done: Boolean(rawVal.done),
        updatedAt: Number(rawVal.updatedAt) || 0,
      };
    }
  }
  return normalized;
}

export function mergeDailyChecklists(
  localMap: DailyChecklistMap | null | undefined,
  remoteMap: DailyChecklistMap | null | undefined,
  maxAgeDays = 14,
  todayStr?: string
): Record<string, Record<string, ChecklistTaskEntry>> {
  const merged: Record<string, Record<string, ChecklistTaskEntry>> = {};
  const today = todayStr || new Date().toISOString().split('T')[0];
  const cutoffMs = new Date(`${today}T00:00:00Z`).getTime() - maxAgeDays * 86400000;

  const isFreshDate = (dateIso: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false;
    const ts = new Date(`${dateIso}T00:00:00Z`).getTime();
    return Number.isFinite(ts) && ts >= cutoffMs;
  };

  const absorb = (source: DailyChecklistMap | null | undefined) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return;
    for (const [dateIso, dayVal] of Object.entries(source)) {
      if (!isFreshDate(dateIso)) continue;
      const normDay = normalizeChecklistDayMap(dayVal);
      if (!merged[dateIso]) merged[dateIso] = {};
      for (const [taskId, entry] of Object.entries(normDay)) {
        const cur = merged[dateIso][taskId];
        if (!cur || entry.updatedAt > cur.updatedAt) {
          merged[dateIso][taskId] = entry;
        }
      }
    }
  };

  absorb(localMap);
  absorb(remoteMap);
  return merged;
}

