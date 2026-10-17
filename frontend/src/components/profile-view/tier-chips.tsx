// The six tier chips, under the summary card's two stat columns.
//
// The card used to draw its own tier meters -- a name row, a bar and a points
// row each. The chips say the same thing in a sixth of the space. Per-tier
// points live in the chip's tooltip.

import { percent } from "@/lib/progress-summary";
import { TIER_FILL_CLASS } from "@/lib/tier-style";
import { TIER_LABEL, type TierProgress } from "@/lib/types";

/**
 * Half chip, half meter: the tier's full name and count, with the chip filling
 * left-to-right as the tier gets done.
 *
 * Abbreviating to "GM" saved a few pixels and cost the reading -- so the name is
 * whole, and the progress is carried by the fill rather than by a separate bar
 * needing its own row.
 */
function TierChip({ tier }: { tier: TierProgress }) {
  const value = percent(tier.completed, tier.total);
  return (
    <li
      className="relative isolate overflow-hidden rounded-full border px-2.5 py-0.5"
      title={`${TIER_LABEL[tier.tier]}: ${tier.completed} of ${tier.total} tasks · ${tier.pointsEarned}/${tier.pointsTotal} points`}
    >
      <span
        className={`absolute inset-y-0 left-0 -z-10 transition-[width] duration-300 ${TIER_FILL_CLASS[tier.tier]}`}
        style={{ width: `${value}%` }}
        aria-hidden
      />
      <span className="flex items-baseline gap-1.5 text-xs whitespace-nowrap">
        <span className="font-medium">{TIER_LABEL[tier.tier]}</span>
        <span className="text-muted-foreground tabular-nums">
          {tier.completed}/{tier.total}
        </span>
      </span>
    </li>
  );
}

export function TierChips({ perTier }: { perTier: readonly TierProgress[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {perTier.map((tier) => (
        <TierChip key={tier.tier} tier={tier} />
      ))}
    </ul>
  );
}
