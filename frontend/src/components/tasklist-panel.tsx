// The plan, docked to the right of the table.
//
// Deliberately a *narrow* view of a task: position, name, tier, and whether it's
// done. Everything else -- description, Comp%, the monster pivot -- is what the
// table on the left is for. The panel answers one question, "what am I doing
// next", and stays readable at a third of the width because it doesn't try to
// answer any of the others.

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronLeft, ChevronRight, GripVertical, ListChecks, ListPlus, X } from 'lucide-react'
import { TASKLIST_DROPPABLE, dragId } from '@/lib/dnd'
import { percent } from '@/lib/progress-summary'
import { summarize, type TaskListEntry } from '@/lib/tasklist'
import { TierBadge } from '@/components/tier-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

function Entry({
  entry,
  onToggleCompleted,
  onRemove,
}: {
  entry: TaskListEntry
  onToggleCompleted: (wikiId: number) => void
  onRemove: (wikiId: number) => void
}) {
  const { task, position, completed } = entry
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dragId('list', task.wikiId) })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`bg-card flex items-start gap-2 rounded-md border p-2 ${
        // Left in place but faded while it's being dragged, so the gap you're
        // aiming at stays where you expect it.
        isDragging ? 'opacity-40' : ''
      }`}
    >
      {/* The handle, not the whole row: the row holds a checkbox and a remove
          button, and a drag surface over the top of those would eat their clicks.
          dnd-kit wires this for the keyboard too -- space to lift, arrows to
          move, space to drop -- which is the accessible path to reordering. */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder "${task.name}", currently ${position}`}
        className="text-muted-foreground hover:text-foreground mt-0.5 cursor-grab touch-none rounded p-0.5 active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <span className="text-muted-foreground mt-0.5 w-4 shrink-0 text-right text-xs tabular-nums">
        {position}
      </span>

      <Checkbox
        checked={completed}
        onCheckedChange={() => onToggleCompleted(task.wikiId)}
        aria-label={`Mark "${task.name}" as ${completed ? 'not completed' : 'completed'}`}
        className="mt-0.5"
      />

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${completed ? 'text-muted-foreground line-through' : ''}`}>
          {task.name}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-xs">
          <TierBadge tier={task.tier} />
          {task.monster && (
            <span className="text-muted-foreground truncate">{task.monster}</span>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(task.wikiId)}
        aria-label={`Remove "${task.name}" from my list`}
        className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  )
}

export interface TaskListPanelProps {
  entries: readonly TaskListEntry[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleCompleted: (wikiId: number) => void
  onRemove: (wikiId: number) => void
  onClear: () => void
}

export function TaskListPanel({
  entries,
  open,
  onOpenChange,
  onToggleCompleted,
  onRemove,
  onClear,
}: TaskListPanelProps) {
  const summary = summarize(entries)
  // Registered even while collapsed, so dragging a row toward a closed panel
  // still has something to hit -- see the rail below.
  const { setNodeRef, isOver } = useDroppable({ id: TASKLIST_DROPPABLE })

  if (!open) {
    // One element, two shapes: a narrow rail beside the table on wide screens, a
    // full-width bar where the panel stacks. Collapsing must never be a way to
    // lose the list -- there is always something to click to get it back.
    //
    // The rail label used to be turned on its side. Sideways text for two words
    // is a party trick that reads badly, so the wide form is now the icon and the
    // count -- both legible the normal way up -- with the words kept for the bar,
    // where there is room for them.
    return (
      <aside ref={setNodeRef} aria-label="My list" className="w-full shrink-0 lg:h-full lg:w-12">
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-expanded={false}
          title={isOver ? 'Drop to add' : `My list — ${summary.completed}/${summary.total} done`}
          className={`hover:bg-muted flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 transition-colors lg:h-full lg:flex-col lg:justify-start lg:px-0 lg:py-3 ${
            isOver ? 'border-foreground bg-muted' : ''
          }`}
        >
          <ListChecks className="size-4 shrink-0" aria-hidden />
          <span className="text-xs font-medium tabular-nums">{summary.total}</span>
          <span className="text-muted-foreground text-xs lg:hidden">
            {isOver ? 'Drop to add' : 'My list'}
          </span>
          {/* The rail's own affordance: a chevron pointing back the way the panel
              will come from, instead of a word lying on its side. */}
          <ChevronLeft className="text-muted-foreground hidden size-4 lg:block" aria-hidden />
        </button>
      </aside>
    )
  }

  return (
    <aside aria-label="My list" className="w-full shrink-0 lg:h-full lg:w-80">
      <div
        ref={setNodeRef}
        className={`flex max-h-[45vh] flex-col rounded-lg border transition-colors lg:max-h-full lg:h-full ${
          isOver ? 'border-foreground bg-muted/40' : ''
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="size-4" aria-hidden />
            My list
            <span className="text-muted-foreground font-normal tabular-nums">
              {summary.completed}/{summary.total} done
            </span>
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-expanded
            aria-label="Collapse my list"
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>

        {summary.total > 0 && (
          <div className="bg-muted h-1 w-full shrink-0 overflow-hidden">
            <div
              className="bg-foreground h-full transition-[width] duration-300"
              style={{ width: `${percent(summary.completed, summary.total)}%` }}
            />
          </div>
        )}

        {entries.length === 0 ? (
          <p className="text-muted-foreground px-3 py-8 text-center text-sm">
            Drag tasks here to plan your next session — or use the{' '}
            {/* The icon an unlisted row actually shows, so this reads as an
                instruction rather than a riddle. */}
            <ListPlus className="inline size-3.5" aria-hidden /> button on any row.
          </p>
        ) : (
          <>
            <SortableContext
              items={entries.map((entry) => dragId('list', entry.task.wikiId))}
              strategy={verticalListSortingStrategy}
            >
              {/* The one part of the panel that scrolls: the header, the meter
                  and Clear all stay put, however long the plan gets. */}
              <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
                {entries.map((entry) => (
                  <Entry
                    key={entry.task.wikiId}
                    entry={entry}
                    onToggleCompleted={onToggleCompleted}
                    onRemove={onRemove}
                  />
                ))}
              </ul>
            </SortableContext>

            <div className="flex shrink-0 justify-end border-t px-2 py-1.5">
              <Button variant="ghost" size="sm" onClick={onClear} className="h-6 px-2 text-xs">
                <X className="size-3" aria-hidden />
                Clear list
              </Button>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
