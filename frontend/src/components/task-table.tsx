import { useMemo } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { useDraggable } from '@dnd-kit/core'
import { ListChecks, ListPlus } from 'lucide-react'
import { dragId } from '@/lib/dnd'
import type { TaskRow, TaskType } from '@/lib/types'
import { COMPLETION_TONE_CLASS, completionTone, formatCompletion } from '@/lib/completion'
import { TierBadge } from '@/components/tier-badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const TYPE_LABEL: Record<TaskType, string> = {
  KILL_COUNT: 'Kill Count',
  RESTRICTION: 'Restriction',
  PERFECTION: 'Perfection',
  MECHANICAL: 'Mechanical',
  SPEED: 'Speed',
  STAMINA: 'Stamina',
}

export interface TaskTableProps {
  tasks: readonly TaskRow[]
  /** Ids of tasks marked done. Held in memory for now; #18 moves it to localStorage. */
  completed: ReadonlySet<number>
  onToggle: (wikiId: number) => void
  /**
   * Turns the Monster cell into the pivot control. Optional so the table stays
   * usable on its own: without it the cell renders as plain text rather than
   * shipping a control that goes nowhere.
   */
  onPivotToMonster?: (monster: string) => void
  /** The monster already pivoted to, if any. Its cells render as plain text. */
  activeMonster?: string
  /** Ids on the plan, so a row can show it's already there. */
  onList?: ReadonlySet<number>
  /**
   * Adds/removes the row from the plan. The keyboard- and touch-reachable
   * counterpart to dragging a row into the panel, which is pointer-only however
   * carefully it's built.
   */
  onToggleListed?: (wikiId: number) => void
}

/**
 * Rows are draggable so they can be thrown at the panel. The pointer sensor is
 * distance-activated (see App), which is what keeps this from swallowing clicks
 * on the checkbox and the monster pivot living inside the same row.
 */
function DraggableRow({
  task,
  isCompleted,
  draggable,
  children,
}: {
  task: TaskRow
  isCompleted: boolean
  draggable: boolean
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId('table', task.wikiId),
    disabled: !draggable,
  })

  return (
    <TableRow
      ref={setNodeRef}
      data-state={isCompleted && 'selected'}
      className={isDragging ? 'opacity-40' : undefined}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      // The row is a drag surface, not a button: dnd-kit's default role would
      // tell a screen reader otherwise, and the ☰ button in the row is the
      // documented way in for anyone not using a pointer.
      role={undefined}
      tabIndex={undefined}
    >
      {children}
    </TableRow>
  )
}

export function TaskTable({
  tasks,
  completed,
  onToggle,
  onPivotToMonster,
  activeMonster,
  onList,
  onToggleListed,
}: TaskTableProps) {
  // Column defs close over the callbacks, so memoise on those rather than rebuilding
  // (and remounting every cell) on each parent render.
  const columns = useMemo<ColumnDef<TaskRow>[]>(
    () => [
      {
        id: 'completed',
        header: () => <span className="sr-only">Completed</span>,
        cell: ({ row }) => {
          const task = row.original
          const isDone = completed.has(task.wikiId)
          return (
            <Checkbox
              checked={isDone}
              onCheckedChange={() => onToggle(task.wikiId)}
              aria-label={`Mark "${task.name}" as ${isDone ? 'not completed' : 'completed'}`}
            />
          )
        },
      },
      ...(onToggleListed
        ? [
            {
              id: 'listed',
              header: () => <span className="sr-only">On my list</span>,
              cell: ({ row }) => {
                const task = row.original
                const listed = onList?.has(task.wikiId) ?? false
                const Icon = listed ? ListChecks : ListPlus
                return (
                  <button
                    type="button"
                    onClick={() => onToggleListed(task.wikiId)}
                    aria-pressed={listed}
                    title={listed ? 'On my list' : 'Add to my list'}
                    aria-label={
                      listed ? `Remove "${task.name}" from my list` : `Add "${task.name}" to my list`
                    }
                    className={`hover:bg-muted rounded p-1 transition-colors ${
                      listed ? 'text-foreground' : 'text-muted-foreground/50 hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-4" aria-hidden />
                  </button>
                )
              },
            } satisfies ColumnDef<TaskRow>,
          ]
        : []),
      {
        id: 'monster',
        header: 'Monster',
        accessorFn: (t) => t.monster,
        cell: ({ row }) => {
          const { monster } = row.original
          if (monster === null) {
            return <span className="text-muted-foreground italic">Any</span>
          }
          // Already pivoted here: clicking would be a no-op, so don't offer it.
          const isActive = monster.toLowerCase() === activeMonster?.trim().toLowerCase()
          if (!onPivotToMonster || isActive) return monster
          return (
            <button
              type="button"
              onClick={() => onPivotToMonster(monster)}
              title={`Show only ${monster} tasks`}
              className="text-left underline decoration-dotted underline-offset-4 hover:text-foreground hover:decoration-solid"
            >
              {monster}
            </button>
          )
        },
      },
      {
        id: 'name',
        header: 'Name',
        accessorFn: (t) => t.name,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'description',
        header: 'Description',
        accessorFn: (t) => t.description,
        // The only column allowed to wrap -- descriptions are full sentences, and
        // truncating them hides the actual requirement.
        cell: ({ row }) => (
          <span className="block max-w-prose whitespace-normal text-muted-foreground">
            {row.original.description}
          </span>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        accessorFn: (t) => t.type,
        cell: ({ row }) => TYPE_LABEL[row.original.type],
      },
      {
        id: 'tier',
        header: 'Tier',
        accessorFn: (t) => t.tier,
        cell: ({ row }) => <TierBadge tier={row.original.tier} />,
      },
      {
        id: 'completionPct',
        header: () => <span className="block text-right">Comp%</span>,
        accessorFn: (t) => t.completionPct,
        cell: ({ row }) => {
          const { completionPct } = row.original
          return (
            <span
              className={`block text-right tabular-nums ${COMPLETION_TONE_CLASS[completionTone(completionPct)]}`}
            >
              {formatCompletion(completionPct)}
            </span>
          )
        },
      },
    ],
    [completed, onToggle, onPivotToMonster, activeMonster, onList, onToggleListed],
  )

  const data = useMemo(() => tasks as TaskRow[], [tasks])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (task) => String(task.wikiId),
  })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHead key={header.id}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <DraggableRow
            key={row.id}
            task={row.original}
            isCompleted={completed.has(row.original.wikiId)}
            draggable={onToggleListed !== undefined}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </DraggableRow>
        ))}
      </TableBody>
    </Table>
  )
}
