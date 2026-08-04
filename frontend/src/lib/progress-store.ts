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

/**
 * Where the current set of ticks came from.
 *
 * A set of 646 integers looks the same however it got here, and one setting
 * needs to tell the difference: manual completion tracking is on by default,
 * unless an account is already keeping the answer. So provenance is stored
 * beside the ids, the way profile-store stores its own.
 *
 * Deliberately not `LoadSourceId`. That list has `wiseoldman`, which can never
 * write progress -- the hiscores don't carry Combat Achievements -- and it has
 * no room for a share code, which isn't a door in the Load dialog at all.
 */
export type ProgressSource =
  "manual" | "wikisync" | "runeprofile" | "sharecode" | "file";

const SOURCES: ReadonlySet<string> = new Set<ProgressSource>([
  "manual",
  "wikisync",
  "runeprofile",
  "sharecode",
  "file",
]);

/** The stored shape: the export, plus where it came from. */
interface StoredProgress extends ProgressExport {
  source: ProgressSource;
}

/**
 * Whether something other than this browser is the authority on these ticks.
 *
 * A WikiSync paste, a RuneProfile lookup and a share code all speak for an
 * account. A backup file does not: it is this app's own tracking coming home,
 * and most of what's in it was ticked by hand in the first place.
 */
export function fromAnAccount(source: ProgressSource): boolean {
  return (
    source === "wikisync" || source === "runeprofile" || source === "sharecode"
  );
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

/**
 * `manual` for anything written before this was stored. That's the safe way to
 * be wrong: it leaves the checkbox column where a returning player left it,
 * rather than making their ticks disappear on the strength of a guess.
 */
function loadSource(): ProgressSource {
  const stored = (readJson(STORAGE_KEY) as { source?: unknown } | null)?.source;
  return typeof stored === "string" && SOURCES.has(stored)
    ? (stored as ProgressSource)
    : "manual";
}

// --- snapshot + subscription ------------------------------------------------
//
// `current` is cached rather than rebuilt per read: useSyncExternalStore compares
// snapshots by identity, and handing it a fresh Set each call is an infinite loop.

let current: ReadonlySet<number> = load();
let currentSource: ProgressSource = loadSource();
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
// The source travels with the snapshot. Undoing an import has to put back the
// provenance as well as the ids, or a browser that just stepped out of a
// RuneProfile import would still believe an account was keeping its answers.
interface Snapshot {
  completed: ReadonlySet<number>;
  source: ProgressSource;
}
let undoStack: Snapshot[] = [];

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
  commit(previous.completed, previous.source, false);
  return true;
}

function commit(
  next: ReadonlySet<number>,
  source: ProgressSource,
  undoable = true,
): void {
  if (undoable) {
    undoStack.push({ completed: current, source: currentSource });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }
  current = next;
  currentSource = source;
  const payload: StoredProgress = {
    app: EXPORT_APP,
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    completed: [...next].sort((a, b) => a - b),
    source,
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

export function getSource(): ProgressSource {
  return currentSource;
}

// --- mutations --------------------------------------------------------------

/**
 * Ticking a box is the definition of tracking by hand, so it says so. That
 * matters after an import: tick one thing yourself and this browser is keeping
 * the answers again, whatever wrote them last.
 */
export function toggle(wikiId: number): void {
  const next = new Set(current);
  if (!next.delete(wikiId)) {
    if (!KNOWN_IDS.has(wikiId)) return;
    next.add(wikiId);
  }
  commit(next, "manual");
}

export function setMany(
  wikiIds: Iterable<number>,
  source: ProgressSource,
): void {
  commit(new Set(sanitizeIds([...wikiIds]).ids), source);
}

// There used to be a `mergeMany` here, the union counterpart to setMany, for the
// WikiSync dialog's merge mode. That mode is gone -- an import now always makes
// this browser match the account, because the account is the authority on what's
// done and a union can only ever leave stale ticks behind. Nothing unions any
// more, so nothing here does either.

/** Back to nothing, and back to this browser keeping its own answers. */
export function reset(): void {
  commit(new Set(), "manual");
}

/** Re-read from disk. For the `storage` event: another tab already wrote. */
export function refreshFromStorage(): void {
  const next = load();
  if (next.size === current.size && [...next].every((id) => current.has(id)))
    return;
  current = next;
  currentSource = loadSource();
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
  commit(new Set(ids), "file");
  return { imported: ids.length, dropped };
}
