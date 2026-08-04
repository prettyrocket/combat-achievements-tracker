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

import { useMemo, useRef } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { gateReason, type GateCheck } from "@/lib/requirements";
import type { SortKey, TaskRow } from "@/lib/types";
import { buildColumns, type TableMeta } from "@/components/task-table/columns";
import { DraggableRow } from "@/components/task-table/draggable-row";
import { GroupBanner } from "@/components/task-table/group-banner";
import { SortableHead } from "@/components/task-table/sortable-head";
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
  /** Current sort, for the header arrows. */
  sort: SortKey;
  onSortChange: (next: SortKey) => void;
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

  const { items, isCollapsed, toggleCollapsed } = useRowItems(rows, sort);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => viewportRef.current,
    // A one-line row; anything taller is measured for real once it mounts.
    estimateSize: () => 45,
    // Enough rows above and below to survive a flick of the wheel without a
    // visible gap, and few enough that a tick stays cheap.
    overscan: 12,
  });

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
      <table className="w-full caption-bottom text-sm">
        <TableHeader className="bg-background sticky top-0 z-10 [&_tr]:border-b-0">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => (
                <TableHead key={header.id} className="border-b">
                  <SortableHead
                    header={header}
                    sort={sort}
                    onSortChange={onSortChange}
                  />
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
            const item = items[virtualRow.index];
            if (item.kind === "group") {
              return (
                <GroupBanner
                  key={groupKey(item.monster)}
                  group={item}
                  index={virtualRow.index}
                  columnCount={columnCount}
                  measureRef={virtualizer.measureElement}
                  collapsed={isCollapsed(item.monster)}
                  onToggleCollapsed={toggleCollapsed}
                  completed={completed}
                  onList={onList}
                  requires={gateReason(gates, item.monster)}
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
                // The third door onto the plan, after the row's button and the
                // banner's. A gate that stops the other two has to stop this
                // one, or the lock is a suggestion.
                locked={
                  !onList.has(task.wikiId) &&
                  gateReason(gates, task.monster) !== null
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
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
