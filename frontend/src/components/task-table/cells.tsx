// The small pieces a cell is built from: the plan control, a wiki link, a
// wrapped name.
//
// All three are pure presentation over one value, with no knowledge of the table
// around them -- which is why they live apart from columns.tsx, where the
// question is what a column *is* rather than how one thing draws.

import { ExternalLink, ListChecks, ListPlus, Lock } from "lucide-react";
import { splitAtColon } from "@/lib/wiki";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The plan control: add, remove, or the lock that says not yet.
 *
 * The lock used to sit beside the monster's name, where it was information and
 * nothing more. It belongs on the control it actually governs -- a plan is what
 * you are going to go and do next, and a task you cannot reach is not that.
 *
 * Only *adding* is locked. A task already on the list stays removable however
 * short of its requirements you are: it can get there from an import or from a
 * profile you edited afterwards, and a plan you can't take something off is a
 * trap. Ticking the row as done is untouched either way -- the app is not the
 * authority on what you have done, you are.
 */
export function ListToggle({
  name,
  listed,
  gateReason,
  onToggle,
}: {
  name: string;
  listed: boolean;
  /** Why this task can't be planned yet, or null when it can. */
  gateReason: string | null;
  onToggle: () => void;
}) {
  const requires = listed ? null : gateReason;

  if (requires !== null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A button, not a decorated span: `title` never appears on keyboard
              focus, so the reason would be reachable by pointer only. Disabled
              would cost the same -- a disabled button takes neither hover nor
              focus, and the reason is the whole point of the lock. */}
          <button
            type="button"
            // Nothing to do on click. The tooltip opens on hover and on focus,
            // and blocking this stops a stray tap from doing anything at all.
            onClick={(event) => event.preventDefault()}
            aria-disabled
            aria-label={`Can't plan "${name}" yet. ${requires}`}
            className="cursor-not-allowed rounded p-1 text-amber-500/70 hover:text-amber-500"
          >
            <Lock className="size-4" aria-hidden />
          </button>
        </TooltipTrigger>
        {/* One line, and the same line the screen reader gets. */}
        <TooltipContent>{requires}</TooltipContent>
      </Tooltip>
    );
  }

  const Icon = listed ? ListChecks : ListPlus;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={listed}
      title={listed ? "On my list" : "Add to my list"}
      aria-label={
        listed ? `Remove "${name}" from my list` : `Add "${name}" to my list`
      }
      className={`rounded p-1 transition-colors ${
        listed
          ? "text-background bg-foreground"
          : "text-muted-foreground/50 hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

/** A wiki link that doesn't take the click meant for the control next to it. */
export function WikiLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={label}
      aria-label={label}
      onPointerDown={(event) => event.stopPropagation()}
      className="text-muted-foreground/40 hover:text-foreground inline-flex shrink-0 transition-colors"
    >
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

/**
 * Names split at their colon, so `Chambers of Xeric: CM (5-Scale) Speed-Chaser`
 * stops setting the width of a column whose other 630 rows are half that long.
 * Only the handful of names with a colon are affected; everything else renders
 * as one line exactly as before.
 */
export function SplitName({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const [head, tail] = splitAtColon(value);
  if (tail === null) return <span className={className}>{value}</span>;
  return (
    <span className={className}>
      {head}:<br />
      <span className="text-muted-foreground">{tail}</span>
    </span>
  );
}
