// Overall progress and the next reward, over a chip per tier.

import { percent } from "@/lib/progress-summary";
import type { RewardStatus } from "@/lib/rewards";
import type { ProgressSummary } from "@/lib/types";
import { Meter } from "@/components/profile-view/meter";
import { RewardStat } from "@/components/profile-view/reward-stat";
import { TierChips } from "@/components/profile-view/tier-chips";

export function SummaryCard({
  summary,
  rewards,
  rsn,
}: {
  summary: ProgressSummary;
  rewards: RewardStatus;
  /** Whose progress this is, or null before anything has been loaded. */
  rsn: string | null;
}) {
  const overall = percent(summary.pointsEarned, summary.pointsTotal);

  return (
    <section
      aria-label="Progress summary"
      className="rounded-lg border p-4 xl:max-w-5xl"
    >
      {/* The two headline facts as a pair of columns: how much of the game is
          done, and what the next reward costs. Same three-part shape each --
          headline, meter, detail -- and half the card apiece, which is what keeps
          the meters a readable length instead of the hairline a single full-width
          bar had become. */}
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold tabular-nums">
            {/* The figure belongs to somebody, so their name goes in front of
                it. Nothing at all before a first load: a blank slot where a
                name goes reads as a bug. */}
            {rsn && (
              <>
                {rsn}{" "}
                <span className="text-muted-foreground font-normal">
                  ·
                </span>{" "}
              </>
            )}
            {overall.toFixed(1)}%
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

      <div className="mt-4 border-t pt-3.5">
        <TierChips perTier={summary.perTier} />
      </div>
    </section>
  );
}
