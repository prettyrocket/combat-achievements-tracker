// The five ways progress gets into this app, as data.
//
// A list rather than five call sites, because the Load dialog's rail, its
// remembered default and its detail pane all have to agree on what exists and
// what each one can write. The order here is the order on screen, and it is
// install count first: WikiSync has roughly 335k Plugin Hub installs against
// RuneProfile's 92k, so the door most people can already walk through goes at
// the top regardless of which one is nicer once you're through it.

import { readJson, writeJson } from '@/lib/local-store'

export type LoadSourceId = 'wikisync' | 'runeprofile' | 'wiseoldman' | 'file' | 'manual'

export interface LoadSourceMeta {
  id: LoadSourceId
  /** The rail label. */
  label: string
  /**
   * What this source can write, in the rail under the name.
   *
   * The single most useful thing the picker can say: four of the five look
   * interchangeable until you notice that only three carry achievements and
   * only one carries a plan.
   */
  carries: string
  /** Marks the one most people can use. Exactly one source has it. */
  popular?: boolean
}

export const LOAD_SOURCES: readonly LoadSourceMeta[] = [
  {
    id: 'wikisync',
    label: 'WikiSync',
    carries: 'Achievements, levels, quests',
    popular: true,
  },
  { id: 'runeprofile', label: 'RuneProfile', carries: 'Achievements, levels, quests' },
  { id: 'wiseoldman', label: 'Wise Old Man', carries: 'Levels only' },
  { id: 'file', label: 'A backup file', carries: 'Everything, including your plan' },
  { id: 'manual', label: 'By hand', carries: 'Levels and quests' },
]

const IDS: ReadonlySet<string> = new Set(LOAD_SOURCES.map((source) => source.id))

/** Where the rail starts on a first visit: the one most people can use. */
export const DEFAULT_LOAD_SOURCE: LoadSourceId = 'wikisync'

const STORAGE_KEY = 'ca-tracker:load-source:v1'

/**
 * The source last imported from.
 *
 * Remembered because nobody switches: whichever door you came through the first
 * time is almost certainly the one you'll use again, and making a returning
 * player re-pick it every time is a click that buys nothing.
 */
export function readLastSource(): LoadSourceId {
  const stored = readJson(STORAGE_KEY)
  return typeof stored === 'string' && IDS.has(stored)
    ? (stored as LoadSourceId)
    : DEFAULT_LOAD_SOURCE
}

/**
 * Only ever called after something actually landed.
 *
 * Merely looking at a source isn't a preference -- clicking through the rail to
 * read what RuneProfile needs shouldn't change where the dialog opens next time.
 */
export function writeLastSource(id: LoadSourceId): void {
  writeJson(STORAGE_KEY, id)
}

export { STORAGE_KEY as LOAD_SOURCE_STORAGE_KEY }
