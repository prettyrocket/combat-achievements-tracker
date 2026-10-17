// Profile with nothing to show: no source set up and nothing ticked.
//
// The welcome dialog's question again, on the page -- a progress screen with
// no progress has nothing to say but how to get some. The way out goes to the
// catalog, where planning doesn't need any of it.

import { Table2 } from "lucide-react";
import type { LoadSourceId } from "@/lib/load-source";
import { SourceCards } from "@/components/source-cards";
import { Button } from "@/components/ui/button";

export function ProfileEmpty({
  onPick,
  onBrowse,
}: {
  /** The full Load dialog, on this source. */
  onPick: (source: LoadSourceId) => void;
  /** Off to the catalog. */
  onBrowse: () => void;
}) {
  return (
    <section
      aria-labelledby="profile-empty-heading"
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-8"
    >
      <h2
        id="profile-empty-heading"
        className="text-center text-2xl font-semibold tracking-tight"
      >
        Would you like to sync your progress?
      </h2>

      <SourceCards onPick={onPick} />

      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="text-muted-foreground text-sm">
          or start planning right away
        </span>
        <Button variant="outline" onClick={onBrowse}>
          <Table2 aria-hidden />
          Catalog
        </Button>
      </div>
    </section>
  );
}
