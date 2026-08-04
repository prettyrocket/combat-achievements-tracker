// The one-line form: what you want above a table you're working down.

import type { ReactNode } from "react";
import type { RewardStatus } from "@/lib/rewards";
import type { ProgressSummary } from "@/lib/types";
import { TierChips } from "@/components/progress-header/tier-chips";

export function CompactSummary({
  who,
  headline,
  overall,
  summary,
  rewards,
}: {
  /** The account's name and its separator, or nothing before a first load. */
  who: ReactNode;
  /** The percentage, already rounded for this form. */
  headline: string;
  overall: number;
  summary: ProgressSummary;
  rewards: RewardStatus;
}) {
  return (
    <>
      {/* One reading, one place: the percentage and the two counts it is
          derived from, rather than the same fact at opposite ends of a bar. */}
      <h2
        className="flex flex-wrap items-baseline gap-x-2 pr-10 text-base font-semibold tabular-nums"
        role="meter"
        aria-valuenow={Math.round(overall)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Overall completion"
      >
        {who}
        {headline}%
        <span className="text-muted-foreground text-sm font-normal">
          complete
        </span>
        {/* What's left to earn rather than what's banked: the two running
            totals were the same fact the percentage in front of them already
            carries, and the distance to the next hilt is the figure you act
            on. Both totals still live in the expanded form. */}
        <span className="text-muted-foreground text-sm font-normal">
          ·{" "}
          {rewards.next ? (
            <>
              <span className="text-foreground font-medium">
                {rewards.pointsToNext}
              </span>{" "}
              {rewards.pointsToNext === 1 ? "point" : "points"} to next reward
            </>
          ) : (
            <>Every reward tier claimed.</>
          )}
        </span>
      </h2>

      {/* Second row: the per-tier breakdown. The reward pill that used to open
          this strip carried the same distance-to-next figure the headline now
          states in words, so what's left is the one thing the line above
          can't say -- where the work stands tier by tier. */}
      <div className="mt-2.5">
        <TierChips perTier={summary.perTier} />
      </div>
    </>
  );
}
