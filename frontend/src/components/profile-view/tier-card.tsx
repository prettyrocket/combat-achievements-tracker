// Progress per tier, a row apiece: name, bar, tasks, points.

import { percent } from "@/lib/progress-summary";
import { TIER_BAR_CLASS } from "@/lib/tier-style";
import { TIER_LABEL, type TierProgress } from "@/lib/types";
import { Meter } from "@/components/profile-view/meter";

export function TierCard({ perTier }: { perTier: readonly TierProgress[] }) {
  return (
    <section aria-label="Progress by tier" className="rounded-lg border p-4">
      <ul className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 gap-y-2.5 text-sm tabular-nums">
        {perTier.map((tier) => (
          <TierRow key={tier.tier} tier={tier} />
        ))}
      </ul>
    </section>
  );
}

function TierRow({ tier }: { tier: TierProgress }) {
  const value = percent(tier.completed, tier.total);
  const label = TIER_LABEL[tier.tier];
  return (
    // Each row lends its cells to the list's grid, so the bars and figures
    // line up down the card.
    <li className="col-span-4 grid grid-cols-subgrid items-center">
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
      <span className="text-muted-foreground text-right text-xs">
        <span className="text-foreground font-medium">{tier.completed}</span> /{" "}
        {tier.total} tasks
      </span>
      <span className="text-muted-foreground text-right text-xs">
        <span className="text-foreground font-medium">{tier.pointsEarned}</span>{" "}
        / {tier.pointsTotal} pts
      </span>
    </li>
  );
}
