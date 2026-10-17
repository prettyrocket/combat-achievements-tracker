// The table, in its own scroll viewport.
//
// Two things drive the shape of this directory.
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
//
// This file owns only the viewport and the wiring. What a column *is* lives in
// columns.tsx, the banner/row flattening in use-row-items.ts, and the individual
// pieces in their own files beside them.

import { useEffect, useMemo, useRef } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { gateReason, type GateCheck } from "@/lib/requirements";
import { COLUMN_SORT } from "@/lib/task-query";
import type { SortKey, TaskQuery, TaskRow } from "@/lib/types";
import { buildColumns, type TableMeta } from "@/components/task-table/columns";
import { DraggableRow } from "@/components/task-table/draggable-row";
import { GroupBanner } from "@/components/task-table/group-banner";
import {
  ColumnMenu,
  isSortableColumn,
} from "@/components/task-table/column-menu";
import { groupKey, useRowItems } from "@/components/task-table/use-row-items";
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
} from "@/components/ui/table";

// Every prop is required. They were optional once, "so the table stays usable
// on its own" -- but there has only ever been one caller, it passes all of them,
// and the fallbacks were branches no run of the app could reach. A second caller
// that genuinely wants a read-only table can make them optional again, with the
// benefit of knowing what it actually needs.
/** Each sortable column's name in words, where its header is an abbreviation. */
const COLUMN_NAME: Record<keyof typeof COLUMN_SORT, string> = {
  monster: "Monster",
  type: "Type",
  tier: "Tier",
  points: "Points",
  completionPct: "Completion",
};

/**
 * Every column's width but Description's, which takes what is left.
 *
 * Fixed, because an automatic table sizes its columns from the rows it is
 * showing -- and a virtualised table changes which rows those are as it
 * scrolls. One long name coming into view widened its column, which squeezed
 * Description, which made rows taller, which pushed that name back out, which
 * gave Description its room back... The table drew 19 rows, then 21, then 19,
 * forever: the shaking after unsorting a grouped table.
 *
 * Sized from the data at 14px: Monster and Name fit nine names in ten on one
 * line and wrap the rest; Tier fits "Grandmaster" with its icon.
 */
const COLUMN_WIDTH: Record<string, string> = {
  completed: "2.5rem",
  listed: "2.5rem",
  monster: "10rem",
  name: "13rem",
  type: "7rem",
  tier: "8.5rem",
  points: "3.5rem",
  completionPct: "5.5rem",
};

/** Names wrap inside their fixed width rather than spilling into the next column. */
const WRAPS = new Set(["monster", "name"]);

export interface TaskTableProps {
  tasks: readonly TaskRow[];
  completed: ReadonlySet<number>;
  onToggle: (wikiId: number) => void;
  /** Whether the checkbox column is drawn at all -- see ColumnHandlers. */
  manualTracking: boolean;
  /** Ids on the plan, so a row can show it's already there. */
  onList: ReadonlySet<number>;
  /**
   * Adds/removes the row from the plan. The keyboard- and touch-reachable
   * counterpart to dragging a row into the panel, which is pointer-only however
   * carefully it's built.
   */
  onToggleListed: (wikiId: number) => void;
  /**
   * Puts a whole monster group on the plan at once, from its banner. Separate
   * from onToggleListed because this one only ever adds: a toggle over twenty
   * tasks would take half of them off again depending on what was already there.
   */
  onAddManyToList: (wikiIds: number[]) => void;
  /** Per-monster requirement verdicts, for the lock marker. */
  gates: ReadonlyMap<string, GateCheck>;
  /** Current sort, for the header menus; undefined is the wiki's own order. */
  sort: SortKey | undefined;
  onSortChange: (next: SortKey | undefined) => void;
  /** The whole query, for the header menus' group and filter options. */
  query: TaskQuery;
  onQueryChange: (next: TaskQuery) => void;
  /** Every monster with its task count, for the Monster header's picker. */
  monsters: readonly { name: string; count: number }[];
  onToggleMonster: (monster: string) => void;
}

export function TaskTable({
  tasks,
  completed,
  onToggle,
  manualTracking,
  onList,
  onToggleListed,
  onAddManyToList,
  gates,
  sort,
  onSortChange,
  query,
  onQueryChange,
  monsters,
  onToggleMonster,
}: TaskTableProps) {
  // Deliberately does *not* depend on `completed` or `onList` -- see TableMeta.
  const columns = useMemo(
    () => buildColumns({ onToggle, onToggleListed, manualTracking }),
    [onToggle, onToggleListed, manualTracking],
  );

  const data = useMemo(() => tasks as TaskRow[], [tasks]);

  const meta = useMemo<TableMeta>(
    () => ({ completed, onList, gates }),
    [completed, onList, gates],
  );

  const table = useReactTable({
    data,
    columns,
    meta,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (task) => String(task.wikiId),
  });

  const rows = table.getRowModel().rows;
  const viewportRef = useRef<HTMLDivElement>(null);

  const { items, isCollapsed, toggleCollapsed } = useRowItems(
    rows,
    query.group,
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => viewportRef.current,
    // Measured heights belong to a banner or a task, not to a position. Keyed
    // by index, a re-sort handed every row the height of whatever used to sit
    // there -- a 30px banner's to a five-line task -- and the scroll position
    // lurched while the real heights came back in.
    getItemKey: (index) => {
      const item = items[index];
      return item.kind === "group"
        ? groupKey(item.by, item.value)
        : item.row.id;
    },
    // A one-line row; anything taller is measured for real once it mounts.
    estimateSize: () => 45,
    // Enough rows above and below to survive a flick of the wheel without a
    // visible gap, and few enough that a tick stays cheap.
    overscan: 12,
  });

  // A new sort or grouping is a new list, and its answer is at the top. Left
  // where it was, the view lands mid-way through a reshuffle and the sort looks
  // like it did nothing.
  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0 });
  }, [sort, query.group]);

  const virtualRows = virtualizer.getVirtualItems();
  const columnCount = table.getAllLeafColumns().length;
  // Spacer rows rather than absolute positioning: a <tbody> can't have its
  // children taken out of flow without losing the column widths that make this
  // a table in the first place.
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  return (
    <div
      ref={viewportRef}
      // The scroll box. Both scrollbars belong to it, so the horizontal one sits
      // at the bottom of what you can see rather than 646 rows below it.
      className="h-full overflow-auto rounded-lg border"
    >
      {/* min-w keeps Description at least 12rem wide; below that the table
          scrolls sideways rather than squeezing it to a word per line. */}
      <table className="w-full min-w-[62rem] table-fixed caption-bottom text-sm">
        <colgroup>
          {table.getAllLeafColumns().map((column) => (
            <col key={column.id} style={{ width: COLUMN_WIDTH[column.id] }} />
          ))}
        </colgroup>
        <TableHeader className="bg-background sticky top-0 z-10 [&_tr]:border-b-0">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => (
                <TableHead key={header.id} className="border-b">
                  {isSortableColumn(header.column.id) ? (
                    <ColumnMenu
                      column={header.column.id}
                      label={flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      name={COLUMN_NAME[header.column.id]}
                      query={query}
                      sort={sort}
                      onSortChange={onSortChange}
                      onQueryChange={onQueryChange}
                      monsters={monsters}
                      onToggleMonster={onToggleMonster}
                    />
                  ) : (
                    // The checkbox columns, Name and Description: nothing to sort,
                    // group or filter by, so the header is just its label.
                    flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {/* In the body rather than instead of the table: the header holds
              three of the filters, and taking it away with the last row would
              leave nothing to widen them back out with. */}
          {items.length === 0 && (
            <tr>
              <td
                colSpan={columnCount}
                className="text-muted-foreground py-12 text-center text-sm"
              >
                No tasks match these filters.
              </td>
            </tr>
          )}
          {paddingTop > 0 && (
            <tr aria-hidden>
              <td colSpan={columnCount} style={{ height: paddingTop }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const item = items[virtualRow.index];
            if (item.kind === "group") {
              return (
                <GroupBanner
                  key={groupKey(item.by, item.value)}
                  group={item}
                  index={virtualRow.index}
                  columnCount={columnCount}
                  measureRef={virtualizer.measureElement}
                  collapsed={isCollapsed(groupKey(item.by, item.value))}
                  onToggleCollapsed={toggleCollapsed}
                  completed={completed}
                  onList={onList}
                  requires={
                    item.by === "monster" ? gateReason(gates, item.value) : null
                  }
                  onAddManyToList={onAddManyToList}
                />
              );
            }
            const { row } = item;
            const task = row.original;
            return (
              <DraggableRow
                key={row.id}
                task={task}
                index={virtualRow.index}
                measureRef={virtualizer.measureElement}
                isCompleted={completed.has(task.wikiId)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={
                      WRAPS.has(cell.column.id)
                        ? "break-words whitespace-normal"
                        : undefined
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </DraggableRow>
            );
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden>
              <td colSpan={columnCount} style={{ height: paddingBottom }} />
            </tr>
          )}
        </TableBody>
      </table>
    </div>
  );
}
