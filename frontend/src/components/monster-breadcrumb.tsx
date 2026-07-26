// Where you are once you've pivoted to a boss, and the way back out.
//
// Only rendered when a monster filter is active. The trail is deliberately two
// deep -- there is no hierarchy above "all tasks" -- so this is a location
// marker with an escape hatch rather than real navigation.

import { X } from 'lucide-react'
import type { MonsterSummary } from '@/lib/types'

export interface MonsterBreadcrumbProps {
  summary: MonsterSummary
  onClear: () => void
}

export function MonsterBreadcrumb({ summary, onClear }: MonsterBreadcrumbProps) {
  // A monster typed into the URL that matches nothing: say so, rather than
  // showing a confident "0 / 0 done" over an empty table.
  const known = summary.total > 0

  return (
    <nav aria-label="Breadcrumb" className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1">
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
        <li aria-current="page">
          <span className="bg-muted inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-3 font-medium">
            {summary.monster}
            <button
              type="button"
              onClick={onClear}
              aria-label={`Clear the ${summary.monster} filter`}
              className="hover:bg-background rounded-full p-1 transition-colors"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        </li>
      </ol>

      <p className="text-muted-foreground text-sm tabular-nums">
        {known ? (
          <>
            <span className="text-foreground font-medium">{summary.completed}</span> /{' '}
            {summary.total} done here
          </>
        ) : (
          'No tasks for that monster'
        )}
      </p>
    </nav>
  )
}
