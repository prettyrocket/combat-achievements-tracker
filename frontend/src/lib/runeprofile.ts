// Combat Achievements, levels and quests from RuneProfile.
//
// The second door to the same three facts a WikiSync paste carries, for people
// who happen to run RuneProfile's plugin instead. It is not a better door --
// WikiSync has ~335k Plugin Hub installs to RuneProfile's ~92k -- but for
// someone already on the far side of it there is no paste at all: type a name
// and the app fetches the lot itself. RuneProfile is the only service anywhere
// that publishes per-task CA completion to third parties over CORS.
//
// The join is exact and was checked rather than assumed: all 646 `index` values
// match the wiki Bucket `id` by name, verified 2026-08-02 against a live
// profile. Both sides derive from the same game cache struct param, so there is
// no mapping table here and there should never need to be one.

import { sanitizeIds } from '@/lib/progress-store'
import { displayRsn } from '@/lib/wikisync'
import type { PlayerProfile } from '@/lib/requirements'

const API_BASE = 'https://api.runeprofile.com/v1/accounts/'

/** Their site, for the "you need the plugin" link in the dialog. */
export const RUNEPROFILE_URL = 'https://runeprofile.com'
export const RUNEPROFILE_PLUGIN_URL = 'https://runelite.net/plugin-hub/show/runeprofile'

export type RuneProfileErrorCode =
  | 'BAD_NAME'
  | 'NOT_TRACKED'
  | 'RATE_LIMITED'
  | 'STALE_PROFILE'
  | 'BAD_RESPONSE'
  | 'UNREACHABLE'

/** Carries a code so the dialog can tell a fixable state from a dead end. */
export class RuneProfileError extends Error {
  readonly code: RuneProfileErrorCode

  constructor(message: string, code: RuneProfileErrorCode) {
    super(message)
    this.name = 'RuneProfileError'
    this.code = code
  }
}

/**
 * What one lookup found.
 *
 * The first three fields are deliberately the shape `diffAgainst` in wikisync.ts
 * already takes -- an import is an import, and the diff has never cared where
 * the ids came from. Everything below them is this door's own business.
 */
export interface RuneProfileImport {
  /** Valid, known task ids the account has completed. */
  ids: number[]
  /** Completed indices that aren't tasks we know about -- a CA release we lack. */
  dropped: number
  profile: PlayerProfile | null
  /** RuneProfile's capitalisation of the name, which is the player's own. */
  displayName: string
  /** 'regular', 'ironman', 'hardcore', 'ultimate'. */
  accountType: string | null
  /** When the plugin last uploaded. The player alone can refresh it. */
  updatedAt: Date | null
}

// --- the achievements half ---------------------------------------------------

interface TasksBody {
  data?: unknown
}

/**
 * Read `/combat-achievements/tasks`.
 *
 * Returns every index the account has actually completed. The response also
 * carries name, description, monster and tier for all 646 -- about 144 KB of
 * text the app already has from the wiki -- so all of that is dropped on the
 * floor here rather than carried into state.
 */
export function parseTasks(body: unknown): { ids: number[]; dropped: number } {
  if (body === null || typeof body !== 'object') {
    throw new RuneProfileError("RuneProfile's reply wasn't readable.", 'BAD_RESPONSE')
  }
  const rows = (body as TasksBody).data
  if (!Array.isArray(rows)) {
    throw new RuneProfileError('RuneProfile returned no task list.', 'BAD_RESPONSE')
  }

  const completed: number[] = []
  for (const row of rows) {
    if (row === null || typeof row !== 'object') continue
    const { index, completed: done } = row as { index?: unknown; completed?: unknown }
    if (done !== true) continue
    if (typeof index !== 'number' || !Number.isFinite(index)) continue
    completed.push(index)
  }
  return sanitizeIds(completed)
}

// --- the requirements half ---------------------------------------------------

/**
 * Levels keyed the way the gate table spells them.
 *
 * No rename table, unlike the Wise Old Man reader: RuneProfile takes its skill
 * names from the game cache, so it already says Runecraft where WOM says
 * runecrafting, and there is no `overall` row to skip. Verified against a live
 * profile -- 24 skills, all matching.
 */
function readLevels(input: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!Array.isArray(input)) return out
  for (const row of input) {
    if (row === null || typeof row !== 'object') continue
    const { name, level } = row as { name?: unknown; level?: unknown }
    if (typeof name !== 'string' || name.trim() === '') continue
    if (typeof level !== 'number' || !Number.isFinite(level) || level < 1) continue
    out[name] = Math.floor(level)
  }
  return out
}

/**
 * Finished quests, by their full in-game name.
 *
 * Only `finished` counts. `in_progress` is not `finished` -- a gate asks whether
 * the door is open, and a quest you have started is a door you have not opened.
 * (The state is spelled `in_progress`, not `started`; checked against the API
 * rather than taken from its documentation.)
 */
function readQuests(input: unknown): string[] {
  const out: string[] = []
  if (!Array.isArray(input)) return out
  for (const row of input) {
    if (row === null || typeof row !== 'object') continue
    const { name, state } = row as { name?: unknown; state?: unknown }
    if (state !== 'finished') continue
    if (typeof name !== 'string' || name.trim() === '') continue
    out.push(name.trim())
  }
  return out
}

interface FullBody {
  username?: unknown
  accountType?: { key?: unknown } | null
  skills?: unknown
  quests?: unknown
  combatAchievements?: unknown
  updatedAt?: unknown
}

/** How many CAs the tier summary claims, which is the staleness cross-check. */
function readTierCompleted(input: unknown): number {
  if (!Array.isArray(input)) return 0
  let total = 0
  for (const row of input) {
    if (row === null || typeof row !== 'object') continue
    const { completed } = row as { completed?: unknown }
    if (typeof completed === 'number' && Number.isFinite(completed)) total += completed
  }
  return total
}

/** Read `/full` -- everything except the per-task list. */
export function parseFull(body: unknown): {
  displayName: string
  accountType: string | null
  updatedAt: Date | null
  profile: PlayerProfile | null
  tierCompleted: number
} {
  if (body === null || typeof body !== 'object') {
    throw new RuneProfileError("RuneProfile's reply wasn't a profile.", 'BAD_RESPONSE')
  }
  const full = body as FullBody

  const levels = readLevels(full.skills)
  const quests = readQuests(full.quests)

  return {
    displayName: typeof full.username === 'string' ? full.username : '',
    accountType: typeof full.accountType?.key === 'string' ? full.accountType.key : null,
    updatedAt: parseDate(full.updatedAt),
    // Neither half means this profile can't answer a requirement question --
    // the same rule the WikiSync reader uses, so a lookup that carried nothing
    // useful never overwrites levels somebody typed by hand.
    profile:
      Object.keys(levels).length === 0 && quests.length === 0 ? null : { levels, quests },
    tierCompleted: readTierCompleted(full.combatAchievements),
  }
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  // The API returns "2026-08-02 18:26:28.409099" -- a space instead of the T,
  // and no zone. Safari refuses that outright and Chrome guesses local time,
  // so it's normalised to an ISO UTC string rather than handed to Date as-is.
  const iso = /^\d{4}-\d{2}-\d{2} /.test(value)
    ? `${value.replace(' ', 'T').replace(/(\.\d{3})\d+$/, '$1')}Z`
    : value
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * How stale the upload is, as a phrase finishing "· synced …".
 *
 * Always shown. RuneProfile holds whatever the plugin last sent, only the
 * player can refresh it, and someone looking at a month-old import deserves to
 * know that before they believe the numbers.
 */
export function syncedLabel(updatedAt: Date | null, now: Date = new Date()): string | null {
  if (updatedAt === null) return null
  const days = Math.floor((now.getTime() - updatedAt.getTime()) / 86_400_000)
  if (days <= 0) return 'synced today'
  if (days === 1) return 'synced yesterday'
  if (days < 60) return `synced ${days} days ago`
  const months = Math.floor(days / 30)
  return `synced ${months} months ago`
}

// --- the lookup --------------------------------------------------------------

async function getJson(url: string, signal: AbortSignal | undefined, who: string) {
  let response: Response
  try {
    // A bare fetch on purpose. RuneProfile's outer CORS middleware answers
    // preflights against an origin allowlist that we are not on, so any header
    // that makes this a non-simple request -- X-API-Key above all -- turns a
    // working call into a blocked one. Anonymous is 30 requests a minute, which
    // is a great deal more than one person clicking Look up.
    response = await fetch(url, { signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new RuneProfileError("Couldn't reach RuneProfile.", 'UNREACHABLE')
  }

  if (response.status === 404) {
    throw new RuneProfileError(`RuneProfile has no profile for ${who}.`, 'NOT_TRACKED')
  }
  if (response.status === 429) {
    throw new RuneProfileError('Too many lookups just now. Try again in a minute.', 'RATE_LIMITED')
  }
  if (!response.ok) {
    throw new RuneProfileError(`RuneProfile answered ${response.status}.`, 'BAD_RESPONSE')
  }
  try {
    return (await response.json()) as unknown
  } catch {
    throw new RuneProfileError("RuneProfile's reply wasn't JSON.", 'BAD_RESPONSE')
  }
}

/**
 * Everything one account has, in two requests.
 *
 * Throws STALE_PROFILE for the case that would otherwise be silent and awful:
 * per-task storage only shipped 2026-05-14, and an account that hasn't synced
 * since returns a cheerful 200 with all 646 tasks marked incomplete. The tier
 * summary is the witness -- it survived the migration, so a profile claiming
 * tier completions while reporting no completed tasks is stale rather than
 * empty, and telling someone with 500 achievements that they have none would be
 * the worst thing this app could do.
 */
export async function fetchRuneProfile(
  rsn: string,
  signal?: AbortSignal,
): Promise<RuneProfileImport> {
  const name = displayRsn(rsn)
  if (name === '') throw new RuneProfileError('Enter your RuneScape name.', 'BAD_NAME')
  const base = `${API_BASE}${encodeURIComponent(name)}`

  const [fullBody, tasksBody] = await Promise.all([
    getJson(`${base}/full`, signal, name),
    getJson(`${base}/combat-achievements/tasks`, signal, name),
  ])

  const full = parseFull(fullBody)
  const { ids, dropped } = parseTasks(tasksBody)

  if (ids.length === 0 && full.tierCompleted > 0) {
    throw new RuneProfileError(
      `RuneProfile has ${full.tierCompleted} achievements for ${name} but no per-task detail — ` +
        'the profile predates that feature. Log in with the RuneProfile plugin to refresh it, ' +
        'then try again.',
      'STALE_PROFILE',
    )
  }

  return {
    ids,
    dropped,
    profile: full.profile,
    displayName: full.displayName === '' ? name : full.displayName,
    accountType: full.accountType,
    updatedAt: full.updatedAt,
  }
}
