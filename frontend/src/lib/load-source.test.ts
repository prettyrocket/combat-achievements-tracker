// The remembered source is read from disk on every open, so the only things
// worth pinning are that a stale or hostile value can't strand somebody on a
// pane that doesn't exist, and that the rail and the id set can't drift apart.

import { afterEach, describe, expect, it, vi } from 'vitest'

function fakeStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

async function load() {
  vi.resetModules()
  vi.stubGlobal('window', { localStorage: fakeStorage() })
  return await import('@/lib/load-source')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the source list', () => {
  it('marks exactly one source as the popular one', async () => {
    const { LOAD_SOURCES } = await load()
    expect(LOAD_SOURCES.filter((source) => source.popular)).toHaveLength(1)
  })

  it('leads with the source most people can use', async () => {
    // Install count, not preference: WikiSync has roughly 335k Plugin Hub
    // installs to RuneProfile's 92k, and the rail order says so.
    const { LOAD_SOURCES, DEFAULT_LOAD_SOURCE } = await load()
    expect(LOAD_SOURCES[0].id).toBe('wikisync')
    expect(DEFAULT_LOAD_SOURCE).toBe('wikisync')
  })

  it('says what every source carries', async () => {
    const { LOAD_SOURCES } = await load()
    for (const source of LOAD_SOURCES) {
      expect(source.carries.trim()).not.toBe('')
      expect(source.label.trim()).not.toBe('')
    }
  })
})

describe('remembering the last source', () => {
  it('starts on the default with nothing stored', async () => {
    const { readLastSource, DEFAULT_LOAD_SOURCE } = await load()
    expect(readLastSource()).toBe(DEFAULT_LOAD_SOURCE)
  })

  it('round-trips a written source', async () => {
    const { readLastSource, writeLastSource } = await load()
    writeLastSource('runeprofile')
    expect(readLastSource()).toBe('runeprofile')
  })

  // The file is hand-editable and survives releases, so a source that no longer
  // exists has to fall back rather than open the dialog onto nothing.
  it('falls back when the stored value is not a source', async () => {
    const { readLastSource, writeLastSource, DEFAULT_LOAD_SOURCE, LOAD_SOURCE_STORAGE_KEY } =
      await load()
    writeLastSource('runeprofile')
    window.localStorage.setItem(LOAD_SOURCE_STORAGE_KEY, JSON.stringify('collectionlog'))
    expect(readLastSource()).toBe(DEFAULT_LOAD_SOURCE)

    window.localStorage.setItem(LOAD_SOURCE_STORAGE_KEY, JSON.stringify({ id: 'file' }))
    expect(readLastSource()).toBe(DEFAULT_LOAD_SOURCE)
  })

  it('accepts every id the rail offers', async () => {
    const { LOAD_SOURCES, readLastSource, writeLastSource } = await load()
    for (const source of LOAD_SOURCES) {
      writeLastSource(source.id)
      expect(readLastSource()).toBe(source.id)
    }
  })
})
