// Whose progress this is and how it gets here: the name, the kind of account,
// the source you set up and how fresh it is, and the two things you'd do about
// it -- or, before anything is set up, the four doors.

import { LoaderCircle, PenLine, RefreshCw } from "lucide-react";
import { ACCOUNT_TYPE_LABEL } from "@/lib/account-type";
import { LOAD_SOURCES, type LoadSourceId } from "@/lib/load-source";
import type { QuickLoad } from "@/lib/quick-load";
import { syncedLabel } from "@/lib/runeprofile";
import type { SyncStatus } from "@/lib/sync-status";
import { useAccountType } from "@/lib/use-account-type";
import { useSyncStatus } from "@/lib/use-sync-status";
import { updatedLabel } from "@/lib/wiseoldman";
import { SourceCards, SourceLogo } from "@/components/source-cards";
import { Button } from "@/components/ui/button";

export interface SummaryCardProps {
  kind: QuickLoad;
  /** Whose progress this is, or null before anything has been loaded. */
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

export function SummaryCard({
  kind,
  rsn,
  busy,
  onSync,
  onChange,
  onPick,
}: SummaryCardProps) {
  const { status } = useSyncStatus();
  const accountType = useAccountType(rsn);

  if (kind === "setup") {
    return (
      // Across both columns: the four cards want a row of their own.
      <section
        aria-label="Account"
        className="rounded-lg border p-4 md:col-span-2"
      >
        {rsn && <h2 className="mb-3 text-lg font-semibold">{rsn}</h2>}
        <SourceCards onPick={onPick} className="sm:grid-cols-4" />
      </section>
    );
  }

  const label = LOAD_SOURCES.find((source) => source.id === kind)!.label;
  const fresh = freshness(kind, status);

  return (
    <section
      aria-label="Account"
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      {/* Manual with no name has nobody to name, and the source row below
          already says Manual. The type only ever comes with a name. */}
      {rsn && (
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{rsn}</h2>
          {accountType && (
            <p className="text-muted-foreground text-sm">
              {ACCOUNT_TYPE_LABEL[accountType]}
            </p>
          )}
        </div>
      )}

      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-3 ${rsn ? "border-t pt-3.5" : ""}`}
      >
        {/* The cards' tile, smaller: the same mark in the same frame, so this
            reads as the card you picked. */}
        <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-md">
          <SourceLogo
            source={kind}
            className={kind === "manual" ? "size-4" : "size-full"}
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          {fresh && <p className="text-muted-foreground text-xs">{fresh}</p>}
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
    </section>
  );
}
