// React binding for progress-store.ts.
//
// useSyncExternalStore rather than useState + an effect: the store is the system
// of record and can change from outside React (another tab writing, an import),
// and this is the hook that exists to keep a component honest about that.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  getCompleted,
  getStorageError,
  refreshFromStorage,
  reset,
  setMany,
  subscribe,
  toggle,
  undo,
} from "@/lib/progress-store";

export interface UseProgress {
  completed: ReadonlySet<number>;
  toggle: (wikiId: number) => void;
  setMany: (wikiIds: Iterable<number>) => void;
  reset: () => void;
  /** Steps back one change to progress. A no-op when there's nothing to step
   *  back to, which is why nothing here reports whether there is. */
  undo: () => void;
  /** Non-null when progress is memory-only and will not survive the tab. */
  storageError: string | null;
}

export function useProgress(): UseProgress {
  const completed = useSyncExternalStore(subscribe, getCompleted, getCompleted);

  // Ctrl+Z / ⌘Z anywhere that isn't a text field, and the only way to undo --
  // ticking a task is a one-click change to the thing this app is for, so the
  // reflex that follows a misclick is the right thing to answer, and it's the
  // reflex people already have. Bound here rather than by whoever renders the
  // table, because the hotkey is part of what having an undo *means*.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "z" ||
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey
      )
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA"
      ) {
        return;
      }
      event.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // The `storage` event fires only in *other* tabs, which is exactly what we want:
  // the writing tab already has the value, the listening tabs need to catch up.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith("ca-tracker:progress:")) {
        refreshFromStorage();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    completed,
    toggle: useCallback((wikiId: number) => toggle(wikiId), []),
    setMany: useCallback((wikiIds: Iterable<number>) => setMany(wikiIds), []),
    reset: useCallback(() => reset(), []),
    undo: useCallback(() => void undo(), []),
    storageError: getStorageError(),
  };
}
