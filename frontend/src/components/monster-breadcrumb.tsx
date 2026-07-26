// Where you are once you've pivoted to a boss, and the way back out.
//
// Only rendered when a monster filter is active. The trail is deliberately two
// deep -- there is no hierarchy above "all tasks" -- so this is a location
// marker with an escape hatch rather than real navigation.

import { Undo2, X } from 'lucide-react'
import { MonsterPicker } from '@/components/monster-picker'
import type { MonsterSummary } from '@/lib/types'

export interface MonsterBreadcrumbProps {
  summaries: readonly MonsterSummary[]
  onClear: () => void
  onRemove: (monster: string) => void
  /** Every monster with its task count, for the inline picker. */
  monsters: readonly { name: string; count: number }[]
  onToggleMonster: (monster: string) => void
  /** Search text the pivot set aside, if any -- offered back rather than lost. */
  parkedSearch?: string | null
  onRestoreSearch?: () => void
}

export function MonsterBreadcrumb({
  summaries,
  onClear,
  onRemove,
  monsters,
  onToggleMonster,
  parkedSearch,
  onRestoreSearch,
}: MonsterBreadcrumbProps) {
  const total = summaries.reduce((sum, s) => sum + s.total, 0)
  const completed = summaries.reduce((sum, s) => sum + s.completed, 0)
  // A monster typed into the URL that matches nothing: say so, rather than
  // showing a confident "0 / 0 done" over an empty table.
  const known = total > 0

  return (
    <nav aria-label="Breadcrumb" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <li>
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-4 transition-colors"
          >
            All tasks
          </button>
        </li>
        <li className="text-muted-foreground" aria-hidden>
          /
        </li>
        {summaries.map((summary) => (
          <li key={summary.monster} aria-current="page">
            <span className="bg-muted inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-3 font-medium">
              {summary.monster}
              <span className="text-muted-foreground text-xs tabular-nums">
                {summary.completed}/{summary.total}
              </span>
              <button
                type="button"
                onClick={() => onRemove(summary.monster)}
                aria-label={`Clear the ${summary.monster} filter`}
                className="hover:bg-background rounded-full p-1 transition-colors"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          </li>
        ))}
        {/* Right where the chosen ones are listed, because this is the only way
            to add a second: with the table filtered to the first, no other
            monster's rows are on screen to click. */}
        <li>
          <MonsterPicker
            monsters={monsters}
            selected={summaries.map((summary) => summary.monster)}
            onToggle={onToggleMonster}
            showCount={false}
            className="h-7 rounded-full px-2.5 text-xs"
          />
        </li>
      </ol>

      <p className="text-muted-foreground text-sm tabular-nums">
        {known ? (
          <>
            <span className="text-foreground font-medium">{completed}</span> / {total} done here
          </>
        ) : (
          'No tasks for that monster'
        )}
      </p>

      {/* The pivot drops the search on purpose -- a leftover word would hide most
          of the rows you just asked for -- but dropping it silently is what made
          this feel like losing your place. So it's offered back. */}
      {parkedSearch && onRestoreSearch && (
        <button
          type="button"
          onClick={onRestoreSearch}
          className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors"
        >
          <Undo2 className="size-3" aria-hidden />
          Restore search “{parkedSearch}”
        </button>
      )}
    </nav>
  )
}
