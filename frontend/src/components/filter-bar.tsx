// Search, facet pickers, monster picker and the menu of hide options.
//
// Every control writes through to the same TaskQuery, which is serialised to the
// URL -- so there is no local state here to drift out of sync with the address
// bar, and every visible arrangement is a link someone can send.
//
// Sort left this bar: the column headers own it now, which is where you were
// already pointing when you decided to re-sort.

import { Ellipsis, Search, X } from "lucide-react";
import { isEmptyQuery } from "@/lib/task-query";
import {
  TIERS,
  TASK_TYPES,
  TYPE_LABEL,
  type TaskQuery,
  type TaskType,
  type Tier,
} from "@/lib/types";
import { FacetPicker } from "@/components/facet-picker";
import { MonsterPicker } from "@/components/monster-picker";
import { TierBadge } from "@/components/tier-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

/** Adds or removes one value from a facet, returning undefined when it empties. */
function toggleFacet<T>(current: T[] | undefined, value: T): T[] | undefined {
  const next = current?.includes(value)
    ? current.filter((v) => v !== value)
    : [...(current ?? []), value];
  return next.length ? next : undefined;
}

export interface FilterBarProps {
  query: TaskQuery;
  onChange: (next: TaskQuery) => void;
  onClear: () => void;
  /** Every monster with its task count, for the picker. */
  monsters: readonly { name: string; count: number }[];
  onToggleMonster: (monster: string) => void;
  resultCount: number;
  totalCount: number;
  /** True while there are no levels or quests to check requirements against. */
  profileIsEmpty: boolean;
  /** Opens the levels dialog, for the state where there's nothing to filter on. */
  onEditProfile: () => void;
}

export function FilterBar({
  query,
  onChange,
  onClear,
  monsters,
  onToggleMonster,
  resultCount,
  totalCount,
  profileIsEmpty,
  onEditProfile,
}: FilterBarProps) {
  const patch = (partial: Partial<TaskQuery>) =>
    onChange({ ...query, ...partial });
  const selected = query.monster ?? [];
  const hidingCompleted = query.completed === false;
  const hidingUnmet = !profileIsEmpty && query.reqs === "met";

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
            value={query.q ?? ""}
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

        {/* Two yes/no questions rather than two three-state cycles: hiding
            is the only direction anyone reached for. Filled while either is on,
            so a narrowed table never looks like the whole catalog. Each pick
            keeps the menu open, since you often want both. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant={hidingCompleted || hidingUnmet ? "default" : "outline"}
              size="sm"
              className="h-9"
              aria-label="More filters"
            >
              <Ellipsis className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuCheckboxItem
              checked={hidingCompleted}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(on) =>
                patch({ completed: on ? false : undefined })
              }
            >
              Hide completed tasks
            </DropdownMenuCheckboxItem>
            {/* With nothing to check against it opens the levels dialog
                instead -- a disabled item would be a filter that looks broken
                rather than one that needs a number first. */}
            <DropdownMenuCheckboxItem
              checked={hidingUnmet}
              onSelect={(event) => {
                if (!profileIsEmpty) event.preventDefault();
              }}
              onCheckedChange={(on) =>
                profileIsEmpty
                  ? onEditProfile()
                  : patch({ reqs: on ? "met" : undefined })
              }
            >
              Hide monsters you can't face yet
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
            className={`h-9 px-2 text-xs ${isEmptyQuery(query) ? "invisible" : ""}`}
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
  );
}
