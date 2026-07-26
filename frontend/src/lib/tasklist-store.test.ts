// Same harness as progress-store's tests: a fake localStorage stubbed onto
// `window`, and a fresh module per test, because the store caches its snapshot at
// import time and several of these depend on what storage held at that moment.

import { afterEach, describe, expect, it, vi } from 'vitest'

const KEY = 'ca-tracker:tasklist:v1'

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
  const store = await import('@/lib/tasklist-store')
  return { store, storage }
}

/** What's actually on disk, as ids. */
function stored(storage: ReturnType<typeof fakeStorage>): number[] {
  return JSON.parse(storage.map.get(KEY) ?? '{"list":[]}').list
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('add, remove, toggle', () => {
  it('starts empty and round-trips through storage', async () => {
    const { store, storage } = await loadStore()
    expect(store.getList()).toEqual([])

    store.add(1)
    store.add(2)
    expect(store.getList()).toEqual([1, 2])
    expect(stored(storage)).toEqual([1, 2])
  })

  it('reloads what a previous session left behind, in order', async () => {
    const { store } = await loadStore({ seed: JSON.stringify({ version: 1, list: [3, 1, 2] }) })
    expect(store.getList()).toEqual([3, 1, 2])
  })

  it('removes and toggles', async () => {
    const { store } = await loadStore()
    store.setList([1, 2, 3])
    store.remove(2)
    expect(store.getList()).toEqual([1, 3])
    store.toggle(2)
    expect(store.getList()).toEqual([1, 3, 2])
    store.toggle(2)
    expect(store.getList()).toEqual([1, 3])
  })

  it('clears', async () => {
    const { store } = await loadStore()
    store.setList([1, 2])
    store.clear()
    expect(store.getList()).toEqual([])
  })
})

describe('insertAt', () => {
  it('reorders within the list', async () => {
    const { store } = await loadStore()
    store.setList([1, 2, 3])
    store.insertAt(3, 0)
    expect(store.getList()).toEqual([3, 1, 2])
  })

  it('adds a new task at a position', async () => {
    const { store } = await loadStore()
    store.setList([1, 2])
    store.insertAt(3, 0)
    expect(store.getList()).toEqual([3, 1, 2])
  })
})

describe('snapshot identity', () => {
  // useSyncExternalStore compares by identity: a fresh array per read is an
  // infinite render loop, and an unchanged reference after a write is a
  // component that never updates.
  it('is stable between changes and new after one', async () => {
    const { store } = await loadStore()
    expect(store.getList()).toBe(store.getList())

    const before = store.getList()
    store.add(1)
    expect(store.getList()).not.toBe(before)
  })

  // A drag that ends where it started must not write or re-render.
  it('does not change identity for a no-op write', async () => {
    const { store } = await loadStore()
    store.setList([1, 2])
    const before = store.getList()
    store.setList([1, 2])
    expect(store.getList()).toBe(before)
  })
})

describe('hostile stored values', () => {
  it.each([
    ['malformed JSON', '{{{'],
    ['a bare array', '[1,2,3]'],
    ['null', 'null'],
    ['a list that is not an array', JSON.stringify({ list: 'nope' })],
    ['no list at all', JSON.stringify({ version: 1 })],
  ])('starts empty for %s rather than refusing to boot', async (_label, seed) => {
    const { store } = await loadStore({ seed })
    expect(store.getList()).toEqual([])
  })

  it('drops ids no task has, keeping the order of the rest', async () => {
    const { store } = await loadStore({
      seed: JSON.stringify({ list: [3, 99999, 1, 'x', null, 2] }),
    })
    expect(store.getList()).toEqual([3, 1, 2])
  })

  it('dedupes a list that was hand-edited to repeat one', async () => {
    const { store } = await loadStore({ seed: JSON.stringify({ list: [1, 2, 1] }) })
    expect(store.getList()).toEqual([1, 2])
  })

  it('refuses to add an id that matches no task', async () => {
    const { store } = await loadStore()
    store.add(999999)
    expect(store.getList()).toEqual([])
  })
})

describe('storage that fails', () => {
  it('keeps working in memory when storage is blocked', async () => {
    const { store } = await loadStore({ throwOnAccess: true })
    store.add(1)
    expect(store.getList()).toEqual([1])
  })

  it('keeps the value when a write fails', async () => {
    const { store } = await loadStore({ throwOnSet: true })
    store.add(7)
    expect(store.getList()).toEqual([7])
  })
})

describe('subscribe', () => {
  it('notifies on change and stops after unsubscribing', async () => {
    const { store } = await loadStore()
    let calls = 0
    const unsubscribe = store.subscribe(() => calls++)

    store.add(1)
    expect(calls).toBe(1)

    unsubscribe()
    store.add(2)
    expect(calls).toBe(1)
  })

  it('does not notify for a change that changes nothing', async () => {
    const { store } = await loadStore()
    store.setList([1])
    let calls = 0
    store.subscribe(() => calls++)

    store.setList([1])
    store.remove(999)
    expect(calls).toBe(0)
  })
})

describe('refreshFromStorage', () => {
  it('picks up what another tab wrote', async () => {
    const { store, storage } = await loadStore()
    store.setList([1])

    storage.map.set(KEY, JSON.stringify({ list: [2, 3] }))
    store.refreshFromStorage()
    expect(store.getList()).toEqual([2, 3])
  })

  it('leaves the snapshot identical when nothing actually changed', async () => {
    const { store } = await loadStore()
    store.setList([1, 2])
    const before = store.getList()
    store.refreshFromStorage()
    expect(store.getList()).toBe(before)
  })

  // Order is the data here, so a reordered list from another tab is a change
  // even though the contents are identical.
  it('notices a reorder, not just a different set of ids', async () => {
    const { store, storage } = await loadStore()
    store.setList([1, 2])
    storage.map.set(KEY, JSON.stringify({ list: [2, 1] }))
    store.refreshFromStorage()
    expect(store.getList()).toEqual([2, 1])
  })
})
