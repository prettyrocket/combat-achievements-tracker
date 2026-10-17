// Domain types for the app. These outlived the backend: tiers, points and task
// shape are facts about the game, not about any server. `Task` mirrors a row of
// the wiki's `combat_achievement` Bucket, plus two locally-owned fields:
// `completionPct` (from Module:Combat_Achievements/completion.json) and
// `completed` (from localStorage).

export const TIERS = [
  "EASY",
  "MEDIUM",
  "HARD",
  "ELITE",
  "MASTER",
  "GRANDMASTER",
] as const;
export type Tier = (typeof TIERS)[number];
export const TIER_POINTS: Record<Tier, number> = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
  ELITE: 4,
  MASTER: 5,
  GRANDMASTER: 6,
};

// How the six tiers are spelled where a person reads them. One copy, because
// three files had grown their own and a seventh tier would have to be spelled
// right in all of them.
export const TIER_LABEL: Record<Tier, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  ELITE: "Elite",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
};

export const TASK_TYPES = [
  "KILL_COUNT",
  "RESTRICTION",
  "PERFECTION",
  "MECHANICAL",
  "SPEED",
  "STAMINA",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

/** Same again for types: the table's column and the filter chip agreed by luck. */
export const TYPE_LABEL: Record<TaskType, string> = {
  KILL_COUNT: "Kill Count",
  RESTRICTION: "Restriction",
  PERFECTION: "Perfection",
  MECHANICAL: "Mechanical",
  SPEED: "Speed",
  STAMINA: "Stamina",
};

export interface Task {
  wikiId: number;
  name: string;
  monster: string | null;
  description: string;
  tier: Tier;
  points: number;
  type: TaskType;
  leagueRegion: string | null;
  completionPct: number | null;
  completed: boolean;
}

// A row of the build-time bundle (src/data/tasks.json), written by
// `npm run refresh-data`. `completed` is deliberately absent: that field is
// localStorage state layered on at runtime, not something the wiki knows about.
export type TaskRow = Omit<Task, "completed">;

export interface MonsterSummary {
  monster: string;
  total: number;
  completed: number;
}

export interface TierProgress {
  tier: Tier;
  total: number;
  completed: number;
  pointsTotal: number;
  pointsEarned: number;
}

export interface ProgressSummary {
  totalTasks: number;
  completedTasks: number;
  pointsTotal: number;
  pointsEarned: number;
  perTier: TierProgress[];
}

// One sort per column, each in the only direction anyone wanted it: names A to
// Z, tiers easiest first, points and Comp% biggest first. Every column had a
// reverse once, and choosing between "Easy first" and "Grandmaster first" was a
// question the menu asked without anyone needing it answered.
//
// There is no sort by task name: names are puzzles ("Perfect Zulrah", "Why Are
// You Running?"), and alphabetising them groups nothing a player looks for.
export const SORT_KEYS = ["comp", "tier", "monster", "type", "points"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/**
 * The requirement filter: monsters you can stand in front of, or the ones you
 * can't yet. Absent means don't filter on it at all.
 *
 * Two values rather than a boolean, matching `completed`'s three states -- "what
 * can't I do yet" is a real question (it's the training plan), not just the
 * inverse of the useful one.
 */
export const REQUIREMENT_FILTERS = ["met", "unmet"] as const;
export type RequirementFilter = (typeof REQUIREMENT_FILTERS)[number];

/**
 * The columns the table can be grouped by: the ones with few enough values that
 * a banner per value is a shape rather than a second row per task.
 *
 * Its own setting rather than a side effect of sorting by monster, which is how
 * grouping started. Tied to the sort, "group by tier, easiest first within" was
 * a view nobody could ask for.
 */
export const GROUP_KEYS = ["monster", "type", "tier"] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];

// Client-side filter/sort state (was a query string to the API; now it just
// drives filtering over the in-memory task list, and serialises to the URL).
export interface TaskQuery {
  tier?: Tier[];
  type?: TaskType[];
  /** Monsters to show, OR'd together. Empty or absent means every monster. */
  monster?: string[];
  q?: string;
  completed?: boolean;
  /** Inert without a player profile -- see filterTasks. */
  reqs?: RequirementFilter;
  sort?: SortKey;
  /** Banner rows per value of this column, with the sort applied within each. */
  group?: GroupKey;
}
