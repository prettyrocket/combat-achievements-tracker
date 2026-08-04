// The full form: worth its height while you're planning.

import type { ReactNode } from "react";
import type { RewardStatus } from "@/lib/rewards";
import type { ProgressSummary } from "@/lib/types";
import { Meter } from "@/components/progress-header/meter";
import { RewardStat } from "@/components/progress-header/reward-stat";
import { TierChips } from "@/components/progress-header/tier-chips";

export function ExpandedSummary({
  who,
  headline,
  overall,
  summary,
  rewards,
}: {
  who: ReactNode;
  headline: string;
  overall: number;
  summary: ProgressSummary;
  rewards: RewardStatus;
}) {
  return (
    <>
      {/* The two headline facts as a pair of columns: how much of the game is
          done, and what the next reward costs. Same three-part shape each --
          headline, meter, detail -- and half the card apiece, which is what keeps
          the meters a readable length instead of the hairline a single full-width
          bar had become. */}
      <div className="grid gap-x-8 gap-y-5 pr-10 sm:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold tabular-nums">
            {who}
            {headline}%
            <span className="text-muted-foreground text-sm font-normal">
              {" "}
              complete
            </span>
          </h2>

          <div
            className="mt-2"
            role="meter"
            aria-valuenow={Math.round(overall)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall completion"
          >
            <Meter value={overall} className="bg-foreground" />
          </div>

          <p className="text-muted-foreground mt-1.5 text-xs tabular-nums">
            <span className="text-foreground font-medium">
              {summary.pointsEarned}
            </span>{" "}
            / {summary.pointsTotal} points ·{" "}
            <span className="text-foreground font-medium">
              {summary.completedTasks}
            </span>{" "}
            / {summary.totalTasks} tasks
          </p>
        </div>

        <RewardStat status={rewards} />
      </div>

      {/* The same chips the collapsed form shows, under a rule: expanding adds
          the two columns above them, it doesn't redraw what was already there. */}
      <div className="mt-4 border-t pt-3.5">
        <TierChips perTier={summary.perTier} />
      </div>
    </>
  );
}
