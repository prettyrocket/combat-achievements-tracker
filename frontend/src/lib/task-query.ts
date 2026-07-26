// Filtering, sorting, and the query string that makes a view shareable.
//
// Pure and free of React: a TaskQuery in, a task list out. The URL is the only
// place this state lives -- there is no second copy in component state to drift
// out of sync with the address bar.

import {
  TIERS,
  TASK_TYPES,
  type SortKey,
  type TaskQuery,
  type TaskRow,
  type TaskType,
  type Tier,
} from '@/lib/types'

/** Most-completed first: the "what can I actually go and do" view. */
export const DEFAULT_SORT: SortKey = 'comp_desc'

const SORT_KEYS: readonly SortKey[] = ['comp_desc', 'comp_asc', 'tier', 'name', 'monster']

const TIER_ORDER = new Map<Tier, number>(TIERS.map((tier, index) => [tier, index]))

// --- filtering --------------------------------------------------------------

function matchesSearch(task: TaskRow, needle: string): boolean {
  return (
    task.name.toLowerCase().includes(needle) ||
    task.description.toLowerCase().includes(needle) ||
    (task.monster?.toLowerCase().includes(needle) ?? false)
  )
}

export function filterTasks(
  tasks: readonly TaskRow[],
  query: TaskQuery,
  completed: ReadonlySet<number>,
): TaskRow[] {
  // An empty list means "no filter on this facet", not "match nothing" -- that's
  // the state you're in the moment you deselect the last chip.
  const tiers = query.tier?.length ? new Set(query.tier) : null
  const types = query.type?.length ? new Set(query.type) : null
  const monster = query.monster?.trim().toLowerCase() || null
  const needle = query.q?.trim().toLowerCase() || null

  return tasks.filter((task) => {
    if (tiers && !tiers.has(task.tier)) return false
    if (types && !types.has(task.type)) return false
    if (monster !== null && task.monster?.toLowerCase() !== monster) return false
    if (needle !== null && !matchesSearch(task, needle)) return false
    if (query.completed !== undefined && completed.has(task.wikiId) !== query.completed) return false
    return true
  })
}

// --- sorting ----------------------------------------------------------------

/**
 * Tasks with no completion percentage sort last whichever way the column is
 * pointing. "Unknown" is not "rarest": the 9 newest tasks have no data yet, and
 * letting them win the ascending sort would park a whole new boss at the top and
 * bury the answer the sort was asked for.
 */
function byCompletion(a: TaskRow, b: TaskRow, direction: 1 | -1): number {
  if (a.completionPct === null || b.completionPct === null) {
    if (a.completionPct === b.completionPct) return 0
    return a.completionPct === null ? 1 : -1
  }
  return (a.completionPct - b.completionPct) * direction
}

const COMPARATORS: Record<SortKey, (a: TaskRow, b: TaskRow) => number> = {
  comp_desc: (a, b) => byCompletion(a, b, -1),
  comp_asc: (a, b) => byCompletion(a, b, 1),
  tier: (a, b) => TIER_ORDER.get(a.tier)! - TIER_ORDER.get(b.tier)!,
  name: (a, b) => a.name.localeCompare(b.name),
  // Tasks with no monster go last, same reasoning as unknown percentages.
  monster: (a, b) => {
    if (a.monster === null || b.monster === null) {
      if (a.monster === b.monster) return 0
      return a.monster === null ? 1 : -1
    }
    return a.monster.localeCompare(b.monster)
  },
}

export function sortTasks(tasks: readonly TaskRow[], sort: SortKey = DEFAULT_SORT): TaskRow[] {
  const compare = COMPARATORS[sort] ?? COMPARATORS[DEFAULT_SORT]
  // Copy, so callers can hand us the bundle without it being reordered under them.
  // The id tiebreak keeps equal rows in a fixed order rather than reshuffling
  // whenever some unrelated state change causes a re-sort.
  return [...tasks].sort((a, b) => compare(a, b) || a.wikiId - b.wikiId)
}

export function applyQuery(
  tasks: readonly TaskRow[],
  query: TaskQuery,
  completed: ReadonlySet<number>,
): TaskRow[] {
  return sortTasks(filterTasks(tasks, query, completed), query.sort ?? DEFAULT_SORT)
}

// --- pivot ------------------------------------------------------------------

/**
 * Focus the view on one boss.
 *
 * Keeps the facets that say *what you are looking for* -- tier, type, completion,
 * sort -- so the "easiest remaining" workflow survives the pivot: sort by Comp%,
 * hide what's done, click the top row's boss, and you land on that boss's
 * remaining tasks still in easiest-first order.
 *
 * Drops the free-text search, which only ever helped you *find* the boss. A
 * leftover "vardorvis" in the box would hide most of the rows the pivot just
 * asked for, and the reason would not be visible anywhere near the table.
 */
export function pivotToMonster(query: TaskQuery, monster: string): TaskQuery {
  return { ...query, monster, q: undefined }
}

/** The breadcrumb's clear: back to every boss, with the rest of the view intact. */
export function clearMonster(query: TaskQuery): TaskQuery {
  return { ...query, monster: undefined }
}

// --- query string -----------------------------------------------------------

export function isEmptyQuery(query: TaskQuery): boolean {
  return serializeQuery(query).toString() === ''
}

/** Only what differs from the default is written, so a clean view has a clean URL. */
export function serializeQuery(query: TaskQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.tier?.length) params.set('tier', query.tier.join(','))
  if (query.type?.length) params.set('type', query.type.join(','))
  if (query.monster?.trim()) params.set('monster', query.monster.trim())
  if (query.q?.trim()) params.set('q', query.q.trim())
  if (query.completed !== undefined) params.set('completed', String(query.completed))
  if (query.sort && query.sort !== DEFAULT_SORT) params.set('sort', query.sort)
  return params
}

/**
 * The query string is user-editable and shareable, so it's untrusted: anything
 * unrecognised is dropped rather than filtered on, which would silently show an
 * empty table for a typo.
 */
export function parseQuery(params: URLSearchParams): TaskQuery {
  const query: TaskQuery = {}

  const tiers = pickKnown(params.get('tier'), TIERS)
  if (tiers.length) query.tier = tiers

  const types = pickKnown(params.get('type'), TASK_TYPES)
  if (types.length) query.type = types

  const monster = params.get('monster')?.trim()
  if (monster) query.monster = monster

  const q = params.get('q')?.trim()
  if (q) query.q = q

  const completed = params.get('completed')
  if (completed === 'true') query.completed = true
  else if (completed === 'false') query.completed = false

  const sort = params.get('sort')
  if (sort && SORT_KEYS.includes(sort as SortKey) && sort !== DEFAULT_SORT) {
    query.sort = sort as SortKey
  }

  return query
}

function pickKnown<T extends Tier | TaskType>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return []
  const set = new Set<string>(allowed)
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is T => set.has(value))
}
