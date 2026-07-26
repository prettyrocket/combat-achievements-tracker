// Invariants of the committed bundle.
//
// These assert against the real tasks.json rather than a fixture, on purpose.
// They're canaries: if a refresh (#1) changes them, either Jagex shipped new
// tasks or the fetch broke, and either way a human should look before it ships.

import { describe, expect, it } from 'vitest'
import { TASKS } from '@/data/tasks'
import { TIERS, TIER_POINTS, TASK_TYPES, type Tier } from '@/lib/types'

const TIER_COUNTS: Record<Tier, number> = {
  EASY: 41,
  MEDIUM: 60,
  HARD: 86,
  ELITE: 164,
  MASTER: 174,
  GRANDMASTER: 121,
}

describe('bundle shape', () => {
  it('has 646 tasks', () => {
    expect(TASKS).toHaveLength(646)
  })

  it('totals 2671 tier points', () => {
    expect(TASKS.reduce((sum, t) => sum + t.points, 0)).toBe(2671)
  })

  it.each(TIERS)('has the expected number of %s tasks', (tier) => {
    expect(TASKS.filter((t) => t.tier === tier)).toHaveLength(TIER_COUNTS[tier])
  })

  it('has unique ids, since they are the join key everywhere', () => {
    expect(new Set(TASKS.map((t) => t.wikiId)).size).toBe(TASKS.length)
  })

  it('is sorted by id', () => {
    const ids = TASKS.map((t) => t.wikiId)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
  })
})

describe('every row is well formed', () => {
  it('uses only known tiers and types, with points matching the tier', () => {
    for (const task of TASKS) {
      expect(TIERS).toContain(task.tier)
      expect(TASK_TYPES).toContain(task.type)
      expect(task.points).toBe(TIER_POINTS[task.tier])
    }
  })

  it('has a non-empty name and description on every row', () => {
    for (const task of TASKS) {
      expect(task.name.length).toBeGreaterThan(0)
      expect(task.description.length).toBeGreaterThan(0)
    }
  })

  it('keeps completion percentages in range, or null', () => {
    for (const task of TASKS) {
      if (task.completionPct === null) continue
      expect(task.completionPct).toBeGreaterThanOrEqual(0)
      expect(task.completionPct).toBeLessThanOrEqual(100)
    }
  })

  it('carries no field named `completed` — that is localStorage state', () => {
    expect(TASKS[0]).not.toHaveProperty('completed')
  })
})

describe('no wiki markup survived into the bundle', () => {
  // The sanitizer is unit-tested separately; this asserts the shipped artefact,
  // which is what the UI actually renders.
  const FIELDS = ['name', 'description', 'monster', 'leagueRegion'] as const

  it.each([
    ['wikilinks', /\[\[|\]\]/],
    ['templates', /\{\{|\}\}/],
    ['html tags', /<[^>]+>/],
    ['html entities', /&(?:#\d+|#x[0-9a-f]+|[a-z]+);/i],
    ['U+007F markers', /\u007f/],
  ])('contains no %s', (_label, pattern) => {
    const offenders = TASKS.filter((task) =>
      FIELDS.some((field) => {
        const value = task[field]
        return typeof value === 'string' && pattern.test(value)
      }),
    )
    expect(offenders.map((t) => t.wikiId)).toEqual([])
  })
})

describe('the rows sanitization actually changed', () => {
  const byId = new Map(TASKS.map((t) => [t.wikiId, t]))

  it('#18 lost its [sic] citation', () => {
    expect(byId.get(18)?.description).toBe(
      'Kill General Graardor whilst he is immobilized.',
    )
  })

  it('#315 shows the wikilink label, not the target', () => {
    expect(byId.get(315)?.description).toContain('Clear the Crystal Crabs room')
  })

  it('#544 unwrapped its unpiped link', () => {
    expect(byId.get(544)?.description).toContain('using Fortis Salute to the north')
  })

  it('#501 unwrapped a link in its league region', () => {
    expect(byId.get(501)?.leagueRegion).toBe('Asgarnia&Kourend,Asgarnia,(with Grimoire Relic)')
  })

  it('#399 is the one task with no monster', () => {
    expect(TASKS.filter((t) => t.monster === null).map((t) => t.wikiId)).toEqual([399])
  })
})

describe('the newest release', () => {
  // Maggot King (637-645) has no league region and no completion data yet. Both
  // fields are nullable; this documents that the nulls are expected, not a bug.
  const maggotKing = TASKS.filter((t) => t.wikiId >= 637 && t.wikiId <= 645)

  it('is nine tasks', () => {
    expect(maggotKing).toHaveLength(9)
  })

  it('has no completion data or league region yet', () => {
    for (const task of maggotKing) {
      expect(task.completionPct).toBeNull()
      expect(task.leagueRegion).toBeNull()
    }
  })

  it('accounts for every task lacking a completion percentage', () => {
    expect(TASKS.filter((t) => t.completionPct === null)).toHaveLength(9)
  })
})
