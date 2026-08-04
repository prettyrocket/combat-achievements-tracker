// Overall progress plus a chip per tier, in one of two forms.
//
// Collapsible, because it is permanently on screen rather than scrolling away:
// the full form is worth its height while you're planning, and the one-line form
// is what you want above a table you're working down.
//
// The card and the toggle live here rather than in either form, which is the
// point of the split: both states are the same box with the same control in the
// same corner, and only the contents differ.

import { ChevronDown, ChevronUp } from "lucide-react";
import { percent } from "@/lib/progress-summary";
import type { RewardStatus } from "@/lib/rewards";
import type { ProgressSummary } from "@/lib/types";
import { CompactSummary } from "@/components/progress-header/compact";
import { ExpandedSummary } from "@/components/progress-header/expanded";

// One card, one width, both states. The summary used to be full-width collapsed
// and half-width expanded, so the whole block resized under the cursor every time
// you toggled it -- and the toggle itself moved 700px. Fixing the width means
// each state has to earn the same room instead: collapsed fills it with two dense
// rows, expanded with two stat columns over the tiers. Only capped from xl up;
// narrower screens keep today's full-width behaviour and are their own problem.
const CARD = "relative mt-4 rounded-lg border p-4 xl:max-w-5xl";

// Pinned to the card rather than placed in a row, so it sits in exactly the same
// spot in both states. pr-10 on whatever shares its line keeps text clear of it.
const TOGGLE_SLOT = "absolute top-4 right-4";

export interface ProgressHeaderProps {
  summary: ProgressSummary;
  rewards: RewardStatus;
  /** Whose progress this is, or null before anything has been loaded. */
  rsn: string | null;
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
}

export function ProgressHeader({
  summary,
  rewards,
  rsn,
  compact,
  onCompactChange,
}: ProgressHeaderProps) {
  const overall = percent(summary.pointsEarned, summary.pointsTotal);

  // Two decimals, and only in the compact line: with 2671 points on the board a
  // single Easy task is 0.037%, so one decimal makes a tick you just made look
  // like it did nothing at all.
  const headline = compact ? overall.toFixed(2) : overall.toFixed(1);

  // The figure belongs to somebody, so their name goes in front of it in both
  // forms. Nothing at all before a first load: a blank slot where a name goes
  // reads as a bug, and the percentage is unambiguous while there's only one
  // account in play. Whitespace-only nodes are dropped in the compact form's
  // flex row, which spaces its children with gap instead.
  const who = rsn && (
    <>
      {rsn} <span className="text-muted-foreground font-normal">·</span>{" "}
    </>
  );

  const Form = compact ? CompactSummary : ExpandedSummary;

  return (
    <section aria-label="Progress summary" className={CARD}>
      <Form
        who={who}
        headline={headline}
        overall={overall}
        summary={summary}
        rewards={rewards}
      />

      <span className={TOGGLE_SLOT}>
        <button
          type="button"
          onClick={() => onCompactChange(!compact)}
          aria-expanded={!compact}
          aria-label={
            compact ? "Show progress by tier" : "Collapse progress summary"
          }
          className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1 transition-colors"
        >
          {compact ? (
            <ChevronDown className="size-4" aria-hidden />
          ) : (
            <ChevronUp className="size-4" aria-hidden />
          )}
        </button>
      </span>
    </section>
  );
}
