// One flat list of banners and rows, and the collapse state that shapes it.
//
// Sorting by monster puts every Vorkath task together, but a flat list of 646
// rows doesn't *look* like it did anything -- the runs are only visible if you
// read the column. A banner row per monster makes the grouping the shape of the
// table rather than a property of one column.
//
// Flattened into the same list the virtualiser counts, so a banner scrolls,
// measures and windows exactly like a row. The alternative -- rendering banners
// outside the virtual window -- puts all 89 of them in the DOM at once, which is
// most of what windowing was added to avoid.

import { useCallback, useMemo, useState } from "react";
import type { Row } from "@tanstack/react-table";
import type { SortKey, TaskRow } from "@/lib/types";

/** One monster's banner, and the tasks under it, in one flat virtualised list. */
export interface GroupItem {
  kind: "group";
  monster: string | null;
  /** Every task under this banner, collapsed or not -- what "add all" adds. */
  wikiIds: number[];
}

export type RowItem = GroupItem | { kind: "row"; row: Row<TaskRow> };

/**
 * `null` is a real value here -- tasks with no monster group under "Any monster"
 * like everything else -- so the key is prefixed rather than relying on a
 * sentinel string no monster could be called.
 */
export function groupKey(monster: string | null): string {
  return monster === null ? "any:" : `monster:${monster}`;
}

export interface RowItems {
  items: RowItem[];
  /** Whether a given monster's banner is currently collapsed. */
  isCollapsed: (monster: string | null) => boolean;
  toggleCollapsed: (monster: string | null) => void;
}

export function useRowItems(
  rows: readonly Row<TaskRow>[],
  sort: SortKey,
): RowItems {
  const grouped = sort === "monster_asc" || sort === "monster_desc";

  // Keyed by monster rather than by position, so collapsing Vorkath and then
  // filtering or re-sorting leaves Vorkath collapsed instead of whatever now
  // happens to sit where it was.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const toggleCollapsed = useCallback((monster: string | null) => {
    setCollapsed((current) => {
      const next = new Set(current);
      const key = groupKey(monster);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (monster: string | null) => collapsed.has(groupKey(monster)),
    [collapsed],
  );

  const items = useMemo<RowItem[]>(() => {
    if (!grouped) return rows.map((row) => ({ kind: "row", row }));
    const out: RowItem[] = [];
    let open: GroupItem | null = null;
    let hidden = false;
    for (const row of rows) {
      const { monster } = row.original;
      if (open === null || open.monster !== monster) {
        open = { kind: "group", monster, wikiIds: [] };
        hidden = collapsed.has(groupKey(monster));
        out.push(open);
      }
      // Collected either way: a collapsed group still knows what's under it,
      // which is what lets "add all" work without expanding it first.
      open.wikiIds.push(row.original.wikiId);
      if (!hidden) out.push({ kind: "row", row });
    }
    return out;
  }, [rows, grouped, collapsed]);

  return { items, isCollapsed, toggleCollapsed };
}
