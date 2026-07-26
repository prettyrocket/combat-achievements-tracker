import { useCallback, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { TASKS } from '@/data/tasks'
import { TaskTable } from '@/components/task-table'
import { ProgressToolbar } from '@/components/progress-toolbar'
import { ProgressHeader } from '@/components/progress-header'
import { FilterBar } from '@/components/filter-bar'
import { MonsterBreadcrumb } from '@/components/monster-breadcrumb'
import { TaskListPanel } from '@/components/tasklist-panel'
import { TASKLIST_DROPPABLE, parseDragId } from '@/lib/dnd'
import { readJson, writeJson } from '@/lib/local-store'
import { summarize, summarizeMonster } from '@/lib/progress-summary'
import { resolve } from '@/lib/tasklist'
import { applyQuery, clearMonster, pivotToMonster } from '@/lib/task-query'
import { useProgress } from '@/lib/use-progress'
import { useTaskList } from '@/lib/use-tasklist'
import { useTaskQuery } from '@/lib/use-task-query'

// Every distinct monster, for the filter's autocomplete. Static data, so it's
// computed once at module load rather than per render.
const MONSTERS = [...new Set(TASKS.map((t) => t.monster).filter((m) => m !== null))].sort()

const BY_ID = new Map(TASKS.map((task) => [task.wikiId, task]))

// Whether the panel was left open. UI state, not data, so it gets its own key and
// stays out of the export -- restoring a backup shouldn't rearrange the furniture.
const PANEL_KEY = 'ca-tracker:tasklist-open:v1'

function panelInitiallyOpen(): boolean {
  const stored = readJson(PANEL_KEY)
  // Open by default: a plan you have to go and find is a plan you stop using.
  return typeof stored === 'boolean' ? stored : true
}

export default function App() {
  const { completed, toggle, setMany, mergeMany, reset, storageError } = useProgress()
  const { query, setQuery, clear } = useTaskQuery()
  const taskList = useTaskList()

  const [panelOpen, setPanelOpen] = useState(panelInitiallyOpen)
  const [dragging, setDragging] = useState<number | null>(null)

  // The summary deliberately ignores the query: it reports progress against the
  // whole game, not against whatever happens to be filtered in right now.
  const summary = useMemo(() => summarize(TASKS, completed), [completed])

  const visible = useMemo(() => applyQuery(TASKS, query, completed), [query, completed])

  const monsterSummary = useMemo(
    () => (query.monster ? summarizeMonster(TASKS, completed, query.monster) : null),
    [query.monster, completed],
  )

  const entries = useMemo(
    () => resolve(taskList.list, TASKS, completed),
    [taskList.list, completed],
  )

  const listedIds = useMemo(() => new Set(taskList.list), [taskList.list])

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

  const togglePanel = useCallback((open: boolean) => {
    setPanelOpen(open)
    writeJson(PANEL_KEY, open)
  }, [])

  // Distance-activated, so a press that turns into a click still reaches the
  // checkbox and the monster pivot inside the row rather than starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    setDragging(parseDragId(active.id)?.wikiId ?? null)
  }, [])

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setDragging(null)
      if (!over) return

      const source = parseDragId(active.id)
      if (!source) return

      const target = parseDragId(over.id)
      if (target) {
        // Dropped onto an entry: take that entry's place, pushing it down.
        taskList.insertAt(source.wikiId, taskList.list.indexOf(target.wikiId))
        return
      }

      // Dropped on the panel itself rather than any entry -- append. Only the
      // panel is a valid target, so anything else is a drag that went nowhere.
      if (over.id === TASKLIST_DROPPABLE) taskList.insertAt(source.wikiId, taskList.list.length)
    },
    [taskList],
  )

  const draggingTask = dragging === null ? null : BY_ID.get(dragging)

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="mx-auto max-w-[100rem] px-6 py-8">
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
            listCount={taskList.list.length}
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

        {/* The split. Stacks below the table under lg, where a 320px column would
            leave the table unusable. */}
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
          <main className="min-w-0 flex-1">
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
                onList={listedIds}
                onToggleListed={taskList.toggle}
              />
            )}
          </main>

          <TaskListPanel
            entries={entries}
            open={panelOpen}
            onOpenChange={togglePanel}
            onToggleCompleted={toggle}
            onRemove={taskList.remove}
            onClear={taskList.clear}
          />
        </div>
      </div>

      {/* Follows the cursor across the gap between table and panel -- without it
          the row stays put and the drag has nothing to show for itself. */}
      <DragOverlay dropAnimation={null}>
        {draggingTask && (
          <div className="bg-card rounded-md border px-3 py-2 text-sm font-medium shadow-lg">
            {draggingTask.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
