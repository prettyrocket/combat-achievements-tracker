import { useCallback, useMemo } from 'react'
import { TASKS } from '@/data/tasks'
import { TaskTable } from '@/components/task-table'
import { ProgressToolbar } from '@/components/progress-toolbar'
import { ProgressHeader } from '@/components/progress-header'
import { FilterBar } from '@/components/filter-bar'
import { MonsterBreadcrumb } from '@/components/monster-breadcrumb'
import { summarize, summarizeMonster } from '@/lib/progress-summary'
import { applyQuery, clearMonster, pivotToMonster } from '@/lib/task-query'
import { useProgress } from '@/lib/use-progress'
import { useTaskQuery } from '@/lib/use-task-query'

// Every distinct monster, for the filter's autocomplete. Static data, so it's
// computed once at module load rather than per render.
const MONSTERS = [...new Set(TASKS.map((t) => t.monster).filter((m) => m !== null))].sort()

export default function App() {
  const { completed, toggle, setMany, mergeMany, reset, storageError } = useProgress()
  const { query, setQuery, clear } = useTaskQuery()

  // The summary deliberately ignores the query: it reports progress against the
  // whole game, not against whatever happens to be filtered in right now.
  const summary = useMemo(() => summarize(TASKS, completed), [completed])

  const visible = useMemo(() => applyQuery(TASKS, query, completed), [query, completed])

  const monsterSummary = useMemo(
    () => (query.monster ? summarizeMonster(TASKS, completed, query.monster) : null),
    [query.monster, completed],
  )

  const pivot = useCallback(
    (monster: string) => {
      setQuery(pivotToMonster(query, monster))
      // The pivot swaps the table out from under you; without this you'd be left
      // scrolled past the end of a list that is now a dozen rows long.
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [query, setQuery],
  )

  const unpivot = useCallback(() => setQuery(clearMonster(query)), [query, setQuery])

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Combat Achievements Tracker</h1>
          {/* The counts live in ProgressHeader now -- one place, and one that
              reports summary.completedTasks rather than the raw set size. */}
          <p className="text-muted-foreground mt-1 text-sm">
            OSRS · {TASKS.length} tasks · data from the wiki Bucket API
          </p>
        </div>
        <ProgressToolbar
          completed={completed}
          completedCount={completed.size}
          onReset={reset}
          onWikiSyncApply={(ids, mode) => (mode === 'replace' ? setMany(ids) : mergeMany(ids))}
        />
      </header>

      {storageError && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
        >
          {storageError}
        </p>
      )}

      <ProgressHeader summary={summary} />

      <FilterBar
        query={query}
        onChange={setQuery}
        onClear={clear}
        monsters={MONSTERS}
        resultCount={visible.length}
        totalCount={TASKS.length}
      />

      {monsterSummary && <MonsterBreadcrumb summary={monsterSummary} onClear={unpivot} />}

      <main className="mt-4">
        {visible.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
            No tasks match these filters.
          </p>
        ) : (
          <TaskTable
            tasks={visible}
            completed={completed}
            onToggle={toggle}
            onPivotToMonster={pivot}
            activeMonster={query.monster}
          />
        )}
      </main>
    </div>
  )
}
