import { useMemo } from 'react'
import { TASKS } from '@/data/tasks'
import { TaskTable } from '@/components/task-table'
import { ProgressToolbar } from '@/components/progress-toolbar'
import { ProgressHeader } from '@/components/progress-header'
import { summarize } from '@/lib/progress-summary'
import { useProgress } from '@/lib/use-progress'

export default function App() {
  const { completed, toggle, setMany, mergeMany, reset, storageError } = useProgress()

  // Recomputed whenever progress changes -- 646 rows is a trivial pass, and
  // caching it against a Set identity is cheaper than reasoning about staleness.
  const summary = useMemo(() => summarize(TASKS, completed), [completed])

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

      <main className="mt-6">
        <TaskTable tasks={TASKS} completed={completed} onToggle={toggle} />
      </main>
    </div>
  )
}
