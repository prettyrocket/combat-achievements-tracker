// The easiest points you can go and get right now.
//
// "Easiest" is borrowed from everybody else: `completionPct` is the share of
// players who have the task, and a task most people have done is one most
// people found doable. "Right now" is the requirement gate -- a task behind a
// quest you haven't finished is not a quick win however common it is.

import type { GateCheck, GateStatus } from "@/lib/requirements";
import type { TaskRow } from "@/lib/types";

export const QUICK_WIN_LIMIT = 8;

/**
 * Unfinished tasks whose monster you can reach, most-completed first.
 *
 * With no profile at all every gate is `unknown`, and a card that hid every
 * gated task would be nearly empty for exactly the people who haven't told us
 * anything yet -- so an empty profile lets `unknown` through. Once there are
 * levels to check against, only `open` counts.
 *
 * Tasks with no completion figure can't be ranked and are left out rather than
 * guessed at. Ties go to the cheaper task, then by name, so the list is stable.
 */
export function quickWins(
  tasks: readonly TaskRow[],
  completed: ReadonlySet<number>,
  gates: ReadonlyMap<string, GateCheck>,
  profileIsEmpty: boolean,
  limit: number = QUICK_WIN_LIMIT,
): TaskRow[] {
  const allowed = (status: GateStatus) =>
    status === "open" || (profileIsEmpty && status === "unknown");

  return tasks
    .filter((task) => {
      if (completed.has(task.wikiId) || task.completionPct === null)
        return false;
      // No monster, no gate: nothing stands in the way.
      if (task.monster === null) return true;
      return allowed(gates.get(task.monster)?.status ?? "open");
    })
    .sort(
      (a, b) =>
        b.completionPct! - a.completionPct! ||
        a.points - b.points ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}
