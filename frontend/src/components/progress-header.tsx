// Overall progress plus a meter per tier.
//
// Plain CSS bars. Six values do not need a chart library, and a <div> with a
// width is both smaller and more accessible than anything a library would
// render for this.
//
// Collapsible, because it is now permanently on screen rather than scrolling
// away: the full form is worth its height while you're planning, and the one-line
// form is what you want above a table you're working down.

import { ChevronDown, ChevronUp, Swords } from "lucide-react";
import { percent } from "@/lib/progress-summary";
import type { RewardStatus } from "@/lib/rewards";
import { itemWikiUrl } from "@/lib/wiki";
import type { ProgressSummary, Tier, TierProgress } from "@/lib/types";

const TIER_LABEL: Record<Tier, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  ELITE: "Elite",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
};

// Matches the tier colours used by the table's TierBadge, at low opacity: the
// fill *behind* a chip's text has to sit under type without fighting it, which
// the solid badge colours would.
const TIER_FILL: Record<Tier, string> = {
  EASY: "bg-emerald-400/25",
  MEDIUM: "bg-sky-400/25",
  HARD: "bg-violet-400/25",
  ELITE: "bg-amber-400/25",
  MASTER: "bg-rose-400/25",
  GRANDMASTER: "bg-fuchsia-400/25",
};

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
        className={`absolute inset-y-0 left-0 -z-10 transition-[width] duration-300 ${TIER_FILL[tier.tier]}`}
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

/**
 * The six chips, in both forms of the header.
 *
 * The expanded view used to draw its own tier meters -- a name row, a bar and a
 * points row each. The chips say the same thing in a sixth of the space and are
 * already the collapsed view's answer to the same question, so expanding is now
 * about what the chips *can't* tell you: the overall figure and the next reward.
 * Per-tier points live in the chip's tooltip, as they already did when collapsed.
 */
function TierChips({ perTier }: { perTier: readonly TierProgress[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {perTier.map((tier) => (
        <TierChip key={tier.tier} tier={tier} />
      ))}
    </ul>
  );
}

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
function RewardStat({ status }: { status: RewardStatus }) {
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

function HiltLink({ hilt }: { hilt: string }) {
  return (
    <a
      href={itemWikiUrl(hilt)}
      target="_blank"
      rel="noreferrer"
      className="font-medium underline decoration-dotted underline-offset-2"
    >
      {hilt}
    </a>
  );
}

function Meter({ value, className }: { value: number; className: string }) {
  return (
    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${className}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

// One card, one width, both states. The summary used to be full-width collapsed
// and half-width expanded, so the whole block resized under the cursor every time
// you toggled it -- and the toggle itself moved 700px. Fixing the width means
// each state has to earn the same room instead: collapsed fills it with two dense
// rows, expanded with two stat columns over the tiers. Only capped from xl up;
// narrower screens keep today's full-width behaviour and are their own problem.
const CARD = "relative mt-4 rounded-lg border p-4 xl:max-w-5xl";

// Pinned to the card rather than placed in a row, so it sits in exactly the same
// spot in both states. pr-10 on whatever shares its line keeps text clear of it.
const TOGGLE_SLOT = "absolute top-4 right-4";

export interface ProgressHeaderProps {
  summary: ProgressSummary;
  rewards: RewardStatus;
  /** Whose progress this is, or null before anything has been loaded. */
  rsn: string | null;
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
}

export function ProgressHeader({
  summary,
  rewards,
  rsn,
  compact,
  onCompactChange,
}: ProgressHeaderProps) {
  const overall = percent(summary.pointsEarned, summary.pointsTotal);

  // Two decimals, and only in the compact line: with 2671 points on the board a
  // single Easy task is 0.037%, so one decimal makes a tick you just made look
  // like it did nothing at all.
  const headline = compact ? overall.toFixed(2) : overall.toFixed(1);

  // The figure belongs to somebody, so their name goes in front of it in both
  // forms. Nothing at all before a first load: a blank slot where a name goes
  // reads as a bug, and the percentage is unambiguous while there's only one
  // account in play. Whitespace-only nodes are dropped in the compact form's
  // flex row, which spaces its children with gap instead.
  const who = rsn && (
    <>
      {rsn} <span className="text-muted-foreground font-normal">·</span>{" "}
    </>
  );

  const toggle = (
    <button
      type="button"
      onClick={() => onCompactChange(!compact)}
      aria-expanded={!compact}
      aria-label={
        compact ? "Show progress by tier" : "Collapse progress summary"
      }
      className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1 transition-colors"
    >
      {compact ? (
        <ChevronDown className="size-4" aria-hidden />
      ) : (
        <ChevronUp className="size-4" aria-hidden />
      )}
    </button>
  );

  if (compact) {
    return (
      <section aria-label="Progress summary" className={CARD}>
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

        <span className={TOGGLE_SLOT}>{toggle}</span>
      </section>
    );
  }

  return (
    <section aria-label="Progress summary" className={CARD}>
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

      <span className={TOGGLE_SLOT}>{toggle}</span>
    </section>
  );
}
