// One flat list of banners and rows, and the collapse state that shapes it.
//
// Grouping puts every Vorkath task together (or every Elite, or every Speed
// task), but a flat list of 646 rows doesn't *look* like it did anything -- the
// runs are only visible if you read the column. A banner row per value makes the
// grouping the shape of the table rather than a property of one column.
//
// Flattened into the same list the virtualiser counts, so a banner scrolls,
// measures and windows exactly like a row. The alternative -- rendering banners
// outside the virtual window -- puts all 89 of them in the DOM at once, which is
// most of what windowing was added to avoid.

import { useCallback, useMemo, useState } from "react";
import type { Row } from "@tanstack/react-table";
import type { GroupKey, TaskRow } from "@/lib/types";

/** One group's banner, and the tasks under it, in one flat virtualised list. */
export interface GroupItem {
  kind: "group";
  by: GroupKey;
  /** The column's value for every task under the banner; null only for monster. */
  value: string | null;
  /** Every task under this banner, collapsed or not -- what "add all" adds. */
  wikiIds: number[];
}

export type RowItem = GroupItem | { kind: "row"; row: Row<TaskRow> };

/**
 * `null` is a real value here -- tasks with no monster group under "Any monster"
 * like everything else -- so the key is prefixed rather than relying on a
 * sentinel string no monster could be called. Prefixed by column too, so a
 * collapsed "Hard" tier can't be confused with anything grouping by type.
 */
export function groupKey(by: GroupKey, value: string | null): string {
  return value === null ? `${by}:any:` : `${by}:${value}`;
}

export interface RowItems {
  items: RowItem[];
  /** Whether a given group's banner is currently collapsed. */
  isCollapsed: (key: string) => boolean;
  toggleCollapsed: (key: string) => void;
}

export function useRowItems(
  rows: readonly Row<TaskRow>[],
  group: GroupKey | undefined,
): RowItems {
  // Keyed by value rather than by position, so collapsing Vorkath and then
  // filtering or re-sorting leaves Vorkath collapsed instead of whatever now
  // happens to sit where it was.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const toggleCollapsed = useCallback((key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (key: string) => collapsed.has(key),
    [collapsed],
  );

  const items = useMemo<RowItem[]>(() => {
    if (!group) return rows.map((row) => ({ kind: "row", row }));
    const out: RowItem[] = [];
    let open: GroupItem | null = null;
    let hidden = false;
    for (const row of rows) {
      const value = row.original[group];
      if (open === null || open.value !== value) {
        open = { kind: "group", by: group, value, wikiIds: [] };
        hidden = collapsed.has(groupKey(group, value));
        out.push(open);
      }
      // Collected either way: a collapsed group still knows what's under it,
      // which is what lets "add all" work without expanding it first.
      open.wikiIds.push(row.original.wikiId);
      if (!hidden) out.push({ kind: "row", row });
    }
    return out;
  }, [rows, group, collapsed]);

  return { items, isCollapsed, toggleCollapsed };
}
