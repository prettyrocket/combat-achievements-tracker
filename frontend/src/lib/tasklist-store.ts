// Persistence for the task list. The ordering rules live in tasklist.ts; this is
// the part that remembers them across reloads.
//
// A separate key from progress, because they are separate facts: what you have
// done, and what you mean to do next. Clearing one shouldn't disturb the other,
// and Reset (which wipes progress) deliberately leaves the plan alone. They travel
// together only in the export file -- see backup.ts.

import { sanitizeIds } from '@/lib/progress-store'
import { readJson, writeJson } from '@/lib/local-store'
import * as list from '@/lib/tasklist'

const STORAGE_KEY = 'ca-tracker:tasklist:v1'
const SCHEMA_VERSION = 1

interface StoredList {
  version: number
  savedAt: string
  list: number[]
}

/**
 * Order is preserved, which is why this can't reuse the Set that progress uses.
 * sanitizeIds keeps input order and dedupes, so it's exactly the validation this
 * needs -- unknown ids dropped, the queue otherwise intact.
 */
function load(): readonly number[] {
  const stored = (readJson(STORAGE_KEY) as { list?: unknown } | null)?.list
  return sanitizeIds(stored).ids
}

// Cached rather than rebuilt per read: useSyncExternalStore compares snapshots by
// identity, and a fresh array each call is an infinite render loop.
let current: readonly number[] = load()
const listeners = new Set<() => void>()

function commit(next: readonly number[]): void {
  current = next
  const payload: StoredList = {
    version: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    list: [...next],
  }
  writeJson(STORAGE_KEY, payload)
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Stable identity between changes -- safe for useSyncExternalStore. */
export function getList(): readonly number[] {
  return current
}

// --- mutations --------------------------------------------------------------
//
// Each one re-validates through sanitizeIds rather than trusting the caller: a
// drop handler works in ids pulled out of a DOM event, and an id for a task that
// isn't in the data would render as a gap in the panel.

export function add(wikiId: number): void {
  commitSanitized(list.add(current, wikiId))
}

export function remove(wikiId: number): void {
  commitSanitized(list.remove(current, wikiId))
}

export function toggle(wikiId: number): void {
  commitSanitized(list.toggle(current, wikiId))
}

/** Reorder within the list, or add at a position if it isn't there yet. */
export function insertAt(wikiId: number, index: number): void {
  commitSanitized(list.insertAt(current, wikiId, index))
}

export function setList(wikiIds: Iterable<number>): void {
  commitSanitized([...wikiIds])
}

export function clear(): void {
  if (current.length === 0) return
  commit([])
}

function commitSanitized(next: readonly number[]): void {
  const { ids } = sanitizeIds([...next])
  // Identical order and contents means nothing to persist and nobody to notify:
  // a drag that ends where it started shouldn't write to disk or re-render.
  if (ids.length === current.length && ids.every((id, i) => id === current[i])) return
  commit(ids)
}

/** Re-read from disk. For the `storage` event: another tab already wrote. */
export function refreshFromStorage(): void {
  const next = load()
  if (next.length === current.length && next.every((id, i) => id === current[i])) return
  current = next
  for (const listener of listeners) listener()
}

export { STORAGE_KEY as TASKLIST_STORAGE_KEY }
