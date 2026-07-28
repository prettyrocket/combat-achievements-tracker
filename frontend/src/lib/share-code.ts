// The share code: everything portable about this browser, as one URL-safe string.
//
// Export (backup.ts) makes localStorage an acceptable system of record; this
// makes it a *movable* one. A file is the right shape for "keep this safe" and
// the wrong shape for "open my progress on my phone", which is the thing the app
// otherwise cannot do at all without a server it was deliberately built without.
//
// Framework-free and storage-free on purpose: a pure codec over values, so the
// round-trip can be tested exhaustively without a fake localStorage or a DOM.
// Reading and writing the actual stores is the caller's job.
//
// The profile is deliberately NOT in here. Two reasons, both structural rather
// than about effort: gatedQuests() is sorted by label, so a positional quest
// bitset would shift every bit after any quest added later and silently decode
// old codes onto the wrong quests; and requirements.ts keeps every skill
// WikiSync reported rather than only the gated ten, which a fixed-width level
// block would quietly throw away. Both are solvable with an append-only wire
// ordering owned by this file, but neither is solvable by reusing what's there,
// and a lossy share code is worse than an honest one. Levels travel in the
// export file, which has no such problem because JSON keys carry their names.

import { sanitizeIds } from '@/lib/progress-store'

/**
 * Bumped only for a change that breaks old readers.
 *
 * Appending a section does not qualify: decode treats a short code as "the
 * later sections are empty", so a v1 code stays readable after a v2 section
 * exists. This moves when an existing byte changes meaning.
 */
const VERSION = 1

/**
 * Ids run 0..645 with no gaps -- asserted in the tests against the real data,
 * because this is the assumption the whole format rests on.
 */
const TASK_COUNT = 646
const BITSET_BYTES = 32 + 49 // 81; ceil(646 / 8), written so the arithmetic shows

/** Version + bitset + one length byte, before any task list entries. */
const HEADER_BYTES = 1 + BITSET_BYTES + 1

/**
 * A task list longer than this can't state its length in one byte. It is ~10x
 * the largest plan anyone builds by hand, and truncating is better than a
 * format that can't say what it holds.
 */
const MAX_LIST = 255

// --- base64url --------------------------------------------------------------
//
// Plain base64 is not URL-safe: `+` and `/` survive a fragment by luck and not
// by spec, and `=` padding is noise in a string people paste into chat. The
// substitution is the standard one (RFC 4648 §5) and is its own inverse.

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code: string): Uint8Array {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// --- encode -----------------------------------------------------------------

export interface Shareable {
  completed: Iterable<number>
  list: readonly number[]
}

/**
 * Layout, v1:
 *
 *   byte  0        version
 *   bytes 1..81    completion bitset, bit `id` for task `id`
 *   byte  82       task list length, n
 *   bytes 83..     n ids, two bytes each, big-endian, in list order
 *
 * Completions are positional because they are a set over a fixed universe: the
 * cost is 81 bytes whether one task is done or all 646, which beats a list of
 * ids as soon as ~40 are complete and never gets worse. The task list is *not*
 * a set -- its order is the whole point -- so it pays for ids by value.
 *
 * Two bytes per id rather than the 10 bits an id actually needs. The packing
 * would save 19 bytes on a 25-task list, which is 25 characters of URL nobody
 * will ever notice, in exchange for a bit-cursor to get wrong in both
 * directions. Byte-aligned stays legible in a hex dump.
 */
export function encodeShareCode({ completed, list }: Shareable): string {
  const trimmed = list.slice(0, MAX_LIST)
  const bytes = new Uint8Array(HEADER_BYTES + trimmed.length * 2)

  bytes[0] = VERSION
  for (const id of completed) {
    // Guard rather than trust: an id outside the universe would corrupt a
    // neighbouring task's bit, or silently write past the bitset into the
    // length byte. Dropping it matches what sanitizeIds does on the way in.
    if (!Number.isInteger(id) || id < 0 || id >= TASK_COUNT) continue
    bytes[1 + (id >> 3)] |= 1 << (id & 7)
  }

  bytes[1 + BITSET_BYTES] = trimmed.length
  trimmed.forEach((id, i) => {
    const at = HEADER_BYTES + i * 2
    bytes[at] = (id >> 8) & 0xff
    bytes[at + 1] = id & 0xff
  })

  return toBase64Url(bytes)
}

// --- decode -----------------------------------------------------------------

export interface ShareCodeResult {
  completed: number[]
  list: number[]
  /** Ids the code named that this build doesn't know -- retired, or from a newer release. */
  dropped: number
}

/**
 * Throws, with a message fit for showing the user, on anything that isn't one
 * of our codes -- matching importProgress, because a pasted code and a chosen
 * file fail for the same reasons and should read the same way.
 *
 * Everything that survives the shape checks still goes through sanitizeIds, so
 * there is exactly one answer in the codebase to "is this a real task id".
 */
export function decodeShareCode(code: string): ShareCodeResult {
  const trimmed = code.trim()
  if (trimmed === '') throw new Error('That share code is empty.')

  // Checked before atob rather than relying on it to throw: atob quietly
  // ignores whitespace, so "hello there" decodes to seven junk bytes and would
  // otherwise be reported as a code that got cut off when copied -- which sends
  // the reader off looking for the missing half of something that was never a
  // code at all.
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    throw new Error("That doesn't look like a share code.")
  }

  let bytes: Uint8Array
  try {
    bytes = fromBase64Url(trimmed)
  } catch {
    throw new Error("That doesn't look like a share code.")
  }

  if (bytes.length < HEADER_BYTES) {
    throw new Error('That share code is incomplete -- it may have been cut off when copied.')
  }
  if (bytes[0] !== VERSION) {
    throw new Error(
      `That share code was made by a different version of this app (format ${bytes[0]}, this build reads ${VERSION}).`,
    )
  }

  // Loop to TASK_COUNT, not to the end of the bitset: bits 646 and 647 are
  // padding in the last byte and mean nothing.
  const rawCompleted: number[] = []
  for (let id = 0; id < TASK_COUNT; id++) {
    if (bytes[1 + (id >> 3)] & (1 << (id & 7))) rawCompleted.push(id)
  }

  const listLength = bytes[1 + BITSET_BYTES]
  const expected = HEADER_BYTES + listLength * 2
  if (bytes.length < expected) {
    throw new Error('That share code is incomplete -- it may have been cut off when copied.')
  }

  const rawList: number[] = []
  for (let i = 0; i < listLength; i++) {
    const at = HEADER_BYTES + i * 2
    rawList.push((bytes[at] << 8) | bytes[at + 1])
  }

  const completed = sanitizeIds(rawCompleted)
  const list = sanitizeIds(rawList)
  return {
    completed: completed.ids,
    list: list.ids,
    dropped: completed.dropped + list.dropped,
  }
}

// --- the URL ----------------------------------------------------------------
//
// The fragment, not the query string. Two reasons, and the first is the one
// that matters: a fragment is never sent in the HTTP request, so a link to
// someone's account progress stays out of server logs, proxy logs and Referer
// headers on a host we don't control. The second is that use-task-query owns
// the search half and preserves the hash, so the two never fight.

const SHARE_KEY = 's'

/**
 * The link, deliberately without the current filters.
 *
 * A share code is about what you've done, not what you were looking at when you
 * copied it -- carrying the query string too would mean the recipient opens your
 * progress filtered to whatever boss you happened to be reading about.
 */
export function buildShareUrl(shareable: Shareable, location: Location): string {
  return `${location.origin}${location.pathname}#${SHARE_KEY}=${encodeShareCode(shareable)}`
}

/** The share code in a URL fragment, or null when there isn't one. */
export function readShareCode(hash: string): string | null {
  if (!hash.startsWith('#')) return null
  return new URLSearchParams(hash.slice(1)).get(SHARE_KEY)
}

/**
 * Drops the code from the address bar without adding a history entry.
 *
 * Called once the code has been dealt with, accepted or not: leaving it there
 * means a reload re-asks a question already answered, and -- worse -- that a
 * later reload could offer to overwrite progress made since.
 */
export function clearShareCode(): void {
  if (typeof window === 'undefined') return
  const { pathname, search } = window.location
  window.history.replaceState(null, '', `${pathname}${search}`)
}
