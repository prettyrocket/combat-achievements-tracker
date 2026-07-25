// Shared types mirroring the backend DTOs / enums (see vault Design §4–5).

export const TIERS = ['EASY', 'MEDIUM', 'HARD', 'ELITE', 'MASTER', 'GRANDMASTER'] as const
export type Tier = (typeof TIERS)[number]
export const TIER_POINTS: Record<Tier, number> = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
  ELITE: 4,
  MASTER: 5,
  GRANDMASTER: 6,
}

export const TASK_TYPES = [
  'KILL_COUNT',
  'RESTRICTION',
  'PERFECTION',
  'MECHANICAL',
  'SPEED',
  'STAMINA',
] as const
export type TaskType = (typeof TASK_TYPES)[number]

export interface Task {
  wikiId: number
  name: string
  monster: string | null
  description: string
  tier: Tier
  points: number
  type: TaskType
  leagueRegion: string | null
  completionPct: number | null
  completed: boolean
}

export interface MonsterSummary {
  monster: string
  total: number
  completed: number
}

export interface TierProgress {
  tier: Tier
  total: number
  completed: number
  pointsTotal: number
  pointsEarned: number
}

export interface ProgressSummary {
  totalTasks: number
  completedTasks: number
  pointsTotal: number
  pointsEarned: number
  perTier: TierProgress[]
}

export interface Meta {
  tiers: { tier: Tier; points: number }[]
  types: TaskType[]
  totalTasks: number
  lastSyncedAt: string | null
}

export type SortKey = 'comp_desc' | 'comp_asc' | 'tier' | 'name' | 'monster'

export interface TaskQuery {
  tier?: Tier[]
  type?: TaskType[]
  monster?: string
  q?: string
  completed?: boolean
  sort?: SortKey
}
