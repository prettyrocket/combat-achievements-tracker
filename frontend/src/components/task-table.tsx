import { useMemo } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
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
   * Turns the Monster cell into the pivot control. Left undefined until #10 builds
   * the pivot view -- the cell renders as plain text rather than shipping a link
   * that goes nowhere.
   */
  onPivotToMonster?: (monster: string) => void
}

export function TaskTable({ tasks, completed, onToggle, onPivotToMonster }: TaskTableProps) {
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
      {
        id: 'monster',
        header: 'Monster',
        accessorFn: (t) => t.monster,
        cell: ({ row }) => {
          const { monster } = row.original
          if (monster === null) {
            return <span className="text-muted-foreground italic">Any</span>
          }
          if (!onPivotToMonster) return monster
          return (
            <button
              type="button"
              onClick={() => onPivotToMonster(monster)}
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
    [completed, onToggle, onPivotToMonster],
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
          <TableRow key={row.id} data-state={completed.has(row.original.wikiId) && 'selected'}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
