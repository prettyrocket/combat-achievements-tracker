// React binding for view.ts. The URL is the source of truth, as it is for the
// filters (use-task-query.ts), so back and forward move between screens.

import { useCallback, useEffect, useState } from "react";
import { parseView, toUrl, withView, type View } from "@/lib/view";

function currentView(): View {
  if (typeof window === "undefined") return "table";
  return parseView(new URLSearchParams(window.location.search));
}

export interface UseView {
  view: View;
  setView: (view: View) => void;
}

export function useView(): UseView {
  const [view, setViewState] = useState<View>(currentView);

  useEffect(() => {
    const onPopState = () => setViewState(currentView());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Always a push: changing screens is navigating somewhere, and Back should
  // take you back to the one you left.
  const setView = useCallback((next: View) => {
    setViewState(next);
    const { pathname, search, hash } = window.location;
    const params = withView(new URLSearchParams(search), next);
    window.history.pushState(null, "", toUrl(pathname, params, hash));
  }, []);

  return { view, setView };
}
