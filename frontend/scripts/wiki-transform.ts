// Turning a Bucket row into a TaskRow: sanitizing, mapping, validating.
//
// Split out of refresh-data.ts so it can be tested. That script fetches and writes
// on import; these are pure functions over data you hand them, which is the half
// worth asserting on -- the network round trip isn't.

import {
  TIERS,
  TIER_POINTS,
  TASK_TYPES,
  type Tier,
  type TaskType,
  type TaskRow,
} from '../src/lib/types.ts'

/** Tripwires. Facts about the current CA release, not guesses -- if either changes,
 *  the game changed and a human should look at the diff before it ships. Bump them
 *  in the same commit as the new tasks.json. */
export const EXPECTED_ROWS = 646
export const EXPECTED_POINTS = 2671

/** The wiki's placeholder for "this task isn't tied to a specific monster". */
const NO_MONSTER = 'None'

/** Shape the Bucket API actually returns. `league_region` is absent (not null)
 *  on tasks the wiki hasn't assigned a region to yet. */
export interface BucketRow {
  id: number
  name: string
  monster: string
  tier: string
  type: string
  task: string
  league_region?: string
}

export class RefreshError extends Error {}

export function fail(message: string): never {
  throw new RefreshError(message)
}

// --- sanitization -----------------------------------------------------------
//
// Far smaller than the wiki-text stripping this originally imagined. Measured over
// all 646 rows: 3 rows carry a [[wikilink]] (two in `task`, one in `league_region`),
// 1 row carries an HTML citation, and nothing else -- no {{templates}}, no U+007F
// markers, no plainlist, no '' markup. So: a few replaces, plus a residue check
// (below) that turns anything new and unrecognised into a loud failure instead of
// markup leaking into the UI.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m, n: string) => NAMED_ENTITIES[n] ?? m)
}

export function sanitize(s: string): string {
  const stripped = s
    // <sup> citations ("immobilized[sic]") are editorial notes about the wiki's own
    // wording. Drop the whole element -- stripping just the tags would leave a bare
    // "[sic]" sitting in the middle of the task description.
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')

  // Decode after tag removal, so a decoded &lt; stays literal text instead of
  // becoming something the tag stripper would have eaten.
  return (
    decodeEntities(stripped)
      // [[Target|Label]] -> Label, [[Target]] -> Target
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target: string, label?: string) =>
        (label ?? target).trim(),
      )
      .replace(/\s+/g, ' ')
      .trim()
  )
}

const RESIDUE = [
  { label: 'wikilink', re: /\[\[|\]\]/ },
  { label: 'template', re: /\{\{|\}\}/ },
  { label: 'html tag', re: /<[^>]+>/ },
  { label: 'html entity', re: /&(?:#\d+|#x[0-9a-f]+|[a-z]+);/i },
  { label: 'U+007F marker', re: /\u007f/ },
  { label: "'' markup", re: /''/ },
]

export function assertClean(value: string, where: string): void {
  for (const { label, re } of RESIDUE) {
    if (re.test(value)) {
      fail(
        `${where}: ${label} survived sanitization -- the wiki introduced markup this ` +
          `script doesn't handle. Teach sanitize() about it, then re-run.\n  ${value}`,
      )
    }
  }
}

// --- mapping ----------------------------------------------------------------

// The Bucket returns display casing ("Kill Count", "Grandmaster"); the app's domain
// types use SCREAMING_SNAKE. Validate rather than trust: an unrecognised value means
// the wiki added a tier or task type and the app needs to know about it.
const TIER_BY_LABEL = new Map<string, Tier>(TIERS.map((t) => [t.toLowerCase(), t]))
const TYPE_BY_LABEL = new Map<string, TaskType>(
  TASK_TYPES.map((t) => [t.toLowerCase().replace(/_/g, ' '), t]),
)

export function toRow(row: BucketRow, completion: Map<number, number>): TaskRow {
  const where = `task #${row.id} (${row.name})`

  const tier = TIER_BY_LABEL.get(String(row.tier).toLowerCase())
  if (!tier) fail(`${where}: unknown tier ${JSON.stringify(row.tier)}`)

  const type = TYPE_BY_LABEL.get(String(row.type).toLowerCase())
  if (!type) fail(`${where}: unknown task type ${JSON.stringify(row.type)}`)

  const description = sanitize(row.task)
  assertClean(description, `${where} description`)
  if (!description) fail(`${where}: description is empty after sanitization`)

  const monsterRaw = sanitize(row.monster)
  assertClean(monsterRaw, `${where} monster`)

  const leagueRegion = row.league_region ? sanitize(row.league_region) : null
  if (leagueRegion !== null) assertClean(leagueRegion, `${where} league region`)

  return {
    wikiId: row.id,
    name: sanitize(row.name),
    monster: monsterRaw === NO_MONSTER ? null : monsterRaw,
    description,
    tier,
    points: TIER_POINTS[tier],
    type,
    leagueRegion,
    completionPct: completion.get(row.id) ?? null,
  }
}

/** Sorted by id, so the committed file has a stable diff between refreshes. */
export function buildTasks(rows: BucketRow[], completion: Map<number, number>): TaskRow[] {
  return rows.map((row) => toRow(row, completion)).sort((a, b) => a.wikiId - b.wikiId)
}

// --- validation -------------------------------------------------------------

export function validate(tasks: TaskRow[], completion: Map<number, number>): void {
  if (tasks.length !== EXPECTED_ROWS) {
    fail(
      `Expected ${EXPECTED_ROWS} tasks, got ${tasks.length}. If a CA release added or ` +
        `removed tasks, verify the data and update EXPECTED_ROWS/EXPECTED_POINTS.`,
    )
  }

  const points = tasks.reduce((sum, t) => sum + t.points, 0)
  if (points !== EXPECTED_POINTS) {
    fail(
      `Expected ${EXPECTED_POINTS} total tier points, got ${points}. Same story as the ` +
        `row count: confirm the release, then update the constants.`,
    )
  }

  const seen = new Set<number>()
  for (const t of tasks) {
    if (seen.has(t.wikiId)) fail(`Duplicate task id ${t.wikiId} -- ids are the join key.`)
    seen.add(t.wikiId)
  }

  // A completion entry with no matching task means the join key drifted.
  const orphans = [...completion.keys()].filter((id) => !seen.has(id))
  if (orphans.length > 0) {
    fail(`completion.json references ${orphans.length} unknown task id(s): ${orphans.join(', ')}`)
  }
}
