// The plan: an ordered list of task ids the player means to work through.
//
// An *ordered* structure, unlike progress -- which is why this is an array and
// not the Set that `completed` uses. Position is the whole point: the top of the
// list is what you do next, and that is the one thing the table on the left can't
// express, however you sort it.
//
// Pure and free of React and of storage, so the ordering rules can be tested
// directly. tasklist-store.ts persists the result; use-tasklist.ts binds it.

import type { TaskRow } from "@/lib/types";

/** A stretch of the plan spent in one place -- see toTrips. */
export interface Trip {
  /** The monster, or null for the tasks that name none. */
  monster: string | null;
  entries: TaskListEntry[];
}

/** An entry, resolved against the task data for rendering. */
export interface TaskListEntry {
  task: TaskRow;
  /** 1-based, as shown in the panel. */
  position: number;
  completed: boolean;
}

export interface TaskListSummary {
  total: number;
  completed: number;
  /** Points the plan is worth in full, and the part of it already earned. Named
   *  to match ProgressSummary, since they mean the same thing over a smaller set. */
  pointsTotal: number;
  pointsEarned: number;
}

// --- ordering primitives ----------------------------------------------------
//
// Every one of these returns a new array and leaves the input alone: the store
// commits by identity, and mutating in place would make a change invisible to it.

/** Appends, if it isn't already there. New work goes to the bottom, not the top:
 *  arriving tasks must never displace the thing you decided to do next. */
export function add(list: readonly number[], wikiId: number): number[] {
  return list.includes(wikiId) ? [...list] : [...list, wikiId];
}

/**
 * Appends every id that isn't already there, in the order given.
 *
 * Not `wikiIds.reduce(add, list)`: that rebuilds the array once per id and does
 * a linear scan each time, and this is fed whole monsters at once. Already-listed
 * ids keep their existing position rather than moving to the bottom -- adding a
 * group you'd partly planned shouldn't reshuffle the part you'd already ordered.
 */
export function addMany(
  list: readonly number[],
  wikiIds: Iterable<number>,
): number[] {
  const seen = new Set(list);
  const next = [...list];
  for (const wikiId of wikiIds) {
    if (seen.has(wikiId)) continue;
    seen.add(wikiId);
    next.push(wikiId);
  }
  return next;
}

export function remove(list: readonly number[], wikiId: number): number[] {
  return list.filter((id) => id !== wikiId);
}

/**
 * Everything already done, off the plan.
 *
 * Only the plan: what you have finished stays finished, because the two are
 * different questions and this one is "what am I still going to go and do". The
 * panel keeps completed entries struck through on purpose -- watching the plan
 * fill in is worth something -- so this is the moment you decide that stretch of
 * the evening is over rather than a tidy-up that happens to you.
 */
export function dropCompleted(
  list: readonly number[],
  completed: ReadonlySet<number>,
): number[] {
  return list.filter((wikiId) => !completed.has(wikiId));
}

export function toggle(list: readonly number[], wikiId: number): number[] {
  return list.includes(wikiId) ? remove(list, wikiId) : add(list, wikiId);
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
export function move(
  list: readonly number[],
  from: number,
  to: number,
): number[] {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return [...list];
  if (from < 0 || from >= list.length || to < 0 || to >= list.length)
    return [...list];
  if (from === to) return [...list];

  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Move by id rather than index -- what a drop handler and a keyboard shortcut
 *  both actually have to hand. */
export function moveId(
  list: readonly number[],
  wikiId: number,
  to: number,
): number[] {
  return move(list, list.indexOf(wikiId), to);
}

/** Insert at a position, or move there if it's already on the list. The drop
 *  handler's single entry point: dropping a table row onto the panel and
 *  dropping an entry within the panel are the same gesture. */
export function insertAt(
  list: readonly number[],
  wikiId: number,
  to: number,
): number[] {
  if (list.includes(wikiId))
    return moveId(list, wikiId, clamp(to, 0, list.length - 1));
  const next = [...list];
  next.splice(clamp(to, 0, list.length), 0, wikiId);
  return next;
}

/** Clamps into range, treating a non-integer as "the end" -- a drop with no
 *  meaningful target lands at the bottom rather than silently doing nothing. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isInteger(value)) return Math.max(min, max);
  return Math.min(max, Math.max(min, value));
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
  const byId = new Map(tasks.map((task) => [task.wikiId, task]));
  const entries: TaskListEntry[] = [];

  for (const wikiId of list) {
    const task = byId.get(wikiId);
    if (!task) continue;
    entries.push({
      task,
      // Numbered over what's actually shown, so the panel never reads 1, 2, 4.
      position: entries.length + 1,
      completed: completed.has(wikiId),
    });
  }

  return entries;
}

/**
 * How far through the plan you are, in tasks and in points.
 *
 * Counts completed entries in place rather than removing them: the list keeps
 * what you've finished, struck through, because watching the plan fill in is the
 * point. A list that empties itself as you go can only ever show you what's left.
 *
 * Points are the reason to plan a session in the first place -- a queue of six
 * Grandmasters and a queue of six Easies are the same "0 / 6" and nothing like
 * the same evening -- so the panel counts them alongside the tasks.
 *
 * Takes resolved entries, not raw ids, so the "3 / 8" in the header is counted
 * over exactly the rows underneath it -- an id the data dropped can't leave the
 * panel claiming a denominator it never renders.
 */
export function summarize(entries: readonly TaskListEntry[]): TaskListSummary {
  const summary: TaskListSummary = {
    total: entries.length,
    completed: 0,
    pointsTotal: 0,
    pointsEarned: 0,
  };

  for (const entry of entries) {
    summary.pointsTotal += entry.task.points;
    if (!entry.completed) continue;
    summary.completed++;
    summary.pointsEarned += entry.task.points;
  }

  return summary;
}

/**
 * The plan as trips: one heading per *run* of tasks that share a monster.
 *
 * Runs, not one section per monster, and that difference is the whole design.
 * A plan is a route through an evening -- four tasks at Cerberus, then two at
 * Zulrah, then back to Cerberus for the one that needs a different setup -- and
 * a view that gathered every Cerberus task into a single section could not
 * express that route. Nor could you drag a task into second place at a boss you
 * visit twice, because there would only be one place called Cerberus.
 *
 * So this is a reading of the order, never a rearrangement of it: the headings
 * appear where the monster changes, every row stays exactly where the list put
 * it, and dragging one anywhere is still the way to move it. Gathering a plan
 * into one section per monster is a thing you can *do* -- see gatherByMonster --
 * rather than a thing the view does to you.
 */
export function toTrips(entries: readonly TaskListEntry[]): Trip[] {
  const trips: Trip[] = [];

  for (const entry of entries) {
    const monster = entry.task.monster;
    const current = trips[trips.length - 1];
    // A new heading only where the monster actually changes. Two runs of the
    // same monster stay two trips, which is the point.
    if (current !== undefined && current.monster === monster) {
      current.entries.push(entry);
    } else {
      trips.push({ monster, entries: [entry] });
    }
  }

  return trips;
}

/**
 * Tidy: every task for a monster moved up to where that monster first appears.
 *
 * The one-press version of the organising nobody wants to do by hand, and an
 * action rather than a mode -- it rewrites the plan, and what you get back is an
 * ordinary plan you can go on dragging. Add three Vorkath tasks over a week and
 * they land at the bottom one at a time; press this and they join the Vorkath
 * trip you already had.
 *
 * First appearance again, for the same reason the panel numbers nothing: the
 * order is yours, and the boss you decided to start with stays first.
 */
export function gatherByMonster(
  list: readonly number[],
  tasks: readonly TaskRow[],
): number[] {
  const monsterOf = new Map(tasks.map((task) => [task.wikiId, task.monster]));
  // Keyed by monster, `null` included as a group of its own: the tasks that name
  // no monster are about a skill or an item, and they belong together too.
  const runs = new Map<string | null, number[]>();

  for (const wikiId of list) {
    // An id the data no longer has keeps its own slot rather than joining the
    // monsterless ones -- resolve() will drop it from the view either way, and
    // guessing it into a group would be inventing a fact about it.
    const monster = monsterOf.get(wikiId);
    const key = monster === undefined ? `?${wikiId}` : monster;
    const run = runs.get(key);
    if (run === undefined) runs.set(key, [wikiId]);
    else run.push(wikiId);
  }

  return [...runs.values()].flat();
}

/**
 * The ids of the plan, cut into the same runs the view shows as trips.
 *
 * Ids the bundle no longer has join whatever run they are sitting in rather than
 * splitting one in half. resolve() drops them from the view, so a run here and a
 * trip on screen stay the same run -- which is what lets a caller name a trip by
 * a task in it and get the right stretch of the list back.
 */
function idRuns(
  list: readonly number[],
  tasks: readonly TaskRow[],
): number[][] {
  const monsterOf = new Map(tasks.map((task) => [task.wikiId, task.monster]));
  const runs: number[][] = [];
  let open: string | null | undefined = undefined;

  for (const wikiId of list) {
    const monster = monsterOf.get(wikiId);
    if (runs.length === 0 || (monster !== undefined && monster !== open)) {
      runs.push([wikiId]);
      // An unknown id never becomes the run's monster: it joined this one, it
      // doesn't get to say what it is.
      if (monster !== undefined) open = monster;
    } else {
      runs[runs.length - 1].push(wikiId);
    }
  }

  return runs;
}

/**
 * Move a whole trip up or down the plan, tasks and all.
 *
 * The unit people actually reorganise. Once a plan is a route -- Cerberus, then
 * Zulrah, then back to Cerberus -- rearranging it means moving a *stop*, and
 * doing that a task at a time is six drags to express one decision.
 *
 * Named by a task in the trip rather than by its position, because position is
 * the thing about to change and because two trips can carry the same monster.
 * A `delta` off either end is a no-op: the first trip has nowhere up to go.
 */
export function moveTrip(
  list: readonly number[],
  tasks: readonly TaskRow[],
  anchor: number,
  delta: -1 | 1,
): number[] {
  const runs = idRuns(list, tasks);
  const from = runs.findIndex((run) => run.includes(anchor));
  const to = from + delta;
  if (from === -1 || to < 0 || to >= runs.length) return [...list];

  const swapped = [...runs];
  swapped[from] = runs[to];
  swapped[to] = runs[from];
  return swapped.flat();
}
