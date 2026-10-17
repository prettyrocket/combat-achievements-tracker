// Search and the menu of hide options.
//
// Every control writes through to the same TaskQuery, which is serialised to the
// URL -- so there is no local state here to drift out of sync with the address
// bar, and every visible arrangement is a link someone can send.
//
// Sort left this bar for the column headers, which is where you were already
// pointing when you decided to re-sort -- and the Monster, Type and Tier filters
// followed it there for the same reason.

import { Ellipsis, Search, X } from "lucide-react";
import { isEmptyQuery } from "@/lib/task-query";
import type { TaskQuery } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export interface FilterBarProps {
  query: TaskQuery;
  onChange: (next: TaskQuery) => void;
  onClear: () => void;
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
  resultCount,
  totalCount,
  profileIsEmpty,
  onEditProfile,
}: FilterBarProps) {
  const patch = (partial: Partial<TaskQuery>) =>
    onChange({ ...query, ...partial });
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
    </section>
  );
}
