// React binding for progress-store.ts.
//
// useSyncExternalStore rather than useState + an effect: the store is the system
// of record and can change from outside React (another tab writing, an import),
// and this is the hook that exists to keep a component honest about that.

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  getCompleted,
  getStorageError,
  mergeMany,
  refreshFromStorage,
  reset,
  setMany,
  subscribe,
  toggle,
} from '@/lib/progress-store'

export interface UseProgress {
  completed: ReadonlySet<number>
  toggle: (wikiId: number) => void
  setMany: (wikiIds: Iterable<number>) => void
  /** Union rather than replace — for the WikiSync paste (#12). */
  mergeMany: (wikiIds: Iterable<number>) => void
  reset: () => void
  /** Non-null when progress is memory-only and will not survive the tab. */
  storageError: string | null
}

export function useProgress(): UseProgress {
  const completed = useSyncExternalStore(subscribe, getCompleted, getCompleted)

  // The `storage` event fires only in *other* tabs, which is exactly what we want:
  // the writing tab already has the value, the listening tabs need to catch up.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith('ca-tracker:progress:')) {
        refreshFromStorage()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return {
    completed,
    toggle: useCallback((wikiId: number) => toggle(wikiId), []),
    setMany: useCallback((wikiIds: Iterable<number>) => setMany(wikiIds), []),
    mergeMany: useCallback((wikiIds: Iterable<number>) => mergeMany(wikiIds), []),
    reset: useCallback(() => reset(), []),
    storageError: getStorageError(),
  }
}
