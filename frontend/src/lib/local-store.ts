// The localStorage seam, shared by everything that persists on this machine.
//
// Extracted from progress-store when the task list became a second thing worth
// keeping: private browsing, disabled cookies and an exhausted quota all surface
// as a throw from perfectly ordinary calls, and there should be exactly one place
// that knows how to survive that -- and exactly one error for the UI to show.
// Two stores failing for the same reason is one problem, not two banners.
//
// Framework-free on purpose. The React bindings live in the use-* hooks; this is
// plain functions, so the failure modes a real browser won't reproduce on demand
// can be tested against an injected fake.

let storageError: string | null = null

/**
 * The live localStorage, or null when it can't be used.
 *
 * Probed by writing, not by feature-detecting: Safari in private mode hands you a
 * perfectly real `localStorage` object that throws the moment you set anything.
 */
export function storage(): Storage | null {
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
    storageError =
      'This browser is blocking local storage, so your progress and task list will be lost when you close the tab. Export to keep them.'
    return null
  }
}

/** Non-null when we're memory-only, with a message fit for showing the user. */
export function getStorageError(): string | null {
  return storageError
}

/** Parsed JSON at `key`, or null if absent, unreadable, or not valid JSON. */
export function readJson(key: string): unknown {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    // Corrupt or hand-edited JSON. Callers start empty rather than refusing to
    // boot; the bad value stays on disk untouched until the next write.
    return null
  }
}

/** Writes JSON at `key`. Returns false, and records the error, if it couldn't. */
export function writeJson(key: string, value: unknown): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(key, JSON.stringify(value))
    return true
  } catch {
    storageError =
      'Ran out of local storage space, so changes are no longer being saved. Export to keep them.'
    return false
  }
}
