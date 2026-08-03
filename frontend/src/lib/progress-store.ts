// Progress lives entirely on the player's machine -- there is no account and no
// server (#15). That makes localStorage the system of record, which is only an
// acceptable place for it because export/import exists: clearing site data would
// otherwise be an unrecoverable loss with no way to move between devices.
//
// Deliberately framework-free. The React binding is use-progress.ts; everything
// here is plain functions over a module-level snapshot, so #6 can test the rules
// without mounting anything.

import { TASKS } from "@/data/tasks";
import { getStorageError, readJson, writeJson } from "@/lib/local-store";

// Re-exported so callers keep asking one module about one concern: the storage
// failure they need to report is the same failure whatever wrote last.
export { getStorageError };

/** Versioned so the stored shape can migrate without guessing at what's there. */
const STORAGE_KEY = "ca-tracker:progress:v1";
const SCHEMA_VERSION = 1;

/** Marks an export as ours, so #12's WikiSync paste can't be fed in by mistake. */
export const EXPORT_APP = "combat-achievements-tracker";

const KNOWN_IDS: ReadonlySet<number> = new Set(TASKS.map((t) => t.wikiId));

export interface ProgressExport {
  app: typeof EXPORT_APP;
  version: number;
  exportedAt: string;
  completed: number[];
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
export function sanitizeIds(
  input: unknown,
  known: ReadonlySet<number> = KNOWN_IDS,
) {
  const kept: number[] = [];
  let dropped = 0;
  if (Array.isArray(input)) {
    const seen = new Set<number>();
    for (const value of input) {
      if (
        typeof value === "number" &&
        Number.isInteger(value) &&
        known.has(value)
      ) {
        if (!seen.has(value)) {
          seen.add(value);
          kept.push(value);
        }
      } else {
        dropped++;
      }
    }
  }
  return { ids: kept, dropped };
}

// --- storage access ---------------------------------------------------------
//
// The plumbing -- probing, and surviving a blocked or full store -- lives in
// local-store.ts, shared with the task list. What's left here is what the shape
// of *progress* means.

function load(): ReadonlySet<number> {
  const completed = (readJson(STORAGE_KEY) as { completed?: unknown } | null)
    ?.completed;
  return new Set(sanitizeIds(completed).ids);
}

// --- snapshot + subscription ------------------------------------------------
//
// `current` is cached rather than rebuilt per read: useSyncExternalStore compares
// snapshots by identity, and handing it a fresh Set each call is an infinite loop.

let current: ReadonlySet<number> = load();
const listeners = new Set<() => void>();

// --- undo -------------------------------------------------------------------
//
// Whole snapshots rather than a log of operations. A set of at most 646 small
// integers is cheap enough that storing the state before each change costs less
// than describing the change and inverting it -- and it means an import, a
// reset and a stray click all undo by exactly the same mechanism.
//
// Deliberately memory-only: this exists to catch the checkbox you hit by
// accident thirty seconds ago, not to be a second copy of your progress.
// Export is what survives a reload, and it says so where it matters.

const UNDO_LIMIT = 50;
let undoStack: ReadonlySet<number>[] = [];

/** The state before the most recent change, if there is one to go back to. */
export function canUndo(): boolean {
  return undoStack.length > 0;
}

/** Steps back one change. Returns false when there's nothing to step back to. */
export function undo(): boolean {
  const previous = undoStack.pop();
  if (previous === undefined) return false;
  // Not itself undoable -- otherwise undo would push the state it just left and
  // the next undo would walk straight back into it.
  commit(previous, false);
  return true;
}

function commit(next: ReadonlySet<number>, undoable = true): void {
  if (undoable) {
    undoStack.push(current);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }
  current = next;
  const payload: ProgressExport = {
    app: EXPORT_APP,
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    completed: [...next].sort((a, b) => a - b),
  };
  writeJson(STORAGE_KEY, payload);
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Stable identity between changes -- safe for useSyncExternalStore. */
export function getCompleted(): ReadonlySet<number> {
  return current;
}

// --- mutations --------------------------------------------------------------

export function toggle(wikiId: number): void {
  const next = new Set(current);
  if (!next.delete(wikiId)) {
    if (!KNOWN_IDS.has(wikiId)) return;
    next.add(wikiId);
  }
  commit(next);
}

export function setMany(wikiIds: Iterable<number>): void {
  commit(new Set(sanitizeIds([...wikiIds]).ids));
}

// There used to be a `mergeMany` here, the union counterpart to setMany, for the
// WikiSync dialog's merge mode. That mode is gone -- an import now always makes
// this browser match the account, because the account is the authority on what's
// done and a union can only ever leave stale ticks behind. Nothing unions any
// more, so nothing here does either.

export function reset(): void {
  commit(new Set());
}

/** Re-read from disk. For the `storage` event: another tab already wrote. */
export function refreshFromStorage(): void {
  const next = load();
  if (next.size === current.size && [...next].every((id) => current.has(id)))
    return;
  current = next;
  // Another tab is the authority now. Undoing here would write this tab's older
  // idea of the truth back over what that tab just did, so the history goes.
  undoStack = [];
  for (const listener of listeners) listener();
}

// --- export / import --------------------------------------------------------

export function buildExport(): ProgressExport {
  return {
    app: EXPORT_APP,
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    completed: [...current].sort((a, b) => a - b),
  };
}

export interface ImportResult {
  imported: number;
  dropped: number;
}

/**
 * Replaces progress rather than merging it. An import is "restore this backup",
 * and a merge could never un-complete a task, which makes restoring an earlier
 * state impossible.
 */
export function importProgress(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  const data = parsed as Partial<ProgressExport> | null;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("That file doesn't look like a progress export.");
  }
  if (data.app !== EXPORT_APP) {
    throw new Error(
      "That file was not exported by this app. WikiSync imports are a separate feature.",
    );
  }
  if (!Array.isArray(data.completed)) {
    throw new Error("That export is missing its `completed` list.");
  }

  const { ids, dropped } = sanitizeIds(data.completed);
  commit(new Set(ids));
  return { imported: ids.length, dropped };
}
