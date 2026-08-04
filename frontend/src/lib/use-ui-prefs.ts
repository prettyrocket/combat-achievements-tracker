// The furniture: what was left open, what was left collapsed, and who this
// browser is tracking.
//
// UI state, not data, so each gets its own key and stays out of the export --
// restoring a backup shouldn't rearrange the furniture. Kept apart from the
// three stores for the same reason: nothing here is progress, and nothing here
// is worth an undo.

import { useCallback, useState } from "react";
import { readJson, writeJson } from "@/lib/local-store";

const PANEL_KEY = "ca-tracker:tasklist-open:v1";
const COMPACT_KEY = "ca-tracker:summary-compact:v1";
// The account the last WikiSync import came from, so a later import can tell
// whether the planned list beside it was built for this account or another.
const RSN_KEY = "ca-tracker:last-rsn:v1";

function storedFlag(key: string, fallback: boolean): boolean {
  const stored = readJson(key);
  return typeof stored === "boolean" ? stored : fallback;
}

/**
 * Whether the summary should start collapsed, for someone who has never said.
 *
 * Nothing above the table scrolls away any more, which is the point -- but it
 * also means the header block is charged to the table's height. On a short or
 * narrow window the six tier meters would leave a table two rows tall, so the
 * first impression there is the one-line form. Say otherwise once and that
 * choice is remembered.
 */
function compactByDefault(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 1024 || window.innerHeight < 900;
}

export interface UiPrefs {
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  compactSummary: boolean;
  setCompactSummary: (compact: boolean) => void;
  /** The account this browser tracks, or null before anything has been loaded. */
  lastRsn: string | null;
  /**
   * Set by an import, and also by simply typing the name into Load and closing
   * it -- saying who you are is saying who you are, whether or not anything was
   * fetched. It's what the different-account warning compares against, so a
   * player who enters levels by hand gets that protection too.
   */
  rememberRsn: (rsn: string) => void;
}

export function useUiPrefs(): UiPrefs {
  // Open by default: a plan you have to go and find is a plan you stop using.
  const [panelOpen, setPanelOpenState] = useState(() =>
    storedFlag(PANEL_KEY, true),
  );
  const [compactSummary, setCompactSummaryState] = useState(() =>
    storedFlag(COMPACT_KEY, compactByDefault()),
  );
  const [lastRsn, setLastRsn] = useState<string | null>(() => {
    const stored = readJson(RSN_KEY);
    return typeof stored === "string" && stored.trim() !== "" ? stored : null;
  });

  const setPanelOpen = useCallback((open: boolean) => {
    setPanelOpenState(open);
    writeJson(PANEL_KEY, open);
  }, []);

  const setCompactSummary = useCallback((compact: boolean) => {
    setCompactSummaryState(compact);
    writeJson(COMPACT_KEY, compact);
  }, []);

  const rememberRsn = useCallback((rsn: string) => {
    const name = rsn.replace(/_/g, " ").replace(/\s+/g, " ").trim();
    if (name === "") return;
    setLastRsn(name);
    writeJson(RSN_KEY, name);
  }, []);

  return {
    panelOpen,
    setPanelOpen,
    compactSummary,
    setCompactSummary,
    lastRsn,
    rememberRsn,
  };
}
