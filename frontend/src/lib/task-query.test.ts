import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SORT,
  applyQuery,
  filterTasks,
  isEmptyQuery,
  parseQuery,
  serializeQuery,
  sortTasks,
} from '@/lib/task-query'
import type { TaskQuery, TaskRow, TaskType, Tier } from '@/lib/types'

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
    type: 'KILL_COUNT' as TaskType,
    leagueRegion: null,
    completionPct: 50,
    ...over,
    // After the spread: points follow from the tier unless explicitly overridden,
    // so a caller passing only `tier` still gets a coherent row.
    points: over.points ?? points,
  }
}

const ids = (tasks: readonly TaskRow[]) => tasks.map((t) => t.wikiId)

describe('filterTasks: no filters', () => {
  it('returns everything for an empty query', () => {
    const tasks = [task(), task(), task()]
    expect(filterTasks(tasks, {}, new Set())).toHaveLength(3)
  })
})

describe('filterTasks: tier and type', () => {
  it('keeps any of the selected tiers', () => {
    const tasks = [task({ tier: 'EASY' }), task({ tier: 'MASTER' }), task({ tier: 'ELITE' })]
    const result = filterTasks(tasks, { tier: ['EASY', 'ELITE'] }, new Set())
    expect(ids(result)).toEqual([tasks[0].wikiId, tasks[2].wikiId])
  })

  it('treats an empty tier list as no tier filter at all', () => {
    const tasks = [task({ tier: 'EASY' }), task({ tier: 'MASTER' })]
    expect(filterTasks(tasks, { tier: [] }, new Set())).toHaveLength(2)
  })

  it('keeps any of the selected types', () => {
    const tasks = [task({ type: 'SPEED' }), task({ type: 'STAMINA' })]
    expect(ids(filterTasks(tasks, { type: ['SPEED'] }, new Set()))).toEqual([tasks[0].wikiId])
  })

  // Within a facet the options are alternatives; across facets they narrow.
  it('ANDs across facets while ORing within one', () => {
    const tasks = [
      task({ tier: 'EASY', type: 'SPEED' }),
      task({ tier: 'EASY', type: 'STAMINA' }),
      task({ tier: 'MASTER', type: 'SPEED' }),
    ]
    const result = filterTasks(tasks, { tier: ['EASY', 'MASTER'], type: ['SPEED'] }, new Set())
    expect(ids(result)).toEqual([tasks[0].wikiId, tasks[2].wikiId])
  })
})

describe('filterTasks: monster', () => {
  it('matches a monster exactly', () => {
    const tasks = [task({ monster: 'Zulrah' }), task({ monster: 'Vorkath' })]
    expect(ids(filterTasks(tasks, { monster: 'Vorkath' }, new Set()))).toEqual([tasks[1].wikiId])
  })

  // The value arrives from a URL someone may have typed or shared.
  it('is case-insensitive', () => {
    const tasks = [task({ monster: 'Zulrah' })]
    expect(filterTasks(tasks, { monster: 'zulrah' }, new Set())).toHaveLength(1)
  })

  it('does not match on a partial name', () => {
    const tasks = [task({ monster: 'Abyssal Sire' })]
    expect(filterTasks(tasks, { monster: 'Abyssal' }, new Set())).toHaveLength(0)
  })

  it('never matches the tasks that have no monster', () => {
    const tasks = [task({ monster: null }), task({ monster: 'Zulrah' })]
    expect(ids(filterTasks(tasks, { monster: 'Zulrah' }, new Set()))).toEqual([tasks[1].wikiId])
  })
})

describe('filterTasks: search', () => {
  const tasks = [
    task({ name: 'Ourg Freezer', description: 'Kill General Graardor.', monster: 'General Graardor' }),
    task({ name: 'Chally Time', description: 'Use a chally.', monster: 'Theatre of Blood' }),
  ]

  it('matches the name', () => {
    expect(ids(filterTasks(tasks, { q: 'ourg' }, new Set()))).toEqual([tasks[0].wikiId])
  })

  it('matches the description', () => {
    expect(ids(filterTasks(tasks, { q: 'chally' }, new Set()))).toEqual([tasks[1].wikiId])
  })

  it('matches the monster', () => {
    expect(ids(filterTasks(tasks, { q: 'graardor' }, new Set()))).toEqual([tasks[0].wikiId])
  })

  it('ignores case and surrounding whitespace', () => {
    expect(filterTasks(tasks, { q: '  OURG  ' }, new Set())).toHaveLength(1)
  })

  it('treats a blank search as no search', () => {
    expect(filterTasks(tasks, { q: '   ' }, new Set())).toHaveLength(2)
  })

  it('returns nothing when nothing matches', () => {
    expect(filterTasks(tasks, { q: 'zzzz' }, new Set())).toHaveLength(0)
  })
})

describe('filterTasks: completion', () => {
  const tasks = [task(), task(), task()]
  const done = new Set([tasks[0].wikiId])

  it('keeps only completed when true', () => {
    expect(ids(filterTasks(tasks, { completed: true }, done))).toEqual([tasks[0].wikiId])
  })

  it('keeps only incomplete when false', () => {
    expect(ids(filterTasks(tasks, { completed: false }, done))).toEqual([
      tasks[1].wikiId,
      tasks[2].wikiId,
    ])
  })

  // Three states, not two: unset means "don't care", which is not the same as false.
  it('keeps everything when unset', () => {
    expect(filterTasks(tasks, {}, done)).toHaveLength(3)
  })
})

describe('sortTasks', () => {
  it('defaults to most-completed first, the easiest-remaining view', () => {
    expect(DEFAULT_SORT).toBe('comp_desc')
  })

  it('sorts by completion percentage descending', () => {
    const tasks = [task({ completionPct: 5 }), task({ completionPct: 70 }), task({ completionPct: 30 })]
    expect(sortTasks(tasks, 'comp_desc').map((t) => t.completionPct)).toEqual([70, 30, 5])
  })

  it('sorts by completion percentage ascending', () => {
    const tasks = [task({ completionPct: 5 }), task({ completionPct: 70 }), task({ completionPct: 30 })]
    expect(sortTasks(tasks, 'comp_asc').map((t) => t.completionPct)).toEqual([5, 30, 70])
  })

  // The 9 newest tasks have no Comp% yet. "Unknown" is not "rarest": letting
  // nulls win the ascending sort would park a whole new boss at the top of the
  // list and bury the actual answer.
  it('puts unknown percentages last in BOTH directions', () => {
    const tasks = [task({ completionPct: null }), task({ completionPct: 40 })]
    expect(sortTasks(tasks, 'comp_desc').map((t) => t.completionPct)).toEqual([40, null])
    expect(sortTasks(tasks, 'comp_asc').map((t) => t.completionPct)).toEqual([40, null])
  })

  it('sorts by tier, easiest first', () => {
    const tasks = [task({ tier: 'MASTER' }), task({ tier: 'EASY' }), task({ tier: 'ELITE' })]
    expect(sortTasks(tasks, 'tier').map((t) => t.tier)).toEqual(['EASY', 'ELITE', 'MASTER'])
  })

  it('sorts by name alphabetically', () => {
    const tasks = [task({ name: 'Zebra' }), task({ name: 'apple' }), task({ name: 'Mango' })]
    expect(sortTasks(tasks, 'name').map((t) => t.name)).toEqual(['apple', 'Mango', 'Zebra'])
  })

  it('sorts by monster, with the no-monster tasks last', () => {
    const tasks = [task({ monster: 'Zulrah' }), task({ monster: null }), task({ monster: 'Araxxor' })]
    expect(sortTasks(tasks, 'monster').map((t) => t.monster)).toEqual(['Araxxor', 'Zulrah', null])
  })

  // Without a tiebreak the order of equal rows is unspecified, so the table
  // would reshuffle on unrelated state changes.
  it('breaks ties by id, so the order is deterministic', () => {
    const tasks = [task({ completionPct: 10 }), task({ completionPct: 10 }), task({ completionPct: 10 })]
    const forward = sortTasks(tasks, 'comp_desc')
    const reversed = sortTasks([...tasks].reverse(), 'comp_desc')
    expect(ids(forward)).toEqual(ids(reversed))
    expect(ids(forward)).toEqual([...ids(tasks)].sort((a, b) => a - b))
  })

  it('does not mutate the array it was given', () => {
    const tasks = [task({ completionPct: 5 }), task({ completionPct: 70 })]
    const before = ids(tasks)
    sortTasks(tasks, 'comp_desc')
    expect(ids(tasks)).toEqual(before)
  })
})

describe('applyQuery', () => {
  it('filters and then sorts', () => {
    const tasks = [
      task({ tier: 'EASY', completionPct: 10 }),
      task({ tier: 'EASY', completionPct: 80 }),
      task({ tier: 'MASTER', completionPct: 99 }),
    ]
    const result = applyQuery(tasks, { tier: ['EASY'], sort: 'comp_desc' }, new Set())
    expect(result.map((t) => t.completionPct)).toEqual([80, 10])
  })

  it('uses the default sort when none is given', () => {
    const tasks = [task({ completionPct: 10 }), task({ completionPct: 80 })]
    expect(applyQuery(tasks, {}, new Set()).map((t) => t.completionPct)).toEqual([80, 10])
  })
})

describe('serializeQuery / parseQuery', () => {
  const roundTrip = (query: TaskQuery) => parseQuery(serializeQuery(query))

  it('omits everything for an empty query, so a clean view has a clean URL', () => {
    expect(serializeQuery({}).toString()).toBe('')
  })

  it('omits the default sort but keeps a non-default one', () => {
    expect(serializeQuery({ sort: DEFAULT_SORT }).toString()).toBe('')
    expect(serializeQuery({ sort: 'name' }).get('sort')).toBe('name')
  })

  it('omits empty facet lists and blank searches', () => {
    expect(serializeQuery({ tier: [], type: [], q: '  ', monster: '' }).toString()).toBe('')
  })

  it.each([
    ['tiers', { tier: ['EASY', 'MASTER'] as Tier[] }],
    ['types', { type: ['SPEED'] as TaskType[] }],
    ['a monster', { monster: 'Abyssal Sire' }],
    ['a search', { q: 'graardor' }],
    ['completed true', { completed: true }],
    ['completed false', { completed: false }],
    ['a sort', { sort: 'tier' as const }],
    ['everything at once', {
      tier: ['ELITE'] as Tier[],
      type: ['PERFECTION'] as TaskType[],
      monster: 'Zulrah',
      q: 'orb',
      completed: false,
      sort: 'name' as const,
    }],
  ])('round-trips %s', (_label, query) => {
    expect(roundTrip(query as TaskQuery)).toEqual(query)
  })

  it('survives a monster name with a space', () => {
    expect(roundTrip({ monster: 'Chambers of Xeric: Challenge Mode' }).monster).toBe(
      'Chambers of Xeric: Challenge Mode',
    )
  })

  // The query string is user-editable and shareable, so it is untrusted input.
  it('drops unknown tiers and types rather than filtering on nonsense', () => {
    const parsed = parseQuery(new URLSearchParams('tier=EASY,LEGENDARY&type=VIBES'))
    expect(parsed.tier).toEqual(['EASY'])
    expect(parsed.type).toBeUndefined()
  })

  it('ignores an unknown sort key and falls back to the default', () => {
    expect(parseQuery(new URLSearchParams('sort=chaos')).sort).toBeUndefined()
  })

  it('treats any non-true/false completed value as unset', () => {
    expect(parseQuery(new URLSearchParams('completed=maybe')).completed).toBeUndefined()
  })

  it('parses an empty query string to an empty query', () => {
    expect(parseQuery(new URLSearchParams(''))).toEqual({})
  })
})

describe('isEmptyQuery', () => {
  it('is true for nothing set and for explicitly empty values', () => {
    expect(isEmptyQuery({})).toBe(true)
    expect(isEmptyQuery({ tier: [], q: '  ', monster: '' })).toBe(true)
    expect(isEmptyQuery({ sort: DEFAULT_SORT })).toBe(true)
  })

  it('is false once any filter is active', () => {
    expect(isEmptyQuery({ tier: ['EASY'] })).toBe(false)
    expect(isEmptyQuery({ q: 'x' })).toBe(false)
    expect(isEmptyQuery({ completed: false })).toBe(false)
    expect(isEmptyQuery({ sort: 'name' })).toBe(false)
  })
})
