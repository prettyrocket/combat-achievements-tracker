// Pivoting to a boss, and the search text that survives it.
//
// Every one of these writes through to the same TaskQuery, which is serialised
// to the URL -- there is no second copy of the view to drift out of sync. What
// this hook adds on top is the parked search: the pivot drops the search box on
// purpose (a leftover "vardorvis" would hide most of the rows the pivot just
// asked for), and dropping it silently is what made pivoting feel like losing
// your place. So the old text is kept here, and the breadcrumb offers it back.

import { useCallback, useState } from "react";
import {
  DEFAULT_SORT,
  addMonster,
  clearMonster,
  pivotToMonster,
  removeMonster,
} from "@/lib/task-query";
import type { SortKey, TaskQuery } from "@/lib/types";
import type { SetQuery } from "@/lib/use-task-query";

export interface MonsterFilter {
  /** Focus the view on one boss, replacing any others. */
  pivot: (monster: string) => void;
  /** Shift-click: add a boss alongside the ones already on screen. */
  addToPivot: (monster: string) => void;
  dropMonster: (monster: string) => void;
  /** The picker's one action: in if it's out, out if it's in. */
  toggleMonster: (monster: string) => void;
  unpivot: () => void;
  /** Search text the last pivot set aside, if any. */
  parkedSearch: string | null;
  restoreSearch: () => void;
  setSort: (sort: SortKey) => void;
  /** Clear every filter, and forget the parked search with them. */
  clearAll: () => void;
}

export function useMonsterFilter(
  query: TaskQuery,
  setQuery: SetQuery,
  clear: () => void,
): MonsterFilter {
  const [parkedSearch, setParkedSearch] = useState<string | null>(null);

  const pivot = useCallback(
    (monster: string) => {
      // Navigation, so it earns its own history entry rather than being folded
      // into whatever filtering came just before it.
      setQuery(pivotToMonster(query, monster), "push");
      setParkedSearch(query.q?.trim() || null);
    },
    [query, setQuery],
  );

  const addToPivot = useCallback(
    (monster: string) => {
      setQuery(addMonster(query, monster), "push");
      if (query.q?.trim()) setParkedSearch(query.q.trim());
    },
    [query, setQuery],
  );

  const dropMonster = useCallback(
    (monster: string) => setQuery(removeMonster(query, monster), "push"),
    [query, setQuery],
  );

  const toggleMonster = useCallback(
    (monster: string) => {
      const isOn = (query.monster ?? []).some(
        (m) => m.trim().toLowerCase() === monster.trim().toLowerCase(),
      );
      setQuery(
        isOn ? removeMonster(query, monster) : addMonster(query, monster),
        "push",
      );
      if (!isOn && query.q?.trim()) setParkedSearch(query.q.trim());
    },
    [query, setQuery],
  );

  const unpivot = useCallback(() => {
    setQuery(clearMonster(query), "push");
    setParkedSearch(null);
  }, [query, setQuery]);

  const restoreSearch = useCallback(() => {
    if (parkedSearch) setQuery({ ...query, q: parkedSearch }, "push");
    setParkedSearch(null);
  }, [parkedSearch, query, setQuery]);

  const setSort = useCallback(
    (sort: SortKey) =>
      setQuery({ ...query, sort: sort === DEFAULT_SORT ? undefined : sort }),
    [query, setQuery],
  );

  const clearAll = useCallback(() => {
    clear();
    setParkedSearch(null);
  }, [clear]);

  return {
    pivot,
    addToPivot,
    dropMonster,
    toggleMonster,
    unpivot,
    parkedSearch,
    restoreSearch,
    setSort,
    clearAll,
  };
}
