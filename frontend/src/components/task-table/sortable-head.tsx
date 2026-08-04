import { flexRender, type Header } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { SortKey, TaskRow } from "@/lib/types";
import {
  COLUMN_SORT,
  sortDirection,
  type SortDirection,
} from "@/lib/task-query";

const DIRECTION_ICON = { asc: ArrowUp, desc: ArrowDown } as const;

/** A header that sorts on click and flips direction on the second click. */
export function SortableHead({
  header,
  sort,
  onSortChange,
}: {
  header: Header<TaskRow, unknown>;
  sort: SortKey;
  onSortChange: (next: SortKey) => void;
}) {
  // Widened from the per-column tuple: every column has its own literal pair, and
  // the union of those has no member in common for `includes` to accept.
  const pair = COLUMN_SORT[header.column.id as keyof typeof COLUMN_SORT] as
    readonly [SortKey, SortKey] | undefined;
  const label = flexRender(header.column.columnDef.header, header.getContext());

  // The two checkbox columns have no sort of their own -- their headers are
  // screen-reader labels, not controls.
  if (!pair) return <>{label}</>;

  const active: SortDirection | null = pair.includes(sort)
    ? sortDirection(sort)
    : null;
  // Second click flips; arriving from another column starts in this column's
  // natural direction -- descending for percentages, ascending for names.
  const next = active === null ? pair[0] : pair[0] === sort ? pair[1] : pair[0];
  const Icon = active === null ? ChevronsUpDown : DIRECTION_ICON[active];

  return (
    <button
      type="button"
      onClick={() => onSortChange(next)}
      aria-label={`Sort by ${header.column.id}`}
      className={`hover:text-foreground -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      {label}
      <Icon className={`size-3.5 ${active ? "" : "opacity-40"}`} aria-hidden />
    </button>
  );
}
