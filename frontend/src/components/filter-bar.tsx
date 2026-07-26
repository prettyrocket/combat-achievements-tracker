// Search, facet chips, monster picker and completion toggle.
//
// Every control writes through to the same TaskQuery, which is serialised to the
// URL -- so there is no local state here to drift out of sync with the address
// bar, and every visible arrangement is a link someone can send.
//
// Sort left this bar: the column headers own it now, which is where you were
// already pointing when you decided to re-sort.

import { Search, X } from 'lucide-react'
import { isEmptyQuery } from '@/lib/task-query'
import { TIERS, TASK_TYPES, type TaskQuery, type TaskType, type Tier } from '@/lib/types'
import { MonsterPicker } from '@/components/monster-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const TIER_LABEL: Record<Tier, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
  ELITE: 'Elite',
  MASTER: 'Master',
  GRANDMASTER: 'Grandmaster',
}

const TYPE_LABEL: Record<TaskType, string> = {
  KILL_COUNT: 'Kill Count',
  RESTRICTION: 'Restriction',
  PERFECTION: 'Perfection',
  MECHANICAL: 'Mechanical',
  SPEED: 'Speed',
  STAMINA: 'Stamina',
}

/** Adds or removes one value from a facet, returning undefined when it empties. */
function toggleFacet<T>(current: T[] | undefined, value: T): T[] | undefined {
  const next = current?.includes(value)
    ? current.filter((v) => v !== value)
    : [...(current ?? []), value]
  return next.length ? next : undefined
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-foreground text-background border-transparent'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

export interface FilterBarProps {
  query: TaskQuery
  onChange: (next: TaskQuery) => void
  onClear: () => void
  /** Every monster with its task count, for the picker. */
  monsters: readonly { name: string; count: number }[]
  onToggleMonster: (monster: string) => void
  resultCount: number
  totalCount: number
}

export function FilterBar({
  query,
  onChange,
  onClear,
  monsters,
  onToggleMonster,
  resultCount,
  totalCount,
}: FilterBarProps) {
  const patch = (partial: Partial<TaskQuery>) => onChange({ ...query, ...partial })
  const selected = query.monster ?? []

  return (
    <section aria-label="Filters" className="mt-4 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={query.q ?? ''}
            onChange={(event) => patch({ q: event.target.value || undefined })}
            placeholder="Search name, description or monster…"
            aria-label="Search tasks"
            className="pl-8"
          />
        </div>

        {/* The picker, not a text box: with the table filtered to one monster
            there is no second monster left on screen to click, so this is the
            only way to build a set of them. The same control appears in the
            breadcrumb, where the chosen ones are listed. */}
        <MonsterPicker
          monsters={monsters}
          selected={selected}
          onToggle={onToggleMonster}
          label="Monsters"
          className="h-9"
        />
      </div>

      {/* The selected monsters are deliberately *not* listed here. The breadcrumb
          directly below already shows each one with its own progress count and
          its own ✕, and two rows of the same chips is just noise. This bar adds
          them; the breadcrumb is where they live. */}

      <div className="flex flex-wrap items-center gap-1.5">
        {TIERS.map((tier) => (
          <Chip
            key={tier}
            active={query.tier?.includes(tier) ?? false}
            onClick={() => patch({ tier: toggleFacet(query.tier, tier) })}
          >
            {TIER_LABEL[tier]}
          </Chip>
        ))}
        <span className="bg-border mx-1 h-4 w-px" aria-hidden />
        {TASK_TYPES.map((type) => (
          <Chip
            key={type}
            active={query.type?.includes(type) ?? false}
            onClick={() => patch({ type: toggleFacet(query.type, type) })}
          >
            {TYPE_LABEL[type]}
          </Chip>
        ))}
        <span className="bg-border mx-1 h-4 w-px" aria-hidden />

        {/* Three states, cycled in the order you actually want them: all -> only
            what's left to do -> only what's done. */}
        <Chip
          active={query.completed !== undefined}
          onClick={() =>
            patch({
              completed:
                query.completed === undefined ? false : query.completed === false ? true : undefined,
            })
          }
        >
          {query.completed === undefined
            ? 'All tasks'
            : query.completed
              ? 'Completed only'
              : 'Not completed'}
        </Chip>

        <span className="text-muted-foreground ml-auto flex items-center gap-3 text-xs">
          <span className="tabular-nums">
            {resultCount === totalCount
              ? `${totalCount} tasks`
              : `${resultCount} of ${totalCount} tasks`}
          </span>
          {!isEmptyQuery(query) && (
            <Button variant="ghost" size="sm" onClick={onClear} className="h-6 px-2 text-xs">
              <X className="size-3" aria-hidden />
              Clear filters
            </Button>
          )}
        </span>
      </div>
    </section>
  )
}
