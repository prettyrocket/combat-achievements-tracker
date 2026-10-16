// Keeps the filter state in the query string.
//
// The URL is the single source of truth rather than a mirror of component state:
// that's what makes a filtered view shareable, and it means back/forward work
// without any extra bookkeeping.

import { useCallback, useEffect, useRef, useState } from "react";
import { parseQuery, serializeQuery } from "@/lib/task-query";
import type { TaskQuery } from "@/lib/types";
import { carryView, toUrl } from "@/lib/view";

function currentQuery(): TaskQuery {
  if (typeof window === "undefined") return {};
  return parseQuery(new URLSearchParams(window.location.search));
}

/**
 * How a change should show up in history.
 *
 * `coalesce` is the default and the reason this exists: one history entry per
 * keystroke made Back a chore -- eight presses to escape "vardorvis" -- while
 * one entry per *session of fiddling* still lets Back undo a filter you regret.
 * Changes that land within COALESCE_MS of the last one overwrite it instead of
 * stacking. `push` is for changes you have navigated somewhere with, `replace`
 * for ones nobody would ever want to step back through.
 */
export type HistoryMode = "push" | "replace" | "coalesce";

/** Long enough to swallow a burst of typing, short enough that two deliberate
 *  clicks stay two entries. */
const COALESCE_MS = 800;

/** Named because the monster filter takes one as a parameter. */
export type SetQuery = (next: TaskQuery, mode?: HistoryMode) => void;

export interface UseTaskQuery {
  query: TaskQuery;
  setQuery: SetQuery;
  clear: () => void;
}

export function useTaskQuery(): UseTaskQuery {
  const [query, setQueryState] = useState<TaskQuery>(currentQuery);
  const lastWrite = useRef(0);

  // Back/forward move through filter states, so they have to be listened for --
  // popstate doesn't fire for our own pushState calls, only for navigation.
  useEffect(() => {
    const onPopState = () => setQueryState(currentQuery());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setQuery = useCallback(
    (next: TaskQuery, mode: HistoryMode = "coalesce") => {
      setQueryState(next);

      // Keep the path and hash; only the filters are ours to rewrite. The view
      // shares the search with them, so it's carried across (view.ts).
      const { pathname, search, hash } = window.location;
      const params = carryView(
        serializeQuery(next),
        new URLSearchParams(search),
      );
      const url = toUrl(pathname, params, hash);

      const now = Date.now();
      const push =
        mode === "push" ||
        (mode === "coalesce" && now - lastWrite.current > COALESCE_MS);
      lastWrite.current = now;

      if (push) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [],
  );

  // Somewhere worth coming back from, always.
  const clear = useCallback(() => setQuery({}, "push"), [setQuery]);

  return { query, setQuery, clear };
}
