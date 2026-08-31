// The report on something that just happened, and then gone.
//
// It used to be a line of text under the toolbar buttons, which had two
// problems. It appeared and disappeared inside the layout, so confirming an
// export nudged everything under it down a row; and it stayed until the next
// act replaced it, so "Exported 82 completed tasks." was still sitting there
// twenty minutes later describing something you had long since finished
// thinking about.
//
// So: over the corner, for a while. Long enough to read at a glance, gone
// without being asked, and closable the moment you have read it.

import { useEffect } from "react";
import { X } from "lucide-react";
import type { Notice } from "@/lib/notice";

/**
 * How long each tone stays.
 *
 * An error gets twice as long because it is twice the reading -- it usually
 * names a file or a reason -- and because missing a confirmation costs nothing
 * while missing a failure means wondering later why the import did nothing.
 * Neither waits for a click: nothing here is a question, and a report that needs
 * dismissing is a report that outstays the thing it reported on.
 */
const LINGER: Record<Notice["tone"], number> = {
  ok: 5000,
  error: 10000,
};

export function Toast({
  notice,
  onDismiss,
}: {
  notice: Notice | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(onDismiss, LINGER[notice.tone]);
    // Cleared on the way out, so a second export arriving before the first has
    // faded restarts the clock rather than inheriting what was left of it --
    // every notice is a fresh object, so this effect runs again for each one.
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);

  if (notice === null) return null;

  const failed = notice.tone === "error";

  return (
    <div
      // Assertive for a failure, polite for a confirmation: one interrupts what
      // a screen reader is saying, the other waits its turn, and that is the
      // difference between the two messages.
      role={failed ? "alert" : "status"}
      aria-live={failed ? "assertive" : "polite"}
      // Above the dialogs: an import can finish after its own dialog has closed,
      // but a copied link or a failed read can also land while one is still
      // open, and a report behind the thing it is reporting on is no report.
      className={`animate-in fade-in slide-in-from-bottom-2 fixed right-4 bottom-4 z-[60] flex max-w-sm items-start gap-3 rounded-lg border px-3 py-2 text-sm shadow-lg duration-200 ${
        failed
          ? "border-red-500/30 bg-red-500/10 text-red-400"
          : "bg-popover text-popover-foreground"
      }`}
    >
      <p className="min-w-0 flex-1">{notice.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className={`-mr-1 shrink-0 rounded p-0.5 transition-colors ${
          failed
            ? "hover:bg-red-500/15"
            : "text-muted-foreground hover:bg-muted"
        }`}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
