// Derived progress numbers. Pure: tasks in, summary out, no store and no React,
// so the header and any future legend agree by construction rather than by two
// components happening to compute the same thing.

import { TIERS, type ProgressSummary, type TaskRow, type Tier, type TierProgress } from '@/lib/types'

/**
 * A 0-100 figure safe to drop straight into a CSS width.
 *
 * Clamped and zero-guarded because the callers are meters: an empty tier is a
 * genuine 0/0, and NaN in a width doesn't error, it just renders nothing --
 * a silently missing bar rather than a visibly wrong one.
 */
export function percent(earned: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, (earned / total) * 100))
}

export function summarize(
  tasks: readonly TaskRow[],
  completed: ReadonlySet<number>,
): ProgressSummary {
  // Seeded with every tier, so the header always has six meters to render and
  // the layout doesn't reflow as a tier crosses zero.
  const perTierByTier = new Map<Tier, TierProgress>(
    TIERS.map((tier) => [tier, { tier, total: 0, completed: 0, pointsTotal: 0, pointsEarned: 0 }]),
  )

  let completedTasks = 0
  let pointsTotal = 0
  let pointsEarned = 0

  // Driven from the task list, never from the completed set. An id in the set
  // with no matching task -- a retired task, or a paste from a newer release --
  // then can't inflate anything into reading 647/646.
  for (const task of tasks) {
    const tier = perTierByTier.get(task.tier)!

    pointsTotal += task.points
    tier.total++
    tier.pointsTotal += task.points

    if (completed.has(task.wikiId)) {
      completedTasks++
      pointsEarned += task.points
      tier.completed++
      tier.pointsEarned += task.points
    }
  }

  return {
    totalTasks: tasks.length,
    completedTasks,
    pointsTotal,
    pointsEarned,
    // TIERS order, not insertion order: Easy reads before Grandmaster.
    perTier: TIERS.map((tier) => perTierByTier.get(tier)!),
  }
}
