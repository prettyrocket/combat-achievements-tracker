// The furniture: what was left open, what was left collapsed, whether the
// checkboxes are there at all, and who this browser is tracking.
//
// UI state, not data, so each gets its own key and stays out of the export --
// restoring a backup shouldn't rearrange the furniture. Kept apart from the
// three stores for the same reason: nothing here is progress, and nothing here
// is worth an undo.

import { useCallback, useState } from "react";
import { readJson, writeJson } from "@/lib/local-store";
import { fromAnAccount, type ProgressSource } from "@/lib/progress-store";

const PANEL_KEY = "ca-tracker:tasklist-open:v1";
const COMPACT_KEY = "ca-tracker:summary-compact:v1";
const MANUAL_TRACKING_KEY = "ca-tracker:manual-tracking:v1";
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

/**
 * The sticky rule, in one place: your answer if you have given one, and where
 * progress came from if you haven't.
 *
 * `null` is a third state and not the same as false. Until you say, the answer
 * follows the source -- import from an account and the checkboxes go, because
 * ticking a box the next import will overwrite is an invitation to lose your
 * own edit. Say it once, either way, and it sticks through every later import.
 * The alternative silently undoes a choice you made, and you would have no way
 * of knowing which import did it.
 *
 * Pure and exported so the rule can be tested without mounting anything --
 * everything else in this file is React furniture.
 */
export function resolveManualTracking(
  chosen: boolean | null,
  source: ProgressSource,
): boolean {
  return chosen ?? !fromAnAccount(source);
}

export interface UiPrefs {
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  compactSummary: boolean;
  setCompactSummary: (compact: boolean) => void;
  /**
   * Whether the checkboxes are there at all.
   *
   * On unless an account is already keeping the answers -- see below for why
   * that's a default rather than a rule.
   */
  manualTracking: boolean;
  setManualTracking: (allowed: boolean) => void;
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

export function useUiPrefs(progressSource: ProgressSource): UiPrefs {
  // Open by default: a plan you have to go and find is a plan you stop using.
  const [panelOpen, setPanelOpenState] = useState(() =>
    storedFlag(PANEL_KEY, true),
  );
  const [compactSummary, setCompactSummaryState] = useState(() =>
    storedFlag(COMPACT_KEY, compactByDefault()),
  );
  // `null` means never answered -- see resolveManualTracking for what that buys.
  const [chosenManualTracking, setChosenManualTracking] = useState<
    boolean | null
  >(() => {
    const stored = readJson(MANUAL_TRACKING_KEY);
    return typeof stored === "boolean" ? stored : null;
  });

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

  const setManualTracking = useCallback((allowed: boolean) => {
    setChosenManualTracking(allowed);
    writeJson(MANUAL_TRACKING_KEY, allowed);
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
    manualTracking: resolveManualTracking(chosenManualTracking, progressSource),
    setManualTracking,
    lastRsn,
    rememberRsn,
  };
}
