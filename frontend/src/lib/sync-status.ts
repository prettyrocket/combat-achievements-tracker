// When progress last came in, and from where.
//
// A fourth small key beside the remembered source, and deliberately not folded
// into it: the source answers "where should Load go", this answers "how fresh
// is what's on screen". The header's Load reads the first and never cares about
// the second, and the Profile screen wants both.
//
// Two dates, because they are two different facts. `syncedAt` is when this
// browser last pulled -- including a pull that found nothing new, since a check
// that confirmed you're up to date is still a sync. `dataAsOf` is when the
// source itself last heard from the game, which only the source knows: a sync
// this minute of a RuneProfile upload from last month is still last month's
// numbers.
//
// Same shape as the other stores: plain functions over a cached snapshot, with
// the React binding in use-sync-status.ts.

import { readJson, writeJson } from "@/lib/local-store";
import type { LoadSourceId } from "@/lib/load-source";

const STORAGE_KEY = "ca-tracker:last-sync:v1";

// Restated rather than derived from LOAD_SOURCES, so a source being retired
// there is a decision here too rather than something that happens to it. A
// record naming "wikisync" falls through to null, which is right: there's no
// way to sync from it any more, so a date for it describes nothing you can do.
const SOURCES: ReadonlySet<string> = new Set<LoadSourceId>([
  "runeprofile",
  "wiseoldman",
  "file",
  "manual",
]);

export interface SyncStatus {
  source: LoadSourceId;
  /** When this browser last applied (or confirmed up-to-date) a sync, ISO string. */
  syncedAt: string;
  /** When the source's own data was last refreshed, if it said. ISO string or null. */
  dataAsOf: string | null;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

/**
 * The last sync on disk, or null if there's none worth showing.
 *
 * Validated field by field: the file is hand-editable and outlives releases,
 * and a half-shaped record would otherwise reach the screen as "Invalid Date".
 */
export function readSyncStatus(): SyncStatus | null {
  const stored = readJson(STORAGE_KEY);
  if (stored === null || typeof stored !== "object" || Array.isArray(stored))
    return null;
  const { source, syncedAt, dataAsOf } = stored as Record<string, unknown>;
  if (typeof source !== "string" || !SOURCES.has(source)) return null;
  if (!isIsoDate(syncedAt)) return null;
  if (dataAsOf !== null && !isIsoDate(dataAsOf)) return null;
  return { source: source as LoadSourceId, syncedAt, dataAsOf };
}

// undefined until first asked, so importing this module touches no storage.
let current: SyncStatus | null | undefined;
const listeners = new Set<() => void>();

/** The cached snapshot, stable between writes as useSyncExternalStore needs. */
export function getSyncStatus(): SyncStatus | null {
  if (current === undefined) current = readSyncStatus();
  return current;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Writes a sync that just landed, stamped now, and returns what it wrote. */
export function recordSync(
  source: LoadSourceId,
  dataAsOf: Date | null,
): SyncStatus {
  const status: SyncStatus = {
    source,
    syncedAt: new Date().toISOString(),
    // An unparseable date from upstream is the same as no date: the source
    // didn't usefully say.
    dataAsOf:
      dataAsOf !== null && !Number.isNaN(dataAsOf.getTime())
        ? dataAsOf.toISOString()
        : null,
  };
  writeJson(STORAGE_KEY, status);
  current = status;
  for (const listener of listeners) listener();
  return status;
}

/** Re-read from disk. For the `storage` event: another tab already wrote. */
export function refreshFromStorage(): void {
  const next = readSyncStatus();
  if (
    next?.source === current?.source &&
    next?.syncedAt === current?.syncedAt &&
    next?.dataAsOf === current?.dataAsOf
  )
    return;
  current = next;
  for (const listener of listeners) listener();
}

export { STORAGE_KEY as SYNC_STATUS_STORAGE_KEY };
