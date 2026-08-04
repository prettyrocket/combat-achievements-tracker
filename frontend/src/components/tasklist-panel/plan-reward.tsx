import { Swords } from "lucide-react";
import { projectRewards, type RewardTier } from "@/lib/rewards";

/**
 * What the plan is worth in rewards -- the line that turns "34 points" into a
 * reason to do it. Only ever about the *outstanding* points: entries already
 * ticked are counted in the overall total and mustn't be promised twice.
 */
export function PlanReward({
  rewardTiers,
  pointsEarned,
  outstanding,
}: {
  rewardTiers: readonly RewardTier[];
  pointsEarned: number;
  outstanding: number;
}) {
  // Nothing outstanding is nothing to project: an empty or all-done list has
  // already had its say in the header.
  if (outstanding === 0) return null;

  const { status, unlocks } = projectRewards(
    rewardTiers,
    pointsEarned,
    outstanding,
  );

  const body =
    unlocks.length > 0 ? (
      <>
        Finishing this list unlocks{" "}
        <span className="text-foreground font-medium">
          {unlocks.map((tier) => tier.hilt).join(" and ")}
        </span>
      </>
    ) : status.next ? (
      <>
        Leaves you{" "}
        <span className="text-foreground font-medium tabular-nums">
          {status.pointsToNext}
        </span>{" "}
        short of{" "}
        <span className="text-foreground font-medium">{status.next.hilt}</span>
      </>
    ) : null;

  if (!body) return null;

  return (
    <p
      className="text-muted-foreground flex shrink-0 items-start gap-1.5 border-b px-3 py-1.5 text-xs"
      title={`These ${outstanding} outstanding points would take you to ${pointsEarned + outstanding}.`}
    >
      <Swords className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{body}</span>
    </p>
  );
}
