// The single entry point to task data. Everything downstream imports from here,
// never from tasks.json directly, so the bundle stays swappable.
//
// tasks.json is generated and committed by `npm run refresh-data` (see
// scripts/refresh-data.ts). It's validated at generation time -- 646 rows, 2671
// tier points, no unsanitized wiki markup -- so there's nothing to re-check here.
import tasks from './tasks.json'
import type { TaskRow } from '@/lib/types'

export const TASKS: readonly TaskRow[] = tasks
