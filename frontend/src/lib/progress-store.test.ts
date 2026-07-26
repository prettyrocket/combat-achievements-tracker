// The store is the system of record for progress, and most of what's worth
// asserting is how it behaves when storage misbehaves -- blocked, full, or holding
// something a previous version (or a text editor) left there.
//
// Each test gets a fresh module via resetModules + dynamic import, because the
// store caches its snapshot at import time and several of these depend on what
// storage looked like at that moment.

import { afterEach, describe, expect, it, vi } from 'vitest'

const KEY = 'ca-tracker:progress:v1'

interface FakeOptions {
  throwOnSet?: boolean
  throwOnAccess?: boolean
  seed?: string | null
}

function fakeStorage({ throwOnSet = false, throwOnAccess = false, seed = null }: FakeOptions = {}) {
  const map = new Map<string, string>()
  if (seed !== null) map.set(KEY, seed)
  return {
    map,
    getItem(k: string) {
      if (throwOnAccess) throw new Error('blocked')
      return map.get(k) ?? null
    },
    setItem(k: string, v: string) {
      if (throwOnAccess || throwOnSet) throw new Error('blocked')
      map.set(k, v)
    },
    removeItem(k: string) {
      if (throwOnAccess) throw new Error('blocked')
      map.delete(k)
    },
  }
}

async function loadStore(options: FakeOptions = {}) {
  const storage = fakeStorage(options)
  vi.resetModules()
  vi.stubGlobal('window', { localStorage: storage })
  const store = await import('@/lib/progress-store')
  return { store, storage }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('toggle and persistence', () => {
  it('starts empty and round-trips a toggle', async () => {
    const { store, storage } = await loadStore()
    expect(store.getCompleted().size).toBe(0)

    store.toggle(18)
    store.toggle(315)
    expect(store.getCompleted().has(18)).toBe(true)
    expect(store.getCompleted().has(315)).toBe(true)

    store.toggle(18)
    expect(store.getCompleted().has(18)).toBe(false)

    const stored = JSON.parse(storage.map.get(KEY)!)
    expect(stored.completed).toEqual([315])
    expect(stored.version).toBe(1)
    expect(stored.app).toBe('combat-achievements-tracker')
  })

  it('writes ids sorted, so the stored value has a stable shape', async () => {
    const { store, storage } = await loadStore()
    store.setMany([300, 1, 42])
    expect(JSON.parse(storage.map.get(KEY)!).completed).toEqual([1, 42, 300])
  })

  it('rehydrates from storage on load', async () => {
    const seed = JSON.stringify({ completed: [1, 2, 3] })
    const { store } = await loadStore({ seed })
    expect([...store.getCompleted()].sort((a, b) => a - b)).toEqual([1, 2, 3])
  })

  it('ignores a toggle for an id that is not a real task', async () => {
    const { store } = await loadStore()
    store.toggle(999999)
    expect(store.getCompleted().size).toBe(0)
  })
})

describe('snapshot identity', () => {
  // useSyncExternalStore compares snapshots by identity. Returning a fresh Set on
  // every read is an infinite render loop, so this is load-bearing, not trivia.
  it('is stable between changes and new after one', async () => {
    const { store } = await loadStore()
    const first = store.getCompleted()
    expect(store.getCompleted()).toBe(first)

    store.toggle(1)
    expect(store.getCompleted()).not.toBe(first)
  })
})

describe('hostile stored values', () => {
  it('drops junk, unknown and duplicate ids', async () => {
    const seed = JSON.stringify({ completed: [1, 9999, -5, 'x', null, 2.5, 2, 2] })
    const { store } = await loadStore({ seed })
    expect([...store.getCompleted()].sort((a, b) => a - b)).toEqual([1, 2])
  })

  it('boots empty rather than throwing on corrupt JSON', async () => {
    const { store } = await loadStore({ seed: '{not json at all' })
    expect(store.getCompleted().size).toBe(0)
  })

  it('boots empty when the stored value is the wrong shape entirely', async () => {
    const { store } = await loadStore({ seed: JSON.stringify('a string') })
    expect(store.getCompleted().size).toBe(0)
  })
})

describe('storage that fails', () => {
  it('degrades to memory when storage is blocked outright', async () => {
    const { store } = await loadStore({ throwOnAccess: true })
    expect(store.getCompleted().size).toBe(0)

    store.toggle(5)
    expect(store.getCompleted().has(5)).toBe(true)
    expect(store.getStorageError()).toEqual(expect.stringContaining('local storage'))
  })

  it('keeps the value and reports an error when a write fails', async () => {
    const { store } = await loadStore({ throwOnSet: true })
    store.toggle(7)
    expect(store.getCompleted().has(7)).toBe(true)
    expect(store.getStorageError()).not.toBeNull()
  })

  it('has no error to report when storage works', async () => {
    const { store } = await loadStore()
    store.toggle(1)
    expect(store.getStorageError()).toBeNull()
  })
})

describe('subscribe', () => {
  it('notifies on change and stops after unsubscribing', async () => {
    const { store } = await loadStore()
    let notified = 0
    const unsubscribe = store.subscribe(() => notified++)

    store.toggle(1)
    store.toggle(2)
    expect(notified).toBe(2)

    store.reset()
    expect(store.getCompleted().size).toBe(0)
    expect(notified).toBe(3)

    unsubscribe()
    store.toggle(1)
    expect(notified).toBe(3)
  })
})

describe('mergeMany vs importProgress', () => {
  // These are deliberately opposite and one line apart at the call site, which is
  // exactly why they get asserted against each other rather than in isolation.
  it('mergeMany unions with what is already there', async () => {
    const { store } = await loadStore()
    store.setMany([100, 101])
    store.mergeMany([1, 2, 3])
    expect([...store.getCompleted()].sort((a, b) => a - b)).toEqual([1, 2, 3, 100, 101])
  })

  it('importProgress replaces instead', async () => {
    const { store } = await loadStore()
    store.setMany([100, 101])
    store.importProgress(
      JSON.stringify({ app: 'combat-achievements-tracker', version: 1, completed: [1] }),
    )
    expect([...store.getCompleted()]).toEqual([1])
  })

  it('mergeMany stays silent when nothing is new', async () => {
    const { store } = await loadStore()
    store.setMany([1, 2])
    let notified = 0
    const unsubscribe = store.subscribe(() => notified++)

    store.mergeMany([1])
    expect(notified).toBe(0)

    store.mergeMany([5])
    expect(notified).toBe(1)
    unsubscribe()
  })

  it('mergeMany validates ids like every other path in', async () => {
    const { store } = await loadStore()
    store.mergeMany([1, 999999, 2])
    expect(store.getCompleted().size).toBe(2)
  })
})

describe('export and import', () => {
  it('exports a tagged, sorted payload', async () => {
    const { store } = await loadStore()
    store.setMany([3, 1, 2])
    const exported = store.buildExport()

    expect(exported.app).toBe('combat-achievements-tracker')
    expect(exported.completed).toEqual([1, 2, 3])
    expect(Number.isNaN(Date.parse(exported.exportedAt))).toBe(false)
  })

  it('round-trips its own export', async () => {
    const { store } = await loadStore()
    store.setMany([5, 9, 12])
    const payload = JSON.stringify(store.buildExport())

    store.reset()
    expect(store.getCompleted().size).toBe(0)

    const result = store.importProgress(payload)
    expect(result).toEqual({ imported: 3, dropped: 0 })
    expect([...store.getCompleted()].sort((a, b) => a - b)).toEqual([5, 9, 12])
  })

  it('counts ids it had to drop', async () => {
    const { store } = await loadStore()
    const result = store.importProgress(
      JSON.stringify({
        app: 'combat-achievements-tracker',
        version: 1,
        completed: [1, 2, 88888, 99999],
      }),
    )
    expect(result).toEqual({ imported: 2, dropped: 2 })
  })

  it.each([
    ['malformed JSON', '{{{'],
    ['a file from another app', JSON.stringify({ app: 'wikisync', completed: [1] })],
    ['a missing completed list', JSON.stringify({ app: 'combat-achievements-tracker' })],
    ['a bare array', JSON.stringify([1, 2, 3])],
    ['null', 'null'],
  ])('rejects %s without touching existing progress', async (_label, payload) => {
    const { store } = await loadStore()
    store.setMany([42])

    expect(() => store.importProgress(payload)).toThrow()
    expect([...store.getCompleted()]).toEqual([42])
  })
})

describe('sanitizeIds', () => {
  it('keeps known ids, drops everything else, and dedupes', async () => {
    const { store } = await loadStore()
    const known = new Set([1, 2, 3])
    expect(store.sanitizeIds([1, 1, 2, 4, 'x', null, 2.5], known)).toEqual({
      ids: [1, 2],
      dropped: 4,
    })
  })

  it('treats a non-array as nothing at all', async () => {
    const { store } = await loadStore()
    expect(store.sanitizeIds('nope', new Set([1]))).toEqual({ ids: [], dropped: 0 })
  })
})
