import { TASKS } from '@/data/tasks'
import { TaskTable } from '@/components/task-table'
import { ProgressToolbar } from '@/components/progress-toolbar'
import { useProgress } from '@/lib/use-progress'

export default function App() {
  const { completed, toggle, reset, storageError } = useProgress()

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Combat Achievements Tracker</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            OSRS · {completed.size} / {TASKS.length} tasks complete
          </p>
        </div>
        <ProgressToolbar completedCount={completed.size} onReset={reset} />
      </header>

      {storageError && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
        >
          {storageError}
        </p>
      )}

      <main className="mt-6">
        <TaskTable tasks={TASKS} completed={completed} onToggle={toggle} />
      </main>
    </div>
  )
}
