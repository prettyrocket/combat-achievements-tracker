// Persistence for the player profile: skill levels and finished quests.
//
// A third key alongside progress and the task list, and a third fact: what you
// have done, what you mean to do next, and what you are *able* to do. Reset
// leaves it alone -- clearing your Combat Achievements doesn't un-train your
// Slayer -- and it travels in the export file with the other two (backup.ts).
//
// Same shape as tasklist-store: plain functions over a cached snapshot, with the
// React binding in use-profile.ts, so the rules can be tested without mounting
// anything.

import { readJson, writeJson } from '@/lib/local-store'
import { EMPTY_PROFILE, normalizeQuest, type PlayerProfile } from '@/lib/requirements'

const STORAGE_KEY = 'ca-tracker:profile:v1'
const SCHEMA_VERSION = 1

export interface StoredProfile {
  version: number
  savedAt: string
  levels: Record<string, number>
  quests: string[]
  /** Where it came from, so the editor can say "imported from WikiSync". */
  source: ProfileSource
}

/** Hand-typed, or read out of a WikiSync paste. */
export type ProfileSource = 'manual' | 'wikisync'

/**
 * Levels are clamped to 1..126 rather than merely type-checked: the file is
 * hand-editable and a level of 0 or 2^31 would quietly make every gate open or
 * every gate shut. 126 rather than 99 because Hitpoints-style virtual levels and
 * future raises are somebody else's problem, and a ceiling that has to move is
 * worse than one that is merely generous.
 */
export function sanitizeLevels(input: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return out
  for (const [skill, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    const level = Math.floor(value)
    if (level < 1) continue
    out[skill] = Math.min(level, 126)
  }
  return out
}

/** Deduped by normalized name, keeping the first spelling seen. */
export function sanitizeQuests(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of input) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed === '') continue
    const key = normalizeQuest(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

export function sanitizeProfile(input: unknown): PlayerProfile {
  const raw = (input ?? {}) as { levels?: unknown; quests?: unknown }
  return { levels: sanitizeLevels(raw.levels), quests: sanitizeQuests(raw.quests) }
}

function load(): PlayerProfile {
  const stored = readJson(STORAGE_KEY)
  return stored === null ? EMPTY_PROFILE : sanitizeProfile(stored)
}

function loadSource(): ProfileSource {
  const stored = (readJson(STORAGE_KEY) as { source?: unknown } | null)?.source
  return stored === 'wikisync' ? 'wikisync' : 'manual'
}

// Cached rather than rebuilt per read: useSyncExternalStore compares snapshots
// by identity, and a fresh object each call is an infinite render loop.
let current: PlayerProfile = load()
let currentSource: ProfileSource = loadSource()
const listeners = new Set<() => void>()

function commit(next: PlayerProfile, source: ProfileSource): void {
  current = next
  currentSource = source
  const payload: StoredProfile = {
    version: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    levels: { ...next.levels },
    quests: [...next.quests],
    source,
  }
  writeJson(STORAGE_KEY, payload)
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Stable identity between changes -- safe for useSyncExternalStore. */
export function getProfile(): PlayerProfile {
  return current
}

export function getSource(): ProfileSource {
  return currentSource
}

// --- mutations --------------------------------------------------------------

export function setProfile(profile: PlayerProfile, source: ProfileSource = 'manual'): void {
  commit(sanitizeProfile(profile), source)
}

/** One skill, from the manual form. A level of 0 or below removes it. */
export function setLevel(skill: string, level: number): void {
  const levels = { ...current.levels }
  if (!Number.isFinite(level) || level < 1) delete levels[skill]
  else levels[skill] = Math.min(Math.floor(level), 126)
  commit({ levels, quests: current.quests }, 'manual')
}

/** One quest, from the manual form's checklist. */
export function setQuest(quest: string, finished: boolean): void {
  const key = normalizeQuest(quest)
  const without = current.quests.filter((q) => normalizeQuest(q) !== key)
  commit(
    { levels: current.levels, quests: finished ? [...without, quest] : without },
    'manual',
  )
}

export function clearProfile(): void {
  commit(EMPTY_PROFILE, 'manual')
}

/** Re-read from disk. For the `storage` event: another tab already wrote. */
export function refreshFromStorage(): void {
  const next = load()
  if (sameProfile(next, current)) return
  current = next
  currentSource = loadSource()
  for (const listener of listeners) listener()
}

function sameProfile(a: PlayerProfile, b: PlayerProfile): boolean {
  const aLevels = Object.entries(a.levels)
  if (aLevels.length !== Object.keys(b.levels).length) return false
  if (aLevels.some(([skill, level]) => b.levels[skill] !== level)) return false
  if (a.quests.length !== b.quests.length) return false
  const bQuests = new Set(b.quests.map(normalizeQuest))
  return a.quests.every((quest) => bQuests.has(normalizeQuest(quest)))
}

export { STORAGE_KEY as PROFILE_STORAGE_KEY }
