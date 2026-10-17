// Progress per tier, a row apiece, and the total under them: name, bar, and one
// figure, read as a percentage, a task count or points.

import { useState } from "react";
import { percent } from "@/lib/progress-summary";
import { TIER_BAR_CLASS } from "@/lib/tier-style";
import { TIER_LABEL, type ProgressSummary } from "@/lib/types";
import { Meter } from "@/components/profile-view/meter";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Measure = "percent" | "tasks" | "points";

export function TierCard({ summary }: { summary: ProgressSummary }) {
  const [measure, setMeasure] = useState<Measure>("percent");

  return (
    <section aria-labelledby="tier-heading" className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="tier-heading" className="font-semibold">
          Tiers
        </h2>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label="Show"
          value={measure}
          onValueChange={(next) => next && setMeasure(next as Measure)}
        >
          <ToggleGroupItem
            value="percent"
            aria-label="Percent"
            className="px-3"
          >
            %
          </ToggleGroupItem>
          <ToggleGroupItem value="tasks" aria-label="Tasks" className="px-3">
            #
          </ToggleGroupItem>
          <ToggleGroupItem value="points" aria-label="Points" className="px-3">
            pts
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <ul className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2.5 text-sm tabular-nums">
        {summary.perTier.map((tier) => (
          <Row
            key={tier.tier}
            label={TIER_LABEL[tier.tier]}
            barClass={TIER_BAR_CLASS[tier.tier]}
            done={tier.completed}
            of={tier.total}
            earned={tier.pointsEarned}
            worth={tier.pointsTotal}
            measure={measure}
          />
        ))}
        <Row
          label="Total"
          barClass="bg-foreground"
          done={summary.completedTasks}
          of={summary.totalTasks}
          earned={summary.pointsEarned}
          worth={summary.pointsTotal}
          measure={measure}
          className="border-t pt-2.5"
        />
      </ul>
    </section>
  );
}

function Row({
  label,
  barClass,
  done,
  of,
  earned,
  worth,
  measure,
  className = "",
}: {
  label: string;
  barClass: string;
  /** Tasks done, of how many. */
  done: number;
  of: number;
  /** Points earned, of how many. */
  earned: number;
  worth: number;
  measure: Measure;
  className?: string;
}) {
  // Within a tier every task is worth the same, so the two shares are one
  // number. Across tiers they aren't: the total's bar follows tasks when
  // counting tasks, and points -- the headline's measure -- otherwise.
  const value =
    measure === "tasks" ? percent(done, of) : percent(earned, worth);
  return (
    // Each row lends its cells to the list's grid, so the bars and figures
    // line up down the card.
    <li
      className={`col-span-3 grid grid-cols-subgrid items-center ${className}`}
    >
      <span className="font-medium">{label}</span>
      <div
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} completion`}
      >
        <Meter value={value} className={barClass} />
      </div>
      <span className="text-muted-foreground min-w-18 text-right text-xs">
        {measure === "percent" ? (
          <span className="text-foreground font-medium">
            {value.toFixed(1)}%
          </span>
        ) : (
          <>
            <span className="text-foreground font-medium">
              {measure === "tasks" ? done : earned}
            </span>{" "}
            / {measure === "tasks" ? of : worth}
          </>
        )}
      </span>
    </li>
  );
}
