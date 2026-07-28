// React binding for tasklist-store.ts, mirroring use-progress.ts.
//
// useSyncExternalStore for the same reason: the store is the system of record and
// changes from outside React -- another tab writing, an imported backup.

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  TASKLIST_STORAGE_KEY,
  add,
  addMany,
  clear,
  getList,
  insertAt,
  refreshFromStorage,
  remove,
  setList,
  subscribe,
  toggle,
} from '@/lib/tasklist-store'

export interface UseTaskList {
  /** Task ids in the order the player arranged them. */
  list: readonly number[]
  add: (wikiId: number) => void
  /** Appends a batch, skipping anything already on the list. */
  addMany: (wikiIds: Iterable<number>) => void
  remove: (wikiId: number) => void
  toggle: (wikiId: number) => void
  /** Drop or reorder: move `wikiId` to `index`, adding it if it's new. */
  insertAt: (wikiId: number, index: number) => void
  /** Replaces the whole list, for a restore. Unlike addMany, this can shorten it. */
  replace: (wikiIds: readonly number[]) => void
  clear: () => void
}

export function useTaskList(): UseTaskList {
  const list = useSyncExternalStore(subscribe, getList, getList)

  // Fires only in *other* tabs, which is what we want: the writing tab already
  // has the value, the listening ones need to catch up.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === TASKLIST_STORAGE_KEY) refreshFromStorage()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return {
    list,
    add: useCallback((wikiId: number) => add(wikiId), []),
    addMany: useCallback((wikiIds: Iterable<number>) => addMany(wikiIds), []),
    remove: useCallback((wikiId: number) => remove(wikiId), []),
    toggle: useCallback((wikiId: number) => toggle(wikiId), []),
    insertAt: useCallback((wikiId: number, index: number) => insertAt(wikiId, index), []),
    replace: useCallback((wikiIds: readonly number[]) => setList(wikiIds), []),
    clear: useCallback(() => clear(), []),
  }
}
