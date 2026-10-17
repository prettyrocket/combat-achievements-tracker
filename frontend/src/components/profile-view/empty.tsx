// Profile with nothing to show: no source set up and nothing ticked.
//
// The welcome dialog's question again, on the page -- a progress screen with
// no progress has nothing to say but how to get some. The way out goes to the
// catalog, where planning doesn't need any of it.

import { ArrowRight } from "lucide-react";
import type { LoadSourceId } from "@/lib/load-source";
import { SourceCards } from "@/components/source-cards";

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
        Sync your progress to get started
      </h2>

      <SourceCards onPick={onPick} />

      <p className="text-muted-foreground text-center text-sm">
        or start planning right away.{" "}
        <button
          type="button"
          onClick={onBrowse}
          className="text-foreground inline-flex items-center gap-1 decoration-muted-foreground hover:decoration-foreground focus-visible:decoration-foreground font-medium underline underline-offset-4 focus-visible:outline-none"
        >
          Go to the catalog
          <ArrowRight className="size-3.5" aria-hidden />
        </button>
      </p>
    </section>
  );
}
