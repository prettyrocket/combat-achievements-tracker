// Progress per tier, a row apiece: name, bar, and one figure, read as a
// percentage, a task count or points.

import { useState } from "react";
import { percent } from "@/lib/progress-summary";
import { TIER_BAR_CLASS } from "@/lib/tier-style";
import { TIER_LABEL, type TierProgress } from "@/lib/types";
import { Meter } from "@/components/profile-view/meter";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Measure = "percent" | "tasks" | "points";

export function TierCard({ perTier }: { perTier: readonly TierProgress[] }) {
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
        {perTier.map((tier) => (
          <TierRow key={tier.tier} tier={tier} measure={measure} />
        ))}
      </ul>
    </section>
  );
}

function TierRow({ tier, measure }: { tier: TierProgress; measure: Measure }) {
  // Every task in a tier is worth the same, so the share of tasks done and the
  // share of points earned are one number -- the bar is the same either way.
  const value = percent(tier.completed, tier.total);
  const label = TIER_LABEL[tier.tier];
  return (
    // Each row lends its cells to the list's grid, so the bars and figures
    // line up down the card.
    <li className="col-span-3 grid grid-cols-subgrid items-center">
      <span className="font-medium">{label}</span>
      <div
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} completion`}
      >
        <Meter value={value} className={TIER_BAR_CLASS[tier.tier]} />
      </div>
      <span className="text-muted-foreground min-w-18 text-right text-xs">
        {measure === "percent" ? (
          <span className="text-foreground font-medium">
            {value.toFixed(1)}%
          </span>
        ) : (
          <>
            <span className="text-foreground font-medium">
              {measure === "tasks" ? tier.completed : tier.pointsEarned}
            </span>{" "}
            / {measure === "tasks" ? tier.total : tier.pointsTotal}
          </>
        )}
      </span>
    </li>
  );
}
