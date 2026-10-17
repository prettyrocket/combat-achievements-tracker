import { Check, Lock, Swords } from "lucide-react";
import type { RewardStatus, RewardTier } from "@/lib/rewards";
import { HiltLink, Meter } from "@/components/profile-view/meter";

/**
 * What the points are for: Ghommal's hilt, on a card of its own beside the
 * summary.
 *
 * Built to the same three-part shape as the summary's overall figure -- a
 * headline, a meter, a line of detail -- so the pair read as two answers to the
 * same question rather than two unrelated widgets.
 *
 * The meter spans the last threshold to the next rather than 0-100, so late on --
 * where 1,945 of 2,671 points is a bar that barely moves -- the gap you're
 * actually closing is still legible.
 *
 * Under it, the whole ladder: every hilt, what it costs, and the one other thing
 * it brings -- so the next reward sits among the rest rather than alone.
 */
export function RewardCard({
  status,
  tiers,
}: {
  status: RewardStatus;
  /** All six, cheapest first. */
  tiers: readonly RewardTier[];
}) {
  const { unlocked, next, pointsToNext, percentToNext } = status;

  return (
    <section
      aria-label="Combat achievement rewards"
      className="rounded-lg border p-4"
    >
      <p className="flex items-baseline gap-1.5 text-lg font-semibold">
        <Swords
          className="text-muted-foreground size-4 shrink-0 self-center"
          aria-hidden
        />
        {unlocked ? (
          <>
            <HiltLink hilt={unlocked.hilt} />
            <span className="text-muted-foreground text-sm font-normal">
              unlocked
            </span>
          </>
        ) : (
          <span className="text-muted-foreground text-base font-normal">
            No reward tier yet
          </span>
        )}
      </p>

      <div
        className="mt-2"
        role="meter"
        aria-valuenow={Math.round(percentToNext)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          next ? `Progress to ${next.hilt}` : "All reward tiers unlocked"
        }
        title={
          next
            ? `${next.hilt} needs ${next.required} points, from tasks of any tier — it also unlocks ${next.alsoUnlocks}.`
            : "Every reward tier claimed."
        }
      >
        <Meter value={percentToNext} className="bg-muted-foreground" />
      </div>

      <p className="text-muted-foreground mt-1.5 text-xs tabular-nums">
        {next ? (
          <>
            <span className="text-foreground font-medium">{pointsToNext}</span>{" "}
            {pointsToNext === 1 ? "point" : "points"} to{" "}
            <HiltLink hilt={next.hilt} /> ({next.label})
          </>
        ) : (
          // Nothing left to work towards is worth saying outright -- an empty
          // space where the next reward was reads as a bug.
          <>Every reward tier claimed.</>
        )}
      </p>

      <ol className="mt-4 space-y-2.5 border-t pt-3.5">
        {tiers.map((tier) => (
          <LadderRow
            key={tier.tier}
            tier={tier}
            state={
              tier === next
                ? "next"
                : unlocked !== null && tier.required <= unlocked.required
                  ? "unlocked"
                  : "locked"
            }
          />
        ))}
      </ol>
    </section>
  );
}

function LadderRow({
  tier,
  state,
}: {
  tier: RewardTier;
  state: "unlocked" | "next" | "locked";
}) {
  return (
    <li
      className={`flex items-start gap-2.5 ${state === "locked" ? "opacity-60" : ""}`}
    >
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
        {state === "unlocked" ? (
          <Check className="size-4 text-emerald-400" aria-hidden />
        ) : state === "next" ? (
          <span className="bg-foreground size-2 rounded-full" aria-hidden />
        ) : (
          <Lock className="text-muted-foreground size-3.5" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <span className="sr-only">
          {state === "unlocked"
            ? "Unlocked: "
            : state === "next"
              ? "Next: "
              : "Locked: "}
        </span>
        <p className="flex items-baseline justify-between gap-3 text-sm">
          <span className={state === "next" ? "font-semibold" : "font-medium"}>
            <HiltLink hilt={tier.hilt} />{" "}
            <span className="text-muted-foreground text-xs font-normal">
              {tier.label}
            </span>
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {tier.required.toLocaleString()} pts
          </span>
        </p>
        <p className="text-muted-foreground text-xs">{tier.alsoUnlocks}</p>
      </div>
    </li>
  );
}
