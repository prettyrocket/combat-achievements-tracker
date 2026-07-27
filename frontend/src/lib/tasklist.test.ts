// The ordering rules are the whole feature, so this is where they're pinned down.
// Everything here is pure: no store, no React, no DOM.

import { describe, expect, it } from 'vitest'
import {
  add,
  addMany,
  insertAt,
  move,
  moveId,
  remove,
  resolve,
  summarize,
  toggle,
} from '@/lib/tasklist'
import type { TaskRow, Tier } from '@/lib/types'

let nextId = 0
function task(over: Partial<TaskRow> = {}): TaskRow {
  const tier: Tier = over.tier ?? 'HARD'
  const points = { EASY: 1, MEDIUM: 2, HARD: 3, ELITE: 4, MASTER: 5, GRANDMASTER: 6 }[tier]
  return {
    wikiId: nextId++,
    name: 'A task',
    monster: 'Zulrah',
    description: 'Do the thing.',
    tier,
    type: 'KILL_COUNT',
    leagueRegion: null,
    completionPct: 50,
    ...over,
    points: over.points ?? points,
  }
}

describe('addMany', () => {
  it('appends a batch in the order given', () => {
    expect(addMany([1], [2, 3, 4])).toEqual([1, 2, 3, 4])
  })

  // Adding a monster group you had partly planned already shouldn't reshuffle
  // the part you had ordered.
  it('leaves ids already on the list where they are', () => {
    expect(addMany([3, 1], [1, 2, 3])).toEqual([3, 1, 2])
  })

  it('drops duplicates within the batch itself', () => {
    expect(addMany([], [5, 5, 6, 5])).toEqual([5, 6])
  })

  it('is a no-op when everything is already there', () => {
    expect(addMany([1, 2], [2, 1])).toEqual([1, 2])
  })

  it('does not mutate the input', () => {
    const list = [1, 2]
    addMany(list, [3])
    expect(list).toEqual([1, 2])
  })
})

describe('add', () => {
  it('appends to the end', () => {
    expect(add([1, 2], 3)).toEqual([1, 2, 3])
  })

  // Arriving work must never displace the thing you decided to do next.
  it('does not move a task that is already on the list', () => {
    expect(add([1, 2, 3], 1)).toEqual([1, 2, 3])
  })

  it('does not mutate the input', () => {
    const list = [1, 2]
    add(list, 3)
    expect(list).toEqual([1, 2])
  })
})

describe('remove and toggle', () => {
  it('removes by id, keeping the rest in order', () => {
    expect(remove([1, 2, 3], 2)).toEqual([1, 3])
  })

  it('is a no-op for an id that is not there', () => {
    expect(remove([1, 2], 9)).toEqual([1, 2])
  })

  it('toggles on and back off', () => {
    expect(toggle([1], 2)).toEqual([1, 2])
    expect(toggle([1, 2], 2)).toEqual([1])
  })

  // Toggle off then on sends it to the bottom, which is the honest outcome:
  // it left the queue, and rejoining it at its old place would be a surprise.
  it('re-adds at the end after a toggle off', () => {
    expect(toggle(toggle([1, 2, 3], 1), 1)).toEqual([2, 3, 1])
  })
})

describe('move', () => {
  it('shifts the entries in between rather than swapping', () => {
    expect(move([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4])
  })

  it('moves backwards too', () => {
    expect(move([1, 2, 3, 4], 3, 1)).toEqual([1, 4, 2, 3])
  })

  it('moves to the very top and the very bottom', () => {
    expect(move([1, 2, 3], 2, 0)).toEqual([3, 1, 2])
    expect(move([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
  })

  it('is a no-op when it lands where it started', () => {
    expect(move([1, 2, 3], 1, 1)).toEqual([1, 2, 3])
  })

  // These come from a drag gesture, so nonsense is a real input, not a bug.
  it.each([
    ['a negative source', -1, 0],
    ['a source past the end', 5, 0],
    ['a target past the end', 0, 5],
    ['a fractional index', 0.5, 1],
    ['NaN', NaN, 0],
  ])('leaves the list alone for %s', (_label, from, to) => {
    expect(move([1, 2, 3], from, to)).toEqual([1, 2, 3])
  })

  it('does not mutate the input', () => {
    const list = [1, 2, 3]
    move(list, 0, 2)
    expect(list).toEqual([1, 2, 3])
  })

  it('keeps every element, never duplicating or losing one', () => {
    const result = move([1, 2, 3, 4, 5], 4, 0)
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5])
  })
})

describe('moveId', () => {
  it('moves by id', () => {
    expect(moveId([1, 2, 3], 3, 0)).toEqual([3, 1, 2])
  })

  it('is a no-op for an id that is not on the list', () => {
    expect(moveId([1, 2, 3], 9, 0)).toEqual([1, 2, 3])
  })
})

describe('insertAt', () => {
  it('inserts a new task at the given position', () => {
    expect(insertAt([1, 2, 3], 9, 1)).toEqual([1, 9, 2, 3])
  })

  it('appends when the position is past the end', () => {
    expect(insertAt([1, 2], 9, 99)).toEqual([1, 2, 9])
  })

  it('inserts at the top for position 0', () => {
    expect(insertAt([1, 2], 9, 0)).toEqual([9, 1, 2])
  })

  // The drop handler's whole point: dragging a row in and dragging an entry
  // around are the same gesture, and must not produce a duplicate.
  it('moves rather than duplicates when the task is already on the list', () => {
    expect(insertAt([1, 2, 3], 3, 0)).toEqual([3, 1, 2])
    expect(insertAt([1, 2, 3], 1, 2)).toEqual([2, 3, 1])
  })

  it('never leaves a duplicate behind', () => {
    const result = insertAt([1, 2, 3], 2, 0)
    expect(result).toHaveLength(3)
    expect(new Set(result).size).toBe(3)
  })

  it('handles an empty list', () => {
    expect(insertAt([], 5, 0)).toEqual([5])
    expect(insertAt([], 5, 7)).toEqual([5])
  })
})

describe('resolve', () => {
  it('pairs ids with tasks, in list order rather than task order', () => {
    const a = task({ name: 'A' })
    const b = task({ name: 'B' })
    const entries = resolve([b.wikiId, a.wikiId], [a, b], new Set())
    expect(entries.map((e) => e.task.name)).toEqual(['B', 'A'])
  })

  it('numbers entries from 1', () => {
    const a = task()
    const b = task()
    const entries = resolve([a.wikiId, b.wikiId], [a, b], new Set())
    expect(entries.map((e) => e.position)).toEqual([1, 2])
  })

  it('marks completion from the progress set', () => {
    const a = task()
    const b = task()
    const entries = resolve([a.wikiId, b.wikiId], [a, b], new Set([b.wikiId]))
    expect(entries.map((e) => e.completed)).toEqual([false, true])
  })

  // A retired task, or a list restored from a newer release.
  it('drops ids the data no longer has', () => {
    const a = task()
    expect(resolve([a.wikiId, 999999], [a], new Set())).toHaveLength(1)
  })

  it('numbers over what it actually kept, so positions never skip', () => {
    const a = task()
    const b = task()
    const entries = resolve([a.wikiId, 999999, b.wikiId], [a, b], new Set())
    expect(entries.map((e) => e.position)).toEqual([1, 2])
  })

  it('is empty for an empty list', () => {
    expect(resolve([], [task()], new Set())).toEqual([])
  })
})

describe('summarize', () => {
  it('counts completed against total', () => {
    const a = task()
    const b = task()
    const c = task()
    const entries = resolve([a.wikiId, b.wikiId, c.wikiId], [a, b, c], new Set([a.wikiId]))
    expect(summarize(entries)).toMatchObject({ total: 3, completed: 1 })
  })

  it('is zeroes for an empty list', () => {
    expect(summarize([])).toEqual({ total: 0, completed: 0, pointsTotal: 0, pointsEarned: 0 })
  })

  // Completed entries stay on the list -- the count is what shows the plan
  // filling in, so it must never quietly shrink the denominator.
  it('keeps completed entries in the total', () => {
    const a = task()
    const entries = resolve([a.wikiId], [a], new Set([a.wikiId]))
    expect(summarize(entries)).toMatchObject({ total: 1, completed: 1 })
  })

  // The denominator is counted over the rendered rows, so a dropped id can't
  // leave the header claiming a total the panel never shows.
  it('ignores ids the data dropped, matching what is rendered', () => {
    const a = task()
    const entries = resolve([a.wikiId, 999999], [a], new Set())
    expect(summarize(entries).total).toBe(1)
  })

  it('totals the points on the list, whatever the tiers', () => {
    const a = task({ tier: 'EASY' })
    const b = task({ tier: 'HARD' })
    const c = task({ tier: 'GRANDMASTER' })
    const entries = resolve([a.wikiId, b.wikiId, c.wikiId], [a, b, c], new Set())
    expect(summarize(entries).pointsTotal).toBe(1 + 3 + 6)
  })

  // Points earned is *not* the task count scaled: finishing the one Grandmaster
  // out of six moves it far more than finishing an Easy would.
  it('earns only the points of the entries actually completed', () => {
    const easy = task({ tier: 'EASY' })
    const gm = task({ tier: 'GRANDMASTER' })
    const entries = resolve([easy.wikiId, gm.wikiId], [easy, gm], new Set([gm.wikiId]))
    expect(summarize(entries)).toMatchObject({ completed: 1, pointsEarned: 6, pointsTotal: 7 })
  })

  it('earns the full total once everything is done', () => {
    const a = task({ tier: 'ELITE' })
    const b = task({ tier: 'MASTER' })
    const entries = resolve([a.wikiId, b.wikiId], [a, b], new Set([a.wikiId, b.wikiId]))
    const summary = summarize(entries)
    expect(summary.pointsEarned).toBe(summary.pointsTotal)
  })

  // Same reasoning as the task denominator: a row the panel never renders must
  // not contribute points the player can't see.
  it('leaves out the points of ids the data dropped', () => {
    const a = task({ tier: 'HARD' })
    const entries = resolve([a.wikiId, 999999], [a], new Set())
    expect(summarize(entries).pointsTotal).toBe(3)
  })
})
