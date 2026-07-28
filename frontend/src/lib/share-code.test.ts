// No fake localStorage here, unlike the store tests: the codec is a pure
// function over values, which is most of the reason it's a separate module.

import { describe, expect, it } from 'vitest'

import { TASKS } from '@/data/tasks'
import { buildShareUrl, decodeShareCode, encodeShareCode, readShareCode } from '@/lib/share-code'

const ALL_IDS = TASKS.map((t) => t.wikiId).sort((a, b) => a - b)

describe('the assumption the format rests on', () => {
  // If this ever fails, the bitset is the wrong size and every code already
  // shared decodes onto the wrong tasks. It is the first test on purpose.
  it('has 646 tasks with contiguous ids from 0', () => {
    expect(ALL_IDS).toHaveLength(646)
    expect(ALL_IDS[0]).toBe(0)
    expect(ALL_IDS[645]).toBe(645)
    expect(ALL_IDS.every((id, i) => id === i)).toBe(true)
  })
})

describe('round trip', () => {
  it('survives an empty browser', () => {
    const out = decodeShareCode(encodeShareCode({ completed: [], list: [] }))
    expect(out).toEqual({ completed: [], list: [], dropped: 0 })
  })

  it('survives a realistic set of completions', () => {
    const completed = [0, 1, 7, 8, 63, 64, 100, 321, 644, 645]
    const out = decodeShareCode(encodeShareCode({ completed, list: [] }))
    expect(out.completed).toEqual(completed)
    expect(out.dropped).toBe(0)
  })

  it('survives every task being complete', () => {
    const out = decodeShareCode(encodeShareCode({ completed: ALL_IDS, list: [] }))
    expect(out.completed).toEqual(ALL_IDS)
  })

  // The byte boundaries are where an off-by-one hides: bit 7 is the last of
  // byte 0, bit 645 is the last real bit of the last byte.
  it.each([0, 7, 8, 15, 16, 639, 640, 644, 645])('survives task %i alone', (id) => {
    expect(decodeShareCode(encodeShareCode({ completed: [id], list: [] })).completed).toEqual([id])
  })

  it('keeps the task list in order rather than sorting it', () => {
    const list = [645, 0, 300, 12]
    const out = decodeShareCode(encodeShareCode({ completed: [], list }))
    expect(out.list).toEqual(list)
  })

  it('carries both halves at once without either disturbing the other', () => {
    const completed = [4, 5, 6, 500]
    const list = [500, 4]
    const out = decodeShareCode(encodeShareCode({ completed, list }))
    expect(out.completed).toEqual(completed)
    expect(out.list).toEqual(list)
  })
})

describe('size and shape', () => {
  // 83 bytes -> 111 characters: the 81-byte bitset is 108 on its own, plus the
  // version and length bytes that make it a format rather than a blob.
  it('is 111 characters when it carries completions only', () => {
    const code = encodeShareCode({ completed: ALL_IDS, list: [] })
    expect(code).toHaveLength(111)
    // The point of a bitset: a full browser and an empty one cost the same.
    expect(encodeShareCode({ completed: [], list: [] })).toHaveLength(111)
  })

  it('stays under 200 characters with a 25-task list attached', () => {
    const code = encodeShareCode({ completed: ALL_IDS, list: ALL_IDS.slice(0, 25) })
    expect(code.length).toBeLessThan(200)
  })

  it('uses only characters that survive a URL fragment unescaped', () => {
    const code = encodeShareCode({ completed: ALL_IDS, list: [1, 2, 3] })
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('hostile and malformed input', () => {
  it('rejects an empty code', () => {
    expect(() => decodeShareCode('   ')).toThrow(/empty/i)
  })

  it('rejects something that was never a share code', () => {
    expect(() => decodeShareCode('hello there')).toThrow(/doesn't look like/i)
  })

  it('rejects a code that was cut off when copied', () => {
    const code = encodeShareCode({ completed: ALL_IDS, list: [] })
    expect(() => decodeShareCode(code.slice(0, 40))).toThrow(/incomplete/i)
  })

  it('rejects a code whose task list claims more entries than it carries', () => {
    const bytes = new Uint8Array(83)
    bytes[0] = 1
    bytes[82] = 10 // says ten ids follow; none do
    expect(() => decodeShareCode(asCode(bytes))).toThrow(/incomplete/i)
  })

  it('names both versions when the format does not match', () => {
    const bytes = new Uint8Array(83)
    bytes[0] = 9
    expect(() => decodeShareCode(asCode(bytes))).toThrow(/format 9.*reads 1/)
  })

  it('ignores the padding bits past task 645', () => {
    // Every bit set, including 646 and 647, which are padding in the last byte.
    const bytes = new Uint8Array(83).fill(0xff)
    bytes[0] = 1
    bytes[82] = 0
    const out = decodeShareCode(asCode(bytes))
    expect(out.completed).toEqual(ALL_IDS)
    expect(out.dropped).toBe(0)
  })

  it('drops ids it does not recognise rather than refusing the code', () => {
    // 0xffff is not a task. It survives the byte format but not sanitizeIds.
    const bytes = new Uint8Array(85)
    bytes[0] = 1
    bytes[82] = 1
    bytes[83] = 0xff
    bytes[84] = 0xff
    const out = decodeShareCode(asCode(bytes))
    expect(out.list).toEqual([])
    expect(out.dropped).toBe(1)
  })

  it('drops out-of-range completions on the way in instead of corrupting a neighbour', () => {
    const out = decodeShareCode(encodeShareCode({ completed: [5, 646, -1, 1e9, 6], list: [] }))
    expect(out.completed).toEqual([5, 6])
  })

  it('truncates a task list too long to state its own length', () => {
    const long = Array.from({ length: 300 }, (_, i) => i)
    expect(decodeShareCode(encodeShareCode({ completed: [], list: long })).list).toHaveLength(255)
  })
})

describe('the URL', () => {
  const location = {
    origin: 'https://ca.example',
    pathname: '/tracker/',
    search: '?tier=MASTER&q=vardorvis',
  } as Location

  it('puts the code in the fragment, where no server sees it', () => {
    const url = buildShareUrl({ completed: [1, 2, 3], list: [] }, location)
    expect(url.startsWith('https://ca.example/tracker/#s=')).toBe(true)
  })

  it('drops the current filters rather than sharing what you were looking at', () => {
    const url = buildShareUrl({ completed: [1], list: [] }, location)
    expect(url).not.toContain('vardorvis')
    expect(url).not.toContain('?')
  })

  it('round-trips through the address bar', () => {
    const completed = [3, 30, 300]
    const list = [300, 3]
    const url = buildShareUrl({ completed, list }, location)
    const code = readShareCode(url.slice(url.indexOf('#')))
    expect(code).not.toBeNull()
    const out = decodeShareCode(code!)
    expect(out.completed).toEqual(completed)
    expect(out.list).toEqual(list)
  })

  it.each(['', '#', '#other=1', '?s=abc'])('finds no code in %o', (hash) => {
    expect(readShareCode(hash)).toBeNull()
  })

  it('ignores a code sitting in the query string, which would leak to logs', () => {
    // Belt and braces: buildShareUrl never emits this, but a hand-edited URL
    // must not be honoured from the half that reaches the server.
    expect(readShareCode('?s=AUmS')).toBeNull()
  })
})

describe('fuzz', () => {
  it('round-trips a hundred random browsers exactly', () => {
    for (let run = 0; run < 100; run++) {
      const completed = ALL_IDS.filter(() => Math.random() < 0.4)
      const list = ALL_IDS.filter(() => Math.random() < 0.02).slice(0, 40)
      const out = decodeShareCode(encodeShareCode({ completed, list }))
      expect(out.completed).toEqual(completed)
      expect(out.list).toEqual(list)
      expect(out.dropped).toBe(0)
    }
  })
})

/** The same base64url the codec emits, so hand-built bytes can be fed to decode. */
function asCode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
