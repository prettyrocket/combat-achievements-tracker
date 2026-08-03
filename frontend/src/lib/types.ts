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

export const TASK_TYPES = [
  "KILL_COUNT",
  "RESTRICTION",
  "PERFECTION",
  "MECHANICAL",
  "SPEED",
  "STAMINA",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

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

// Every sort is directional now that the column headers are the control: a
// header has to be able to say which way it is pointing, and "Tier" with no
// direction can't. The two `comp_*` names predate the convention and are kept
// as they are, because they are already out there in shared URLs.
export const SORT_KEYS = [
  "comp_desc",
  "comp_asc",
  "tier_asc",
  "tier_desc",
  "name_asc",
  "name_desc",
  "monster_asc",
  "monster_desc",
  "type_asc",
  "type_desc",
  "points_desc",
  "points_asc",
] as const;
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
}
