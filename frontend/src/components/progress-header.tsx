// Overall progress plus a meter per tier.
//
// Plain CSS bars. Six values do not need a chart library, and a <div> with a
// width is both smaller and more accessible than anything a library would
// render for this.

import { percent } from '@/lib/progress-summary'
import type { ProgressSummary, Tier } from '@/lib/types'

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

export function ProgressHeader({ summary }: { summary: ProgressSummary }) {
  const overall = percent(summary.pointsEarned, summary.pointsTotal)

  return (
    <section aria-label="Progress summary" className="mt-6 rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">
          {overall.toFixed(1)}
          <span className="text-muted-foreground text-sm font-normal"> complete</span>
        </h2>
        <p className="text-muted-foreground text-sm tabular-nums">
          <span className="text-foreground font-medium">{summary.pointsEarned}</span> /{' '}
          {summary.pointsTotal} points ·{' '}
          <span className="text-foreground font-medium">{summary.completedTasks}</span> /{' '}
          {summary.totalTasks} tasks
        </p>
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
