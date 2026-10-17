// React binding for sync-status.ts.
//
// A store rather than useState, so every component that asks sees the same
// answer: App records, and whatever shows the date elsewhere re-renders with
// it, without the status having to be threaded down as a prop.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { LoadSourceId } from "@/lib/load-source";
import {
  getSyncStatus,
  recordSync,
  refreshFromStorage,
  subscribe,
  SYNC_STATUS_STORAGE_KEY,
  type SyncStatus,
} from "@/lib/sync-status";

export interface UseSyncStatus {
  status: SyncStatus | null;
  /** Writes storage and updates every subscriber in one step. */
  record: (source: LoadSourceId, dataAsOf: Date | null) => void;
}

export function useSyncStatus(): UseSyncStatus {
  const status = useSyncExternalStore(subscribe, getSyncStatus, getSyncStatus);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === SYNC_STATUS_STORAGE_KEY)
        refreshFromStorage();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const record = useCallback(
    (source: LoadSourceId, dataAsOf: Date | null) =>
      void recordSync(source, dataAsOf),
    [],
  );

  return { status, record };
}
