// The table, in its own scroll viewport.
//
// Two things drive the shape of this file.
//
// First, the viewport: the table scrolls *inside* a fixed-height box rather than
// making the page 30,000px tall. That keeps the progress header and the task list
// on screen, and -- the reason it became urgent -- it puts the horizontal
// scrollbar at the bottom of the *viewport* instead of the bottom of 646 rows,
// where nobody could reach it.
//
// Second, only what's visible is rendered. Toggling one checkbox used to block
// the main thread for over a second, because every row is a dnd-kit draggable and
// all 646 of them re-registered on each render. Windowing cuts that to ~20 rows;
// the column defs no longer close over `completed` (it arrives via table meta),
// so a tick can't invalidate them and remount every cell either.

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Header,
  type Row,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useDraggable } from '@dnd-kit/core'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ExternalLink,
  ListChecks,
  ListPlus,
} from 'lucide-react'
import { dragId } from '@/lib/dnd'
import type { SortKey, TaskRow, TaskType } from '@/lib/types'
import { COMPLETION_TONE_CLASS, completionTone, formatCompletion } from '@/lib/completion'
import { COLUMN_SORT, sortDirection, type SortDirection } from '@/lib/task-query'
import { monsterWikiUrl, splitAtColon, taskWikiUrl } from '@/lib/wiki'
import { TierBadge } from '@/components/tier-badge'
import { Checkbox } from '@/components/ui/checkbox'
// Note the missing `Table`: that wrapper brings its own `overflow-x-auto` div,
// and nesting one inside this viewport puts the horizontal scrollbar back at the
// bottom of all 646 rows -- the exact thing the viewport exists to fix. The
// <table> element is written out by hand below; every other part is shadcn's.
import {
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

/**
 * Row state that changes constantly, kept out of the column defs.
 *
 * Column defs that close over `completed` are rebuilt on every tick, and a new
 * def array makes TanStack rebuild its columns and remount every cell. Reading
 * this from meta instead means a tick re-renders cells and nothing more.
 */
interface TableMeta {
  completed: ReadonlySet<number>
  onList: ReadonlySet<number> | undefined
  activeMonsters: readonly string[]
}

export interface TaskTableProps {
  tasks: readonly TaskRow[]
  completed: ReadonlySet<number>
  onToggle: (wikiId: number) => void
  /**
   * Turns the Monster cell into the pivot control. Optional so the table stays
   * usable on its own: without it the cell renders as plain text rather than
   * shipping a control that goes nowhere.
   */
  onPivotToMonster?: (monster: string) => void
  /** Adds a monster to the filter alongside whatever's already there (shift-click). */
  onAddMonster?: (monster: string) => void
  /** Monsters already filtered to. Their cells render as plain text. */
  activeMonsters?: readonly string[]
  /** Ids on the plan, so a row can show it's already there. */
  onList?: ReadonlySet<number>
  /**
   * Adds/removes the row from the plan. The keyboard- and touch-reachable
   * counterpart to dragging a row into the panel, which is pointer-only however
   * carefully it's built.
   */
  onToggleListed?: (wikiId: number) => void
  /**
   * Puts a whole monster group on the plan at once, from its banner. Separate
   * from onToggleListed because this one only ever adds: a toggle over twenty
   * tasks would take half of them off again depending on what was already there.
   */
  onAddManyToList?: (wikiIds: number[]) => void
  /** Current sort, for the header arrows. */
  sort: SortKey
  onSortChange?: (next: SortKey) => void
}

/** A wiki link that doesn't take the click meant for the control next to it. */
function WikiLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={label}
      aria-label={label}
      onPointerDown={(event) => event.stopPropagation()}
      className="text-muted-foreground/40 hover:text-foreground inline-flex shrink-0 transition-colors"
    >
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  )
}

/**
 * Names split at their colon, so `Chambers of Xeric: CM (5-Scale) Speed-Chaser`
 * stops setting the width of a column whose other 630 rows are half that long.
 * Only the handful of names with a colon are affected; everything else renders
 * as one line exactly as before.
 */
function SplitName({ value, className }: { value: string; className?: string }) {
  const [head, tail] = splitAtColon(value)
  if (tail === null) return <span className={className}>{value}</span>
  return (
    <span className={className}>
      {head}:<br />
      <span className="text-muted-foreground">{tail}</span>
    </span>
  )
}

/**
 * Rows are draggable so they can be thrown at the panel. The pointer sensor is
 * distance-activated (see App), which is what keeps this from swallowing clicks
 * on the checkbox and the monster pivot living inside the same row.
 *
 * `measureRef` is the virtualiser's: rows wrap to different heights (a long
 * description is three lines), so each one reports its real height rather than
 * trusting the estimate.
 */
function DraggableRow({
  task,
  isCompleted,
  draggable,
  index,
  measureRef,
  children,
}: {
  task: TaskRow
  isCompleted: boolean
  draggable: boolean
  index: number
  measureRef: (node: HTMLElement | null) => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId('table', task.wikiId),
    disabled: !draggable,
  })

  const ref = useCallback(
    (node: HTMLTableRowElement | null) => {
      setNodeRef(node)
      measureRef(node)
    },
    [setNodeRef, measureRef],
  )

  return (
    <TableRow
      ref={ref}
      data-index={index}
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

/** One monster's banner, and the tasks under it, in one flat virtualised list. */
interface GroupItem {
  kind: 'group'
  monster: string | null
  /** Every task under this banner, collapsed or not -- what "add all" adds. */
  wikiIds: number[]
}
type RowItem = GroupItem | { kind: 'row'; row: Row<TaskRow> }

/**
 * `null` is a real value here -- tasks with no monster group under "Any monster"
 * like everything else -- so the key is prefixed rather than relying on a
 * sentinel string no monster could be called.
 */
function groupKey(monster: string | null): string {
  return monster === null ? 'any:' : `monster:${monster}`
}

/**
 * A monster's banner: collapses its rows, and puts the whole group on the plan
 * in one click.
 *
 * Two buttons rather than one clickable row. The row's job is collapsing, which
 * is cheap and reversible; adding twenty tasks to a plan is neither, and a strip
 * that did the safe thing everywhere except one patch is how you end up doing
 * the expensive thing by accident.
 */
function GroupBanner({
  group,
  index,
  columnCount,
  measureRef,
  collapsed,
  onToggleCollapsed,
  completed,
  onList,
  onAddManyToList,
}: {
  group: GroupItem
  index: number
  columnCount: number
  measureRef: (node: HTMLElement | null) => void
  collapsed: boolean
  onToggleCollapsed: (monster: string | null) => void
  completed: ReadonlySet<number>
  onList: ReadonlySet<number> | undefined
  onAddManyToList?: (wikiIds: number[]) => void
}) {
  const name = group.monster ?? 'Any monster'
  // A plan is what's left to do. Filtered to "All tasks" a group carries the
  // ones you've already finished, and putting those on the list is the one
  // thing this button must never quietly do.
  const toAdd = group.wikiIds.filter((id) => !completed.has(id) && !onList?.has(id))
  const Chevron = collapsed ? ChevronRight : ChevronDown

  return (
    <tr data-index={index} ref={measureRef} className="bg-muted/60">
      <td colSpan={columnCount} className="border-y p-0">
        {/* Not spread across the full width of the table: these two belong to
            the group's name, so they sit with it. */}
        <div className="flex items-center gap-1 px-2 py-1">
          <button
            type="button"
            onClick={() => onToggleCollapsed(group.monster)}
            aria-expanded={!collapsed}
            className="hover:text-foreground text-foreground flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs font-semibold transition-colors"
          >
            <Chevron className="size-3.5 shrink-0 opacity-70" aria-hidden />
            <span className={`truncate ${group.monster === null ? 'italic' : ''}`}>{name}</span>
            <span className="text-muted-foreground shrink-0 font-normal tabular-nums">
              {group.wikiIds.length}
            </span>
          </button>

          {onAddManyToList && (
            <button
              type="button"
              onClick={() => onAddManyToList(toAdd)}
              disabled={toAdd.length === 0}
              title={
                toAdd.length === 0
                  ? `Nothing left to plan for ${name} — every task is done or already on your list`
                  : `Add ${toAdd.length} unfinished ${name} task${toAdd.length === 1 ? '' : 's'} to my list`
              }
              className="text-muted-foreground hover:bg-background hover:text-foreground flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-40"
            >
              <ListPlus className="size-3.5" aria-hidden />
              {/* The number is what makes this safe to click: it counts what is
                  actually about to be added, not how big the group is. */}
              Add {toAdd.length === 0 ? 'all' : toAdd.length}
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

const DIRECTION_ICON = { asc: ArrowUp, desc: ArrowDown } as const

/** A header that sorts on click and flips direction on the second click. */
function SortableHead({
  header,
  sort,
  onSortChange,
}: {
  header: Header<TaskRow, unknown>
  sort: SortKey
  onSortChange?: (next: SortKey) => void
}) {
  // Widened from the per-column tuple: every column has its own literal pair, and
  // the union of those has no member in common for `includes` to accept.
  const pair = COLUMN_SORT[header.column.id as keyof typeof COLUMN_SORT] as
    | readonly [SortKey, SortKey]
    | undefined
  const label = flexRender(header.column.columnDef.header, header.getContext())

  if (!pair || !onSortChange) return <>{label}</>

  const active: SortDirection | null = pair.includes(sort) ? sortDirection(sort) : null
  // Second click flips; arriving from another column starts in this column's
  // natural direction -- descending for percentages, ascending for names.
  const next = active === null ? pair[0] : pair[0] === sort ? pair[1] : pair[0]
  const Icon = active === null ? ChevronsUpDown : DIRECTION_ICON[active]

  return (
    <button
      type="button"
      onClick={() => onSortChange(next)}
      aria-label={`Sort by ${header.column.id}`}
      className={`hover:text-foreground -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors ${
        active ? 'text-foreground' : 'text-muted-foreground'
      }`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? '' : 'opacity-40'}`} aria-hidden />
    </button>
  )
}

export function TaskTable({
  tasks,
  completed,
  onToggle,
  onPivotToMonster,
  onAddMonster,
  activeMonsters,
  onList,
  onToggleListed,
  onAddManyToList,
  sort,
  onSortChange,
}: TaskTableProps) {
  // Deliberately does *not* depend on `completed` or `onList` -- see TableMeta.
  const columns = useMemo<ColumnDef<TaskRow>[]>(
    () => [
      {
        id: 'completed',
        header: () => <span className="sr-only">Completed</span>,
        cell: ({ row, table }) => {
          const task = row.original
          const isDone = (table.options.meta as TableMeta).completed.has(task.wikiId)
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
              cell: ({ row, table }) => {
                const task = row.original
                const listed =
                  (table.options.meta as TableMeta).onList?.has(task.wikiId) ?? false
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
                    className={`rounded p-1 transition-colors ${
                      listed
                        ? 'text-background bg-foreground'
                        : 'text-muted-foreground/50 hover:bg-muted hover:text-foreground'
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
        cell: ({ row, table }) => {
          const { monster } = row.original
          if (monster === null) {
            return <span className="text-muted-foreground italic">Any</span>
          }
          const { activeMonsters: active } = table.options.meta as TableMeta
          // Already filtered to this one: clicking would be a no-op, so don't offer it.
          const isActive = active.some((m) => m.toLowerCase() === monster.toLowerCase())
          return (
            <span className="flex items-start gap-1.5">
              {!onPivotToMonster || isActive ? (
                <SplitName value={monster} />
              ) : (
                <button
                  type="button"
                  onClick={(event) => {
                    // Shift adds to the filter instead of replacing it, so you can
                    // hold two bosses side by side without retyping either.
                    if (event.shiftKey && onAddMonster) onAddMonster(monster)
                    else onPivotToMonster(monster)
                  }}
                  title={`Show only ${monster} tasks — shift-click to add it alongside`}
                  className="hover:text-foreground text-left underline decoration-dotted underline-offset-4 hover:decoration-solid"
                >
                  <SplitName value={monster} />
                </button>
              )}
              <WikiLink href={monsterWikiUrl(monster)} label={`${monster} on the wiki`} />
            </span>
          )
        },
      },
      {
        id: 'name',
        header: 'Name',
        accessorFn: (t) => t.name,
        cell: ({ row }) => (
          <span className="flex items-start gap-1.5">
            <SplitName value={row.original.name} className="font-medium" />
            <WikiLink
              href={taskWikiUrl(row.original.name)}
              label={`"${row.original.name}" on the wiki`}
            />
          </span>
        ),
      },
      {
        id: 'description',
        header: 'Description',
        accessorFn: (t) => t.description,
        // The only column allowed to wrap freely -- descriptions are full
        // sentences, and truncating them hides the actual requirement.
        cell: ({ row }) => (
          <span className="text-muted-foreground block max-w-prose whitespace-normal">
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
        id: 'points',
        header: () => <span className="block text-right">Pts</span>,
        accessorFn: (t) => t.points,
        cell: ({ row }) => (
          <span className="text-muted-foreground block text-right tabular-nums">
            {row.original.points}
          </span>
        ),
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
    [onToggle, onPivotToMonster, onAddMonster, onToggleListed],
  )

  const data = useMemo(() => tasks as TaskRow[], [tasks])

  const meta = useMemo<TableMeta>(
    () => ({
      completed,
      onList,
      activeMonsters: activeMonsters ?? [],
    }),
    [completed, onList, activeMonsters],
  )

  const table = useReactTable({
    data,
    columns,
    meta,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (task) => String(task.wikiId),
  })

  const rows = table.getRowModel().rows
  const viewportRef = useRef<HTMLDivElement>(null)

  // Sorting by monster puts every Vorkath task together, but a flat list of 646
  // rows doesn't *look* like it did anything -- the runs are only visible if you
  // read the column. A banner row per monster makes the grouping the shape of
  // the table rather than a property of one column.
  //
  // Flattened into the same list the virtualiser counts, so a banner scrolls,
  // measures and windows exactly like a row. The alternative -- rendering
  // banners outside the virtual window -- puts all 89 of them in the DOM at
  // once, which is most of what windowing was added to avoid.
  const grouped = sort === 'monster_asc' || sort === 'monster_desc'

  // Keyed by monster rather than by position, so collapsing Vorkath and then
  // filtering or re-sorting leaves Vorkath collapsed instead of whatever now
  // happens to sit where it was.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())

  const toggleCollapsed = useCallback((monster: string | null) => {
    setCollapsed((current) => {
      const next = new Set(current)
      const key = groupKey(monster)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }, [])

  const items = useMemo<RowItem[]>(() => {
    if (!grouped) return rows.map((row) => ({ kind: 'row', row }))
    const out: RowItem[] = []
    let open: GroupItem | null = null
    let hidden = false
    for (const row of rows) {
      const { monster } = row.original
      if (open === null || open.monster !== monster) {
        open = { kind: 'group', monster, wikiIds: [] }
        hidden = collapsed.has(groupKey(monster))
        out.push(open)
      }
      // Collected either way: a collapsed group still knows what's under it,
      // which is what lets "add all" work without expanding it first.
      open.wikiIds.push(row.original.wikiId)
      if (!hidden) out.push({ kind: 'row', row })
    }
    return out
  }, [rows, grouped, collapsed])

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => viewportRef.current,
    // A one-line row; anything taller is measured for real once it mounts.
    estimateSize: () => 45,
    // Enough rows above and below to survive a flick of the wheel without a
    // visible gap, and few enough that a tick stays cheap.
    overscan: 12,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const columnCount = table.getAllLeafColumns().length
  // Spacer rows rather than absolute positioning: a <tbody> can't have its
  // children taken out of flow without losing the column widths that make this
  // a table in the first place.
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom =
    virtualRows.length > 0
      ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0

  return (
    <div
      ref={viewportRef}
      // The scroll box. Both scrollbars belong to it, so the horizontal one sits
      // at the bottom of what you can see rather than 646 rows below it.
      className="h-full overflow-auto rounded-lg border"
    >
      <table className="w-full caption-bottom text-sm">
        <TableHeader className="bg-background sticky top-0 z-10 [&_tr]:border-b-0">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => (
                <TableHead key={header.id} className="border-b">
                  <SortableHead header={header} sort={sort} onSortChange={onSortChange} />
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {paddingTop > 0 && (
            <tr aria-hidden>
              <td colSpan={columnCount} style={{ height: paddingTop }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const item = items[virtualRow.index]
            if (item.kind === 'group') {
              return (
                <GroupBanner
                  key={groupKey(item.monster)}
                  group={item}
                  index={virtualRow.index}
                  columnCount={columnCount}
                  measureRef={virtualizer.measureElement}
                  collapsed={collapsed.has(groupKey(item.monster))}
                  onToggleCollapsed={toggleCollapsed}
                  completed={completed}
                  onList={onList}
                  onAddManyToList={onAddManyToList}
                />
              )
            }
            const { row } = item
            return (
              <DraggableRow
                key={row.id}
                task={row.original}
                index={virtualRow.index}
                measureRef={virtualizer.measureElement}
                isCompleted={completed.has(row.original.wikiId)}
                draggable={onToggleListed !== undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </DraggableRow>
            )
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden>
              <td colSpan={columnCount} style={{ height: paddingBottom }} />
            </tr>
          )}
        </TableBody>
      </table>
    </div>
  )
}
