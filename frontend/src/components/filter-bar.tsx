// Search, facet pickers, monster picker and completion toggle.
//
// Every control writes through to the same TaskQuery, which is serialised to the
// URL -- so there is no local state here to drift out of sync with the address
// bar, and every visible arrangement is a link someone can send.
//
// Sort left this bar: the column headers own it now, which is where you were
// already pointing when you decided to re-sort.

import { Search, X } from 'lucide-react'
import { isEmptyQuery } from '@/lib/task-query'
import {
  TIERS,
  TASK_TYPES,
  type TaskQuery,
  type TaskType,
  type Tier,
} from '@/lib/types'
import { FacetPicker } from '@/components/facet-picker'
import { MonsterPicker } from '@/components/monster-picker'
import { TierBadge } from '@/components/tier-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

/**
 * The completion filter's three states, in the order you actually want them:
 * all -> only what's left to do -> only what's done.
 */
const COMPLETED_STATES = [
  { value: undefined, label: 'All tasks' },
  { value: false, label: 'Not completed' },
  { value: true, label: 'Completed only' },
] as const

function nextCompleted(current: boolean | undefined) {
  const at = COMPLETED_STATES.findIndex((state) => state.value === current)
  return COMPLETED_STATES[(at + 1) % COMPLETED_STATES.length].value
}

/**
 * All labels stacked in one grid cell, with the inactive ones hidden.
 * The button is then always as wide as its longest state and never resizes
 * under the cursor -- and it stays that way if the wording changes, which a
 * hard-coded width would not.
 */
function CycleLabel<T>({
  states,
  current,
}: {
  states: readonly { readonly value: T; readonly label: string }[]
  current: T
}) {
  return (
    <span className="grid">
      {states.map((state) => (
        <span
          key={state.label}
          className={`col-start-1 row-start-1 ${state.value === current ? '' : 'invisible'}`}
        >
          {state.label}
        </span>
      ))}
    </span>
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
        {/* Capped, not greedy: an uncapped flex-1 ate every spare pixel, which
            left the readout at the end jammed against the last filter. */}
        <div className="relative min-w-56 max-w-md flex-1">
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

        {/* Beside the monster picker rather than on their own row: all three
            answer "which tasks", and they now share one shape, so they belong
            in one place. */}
        <FacetPicker
          label="Tiers"
          options={TIERS}
          selected={query.tier ?? []}
          onToggle={(tier) => patch({ tier: toggleFacet(query.tier, tier) })}
          renderOption={(tier: Tier) => <TierBadge tier={tier} />}
          className="h-9"
        />

        <FacetPicker
          label="Types"
          options={TASK_TYPES}
          selected={query.type ?? []}
          onToggle={(type) => patch({ type: toggleFacet(query.type, type) })}
          renderOption={(type: TaskType) => TYPE_LABEL[type]}
          className="h-9"
        />

        {/* Not a picker -- one control cycling three states, so it says its
            current state rather than opening a list. Filled when it is doing
            something, outlined when it is letting everything through. */}
        <Button
          variant={query.completed === undefined ? 'outline' : 'default'}
          size="sm"
          className="h-9"
          aria-pressed={query.completed !== undefined}
          onClick={() => patch({ completed: nextCompleted(query.completed) })}
        >
          <CycleLabel states={COMPLETED_STATES} current={query.completed} />
        </Button>

        {/* Trails the controls rather than being pushed to the far edge --
            stranded against the right margin it read as a separate widget. The
            padding is the only separation it needs: this is the bar's readout,
            not another thing to press. */}
        <span className="text-muted-foreground flex items-center gap-2 pl-4 text-xs">
          {/* Sized by the widest thing it can ever say, held invisibly in the
              same grid cell. "646 tasks" becoming "12 of 646 tasks" the moment
              you filter was dragging the Clear button along with it. Tabular
              figures do the rest: every digit is the same width, so the reserve
              holds for any count. */}
          <span className="grid justify-items-start tabular-nums">
            <span className="invisible col-start-1 row-start-1" aria-hidden>
              {`${totalCount} of ${totalCount} tasks`}
            </span>
            <span className="col-start-1 row-start-1">
              {resultCount === totalCount
                ? `${totalCount} tasks`
                : `${resultCount} of ${totalCount} tasks`}
            </span>
          </span>
          {/* Held rather than removed when there's nothing to clear: hidden
              this way it keeps its space but takes no focus and is invisible
              to a screen reader, so the count never slides sideways. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className={`h-9 px-2 text-xs ${isEmptyQuery(query) ? 'invisible' : ''}`}
          >
            <X className="size-3" aria-hidden />
            Clear filters
          </Button>
        </span>
      </div>

      {/* The selected monsters are deliberately *not* listed here. The breadcrumb
          directly below already shows each one with its own progress count and
          its own ✕, and two rows of the same chips is just noise. This bar adds
          them; the breadcrumb is where they live. */}
    </section>
  )
}
