// The furniture the five Load panes share.
//
// Everything here is used by a pane, never by the dialog around them -- that
// distinction is the file's whole reason for existing, and it earned the name
// the hard way. This started as import-footer.tsx holding one footer, then
// accreted a warning, a step list, a lookup button and for a while the name
// field, by which point it was a drawer with a misleading label. The name field
// went to name-row.tsx, where it belongs, because it was the one thing in here
// the dialog rendered rather than a pane.
//
// Nothing here holds state. Panes own their own flow; these just make five of
// them look like one app.

import type { ReactNode } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogClose } from "@/components/ui/dialog";

/**
 * The bottom of every pane, so five flows end in the same shape.
 *
 * One sentence and one button. The sentence is the only place that says what
 * applying will do, which is why every pane writes into it rather than growing
 * a panel of its own above the fold -- there is a single place to look, and it
 * is next to the thing that does it.
 */
export interface ImportFooterProps {
  /** What applying would do, or what went wrong. Null shows nothing. */
  status: ReactNode;
  /** Tailwind text colour for the status line. */
  tone?: string;
  /** Failures announce; everything else merely updates. */
  alert?: boolean;
  label: string;
  disabled?: boolean;
  variant?: "default" | "success" | "destructive";
  onApply: () => void;
}

export function ImportFooter({
  status,
  tone = "",
  alert = false,
  label,
  disabled = false,
  variant = "default",
  onApply,
}: ImportFooterProps) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
      {/* alert for a failure, status otherwise: one is news that interrupts,
          the other is confirmation of something you just asked for. */}
      <p
        role={alert ? "alert" : "status"}
        className={`text-xs leading-snug text-balance sm:flex-1 sm:pr-2 ${tone}`}
      >
        {status}
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:shrink-0">
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button onClick={onApply} disabled={disabled} variant={variant}>
          {label}
        </Button>
      </div>
    </div>
  );
}

/**
 * Who a lookup found, above what it carries.
 *
 * Both fetching panes render this identically -- name, account type when it
 * isn't a regular account, and how old the data is -- so the two of them can't
 * drift apart on which of those is worth a badge. What the import carries
 * differs per source, and comes in as children.
 */
export function FoundAccount({
  displayName,
  accountType,
  updated,
  children,
}: {
  displayName: string;
  accountType: string | null;
  /** How stale the source's snapshot is, or null when it doesn't say. */
  updated: string | null;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1 text-sm">
      <p>
        <span className="font-medium">{displayName}</span>
        {accountType !== null && accountType !== "regular" && (
          <span className="text-muted-foreground"> · {accountType}</span>
        )}
        {updated !== null && (
          <span className="text-muted-foreground"> · {updated}</span>
        )}
      </p>
      <p className="text-muted-foreground text-xs leading-snug">{children}</p>
    </div>
  );
}

/**
 * The warning that the plan on screen was built for somebody else.
 *
 * Shared because both whole-account sources can hit it, and because the offer
 * it makes is destructive: a plan is the one thing in this app an import has no
 * business overwriting on its own.
 */
export function DifferentAccountNotice({
  listCount,
  lastRsn,
  clearList,
  onChange,
}: {
  listCount: number;
  lastRsn: string | null;
  clearList: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
      <Checkbox
        checked={clearList}
        onCheckedChange={(next) => onChange(next === true)}
        className="mt-0.5"
      />
      <span className="leading-tight">
        <span className="font-medium text-amber-300">
          This is a different account from your last import.
        </span>
        <span className="text-muted-foreground block text-xs">
          Your {listCount} planned task{listCount === 1 ? " was" : "s were"}{" "}
          added while you were syncing{" "}
          <span className="text-foreground">{lastRsn}</span>. Tick to clear the
          list too; leave it to keep it.
        </span>
      </span>
    </label>
  );
}

/** The numbered instructions above every fetch-or-paste pane. */
export function Steps({ children }: { children: ReactNode }) {
  return (
    <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-sm">
      {children}
    </ol>
  );
}

/**
 * A pane's own fetch button.
 *
 * Lives in the pane rather than beside the name, because only two of the five
 * sources fetch and a control that appears when you change source reads as the
 * layout twitching rather than as the source differing.
 */
export function LookUpButton({
  busy,
  disabled,
  onClick,
}: {
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button variant="outline" disabled={busy || disabled} onClick={onClick}>
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Search className="size-4" aria-hidden />
      )}
      {busy ? "Looking" : "Look up"}
    </Button>
  );
}
