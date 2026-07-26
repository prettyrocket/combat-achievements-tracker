// Parses a pasted WikiSync response into task ids.
//
// The app never calls sync.runescape.wiki. The endpoint is Origin-gated (#14) and
// the wiki has explicitly asked third parties not to use the API, so the user
// fetches their own data via a top-level navigation -- which sends no Origin
// header -- and pastes the result here. That keeps us off their infrastructure
// entirely, which is the point, not a workaround.
//
// Pure and side-effect free: this decides what the paste *means*, and the caller
// decides what to do about it.

import { sanitizeIds } from '@/lib/progress-store'

/** WikiSync's own "this RSN has never synced" response. */
const NO_USER_DATA = 'NO_USER_DATA'

/**
 * The sync URL for a player, or null if there's no usable name yet.
 *
 * Built here rather than in the component so the encoding is testable: RSNs
 * routinely contain spaces, and a hand-typed URL with a raw space in it is the
 * most likely way this flow fails before it starts. Underscores are equivalent
 * to spaces in RuneScape names, and runs of whitespace collapse, so "Lynx  Titan",
 * "Lynx_Titan" and " Lynx Titan " all produce the same URL.
 */
export function buildSyncUrl(rsn: string): string | null {
  const name = rsn.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  if (name === '') return null
  return `https://sync.runescape.wiki/runelite/player/${encodeURIComponent(name)}/STANDARD`
}

export interface WikiSyncParse {
  /** Valid, known task ids found in the paste, deduped. */
  ids: number[]
  /** Entries that weren't ids of tasks we know about. */
  dropped: number
}

export class WikiSyncParseError extends Error {}

function fail(message: string): never {
  throw new WikiSyncParseError(message)
}

/**
 * Accepts either the full WikiSync payload or a bare array of ids, for anyone
 * who has already pulled the list out themselves.
 *
 * WikiSync's `combat_achievements` ids map 1:1 onto the wiki Bucket `id` that
 * everything else here joins on (#14), so no translation is needed -- which is
 * the only reason this feature is a paste box rather than a mapping table.
 */
export function parseWikiSync(text: string): WikiSyncParse {
  const trimmed = text.trim()
  if (trimmed === '') fail('Paste the JSON from your WikiSync URL first.')

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    fail(
      "That doesn't look like JSON. Copy the entire page contents from the sync URL, " +
        'starting with {.',
    )
  }

  if (Array.isArray(parsed)) {
    return toResult(parsed)
  }

  if (parsed === null || typeof parsed !== 'object') {
    fail('That JSON is not a WikiSync response.')
  }

  const body = parsed as Record<string, unknown>

  if (body.code === NO_USER_DATA) {
    fail(
      'WikiSync has no data for that name. Check the spelling, then log in with the ' +
        'WikiSync plugin installed and open the Combat Achievements interface in-game ' +
        'at least once before logging out.',
    )
  }

  const list = body.combat_achievements
  if (list === undefined) {
    // A valid profile with no CA list means the interface was never opened --
    // the plugin only captures the list once the player has viewed it.
    fail(
      'That response has no `combat_achievements` list. Open the Combat Achievements ' +
        'interface in-game at least once, log out, then reload the sync URL.',
    )
  }
  if (!Array.isArray(list)) {
    fail('That response has a `combat_achievements` field, but it is not a list.')
  }

  return toResult(list)
}

function toResult(list: unknown[]): WikiSyncParse {
  const { ids, dropped } = sanitizeIds(list)
  if (ids.length === 0 && dropped === 0) {
    fail('That response lists no completed Combat Achievements.')
  }
  return { ids, dropped }
}

/**
 * How a paste combines with existing progress.
 *
 * `merge` is the default because it cannot lose anything: WikiSync only knows
 * what it has seen, so a task ticked by hand for content it hasn't captured
 * should survive. `replace` exists for the case merge can't express -- making
 * this browser match the account exactly, including un-ticking things.
 */
export type ImportMode = 'merge' | 'replace'

export interface WikiSyncDiff {
  /** Not currently ticked, and will be after applying. */
  newlyCompleted: number[]
  /** Already ticked; the paste agrees. */
  alreadyCompleted: number[]
  /** Currently ticked but absent from the paste. Only ever non-empty in `replace`. */
  removed: number[]
  /** Unrecognised entries, ignored rather than failing the whole import. */
  dropped: number
  mode: ImportMode
}

/**
 * What applying this paste would actually change. Shown before anything is
 * written -- a paste can carry hundreds of tasks and the user should see the
 * size of it first, and in `replace` mode the number that matters is what
 * disappears, not what arrives.
 */
export function diffAgainst(
  parse: WikiSyncParse,
  completed: ReadonlySet<number>,
  mode: ImportMode = 'merge',
): WikiSyncDiff {
  const newlyCompleted: number[] = []
  const alreadyCompleted: number[] = []
  for (const id of parse.ids) {
    if (completed.has(id)) alreadyCompleted.push(id)
    else newlyCompleted.push(id)
  }

  const removed: number[] = []
  if (mode === 'replace') {
    const incoming = new Set(parse.ids)
    for (const id of completed) {
      if (!incoming.has(id)) removed.push(id)
    }
    removed.sort((a, b) => a - b)
  }

  return { newlyCompleted, alreadyCompleted, removed, dropped: parse.dropped, mode }
}

/** Whether applying this diff would change anything at all. */
export function diffIsNoop(diff: WikiSyncDiff): boolean {
  return diff.newlyCompleted.length === 0 && diff.removed.length === 0
}
