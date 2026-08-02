// Skill levels from Wise Old Man.
//
// The only thing about your own account this app fetches for itself, and it
// took a detour to get here. The official hiscores carry every level and would
// have done fine, but they answer with no Access-Control-Allow-Origin header,
// so a browser on our own origin cannot read them -- the same wall WikiSync
// puts up, for an entirely different reason. Wise Old Man already scrapes and
// caches those hiscores, publishes the result for third parties on purpose, and
// answers `access-control-allow-origin: *`. That turns a backend into a fetch().
//
// Levels only, and that is the whole point of keeping it separate from the
// WikiSync path: no quests live here, and no Combat Achievements live on the
// hiscores at all -- 91 tracked activities, and Collections Logged made the cut
// while CAs did not. This fills in one half of the profile and never goes near
// your progress.

// displayRsn belongs to the WikiSync module by history rather than by right:
// it is a plain RuneScape-name tidy-up ("Lynx_Titan" and " lynx  titan " are
// one player), and both flows ask the same name of the same person.
import { displayRsn } from '@/lib/wikisync'

const API_BASE = 'https://api.wiseoldman.net/v2/players/'

/** Their rate limit is 20/minute per IP, which in a browser app is per player. */
export const WISE_OLD_MAN_URL = 'https://wiseoldman.net'

export type WomErrorCode =
  | 'BAD_NAME'
  | 'NOT_TRACKED'
  | 'RATE_LIMITED'
  | 'NO_SNAPSHOT'
  | 'BAD_RESPONSE'
  | 'UNREACHABLE'

/** Carries a code so the dialog can tell "try again" from "that's not fixable". */
export class WomLookupError extends Error {
  constructor(
    readonly code: WomErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'WomLookupError'
  }
}

/**
 * WOM's metric keys are the OSRS skills in lower case, with one disagreement:
 * it says `runecrafting` where the game, the hiscores and WikiSync all say
 * Runecraft.
 *
 * That matters more than one word should. These levels land in the same
 * `levels` record a WikiSync paste writes into, so two spellings of one skill
 * would sit there as two skills, and only the one the gate table happens to
 * name would ever be read.
 */
const RENAMED: Readonly<Record<string, string>> = { runecrafting: 'Runecraft' }

/** A total, not a skill. Storing it as one would put a level 2277 in the profile. */
const NOT_A_SKILL: ReadonlySet<string> = new Set(['overall'])

/**
 * A WOM metric key as this app spells the skill, or null if it isn't one.
 *
 * Capitalisation rather than a 23-entry table, because that is genuinely the
 * rule and a table would be 22 lines of restating it to catch one exception.
 * The exception is named above; wom.test.ts checks the ten skills any gate
 * actually asks for come out the far side spelled the way the gates spell them.
 */
export function skillName(key: string): string | null {
  if (NOT_A_SKILL.has(key)) return null
  const renamed = RENAMED[key]
  if (renamed !== undefined) return renamed
  if (!/^[a-z]+$/.test(key)) return null
  return key[0].toUpperCase() + key.slice(1)
}

export interface WomLookup {
  /** WOM's capitalisation of the name, which is the player's own. */
  displayName: string
  levels: Record<string, number>
  /** When WOM last refreshed this player from the hiscores, if it said. */
  updatedAt: Date | null
  /** WOM's own word: 'regular', 'ironman', 'hardcore', 'ultimate'. */
  accountType: string | null
}

interface WomSkill {
  level?: unknown
}

/**
 * Read a `/v2/players/{name}` body.
 *
 * Pure and separate from the fetch so the shape can be tested without a network
 * or a mock of one -- the response is deep enough (`latestSnapshot.data.skills`)
 * that a silent change in it is the most likely way this quietly stops working.
 */
export function parseWomPlayer(body: unknown): WomLookup {
  if (body === null || typeof body !== 'object') {
    throw new WomLookupError('BAD_RESPONSE', "Wise Old Man's reply wasn't a player.")
  }
  const player = body as {
    displayName?: unknown
    username?: unknown
    type?: unknown
    updatedAt?: unknown
    latestSnapshot?: { data?: { skills?: unknown } } | null
  }

  const skills = player.latestSnapshot?.data?.skills
  if (skills === null || skills === undefined || typeof skills !== 'object') {
    // WOM knows the name but has never actually pulled the hiscores for it.
    throw new WomLookupError(
      'NO_SNAPSHOT',
      'Wise Old Man has this name but no levels for it yet.',
    )
  }

  const levels: Record<string, number> = {}
  for (const [key, value] of Object.entries(skills as Record<string, unknown>)) {
    const name = skillName(key)
    if (name === null) continue
    if (value === null || typeof value !== 'object') continue
    const level = (value as WomSkill).level
    // Unranked skills come back as level 1, which is true and worth keeping.
    // Anything below that is WOM saying "no data", not a level.
    if (typeof level !== 'number' || !Number.isFinite(level) || level < 1) continue
    levels[name] = Math.floor(level)
  }

  if (Object.keys(levels).length === 0) {
    throw new WomLookupError('NO_SNAPSHOT', 'Wise Old Man returned no levels for that name.')
  }

  const displayName =
    typeof player.displayName === 'string' && player.displayName.trim() !== ''
      ? player.displayName
      : typeof player.username === 'string'
        ? player.username
        : ''

  return {
    displayName,
    levels,
    updatedAt: parseDate(player.updatedAt),
    accountType: typeof player.type === 'string' ? player.type : null,
  }
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * How stale the levels are, as a phrase that finishes "· updated …".
 *
 * Worth showing rather than hiding: WOM holds a snapshot from whenever somebody
 * last refreshed this player, which for most accounts is not today. Someone who
 * trained since then and sees the old number should be able to see *why*
 * instead of concluding the filter is broken.
 */
export function updatedLabel(updatedAt: Date | null, now: Date = new Date()): string | null {
  if (updatedAt === null) return null
  const days = Math.floor((now.getTime() - updatedAt.getTime()) / 86_400_000)
  if (days <= 0) return 'updated today'
  if (days === 1) return 'updated yesterday'
  if (days < 60) return `updated ${days} days ago`
  const months = Math.floor(days / 30)
  return `updated ${months} months ago`
}

/**
 * Look a player up.
 *
 * No User-Agent header, deliberately: WOM's docs ask API consumers to send one,
 * and `fetch` forbids setting it -- the browser's own is what goes out. That is
 * also what gets this past Cloudflare's bot check, which is why the same request
 * from `curl` needs an override and this doesn't.
 */
export async function fetchWomLevels(rsn: string, signal?: AbortSignal): Promise<WomLookup> {
  const name = displayRsn(rsn)
  if (name === '') throw new WomLookupError('BAD_NAME', 'Enter your RuneScape name.')

  let response: Response
  try {
    response = await fetch(`${API_BASE}${encodeURIComponent(name)}`, {
      signal,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    // An aborted lookup is the dialog closing or a second search starting, not
    // a failure anyone needs to read about.
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new WomLookupError('UNREACHABLE', "Couldn't reach Wise Old Man.")
  }

  if (response.status === 404) {
    throw new WomLookupError('NOT_TRACKED', `Wise Old Man has never tracked ${name}.`)
  }
  if (response.status === 429) {
    throw new WomLookupError('RATE_LIMITED', 'Too many lookups just now. Try again in a minute.')
  }
  if (!response.ok) {
    throw new WomLookupError('BAD_RESPONSE', `Wise Old Man answered ${response.status}.`)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new WomLookupError('BAD_RESPONSE', "Wise Old Man's reply wasn't JSON.")
  }
  return parseWomPlayer(body)
}
