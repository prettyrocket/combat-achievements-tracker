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
import type { PlayerProfile } from '@/lib/requirements'

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
  const name = displayRsn(rsn)
  if (name === '') return null
  return `https://sync.runescape.wiki/runelite/player/${encodeURIComponent(name)}/STANDARD`
}

/**
 * A typed name tidied for display, keeping the player's own capitalisation --
 * unlike normalizeRsn, which lowercases because it only ever compares.
 */
export function displayRsn(rsn: string): string {
  return rsn.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

export interface WikiSyncParse {
  /** Valid, known task ids found in the paste, deduped. */
  ids: number[]
  /** Entries that weren't ids of tasks we know about. */
  dropped: number
  /**
   * Skill levels and finished quests, when the paste carried them.
   *
   * Null for a bare array of ids, and for a profile with neither field. The CA
   * list is what the import is *for*, so this half never fails the parse: a
   * payload whose `levels` is nonsense imports the achievements and says nothing
   * about requirements, rather than rejecting a paste that was mostly good.
   */
  profile: PlayerProfile | null
}

/**
 * Why a paste was rejected. The dialog needs more than the text: an empty CA
 * list isn't really a failure, it's a player who hasn't done any yet, and it
 * gets a different tone and a different button.
 */
export type WikiSyncErrorCode =
  | 'EMPTY_PASTE'
  | 'NOT_JSON'
  | 'NOT_WIKISYNC'
  | 'NO_USER'
  | 'NO_CA_LIST'
  | 'EMPTY_LIST'

export class WikiSyncParseError extends Error {
  // Assigned in the body rather than as a parameter property: the build runs
  // with `erasableSyntaxOnly`, which rules those out.
  readonly code: WikiSyncErrorCode

  constructor(message: string, code: WikiSyncErrorCode) {
    super(message)
    this.code = code
  }
}

function fail(message: string, code: WikiSyncErrorCode): never {
  throw new WikiSyncParseError(message, code)
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
  if (trimmed === '') fail('Paste the JSON from your sync URL first.', 'EMPTY_PASTE')

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    fail('Invalid JSON. Try again.', 'NOT_JSON')
  }

  if (Array.isArray(parsed)) {
    // A bare list of ids, from someone who pulled it out themselves. Nothing
    // else to read, so no profile.
    return toResult(parsed, null)
  }

  if (parsed === null || typeof parsed !== 'object') {
    fail('Invalid WikiSync response. Try again.', 'NOT_WIKISYNC')
  }

  const body = parsed as Record<string, unknown>

  if (body.code === NO_USER_DATA) {
    fail('Invalid username. Try again.', 'NO_USER')
  }

  const profile = readProfile(body)

  const list = body.combat_achievements
  if (list === undefined) {
    // A valid profile with no CA list at all. Usually a brand new account --
    // an existing one reports the field even when it's empty, because the
    // plugin reads completion from varps on a timer and doesn't wait to be
    // shown the interface. The dialog phrases this one, because which of those
    // two it is decides whether it reads as congratulation or as a fix.
    fail('No achievements to load.', 'NO_CA_LIST')
  }
  if (!Array.isArray(list)) {
    fail('Invalid WikiSync response. Try again.', 'NOT_WIKISYNC')
  }

  return toResult(list, profile)
}

function toResult(list: unknown[], profile: PlayerProfile | null): WikiSyncParse {
  const { ids, dropped } = sanitizeIds(list)
  if (ids.length === 0 && dropped === 0) {
    // Same situation as NO_CA_LIST from where the player is standing: the
    // account has no Combat Achievements to bring over yet.
    fail('No achievements to load.', 'EMPTY_LIST')
  }
  return { ids, dropped, profile }
}

// --- the requirements half --------------------------------------------------
//
// The same payload that carries `combat_achievements` also carries `levels` and
// `quests`, which is every input the requirement filter needs. Reading them here
// means a player who already uses WikiSync never types a level in by hand.

/**
 * RuneLite's QuestState ordinal: NOT_STARTED 0, IN_PROGRESS 1, FINISHED 2.
 *
 * Written to accept more than that on purpose. This is the one field in the
 * payload whose encoding we are inferring rather than reading from a spec -- the
 * API is the wiki's own and undocumented for third parties -- so a future
 * boolean or "FINISHED" string reads correctly instead of silently marking every
 * quest unfinished. Anything unrecognised means not done, which errs towards
 * showing a row rather than hiding it.
 */
function questIsFinished(value: unknown): boolean {
  if (typeof value === 'number') return value >= 2
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toUpperCase() === 'FINISHED'
  return false
}

function readLevels(value: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return out
  for (const [skill, level] of Object.entries(value as Record<string, unknown>)) {
    if (typeof level === 'number' && Number.isFinite(level) && level >= 1) {
      out[skill] = Math.floor(level)
    }
  }
  return out
}

function readQuests(value: unknown): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value as Record<string, unknown>)
    .filter(([, state]) => questIsFinished(state))
    .map(([quest]) => quest)
}

function readProfile(body: Record<string, unknown>): PlayerProfile | null {
  const levels = readLevels(body.levels)
  const quests = readQuests(body.quests)
  // Neither half present means this payload has nothing to say about
  // requirements -- distinct from an account with a genuinely empty profile,
  // which can't happen (every account has levels).
  if (Object.keys(levels).length === 0 && quests.length === 0) return null
  return { levels, quests }
}

export interface WikiSyncDiff {
  /** Not currently ticked, and will be after applying. */
  newlyCompleted: number[]
  /** Already ticked; the paste agrees. */
  alreadyCompleted: number[]
  /** Currently ticked but absent from the paste, so about to be un-ticked. */
  removed: number[]
  /** Unrecognised entries, ignored rather than failing the whole import. */
  dropped: number
}

/**
 * What applying this paste would actually change. Shown before anything is
 * written -- a paste can carry hundreds of tasks and the user should see the
 * size of it first, and the number that matters is what disappears, not what
 * arrives.
 *
 * This always *replaces*: the account is the authority on which Combat
 * Achievements are done, so a paste is "here is the truth", not "here is some
 * more". There used to be a merge mode, on the theory that a hand-ticked task
 * deserved protection from a WikiSync that hadn't seen it -- but once the CA
 * interface has been opened in-game the plugin has the whole list, and a mode
 * that can only ever leave stale ticks behind is a mode that makes the number
 * at the top wrong. The planned list is a different matter and is never touched
 * by an import; it is yours, not the account's.
 */
export function diffAgainst(parse: WikiSyncParse, completed: ReadonlySet<number>): WikiSyncDiff {
  const newlyCompleted: number[] = []
  const alreadyCompleted: number[] = []
  for (const id of parse.ids) {
    if (completed.has(id)) alreadyCompleted.push(id)
    else newlyCompleted.push(id)
  }

  const incoming = new Set(parse.ids)
  const removed: number[] = []
  for (const id of completed) {
    if (!incoming.has(id)) removed.push(id)
  }
  removed.sort((a, b) => a - b)

  return { newlyCompleted, alreadyCompleted, removed, dropped: parse.dropped }
}

/** Whether applying this diff would change anything at all. */
export function diffIsNoop(diff: WikiSyncDiff): boolean {
  return diff.newlyCompleted.length === 0 && diff.removed.length === 0
}

/**
 * The name of the last account imported from, so a later import can tell
 * whether the planned list it's about to sit beside was built for this account
 * or a different one.
 *
 * Normalised the same way buildSyncUrl normalises: "Lynx_Titan" and "lynx titan"
 * are the same player, and prompting about a changed account because someone
 * typed an underscore would be noise.
 */
export function normalizeRsn(rsn: string): string {
  return rsn.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function sameAccount(a: string, b: string): boolean {
  return normalizeRsn(a) === normalizeRsn(b)
}
