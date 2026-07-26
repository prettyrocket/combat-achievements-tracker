// Overall progress plus a meter per tier.
//
// Plain CSS bars. Six values do not need a chart library, and a <div> with a
// width is both smaller and more accessible than anything a library would
// render for this.
//
// Collapsible, because it is now permanently on screen rather than scrolling
// away: the full form is worth its height while you're planning, and the one-line
// form is what you want above a table you're working down.

import { ChevronDown, ChevronUp } from 'lucide-react'
import { percent } from '@/lib/progress-summary'
import type { ProgressSummary, Tier, TierProgress } from '@/lib/types'

const TIER_LABEL: Record<Tier, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
  ELITE: 'Elite',
  MASTER: 'Master',
  GRANDMASTER: 'Grandmaster',
}

// Matches the tier colours used by the table's TierBadge.
const TIER_BAR: Record<Tier, string> = {
  EASY: 'bg-emerald-400',
  MEDIUM: 'bg-sky-400',
  HARD: 'bg-violet-400',
  ELITE: 'bg-amber-400',
  MASTER: 'bg-rose-400',
  GRANDMASTER: 'bg-fuchsia-400',
}

// The same colours again at low opacity: the fill *behind* a chip's text has to
// sit under type without fighting it, which the solid bar colours would.
const TIER_FILL: Record<Tier, string> = {
  EASY: 'bg-emerald-400/25',
  MEDIUM: 'bg-sky-400/25',
  HARD: 'bg-violet-400/25',
  ELITE: 'bg-amber-400/25',
  MASTER: 'bg-rose-400/25',
  GRANDMASTER: 'bg-fuchsia-400/25',
}

/**
 * Half chip, half meter: the tier's full name and count, with the chip filling
 * left-to-right as the tier gets done.
 *
 * Abbreviating to "GM" saved a few pixels and cost the reading -- so the name is
 * whole, and the progress is carried by the fill rather than by a separate bar
 * needing its own row.
 */
function TierChip({ tier }: { tier: TierProgress }) {
  const value = percent(tier.completed, tier.total)
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
  )
}

function Meter({ value, className }: { value: number; className: string }) {
  return (
    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${className}`}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

export interface ProgressHeaderProps {
  summary: ProgressSummary
  compact: boolean
  onCompactChange: (compact: boolean) => void
}

export function ProgressHeader({ summary, compact, onCompactChange }: ProgressHeaderProps) {
  const overall = percent(summary.pointsEarned, summary.pointsTotal)

  // Two decimals, and only in the compact line: with 2671 points on the board a
  // single Easy task is 0.037%, so one decimal makes a tick you just made look
  // like it did nothing at all.
  const headline = compact ? overall.toFixed(2) : overall.toFixed(1)

  const toggle = (
    <button
      type="button"
      onClick={() => onCompactChange(!compact)}
      aria-expanded={!compact}
      aria-label={compact ? 'Show progress by tier' : 'Collapse progress summary'}
      className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1 transition-colors"
    >
      {compact ? <ChevronDown className="size-4" aria-hidden /> : <ChevronUp className="size-4" aria-hidden />}
    </button>
  )

  const points = (
    <p className="text-muted-foreground text-sm tabular-nums">
      <span className="text-foreground font-medium">{summary.pointsEarned}</span> /{' '}
      {summary.pointsTotal} points ·{' '}
      <span className="text-foreground font-medium">{summary.completedTasks}</span> /{' '}
      {summary.totalTasks} tasks
    </p>
  )

  if (compact) {
    return (
      <section
        aria-label="Progress summary"
        className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-2"
      >
        {/* One reading, one place: the percentage and the two counts it is
            derived from, rather than the same fact at opposite ends of a bar. */}
        <h2
          className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold tabular-nums"
          role="meter"
          aria-valuenow={Math.round(overall)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall completion"
        >
          {headline}%<span className="text-muted-foreground text-sm font-normal">complete</span>
          <span className="text-muted-foreground text-sm font-normal">
            · <span className="text-foreground font-medium">{summary.pointsEarned}</span>/
            {summary.pointsTotal} pts ·{' '}
            <span className="text-foreground font-medium">{summary.completedTasks}</span>/
            {summary.totalTasks} tasks
          </span>
        </h2>

        {/* The tiers survive the collapse as chips that fill as you go -- where
            you're behind is the part worth keeping when the meters go. */}
        <ul className="flex flex-wrap items-center gap-1.5">
          {summary.perTier.map((tier) => (
            <TierChip key={tier.tier} tier={tier} />
          ))}
        </ul>

        <span className="ml-auto">{toggle}</span>
      </section>
    )
  }

  return (
    <section aria-label="Progress summary" className="mt-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold tabular-nums">
          {headline}%<span className="text-muted-foreground text-sm font-normal"> complete</span>
        </h2>
        <div className="flex items-center gap-2">
          {points}
          {toggle}
        </div>
      </div>

      <div
        className="mt-3"
        role="meter"
        aria-valuenow={Math.round(overall)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Overall completion"
      >
        <Meter value={overall} className="bg-foreground" />
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {summary.perTier.map((tier) => (
          <li key={tier.tier}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium">{TIER_LABEL[tier.tier]}</span>
              <span className="text-muted-foreground tabular-nums">
                {tier.completed}/{tier.total}
              </span>
            </div>
            <div className="mt-1.5">
              <Meter value={percent(tier.completed, tier.total)} className={TIER_BAR[tier.tier]} />
            </div>
            <p className="text-muted-foreground mt-1 text-[11px] tabular-nums">
              {tier.pointsEarned}/{tier.pointsTotal} pts
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
