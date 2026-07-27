// The reward tiers: what your points are actually *for*.
//
// Points on their own are a score. The thing a player is really tracking is the
// next hilt -- so this turns a point total into "Ghommal's hilt 3 unlocked, 656
// to hilt 4", which is the question the header and the plan panel both answer.
//
// Two rules from the wiki drive everything here:
//
//   1. Rewards are unlocked by a *cumulative point total earned from tasks of
//      any tier*. You do not have to finish Easy to claim Hard: six Grandmaster
//      tasks are worth the same 36 points as thirty-six Easy ones.
//   2. Each tier's requirement is the sum of all points available in that tier
//      and every tier below it. Grandmaster therefore requires every point in
//      the game, which matches the wiki's separate note that the Grandmaster
//      reward needs every currently-released task done.
//
// Rule 2 is why the thresholds are *derived from the bundle* instead of typed in
// as constants. The requirements move every time Jagex releases tasks -- they
// were 33/115/304/820/1485/2005 not long ago -- and a hardcoded number would go
// quietly wrong on the next `npm run refresh-data` rather than loudly. Derived,
// they are correct by construction. Checked against the wiki's own globals
// (`{{Globals|ca hard points}}` and friends) at the time of writing: 41, 161,
// 419, 1075, 1945, 2671 -- the same six numbers this produces from tasks.json.
//
// One consequence worth knowing, and the reason `unlocked` is computed rather
// than remembered: a new release raises the thresholds, so a tier you had met
// can come *undone*. The game does this too -- it unequips the hilt until you
// make up the difference.

// Relative, not the usual `@/lib/types`: check-links.ts loads this module in
// bare Node to build the six reward links, and Node doesn't read the alias out
// of tsconfig. types.ts imports nothing, so the graph stops here.
import { TIERS, type TaskRow, type Tier } from './types.ts'

export interface RewardTier {
  tier: Tier
  label: string
  /** Cumulative points needed, earned from tasks of any tier. */
  required: number
  /** The item the tier is known by -- an exact wiki page title. */
  hilt: string
  /** The same item where there's no room for it: "Hilt 3". */
  hiltShort: string
  /** One more thing the tier grants, for the tooltip. Not the full list: the
   *  wiki has a dozen per tier, and this is a tracker, not the wiki. */
  alsoUnlocks: string
}

const TIER_LABEL: Record<Tier, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
  ELITE: 'Elite',
  MASTER: 'Master',
  GRANDMASTER: 'Grandmaster',
}

// The headline reward per tier. These are stable -- the *thresholds* move with
// each release, the hilts don't -- so unlike the numbers they are safe to name.
const REWARD: Record<Tier, Omit<RewardTier, 'tier' | 'label' | 'required'>> = {
  EASY: {
    hilt: "Ghommal's hilt 1",
    hiltShort: 'Hilt 1',
    alsoUnlocks: 'a 5,000 xp antique lamp and three daily God Wars Dungeon teleports',
  },
  MEDIUM: {
    hilt: "Ghommal's hilt 2",
    hiltShort: 'Hilt 2',
    alsoUnlocks: 'a 10,000 xp antique lamp and no Prayer drain at Barrows',
  },
  HARD: {
    hilt: "Ghommal's hilt 3",
    hiltShort: 'Hilt 3',
    alsoUnlocks: 'a 15,000 xp antique lamp and unlimited God Wars Dungeon teleports',
  },
  ELITE: {
    hilt: "Ghommal's hilt 4",
    hiltShort: 'Hilt 4',
    alsoUnlocks: 'a 25,000 xp antique lamp and the Tztok slayer helmet',
  },
  MASTER: {
    hilt: "Ghommal's hilt 5",
    hiltShort: 'Hilt 5',
    alsoUnlocks: "Ghommal's lucky penny and the avernic defender 5",
  },
  GRANDMASTER: {
    hilt: "Ghommal's hilt 6",
    hiltShort: 'Hilt 6',
    alsoUnlocks: 'the avernic defender 6 and a 50,000 xp antique lamp',
  },
}

/**
 * The six tiers with their point requirements, cheapest first.
 *
 * Driven from the tasks themselves, per rule 2 above. Tiers are walked in TIERS
 * order so the running total accumulates Easy -> Grandmaster; a tier with no
 * tasks contributes nothing and simply shares the previous threshold.
 */
export function rewardTiers(tasks: readonly TaskRow[]): RewardTier[] {
  const pointsInTier = new Map<Tier, number>(TIERS.map((tier) => [tier, 0]))
  for (const task of tasks) {
    pointsInTier.set(task.tier, pointsInTier.get(task.tier)! + task.points)
  }

  let running = 0
  return TIERS.map((tier) => {
    running += pointsInTier.get(tier)!
    return { tier, label: TIER_LABEL[tier], required: running, ...REWARD[tier] }
  })
}

export interface RewardStatus {
  /** The best tier already claimed, or null before the first one. */
  unlocked: RewardTier | null
  /** The one being worked towards, or null once they're all claimed. */
  next: RewardTier | null
  /** Points still needed for `next`. 0 when there is no next. */
  pointsToNext: number
  /** 0-100 across the gap between the last threshold and the next, so the meter
   *  measures the stretch you're on rather than restarting the whole game. */
  percentToNext: number
}

/**
 * Where a point total stands against the tiers.
 *
 * `>=` throughout: a threshold is met *at* the number, not past it.
 */
export function rewardStatus(tiers: readonly RewardTier[], points: number): RewardStatus {
  let unlocked: RewardTier | null = null
  let next: RewardTier | null = null

  for (const tier of tiers) {
    if (points >= tier.required) unlocked = tier
    else if (next === null) next = tier
  }

  if (next === null) return { unlocked, next: null, pointsToNext: 0, percentToNext: 100 }

  // The floor of the current stretch. Not `unlocked.required`: a tier with no
  // tasks of its own shares its predecessor's threshold, which would make the
  // gap zero-width and the meter a division by zero.
  const floor = unlocked?.required ?? 0
  const span = next.required - floor
  return {
    unlocked,
    next,
    pointsToNext: next.required - points,
    percentToNext: span <= 0 ? 100 : Math.min(100, Math.max(0, ((points - floor) / span) * 100)),
  }
}

export interface RewardProjection {
  /** What finishing the plan would leave you on. */
  status: RewardStatus
  /** Tiers the plan would carry you across, cheapest first. Empty if it doesn't
   *  reach the next threshold -- which is worth saying just as plainly. */
  unlocks: RewardTier[]
}

/**
 * What a plan would be worth: where `points` lands once `planned` more are
 * earned, and which thresholds get crossed on the way.
 *
 * The whole reason the panel counts points at all. "This list is 34 points" is
 * trivia; "this list is the last 34 points to hilt 4" is a reason to do it
 * tonight, and it's also how you notice that swapping two Easies for a Master
 * would get you there.
 *
 * `planned` is the *outstanding* points on the list -- entries already ticked
 * are counted in `points` and must not be counted twice.
 */
export function projectRewards(
  tiers: readonly RewardTier[],
  points: number,
  planned: number,
): RewardProjection {
  const status = rewardStatus(tiers, points + planned)
  const unlocks = tiers.filter((tier) => tier.required > points && tier.required <= points + planned)
  return { status, unlocks }
}
