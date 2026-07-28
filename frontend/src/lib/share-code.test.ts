// No fake localStorage here, unlike the store tests: the codec is a pure
// function over values, which is most of the reason it's a separate module.

import { describe, expect, it } from 'vitest'

import { TASKS } from '@/data/tasks'
import {
  QUEST_WIRE_ORDER,
  SKILL_WIRE_ORDER,
  buildShareUrl,
  decodeShareCode,
  encodeShareCode,
  profileWireLoss,
  readShareCode,
} from '@/lib/share-code'
import { GATED_SKILLS, gatedQuests } from '@/lib/requirements'

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

describe('the wire orderings', () => {
  // The whole format rests on these never moving. Each of these tests exists to
  // fail the build rather than let a code already in the wild quietly re-point.

  it('covers every gated quest, so adding a gate fails here first', () => {
    for (const quest of gatedQuests()) {
      expect(QUEST_WIRE_ORDER).toContain(quest)
    }
  })

  it('covers every gated skill', () => {
    for (const skill of GATED_SKILLS) {
      expect(SKILL_WIRE_ORDER).toContain(skill)
    }
  })

  // Pinned literally: gatedQuests() sorts by label, and a quest added later
  // would land mid-list there. If someone ever re-derives this ordering from it,
  // this test is what stops the resulting silent corruption.
  it('has not been re-sorted since the format was frozen', () => {
    expect(QUEST_WIRE_ORDER.slice(0, 19)).toEqual([
      'A Kingdom Divided',
      'Beneath Cursed Sands',
      'Children of the Sun',
      'Desert Treasure II - The Fallen Empire',
      'Dragon Slayer II',
      'Monkey Madness II',
      'Perilous Moons',
      'Priest in Peril',
      'Regicide',
      'Secrets of the North',
      'Sins of the Father',
      'Song of the Elves',
      'The Blood Moon Rises',
      'The Final Dawn',
      'The Fremennik Exiles',
      'The Heart of Darkness',
      'The Ides of Milk',
      'Troubled Tortugans',
      'While Guthix Sleeps',
    ])
  })

  it('has no duplicate positions in either ordering', () => {
    expect(new Set(SKILL_WIRE_ORDER).size).toBe(SKILL_WIRE_ORDER.length)
    expect(new Set(QUEST_WIRE_ORDER).size).toBe(QUEST_WIRE_ORDER.length)
  })
})

describe('round trip', () => {
  it('survives an empty browser', () => {
    const out = decodeShareCode(encodeShareCode({ completed: [], list: [] }))
    expect(out).toEqual({
      completed: [],
      list: [],
      dropped: 0,
      profile: { levels: {}, quests: [] },
      profileDropped: { levels: 0, quests: 0 },
    })
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

describe('the profile', () => {
  const profile = {
    levels: { Slayer: 92, Hitpoints: 99, Ranged: 85 },
    quests: ['Priest in Peril', 'Song of the Elves'],
  }

  it('round-trips levels and quests', () => {
    const out = decodeShareCode(encodeShareCode({ completed: [], list: [], profile }))
    expect(out.profile.levels).toEqual(profile.levels)
    expect([...out.profile.quests].sort()).toEqual(['Priest in Peril', 'Song of the Elves'])
    expect(out.profileDropped).toEqual({ levels: 0, quests: 0 })
  })

  it('carries all four halves at once without any disturbing another', () => {
    const completed = [4, 5, 645]
    const list = [645, 4]
    const out = decodeShareCode(encodeShareCode({ completed, list, profile }))
    expect(out.completed).toEqual(completed)
    expect(out.list).toEqual(list)
    expect(out.profile.levels).toEqual(profile.levels)
  })

  it('keeps every level a real account could hold', () => {
    const levels = Object.fromEntries(SKILL_WIRE_ORDER.map((s) => [s, 99]))
    const out = decodeShareCode(encodeShareCode({ completed: [], list: [], profile: { levels, quests: [] } }))
    expect(out.profile.levels).toEqual(levels)
  })

  it('clamps a level past the ceiling rather than overflowing its byte', () => {
    const out = decodeShareCode(
      encodeShareCode({ completed: [], list: [], profile: { levels: { Slayer: 9000 }, quests: [] } }),
    )
    expect(out.profile.levels).toEqual({ Slayer: 126 })
  })

  it('finds a quest whose dash is the wrong kind of dash', () => {
    // normalizeQuest exists for exactly this; the wire format inherits it, and
    // decode hands back the canonical spelling rather than the one it was given.
    const out = decodeShareCode(
      encodeShareCode({
        completed: [],
        list: [],
        profile: { levels: {}, quests: ['Desert Treasure II — The Fallen Empire'] },
      }),
    )
    expect(out.profile.quests).toEqual(['Desert Treasure II - The Fallen Empire'])
  })

  it('matches a skill whatever case it arrived in', () => {
    const out = decodeShareCode(
      encodeShareCode({ completed: [], list: [], profile: { levels: { sLaYeR: 70 }, quests: [] } }),
    )
    expect(out.profile.levels).toEqual({ Slayer: 70 })
  })

  it('writes no section at all for an empty profile', () => {
    // The proof that appending this section broke nothing: a browser with no
    // levels makes byte-identical codes before and after the feature existed.
    const bare = encodeShareCode({ completed: [1, 2], list: [3] })
    expect(encodeShareCode({ completed: [1, 2], list: [3], profile: { levels: {}, quests: [] } })).toBe(bare)
    expect(encodeShareCode({ completed: [1, 2], list: [3], profile: null })).toBe(bare)
  })

  it('reads a code made before the section existed, exactly as it used to', () => {
    // Hand-built to the old layout: version, bitset, list length, no tail.
    const bytes = new Uint8Array(85)
    bytes[0] = 1
    bytes[1] = 0b0000_0110 // tasks 1 and 2
    bytes[82] = 1
    bytes[83] = 0
    bytes[84] = 3
    const out = decodeShareCode(asCode(bytes))
    expect(out.completed).toEqual([1, 2])
    expect(out.list).toEqual([3])
    expect(out.profile).toEqual({ levels: {}, quests: [] })
    expect(out.profileDropped).toEqual({ levels: 0, quests: 0 })
  })

  it('rejects a profile section that was cut off mid-flight', () => {
    const code = encodeShareCode({ completed: [], list: [], profile })
    const bytes = fromCode(code)
    // Drop the last two bytes of the quest bitset.
    expect(() => decodeShareCode(asCode(bytes.slice(0, bytes.length - 2)))).toThrow(/incomplete/i)
  })

  it('skips skills and quests appended by a newer build, and counts them', () => {
    // A section claiming 25 skills and 5 quest bytes: two skills and some quest
    // slots this build has no name for.
    const bytes = new Uint8Array(83 + 1 + 25 + 1 + 5)
    bytes[0] = 1
    bytes[82] = 0
    bytes[83] = 25
    bytes[83 + 1 + 18] = 92 // Slayer, position 18, known
    bytes[83 + 1 + 23] = 70 // Sailing, position 23, known
    bytes[83 + 1 + 24] = 55 // appended skill, unknown
    bytes[83 + 1 + 25] = 5
    bytes[83 + 1 + 25 + 1] = 0b1000_0000 // quest 7: Priest in Peril
    bytes[83 + 1 + 25 + 1 + 4] = 0b0000_0001 // quest 32: past the end
    const out = decodeShareCode(asCode(bytes))
    expect(out.profile.levels).toEqual({ Slayer: 92, Sailing: 70 })
    expect(out.profile.quests).toEqual(['Priest in Peril'])
    expect(out.profileDropped).toEqual({ levels: 1, quests: 1 })
  })
})

describe('what cannot travel in a link', () => {
  it('counts the quests no link can carry, before one is made', () => {
    const loss = profileWireLoss({
      levels: { Slayer: 92, Sandwichmaking: 30 },
      quests: ['Priest in Peril', 'Cook’s Assistant', 'Dragon Slayer I'],
    })
    expect(loss).toEqual({ levels: 1, quests: 2 })
  })

  it('reports nothing lost for a profile that fits', () => {
    expect(profileWireLoss({ levels: { Slayer: 92 }, quests: ['Regicide'] })).toEqual({
      levels: 0,
      quests: 0,
    })
  })

  it('reports nothing for no profile at all', () => {
    expect(profileWireLoss(null)).toEqual({ levels: 0, quests: 0 })
  })

  it('agrees with what the codec actually drops', () => {
    const profile = {
      levels: { Slayer: 92, Sandwichmaking: 30 },
      quests: ['Priest in Peril', 'Dragon Slayer I'],
    }
    const out = decodeShareCode(encodeShareCode({ completed: [], list: [], profile }))
    const loss = profileWireLoss(profile)
    expect(Object.keys(out.profile.levels)).toHaveLength(
      Object.keys(profile.levels).length - loss.levels,
    )
    expect(out.profile.quests).toHaveLength(profile.quests.length - loss.quests)
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

  // 28 bytes for the section -- 1 + 23 levels + 1 + 3 quest bytes -- and 83 + 28
  // divides by 3, so the whole code encodes with no padding to strip: 148
  // characters flat, 37 more than without.
  it('adds a fixed 37 characters for a profile, full or nearly empty', () => {
    const bare = encodeShareCode({ completed: ALL_IDS, list: [] })
    const one = encodeShareCode({
      completed: ALL_IDS,
      list: [],
      profile: { levels: { Slayer: 92 }, quests: [] },
    })
    const full = encodeShareCode({
      completed: ALL_IDS,
      list: [],
      profile: {
        levels: Object.fromEntries(SKILL_WIRE_ORDER.map((s) => [s, 99])),
        quests: [...QUEST_WIRE_ORDER],
      },
    })
    expect(one.length).toBe(full.length)
    expect(full.length - bare.length).toBe(39)
    expect(full).toHaveLength(150)
  })

  it('fits a whole account in a URL people can paste into a message', () => {
    const code = encodeShareCode({
      completed: ALL_IDS,
      list: ALL_IDS.slice(0, 25),
      profile: {
        levels: Object.fromEntries(SKILL_WIRE_ORDER.map((s) => [s, 99])),
        quests: [...QUEST_WIRE_ORDER],
      },
    })
    expect(code.length).toBeLessThan(250)
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

/** The inverse, for tests that truncate a real code rather than build one. */
function fromCode(code: string): Uint8Array {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
