// The small pieces a cell is built from: a lock, a wiki link, a wrapped name.
//
// All three are pure presentation over one value, with no knowledge of the table
// around them -- which is why they live apart from columns.tsx, where the
// question is what a column *is* rather than how one thing draws.

import { ExternalLink, Lock } from "lucide-react";
import { describeMissing, type GateCheck } from "@/lib/requirements";
import { splitAtColon } from "@/lib/wiki";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The lock on a monster you can't face yet.
 *
 * Shown whether or not the requirement filter is on, which is the point: with
 * the filter off you learn *why* Vorkath is out of reach instead of wondering,
 * and with it set to "Can't face yet" every row carries its own reason. Nothing
 * is greyed out -- the row is still tickable, because the app is not the
 * authority on what you have done, you are.
 */
export function GateLock({ gate }: { gate: GateCheck }) {
  if (gate.status !== "blocked") return null;
  const requires = `Requires ${describeMissing(gate.missing)}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A button, not a decorated span: `title` never appears on keyboard
            focus, so the reason was reachable by pointer only. This is the one
            control here that exists purely to be read. */}
        <button
          type="button"
          // Nothing to do on click -- the tooltip opens on hover and on focus.
          // Blocking it stops a stray tap from doing anything at all.
          onClick={(event) => event.preventDefault()}
          aria-label={requires}
          className="mt-0.5 inline-flex shrink-0 cursor-help rounded-sm text-amber-500/70 hover:text-amber-500"
        >
          <Lock className="size-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      {/* One line, and the same line the screen reader gets. What you're short
          of is a number you already know; what the gate asks for is the thing
          you came to the lock to find out. */}
      <TooltipContent>{requires}</TooltipContent>
    </Tooltip>
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
