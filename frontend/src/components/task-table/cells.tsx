// The small pieces a cell is built from: the plan control, a linked name, a
// wrapped one.
//
// All three are pure presentation over one value, with no knowledge of the table
// around them -- which is why they live apart from columns.tsx, where the
// question is what a column *is* rather than how one thing draws.

import { ListChecks, ListPlus, Lock } from "lucide-react";
import { splitAtColon } from "@/lib/wiki";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The plan control: add, remove, and the lock that says what this one will take.
 *
 * The lock used to refuse. It sat where the add button goes and did nothing on
 * click, on the reasoning that a plan is what you are going to do next and a
 * task you cannot reach is not that. But a plan you are building towards --
 * 85 Slayer, then these six Cerberus tasks -- is the same list, and the app is
 * no more the authority on what you are going to do than on what you have done.
 *
 * So the lock stays and the veto goes: an unreachable task shows the amber lock
 * and says what it needs, and adds when you click it anyway.
 */
export function ListToggle({
  name,
  listed,
  gateReason,
  onToggle,
}: {
  name: string;
  listed: boolean;
  /** What this task needs first, or null when nothing. */
  gateReason: string | null;
  onToggle: () => void;
}) {
  // Nothing to warn about once it's on the list -- at that point the control's
  // job is removing it, and the row is already a decision you made.
  const requires = listed ? null : gateReason;
  const Icon = requires !== null ? Lock : listed ? ListChecks : ListPlus;

  const button = (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={listed}
      // The reason lives in the tooltip when there is one; a `title` beside it
      // would open a second, native tooltip saying something shorter.
      title={
        requires !== null ? undefined : listed ? "On my list" : "Add to my list"
      }
      aria-label={
        requires !== null
          ? `Add "${name}" to my list. ${requires}`
          : listed
            ? `Remove "${name}" from my list`
            : `Add "${name}" to my list`
      }
      className={`rounded p-1 transition-colors ${
        requires !== null
          ? "hover:bg-muted text-amber-500/70 hover:text-amber-500"
          : listed
            ? "text-background bg-foreground"
            : "text-muted-foreground/50 hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );

  if (requires === null) return button;

  return (
    <Tooltip>
      {/* A live button, so the reason is reachable by hover and by focus. A
          disabled one would take neither -- which is why the lock was never
          `disabled` even back when it refused. */}
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      {/* One line, and the same line the screen reader gets. */}
      <TooltipContent>{requires}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A name that is also the way to its wiki page.
 *
 * There used to be a ↗ icon beside the name for this, and the name itself did
 * something else -- monsters filtered the table, tasks did nothing at all. Two
 * targets a few pixels apart doing unrelated things is a worse deal than one
 * obvious one: the name is the page, and filtering by monster is what the
 * filter bar's picker is for.
 */
export function WikiName({
  value,
  href,
  className,
}: {
  value: string;
  href: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={`${value} on the wiki`}
      // Native link-dragging would race the row's own drag gesture and win:
      // the browser starts it within a pixel or two, well before the pointer
      // sensor's 8px threshold. Off, so a name is as draggable as the rest of
      // the row -- which matters now that the name is most of the row.
      draggable={false}
      className={`hover:text-foreground text-left underline decoration-dotted underline-offset-4 hover:decoration-solid ${className ?? ""}`}
    >
      <SplitName value={value} />
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
