// The Wise Old Man pane.
//
// The only source here that needs nothing installed: WOM mirrors the official
// hiscores, which carry every skill level, so a name is the whole input. The
// hiscores send no CORS header of their own, which is why this goes through WOM
// rather than straight to Jagex (see lib/wiseoldman.ts).
//
// Levels only, and that shapes the pane. There are no achievements to diff and
// no plan to threaten, so the footer says how many levels it found rather than
// what it will take away, and the quest checklist stays somebody else's job --
// the hiscores have never heard of a quest.

import { useEffect, useRef, useState } from "react";
import {
  fetchWomLevels,
  updatedLabel,
  WISE_OLD_MAN_URL,
  WomLookupError,
  type WomLookup,
} from "@/lib/wiseoldman";
import {
  Carries,
  FoundAccount,
  ImportFooter,
  LookUpButton,
} from "@/components/load/pane-parts";

export interface WiseOldManPanelProps {
  /** Owned by the dialog: who this browser is tracking, not this pane's input. */
  rsn: string;
  /** Replaces every level, leaving quests alone -- this source has none. */
  onApply: (levels: Record<string, number>) => void;
  onFinished: (remember: boolean) => void;
}

export function WiseOldManPanel({
  rsn,
  onApply,
  onFinished,
}: WiseOldManPanelProps) {
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<WomLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  // Editing the name invalidates the last result. Runs on mount too, harmlessly.
  useEffect(() => {
    setFound(null);
    setError(null);
  }, [rsn]);

  async function run() {
    if (busy || rsn.trim() === "") return;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setBusy(true);
    setError(null);
    setFound(null);
    try {
      // Found, not applied. Every other pane previews before it writes, and a
      // lookup that silently overwrote levels the moment it resolved was the
      // one thing in the old dialog that didn't ask first.
      setFound(await fetchWomLevels(rsn, controller.signal));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(
        err instanceof WomLookupError
          ? err.message
          : "That lookup failed. Try again in a moment.",
      );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const stale = found === null ? null : updatedLabel(found.updatedAt);
  const count = found === null ? 0 : Object.keys(found.levels).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <p className="text-muted-foreground text-sm">
          Lookup skill levels on{" "}
          <a
            href={WISE_OLD_MAN_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground font-medium underline underline-offset-2"
          >
            Wise Old Man
          </a>
          .
        </p>

        <LookUpButton
          busy={busy}
          disabled={rsn.trim() === ""}
          onClick={() => void run()}
        />

        {/* The date matters here more than anywhere: WOM holds whatever
            snapshot was last taken, and somebody who trained since then should
            see why the number is old rather than distrust the requirement
            filter. */}
        {found && (
          <FoundAccount
            displayName={found.displayName}
            accountType={found.accountType}
            updated={stale}
          >
            <Carries name={found.displayName} quests={false} />
          </FoundAccount>
        )}
      </div>

      <ImportFooter
        status={
          error ??
          (found === null ? null : (
            <>
              This will set{" "}
              <span className="font-semibold text-emerald-400">
                {count} levels
              </span>{" "}
              from {found.displayName}.
            </>
          ))
        }
        tone={error === null ? "text-foreground" : "text-red-400"}
        alert={error !== null}
        label="Import"
        disabled={found === null}
        variant={found === null ? "default" : "success"}
        onApply={() => {
          if (!found) return;
          onApply(found.levels);
          onFinished(true);
        }}
      />
    </div>
  );
}
