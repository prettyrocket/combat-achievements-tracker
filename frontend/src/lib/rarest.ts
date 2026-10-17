// The completed tasks the fewest players have, for the Profile's bragging card.
//
// `completionPct` is the wiki's share of tracked players who have the task. The
// type allows null -- a task too new to have a figure -- and a task with no
// figure can't be ranked as rare or common, so it's left out rather than sorted
// to either end.

import type { TaskRow } from "@/lib/types";

export type RareTask = TaskRow & { completionPct: number };

/**
 * Up to `limit` completed tasks, rarest first.
 *
 * Ties go to the wiki id, so the order is stable between renders and between
 * two players with the same ticks.
 */
export function rarestCompletions(
  tasks: readonly TaskRow[],
  completed: ReadonlySet<number>,
  limit: number,
): RareTask[] {
  return tasks
    .filter(
      (task): task is RareTask =>
        completed.has(task.wikiId) && task.completionPct !== null,
    )
    .sort((a, b) => a.completionPct - b.completionPct || a.wikiId - b.wikiId)
    .slice(0, Math.max(0, limit));
}
