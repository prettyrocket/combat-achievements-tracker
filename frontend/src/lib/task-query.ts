// Filtering, sorting, and the query string that makes a view shareable.
//
// Pure and free of React: a TaskQuery in, a task list out. The URL is the only
// place this state lives -- there is no second copy in component state to drift
// out of sync with the address bar.

import {
  REQUIREMENT_FILTERS,
  SORT_KEYS,
  TIERS,
  TASK_TYPES,
  type RequirementFilter,
  type SortKey,
  type TaskQuery,
  type TaskRow,
  type TaskType,
  type Tier,
} from '@/lib/types'
import { checkGate, profileIsEmpty, type PlayerProfile } from '@/lib/requirements'

/** Most-completed first: the "what can I actually go and do" view. */
export const DEFAULT_SORT: SortKey = 'comp_desc'

const TIER_ORDER = new Map<Tier, number>(TIERS.map((tier, index) => [tier, index]))
const TYPE_ORDER = new Map<TaskType, number>(TASK_TYPES.map((type, index) => [type, index]))

// --- filtering --------------------------------------------------------------

function matchesSearch(task: TaskRow, needle: string): boolean {
  return (
    task.name.toLowerCase().includes(needle) ||
    task.description.toLowerCase().includes(needle) ||
    (task.monster?.toLowerCase().includes(needle) ?? false)
  )
}

/** Trimmed, lowercased, blanks dropped -- the form every comparison here wants. */
function normalizeMonsters(monsters: readonly string[] | undefined): string[] {
  if (!monsters?.length) return []
  const seen = new Set<string>()
  for (const monster of monsters) {
    const value = monster.trim().toLowerCase()
    if (value) seen.add(value)
  }
  return [...seen]
}

export function filterTasks(
  tasks: readonly TaskRow[],
  query: TaskQuery,
  completed: ReadonlySet<number>,
  profile: PlayerProfile | null = null,
): TaskRow[] {
  // An empty list means "no filter on this facet", not "match nothing" -- that's
  // the state you're in the moment you deselect the last chip.
  const tiers = query.tier?.length ? new Set(query.tier) : null
  const types = query.type?.length ? new Set(query.type) : null
  const monsters = normalizeMonsters(query.monster)
  const monsterSet = monsters.length ? new Set(monsters) : null
  const needle = query.q?.trim().toLowerCase() || null
  // Inert without a profile, rather than matching nothing. A shared link
  // carrying `reqs=met` lands on someone who has never entered their levels, and
  // showing them an empty table would look like the link was broken -- the
  // honest answer there is "we don't know", and the honest response is to show
  // the tasks and let the control explain itself.
  const reqs = profileIsEmpty(profile) ? null : (query.reqs ?? null)

  return tasks.filter((task) => {
    if (tiers && !tiers.has(task.tier)) return false
    if (types && !types.has(task.type)) return false
    // OR within the facet: several bosses on screen at once is the whole point
    // of the chips.
    if (monsterSet && (task.monster === null || !monsterSet.has(task.monster.toLowerCase()))) {
      return false
    }
    if (needle !== null && !matchesSearch(task, needle)) return false
    if (query.completed !== undefined && completed.has(task.wikiId) !== query.completed) return false
    if (reqs !== null) {
      // `unknown` can't reach here -- it only happens without a profile, and
      // `reqs` is null in that case -- so the two states left are the two the
      // filter names.
      const open = checkGate(task.monster, profile).status === 'open'
      if (open !== (reqs === 'met')) return false
    }
    return true
  })
}

// --- sorting ----------------------------------------------------------------

export type SortDirection = 'asc' | 'desc'

export function sortDirection(sort: SortKey): SortDirection {
  return sort.endsWith('_asc') ? 'asc' : 'desc'
}

/**
 * Which sorts a column header owns, in the order its clicks cycle through.
 *
 * The first entry is the direction a column starts in, chosen per column rather
 * than uniformly: clicking Comp% means "show me the common ones", clicking Name
 * means A-Z. Starting every column ascending would make the useful click the
 * second one everywhere.
 */
export const COLUMN_SORT = {
  monster: ['monster_asc', 'monster_desc'],
  name: ['name_asc', 'name_desc'],
  type: ['type_asc', 'type_desc'],
  tier: ['tier_asc', 'tier_desc'],
  points: ['points_desc', 'points_asc'],
  completionPct: ['comp_desc', 'comp_asc'],
} as const satisfies Record<string, readonly [SortKey, SortKey]>

/**
 * Nulls sort last whichever way the column is pointing. "Unknown" is not
 * "rarest": the 9 newest tasks have no completion data yet, and letting them win
 * the ascending sort would park a whole new boss at the top and bury the answer
 * the sort was asked for. Same reasoning for tasks with no monster.
 */
function nullsLast<T>(a: T | null, b: T | null): number | null {
  if (a !== null && b !== null) return null
  if (a === b) return 0
  return a === null ? 1 : -1
}

function compare(a: TaskRow, b: TaskRow, sort: SortKey): number {
  const flip = sortDirection(sort) === 'desc' ? -1 : 1

  switch (sort) {
    case 'comp_asc':
    case 'comp_desc': {
      const nulls = nullsLast(a.completionPct, b.completionPct)
      return nulls ?? (a.completionPct! - b.completionPct!) * flip
    }
    case 'monster_asc':
    case 'monster_desc': {
      const nulls = nullsLast(a.monster, b.monster)
      return nulls ?? a.monster!.localeCompare(b.monster!) * flip
    }
    case 'tier_asc':
    case 'tier_desc':
      return (TIER_ORDER.get(a.tier)! - TIER_ORDER.get(b.tier)!) * flip
    case 'type_asc':
    case 'type_desc':
      return (TYPE_ORDER.get(a.type)! - TYPE_ORDER.get(b.type)!) * flip
    case 'points_asc':
    case 'points_desc':
      return (a.points - b.points) * flip
    case 'name_asc':
    case 'name_desc':
      return a.name.localeCompare(b.name) * flip
  }
}

export function sortTasks(tasks: readonly TaskRow[], sort: SortKey = DEFAULT_SORT): TaskRow[] {
  const key = SORT_KEYS.includes(sort) ? sort : DEFAULT_SORT
  // Copy, so callers can hand us the bundle without it being reordered under them.
  // The id tiebreak keeps equal rows in a fixed order rather than reshuffling
  // whenever some unrelated state change causes a re-sort.
  return [...tasks].sort((a, b) => compare(a, b, key) || a.wikiId - b.wikiId)
}

export function applyQuery(
  tasks: readonly TaskRow[],
  query: TaskQuery,
  completed: ReadonlySet<number>,
  profile: PlayerProfile | null = null,
): TaskRow[] {
  return sortTasks(filterTasks(tasks, query, completed, profile), query.sort ?? DEFAULT_SORT)
}

// --- pivot ------------------------------------------------------------------

/**
 * Focus the view on one boss, replacing any others.
 *
 * Keeps the facets that say *what you are looking for* -- tier, type, completion,
 * sort -- so the "easiest remaining" workflow survives the pivot: sort by Comp%,
 * hide what's done, click the top row's boss, and you land on that boss's
 * remaining tasks still in easiest-first order.
 *
 * The free-text search is dropped, because it only ever helped you *find* the
 * boss and a leftover "vardorvis" would hide most of the rows the pivot just
 * asked for. Dropping it silently is what made this feel like losing your place,
 * so the caller keeps hold of the old text and the breadcrumb offers it back.
 */
export function pivotToMonster(query: TaskQuery, monster: string): TaskQuery {
  return { ...query, monster: [monster], q: undefined }
}

/** Shift-click: add a boss to the ones already on screen. */
export function addMonster(query: TaskQuery, monster: string): TaskQuery {
  const current = query.monster ?? []
  const has = current.some((m) => m.trim().toLowerCase() === monster.trim().toLowerCase())
  return has ? query : { ...query, monster: [...current, monster], q: undefined }
}

export function removeMonster(query: TaskQuery, monster: string): TaskQuery {
  const next = (query.monster ?? []).filter(
    (m) => m.trim().toLowerCase() !== monster.trim().toLowerCase(),
  )
  return { ...query, monster: next.length ? next : undefined }
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
  // One `monster` param per boss rather than a joined list: names are the wiki's
  // own, and picking a delimiter that no name will ever contain is a bet worth
  // not taking.
  for (const monster of query.monster ?? []) {
    if (monster.trim()) params.append('monster', monster.trim())
  }
  if (query.q?.trim()) params.set('q', query.q.trim())
  if (query.completed !== undefined) params.set('completed', String(query.completed))
  // Written even though it's inert without a profile: the link is a description
  // of a view, and the recipient may well have their own levels entered.
  if (query.reqs !== undefined) params.set('reqs', query.reqs)
  if (query.sort && query.sort !== DEFAULT_SORT) params.set('sort', query.sort)
  return params
}

/**
 * Sorts as they were named before the headers became the control. Old links
 * still work; they just land on the ascending form, which is what those keys
 * used to do.
 */
const LEGACY_SORT: Record<string, SortKey> = {
  tier: 'tier_asc',
  name: 'name_asc',
  monster: 'monster_asc',
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

  const monsters = params
    .getAll('monster')
    .map((monster) => monster.trim())
    .filter((monster) => monster !== '')
  if (monsters.length) query.monster = monsters

  const q = params.get('q')?.trim()
  if (q) query.q = q

  const completed = params.get('completed')
  if (completed === 'true') query.completed = true
  else if (completed === 'false') query.completed = false

  const reqs = params.get('reqs')
  if (reqs !== null && REQUIREMENT_FILTERS.includes(reqs as RequirementFilter)) {
    query.reqs = reqs as RequirementFilter
  }

  const raw = params.get('sort')
  const sort = raw ? (LEGACY_SORT[raw] ?? (SORT_KEYS.includes(raw as SortKey) ? raw : null)) : null
  if (sort && sort !== DEFAULT_SORT) query.sort = sort as SortKey

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
