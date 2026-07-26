// The plan: an ordered list of task ids the player means to work through.
//
// An *ordered* structure, unlike progress -- which is why this is an array and
// not the Set that `completed` uses. Position is the whole point: the top of the
// list is what you do next, and that is the one thing the table on the left can't
// express, however you sort it.
//
// Pure and free of React and of storage, so the ordering rules can be tested
// directly. tasklist-store.ts persists the result; use-tasklist.ts binds it.

import type { TaskRow } from '@/lib/types'

/** An entry, resolved against the task data for rendering. */
export interface TaskListEntry {
  task: TaskRow
  /** 1-based, as shown in the panel. */
  position: number
  completed: boolean
}

export interface TaskListSummary {
  total: number
  completed: number
}

// --- ordering primitives ----------------------------------------------------
//
// Every one of these returns a new array and leaves the input alone: the store
// commits by identity, and mutating in place would make a change invisible to it.

/** Appends, if it isn't already there. New work goes to the bottom, not the top:
 *  arriving tasks must never displace the thing you decided to do next. */
export function add(list: readonly number[], wikiId: number): number[] {
  return list.includes(wikiId) ? [...list] : [...list, wikiId]
}

export function remove(list: readonly number[], wikiId: number): number[] {
  return list.filter((id) => id !== wikiId)
}

export function toggle(list: readonly number[], wikiId: number): number[] {
  return list.includes(wikiId) ? remove(list, wikiId) : add(list, wikiId)
}

/**
 * Moves the entry at `from` to `to`, shifting everything between it along --
 * the drag-and-drop meaning of "move", not a swap. A swap would fling whatever
 * you dropped onto back to where you dragged from, which is not what dropping a
 * card into a queue looks like.
 *
 * Out-of-range indices return the list unchanged rather than throwing: the
 * source of these is a drag gesture, and a nonsense one should be a no-op.
 */
export function move(list: readonly number[], from: number, to: number): number[] {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return [...list]
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return [...list]
  if (from === to) return [...list]

  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** Move by id rather than index -- what a drop handler and a keyboard shortcut
 *  both actually have to hand. */
export function moveId(list: readonly number[], wikiId: number, to: number): number[] {
  return move(list, list.indexOf(wikiId), to)
}

/** Insert at a position, or move there if it's already on the list. The drop
 *  handler's single entry point: dropping a table row onto the panel and
 *  dropping an entry within the panel are the same gesture. */
export function insertAt(list: readonly number[], wikiId: number, to: number): number[] {
  if (list.includes(wikiId)) return moveId(list, wikiId, clamp(to, 0, list.length - 1))
  const next = [...list]
  next.splice(clamp(to, 0, list.length), 0, wikiId)
  return next
}

/** Clamps into range, treating a non-integer as "the end" -- a drop with no
 *  meaningful target lands at the bottom rather than silently doing nothing. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isInteger(value)) return Math.max(min, max)
  return Math.min(max, Math.max(min, value))
}

// --- resolving against the data ---------------------------------------------

/**
 * Pairs each id with its task, dropping ids the data no longer has.
 *
 * Same reasoning as sanitizeIds: a retired task, or a list restored from a newer
 * release, must not render an empty row or crash the panel. Dropping here rather
 * than in the store keeps the stored list intact, so a task that disappears from
 * the bundle and comes back doesn't silently lose its place in the queue.
 */
export function resolve(
  list: readonly number[],
  tasks: readonly TaskRow[],
  completed: ReadonlySet<number>,
): TaskListEntry[] {
  const byId = new Map(tasks.map((task) => [task.wikiId, task]))
  const entries: TaskListEntry[] = []

  for (const wikiId of list) {
    const task = byId.get(wikiId)
    if (!task) continue
    entries.push({
      task,
      // Numbered over what's actually shown, so the panel never reads 1, 2, 4.
      position: entries.length + 1,
      completed: completed.has(wikiId),
    })
  }

  return entries
}

/**
 * How far through the plan you are.
 *
 * Counts completed entries in place rather than removing them: the list keeps
 * what you've finished, struck through, because watching the plan fill in is the
 * point. A list that empties itself as you go can only ever show you what's left.
 *
 * Takes resolved entries, not raw ids, so the "3 / 8" in the header is counted
 * over exactly the rows underneath it -- an id the data dropped can't leave the
 * panel claiming a denominator it never renders.
 */
export function summarize(entries: readonly TaskListEntry[]): TaskListSummary {
  let done = 0
  for (const entry of entries) if (entry.completed) done++
  return { total: entries.length, completed: done }
}
