// The half of an import that is the same whatever door it came through.
//
// WikiSync and RuneProfile fetch differently and fail differently, but once
// they have a list of ids the rest is identical: diff it against what's ticked,
// make a removal take two clicks, offer to drop a plan built for another
// account, and word the button accordingly. That was duplicated across two
// dialogs before this existed; now it is written down once and the panels only
// own the part that is genuinely theirs.
//
// Errors deliberately stay outside. A paste with no CA field and a profile that
// predates per-task storage are different problems with different fixes, and
// flattening them into one "error" string is how a panel ends up apologising
// for something it could have told you how to solve.

import { useCallback, useState, type ReactNode } from "react";
import {
  diffAgainst,
  diffIsNoop,
  sameAccount,
  type WikiSyncDiff,
} from "@/lib/wikisync";
import type { PlayerProfile } from "@/lib/requirements";

/** The three things every import produces, whatever fetched them. */
export interface ImportPayload {
  ids: number[];
  dropped: number;
  profile: PlayerProfile | null;
}

export interface ImportFlowOptions {
  completed: ReadonlySet<number>;
  listCount: number;
  lastRsn: string | null;
  onApply: (
    ids: number[],
    rsn: string,
    clearList: boolean,
    profile: PlayerProfile | null,
  ) => void;
  /** Called once an import actually lands, so the rail can remember this door. */
  onApplied?: () => void;
}

const TAKES = "font-semibold text-red-400";

/** Spelled out at one, where a numeral beside a singular noun reads oddly. */
function word(value: number) {
  return value === 1 ? "one" : String(value);
}

export interface ImportFlow {
  diff: WikiSyncDiff | null;
  clearList: boolean;
  setClearList: (next: boolean) => void;
  /** Whether the plan on screen was built while syncing somebody else. */
  differentAccount: (rsn: string) => boolean;
  /** Hand over a successful read; returns the diff it produced. */
  read: (payload: ImportPayload) => void;
  /** Forget the last read -- a new name, a new paste, a closed dialog. */
  clear: () => void;
  /** Two clicks when something is about to be un-ticked, one otherwise. */
  apply: (rsn: string, payload: ImportPayload) => void;
  /** The sentence beside the button, or null when there's nothing to say. */
  status: (rsn: string) => ReactNode;
  label: (rsn: string) => string;
  disabled: (rsn: string) => boolean;
  variant: (rsn: string) => "default" | "success" | "destructive";
  /**
   * The status line's colour, for a read that succeeded.
   *
   * Panes still own their *errors* -- a paste with no CA field and a profile
   * that predates per-task storage want different colours and different words.
   * What they don't own is this: green when something is actually landing,
   * plain otherwise. Both wrote the same ternary before it lived here.
   */
  tone: (rsn: string) => string;
}

export function useImportFlow({
  completed,
  listCount,
  lastRsn,
  onApply,
  onApplied,
}: ImportFlowOptions): ImportFlow {
  const [diff, setDiff] = useState<WikiSyncDiff | null>(null);
  const [clearList, setClearList] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const differentAccount = useCallback(
    (rsn: string) =>
      lastRsn !== null &&
      rsn.trim() !== "" &&
      !sameAccount(rsn, lastRsn) &&
      listCount > 0,
    [lastRsn, listCount],
  );

  const read = useCallback(
    (payload: ImportPayload) => {
      // An armed destructive apply belongs to one specific diff. A new read has
      // to be looked at and armed again.
      setConfirming(false);
      setDiff(diffAgainst(payload, completed));
    },
    [completed],
  );

  const clear = useCallback(() => {
    setDiff(null);
    setConfirming(false);
    // Never inherited: throwing away a plan is a decision made once, about one
    // import, not a preference the dialog keeps on your behalf.
    setClearList(false);
  }, []);

  const apply = useCallback(
    (rsn: string, payload: ImportPayload) => {
      if (!diff) return;
      if (diff.removed.length > 0 && !confirming) {
        setConfirming(true);
        return;
      }
      onApply(
        [...diff.newlyCompleted, ...diff.alreadyCompleted],
        rsn,
        differentAccount(rsn) && clearList,
        payload.profile,
      );
      onApplied?.();
    },
    [diff, confirming, clearList, differentAccount, onApply, onApplied],
  );

  const status = useCallback(
    (rsn: string): ReactNode => {
      if (!diff) return null;

      // What an import does is said once, up beside what it brings, rather
      // than again down here -- see ImportSummary. The footer is left with the
      // two things that aren't about the profile at all.
      if (!diffIsNoop(diff)) return null;

      // The plan is not the profile. Throwing it away is its own destructive
      // act, and the overwrite sentence doesn't cover it.
      if (differentAccount(rsn) && clearList) {
        return (
          <>
            This will{" "}
            <span className={TAKES}>clear your {word(listCount)}</span> planned
            task
            {listCount === 1 ? "" : "s"}.
          </>
        );
      }
      return (
        <>
          <span aria-hidden>✅</span> Already up to date.
        </>
      );
    },
    [diff, clearList, differentAccount, listCount],
  );

  const label = useCallback(
    (rsn: string) => {
      if (!diff) return "Import";
      if (diff.removed.length > 0) return confirming ? "Confirm" : "Replace";
      if (diffIsNoop(diff))
        return differentAccount(rsn) && clearList ? "Clear" : "Import";
      return "Import";
    },
    [diff, confirming, clearList, differentAccount],
  );

  const disabled = useCallback(
    (rsn: string) =>
      diff === null ||
      (diffIsNoop(diff) && !(differentAccount(rsn) && clearList)),
    [diff, clearList, differentAccount],
  );

  const variant = useCallback(
    (rsn: string): "default" | "success" | "destructive" => {
      if (!diff) return "default";
      if (diff.removed.length > 0 || (differentAccount(rsn) && clearList))
        return "destructive";
      return diff.newlyCompleted.length > 0 ? "success" : "default";
    },
    [diff, clearList, differentAccount],
  );

  const tone = useCallback(
    (rsn: string) => {
      if (diff === null) return "";
      return variant(rsn) === "default"
        ? "text-emerald-400"
        : "text-foreground";
    },
    [diff, variant],
  );

  return {
    diff,
    clearList,
    setClearList: (next: boolean) => {
      setClearList(next);
      // Changes what the armed button would do, so make it be read again.
      setConfirming(false);
    },
    differentAccount,
    read,
    clear,
    apply,
    status,
    label,
    disabled,
    variant,
    tone,
  };
}
