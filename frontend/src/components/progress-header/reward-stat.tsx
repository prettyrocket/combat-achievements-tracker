import { Swords } from "lucide-react";
import type { RewardStatus } from "@/lib/rewards";
import { HiltLink, Meter } from "@/components/progress-header/meter";

/**
 * What the points are for, as the second of the two stat columns.
 *
 * Built to the same three-part shape as the overall column beside it -- a
 * headline, a meter, a line of detail -- so the pair read as two answers to the
 * same question rather than two unrelated widgets. Side by side is also what
 * stops either meter from becoming the full-width hairline that started all
 * this: two 480px bars use the room that one 1,000px bar was wasting.
 *
 * The meter spans the last threshold to the next rather than 0-100, so late on --
 * where 1,945 of 2,671 points is a bar that barely moves -- the gap you're
 * actually closing is still legible.
 */
export function RewardStat({ status }: { status: RewardStatus }) {
  const { unlocked, next, pointsToNext, percentToNext } = status;

  return (
    <div>
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
    </div>
  );
}
