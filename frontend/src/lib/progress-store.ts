// Progress lives entirely on the player's machine -- there is no account and no
// server (#15). That makes localStorage the system of record, which is only an
// acceptable place for it because export/import exists: clearing site data would
// otherwise be an unrecoverable loss with no way to move between devices.
//
// Deliberately framework-free. The React binding is use-progress.ts; everything
// here is plain functions over a module-level snapshot, so #6 can test the rules
// without mounting anything.

import { TASKS } from '@/data/tasks'

/** Versioned so the stored shape can migrate without guessing at what's there. */
const STORAGE_KEY = 'ca-tracker:progress:v1'
const SCHEMA_VERSION = 1

/** Marks an export as ours, so #12's WikiSync paste can't be fed in by mistake. */
export const EXPORT_APP = 'combat-achievements-tracker'

const KNOWN_IDS: ReadonlySet<number> = new Set(TASKS.map((t) => t.wikiId))

export interface ProgressExport {
  app: typeof EXPORT_APP
  version: number
  exportedAt: string
  completed: number[]
}

// --- id validation ----------------------------------------------------------

/**
 * Pull the usable task ids out of whatever we were handed -- stored JSON, an
 * imported file, a caller's array.
 *
 * Ids are the wiki's stable natural key, never array positions, so an id that
 * isn't in the current data set means a task was retired (or the file came from
 * a future release). Dropping those quietly is correct: the alternative is
 * crashing on load over a task that no longer exists.
 */
export function sanitizeIds(input: unknown, known: ReadonlySet<number> = KNOWN_IDS) {
  const kept: number[] = []
  let dropped = 0
  if (Array.isArray(input)) {
    const seen = new Set<number>()
    for (const value of input) {
      if (typeof value === 'number' && Number.isInteger(value) && known.has(value)) {
        if (!seen.has(value)) {
          seen.add(value)
          kept.push(value)
        }
      } else {
        dropped++
      }
    }
  }
  return { ids: kept, dropped }
}

// --- storage access ---------------------------------------------------------
//
// Private browsing, disabled cookies and a full quota all surface as a throw from
// perfectly ordinary calls. None of that should take the app down: we fall back to
// an in-memory snapshot that works for the session, and say so rather than
// pretending the data is safe.

let storageError: string | null = null

function storage(): Storage | null {
  if (storageError !== null) return null
  // No window during SSR/tests. Not an error worth reporting -- there's no user
  // there to tell, and the in-memory snapshot behaves correctly.
  if (typeof window === 'undefined') return null
  try {
    const probe = '__ca_probe__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    storageError = 'This browser is blocking local storage, so progress will be lost when you close the tab. Export to keep it.'
    return null
  }
}

/** Non-null when progress is memory-only, with a message fit for the user. */
export function getStorageError(): string | null {
  return storageError
}

function load(): ReadonlySet<number> {
  const store = storage()
  if (!store) return new Set()
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (raw === null) return new Set()
    const parsed: unknown = JSON.parse(raw)
    const completed = (parsed as { completed?: unknown } | null)?.completed
    return new Set(sanitizeIds(completed).ids)
  } catch {
    // Corrupt or hand-edited JSON. Starting empty beats refusing to boot; the
    // bad value stays on disk untouched until the next successful write.
    return new Set()
  }
}

// --- snapshot + subscription ------------------------------------------------
//
// `current` is cached rather than rebuilt per read: useSyncExternalStore compares
// snapshots by identity, and handing it a fresh Set each call is an infinite loop.

let current: ReadonlySet<number> = load()
const listeners = new Set<() => void>()

function commit(next: ReadonlySet<number>): void {
  current = next
  const store = storage()
  if (store) {
    const payload: ProgressExport = {
      app: EXPORT_APP,
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      completed: [...next].sort((a, b) => a - b),
    }
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      storageError =
        'Ran out of local storage space, so progress is no longer being saved. Export to keep it.'
    }
  }
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Stable identity between changes -- safe for useSyncExternalStore. */
export function getCompleted(): ReadonlySet<number> {
  return current
}

// --- mutations --------------------------------------------------------------

export function toggle(wikiId: number): void {
  const next = new Set(current)
  if (!next.delete(wikiId)) {
    if (!KNOWN_IDS.has(wikiId)) return
    next.add(wikiId)
  }
  commit(next)
}

export function setMany(wikiIds: Iterable<number>): void {
  commit(new Set(sanitizeIds([...wikiIds]).ids))
}

export function reset(): void {
  commit(new Set())
}

/** Re-read from disk. For the `storage` event: another tab already wrote. */
export function refreshFromStorage(): void {
  const next = load()
  if (next.size === current.size && [...next].every((id) => current.has(id))) return
  current = next
  for (const listener of listeners) listener()
}

// --- export / import --------------------------------------------------------

export function buildExport(): ProgressExport {
  return {
    app: EXPORT_APP,
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    completed: [...current].sort((a, b) => a - b),
  }
}

export interface ImportResult {
  imported: number
  dropped: number
}

/**
 * Replaces progress rather than merging it. An import is "restore this backup",
 * and a merge could never un-complete a task, which makes restoring an earlier
 * state impossible.
 */
export function importProgress(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON.")
  }

  const data = parsed as Partial<ProgressExport> | null
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error("That file doesn't look like a progress export.")
  }
  if (data.app !== EXPORT_APP) {
    throw new Error(
      'That file was not exported by this app. WikiSync imports are a separate feature.',
    )
  }
  if (!Array.isArray(data.completed)) {
    throw new Error('That export is missing its `completed` list.')
  }

  const { ids, dropped } = sanitizeIds(data.completed)
  commit(new Set(ids))
  return { imported: ids.length, dropped }
}
