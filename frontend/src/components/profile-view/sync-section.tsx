// How progress gets here: the source you set up, how fresh it is, and the two
// things you'd do about it -- or, before anything is set up, the four doors.

import { LoaderCircle, PenLine, RefreshCw } from "lucide-react";
import type { QuickLoad } from "@/lib/quick-load";
import { LOAD_SOURCES, type LoadSourceId } from "@/lib/load-source";
import { syncedLabel } from "@/lib/runeprofile";
import { updatedLabel } from "@/lib/wiseoldman";
import type { SyncStatus } from "@/lib/sync-status";
import { useSyncStatus } from "@/lib/use-sync-status";
import { SourceCards, SourceLogo } from "@/components/source-cards";
import { Button } from "@/components/ui/button";

export interface SyncSectionProps {
  kind: QuickLoad;
  /** The remembered name, which a lookup looks up. */
  rsn: string | null;
  busy: boolean;
  /** The header's Load: sync again, or open the by-hand form. */
  onSync: () => void;
  /** The full Load dialog, on the remembered source. */
  onChange: () => void;
  /** The full Load dialog, on this source. */
  onPick: (source: LoadSourceId) => void;
}

/**
 * The freshness phrase, or null when there's nothing true to say.
 *
 * A lookup's own date rather than when this browser pulled it: last month's
 * upload synced this minute is still last month's numbers. A record from some
 * other source says nothing about this one, so it says nothing at all. Manual
 * has no source to ask, so its date is the last edit.
 */
function freshness(
  kind: Exclude<QuickLoad, "setup">,
  status: SyncStatus | null,
): string | null {
  if (status === null || status.source !== kind) return null;
  switch (kind) {
    case "runeprofile":
      return syncedLabel(status.dataAsOf ? new Date(status.dataAsOf) : null);
    case "wiseoldman":
      return updatedLabel(status.dataAsOf ? new Date(status.dataAsOf) : null);
    case "manual":
      return updatedLabel(new Date(status.syncedAt));
  }
}

export function SyncSection({
  kind,
  rsn,
  busy,
  onSync,
  onChange,
  onPick,
}: SyncSectionProps) {
  const { status } = useSyncStatus();

  return (
    <section aria-labelledby="sync-heading" className="w-full xl:max-w-5xl">
      <h2
        id="sync-heading"
        className="text-muted-foreground mb-2 text-sm font-medium"
      >
        How you sync
      </h2>

      {kind === "setup" ? (
        // One row once there's the width, so it stays a strip under the card
        // rather than a block that outweighs it.
        <SourceCards onPick={onPick} className="sm:grid-cols-4" />
      ) : (
        <SetUp
          kind={kind}
          rsn={rsn}
          busy={busy}
          freshness={freshness(kind, status)}
          onSync={onSync}
          onChange={onChange}
        />
      )}
    </section>
  );
}

function SetUp({
  kind,
  rsn,
  busy,
  freshness,
  onSync,
  onChange,
}: {
  kind: Exclude<QuickLoad, "setup">;
  rsn: string | null;
  busy: boolean;
  freshness: string | null;
  onSync: () => void;
  onChange: () => void;
}) {
  const label = LOAD_SOURCES.find((source) => source.id === kind)!.label;
  // Manual has no name to look up; the form is the whole of it.
  const name = kind === "manual" ? null : rsn;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border p-4">
      {/* The cards' tile, smaller: the same mark in the same frame, so this
          reads as the card you picked. */}
      <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-md">
        <SourceLogo
          source={kind}
          className={kind === "manual" ? "size-5" : "size-full"}
        />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {label}
          {name && (
            <>
              {" "}
              <span className="text-muted-foreground font-normal">·</span>{" "}
              {name}
            </>
          )}
        </p>
        {freshness && (
          <p className="text-muted-foreground text-xs">{freshness}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : kind === "manual" ? (
            <PenLine className="size-4" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          {kind === "manual" ? "Edit" : "Sync now"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onChange}>
          Change
        </Button>
      </div>
    </div>
  );
}
