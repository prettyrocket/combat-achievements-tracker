import { useCallback, useState } from 'react'
import { TASKS } from '@/data/tasks'
import { TaskTable } from '@/components/task-table'

export default function App() {
  // In-memory for now. #18 replaces this with a localStorage-backed store; the
  // table only ever sees a Set and a toggle, so that swap doesn't reach the UI.
  const [completed, setCompleted] = useState<ReadonlySet<number>>(() => new Set())

  const toggle = useCallback((wikiId: number) => {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (!next.delete(wikiId)) next.add(wikiId)
      return next
    })
  }, [])

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Combat Achievements Tracker</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            OSRS · {TASKS.length} tasks · data from the wiki Bucket API
          </p>
        </div>
        <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium">
          {completed.size} / {TASKS.length} done
        </span>
      </header>

      <main className="mt-6">
        <TaskTable tasks={TASKS} completed={completed} onToggle={toggle} />
      </main>
    </div>
  )
}
