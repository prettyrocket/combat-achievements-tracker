// Facts derived from the task bundle, computed once at module load.
//
// All three are functions of static data, so recomputing them per render would
// be work with a guaranteed identical answer. They live together because they
// share that one property, not because they are otherwise related.

import { TASKS } from "@/data/tasks";
import { rewardTiers } from "@/lib/rewards";

/** Every distinct monster with its task count, for the picker. */
export const MONSTERS = (() => {
  const counts = new Map<string, number>();
  for (const task of TASKS) {
    if (task.monster !== null)
      counts.set(task.monster, (counts.get(task.monster) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
})();

/** Task by wikiId, for the drag overlay and anything else holding a bare id. */
export const BY_ID = new Map(TASKS.map((task) => [task.wikiId, task]));

// The point requirements for each reward tier, derived from the bundle -- see
// rewards.ts for why they aren't constants.
export const REWARD_TIERS = rewardTiers(TASKS);
