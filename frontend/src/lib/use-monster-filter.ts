// Filtering to a boss, and the search text that survives it.
//
// Every one of these writes through to the same TaskQuery, which is serialised
// to the URL -- there is no second copy of the view to drift out of sync. What
// this hook adds on top is the parked search: narrowing to a boss sets the
// search box aside on purpose (a leftover "vardorvis" would hide most of the
// rows you just asked for), and dropping it silently is what made this feel
// like losing your place. So the old text is kept here, and the breadcrumb
// offers it back.
//
// The one door in is `toggleMonster`, from the filter bar's picker and the
// breadcrumb. There were two more -- `pivot` and `addToPivot`, for clicking and
// shift-clicking a monster's name in the table -- until the name became a link
// to its wiki page instead.

import { useCallback, useState } from "react";
import {
  DEFAULT_SORT,
  addMonster,
  clearMonster,
  removeMonster,
} from "@/lib/task-query";
import type { SortKey, TaskQuery } from "@/lib/types";
import type { SetQuery } from "@/lib/use-task-query";

export interface MonsterFilter {
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
    dropMonster,
    toggleMonster,
    unpivot,
    parkedSearch,
    restoreSearch,
    setSort,
    clearAll,
  };
}
