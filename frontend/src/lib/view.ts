// Which screen you are on, kept in the query string as `?view=`.
//
// A param rather than a path: Pages has no SPA fallback, so a path a reload
// can't find is a 404. The table is the default and so has no param at all --
// every link written before this existed still lands where it used to.

export type View = "table" | "list" | "profile";

const VIEWS: readonly View[] = ["table", "list", "profile"];

export const VIEW_PARAM = "view";

export function parseView(params: URLSearchParams): View {
  const value = params.get(VIEW_PARAM);
  return VIEWS.find((view) => view === value) ?? "table";
}

/** Sets or clears the view on a copy of `params`, leaving the rest alone. */
export function withView(params: URLSearchParams, view: View): URLSearchParams {
  const next = new URLSearchParams(params);
  if (view === "table") next.delete(VIEW_PARAM);
  else next.set(VIEW_PARAM, view);
  return next;
}

/**
 * Copies the view from `from` onto `params`. For a writer that rebuilds the
 * query string from its own state, which would otherwise drop it.
 */
export function carryView(
  params: URLSearchParams,
  from: URLSearchParams,
): URLSearchParams {
  return withView(params, parseView(from));
}

/** `?query#hash` for `pathname`, without a lone "?" when there is no query. */
export function toUrl(
  pathname: string,
  params: URLSearchParams,
  hash: string,
): string {
  const search = params.toString();
  return search ? `${pathname}?${search}${hash}` : `${pathname}${hash}`;
}
