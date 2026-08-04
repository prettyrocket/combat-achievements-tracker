import { ChevronDown, ChevronRight, ListPlus, Lock } from "lucide-react";
import type { GroupItem } from "@/components/task-table/use-row-items";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * A monster's banner: collapses its rows, and puts the whole group on the plan
 * in one click.
 *
 * Two buttons rather than one clickable row. The row's job is collapsing, which
 * is cheap and reversible; adding twenty tasks to a plan is neither, and a strip
 * that did the safe thing everywhere except one patch is how you end up doing
 * the expensive thing by accident.
 */
export function GroupBanner({
  group,
  index,
  columnCount,
  measureRef,
  collapsed,
  onToggleCollapsed,
  completed,
  onList,
  requires,
  onAddManyToList,
}: {
  group: GroupItem;
  index: number;
  columnCount: number;
  measureRef: (node: HTMLElement | null) => void;
  collapsed: boolean;
  onToggleCollapsed: (monster: string | null) => void;
  completed: ReadonlySet<number>;
  onList: ReadonlySet<number>;
  /** Why this monster can't go on the plan, or null when it can. Bulk-adding is
   *  the row control twenty times over, so it locks on the same condition. */
  requires: string | null;
  onAddManyToList: (wikiIds: number[]) => void;
}) {
  const name = group.monster ?? "Any monster";
  // A plan is what's left to do. Filtered to "All tasks" a group carries the
  // ones you've already finished, and putting those on the list is the one
  // thing this button must never quietly do.
  const toAdd = group.wikiIds.filter(
    (id) => !completed.has(id) && !onList.has(id),
  );
  const Chevron = collapsed ? ChevronRight : ChevronDown;

  return (
    <tr data-index={index} ref={measureRef} className="bg-muted/60">
      <td colSpan={columnCount} className="border-y p-0">
        {/* Not spread across the full width of the table: these two belong to
            the group's name, so they sit with it. */}
        <div className="flex items-center gap-1 px-2 py-1">
          <button
            type="button"
            onClick={() => onToggleCollapsed(group.monster)}
            aria-expanded={!collapsed}
            className="hover:text-foreground text-foreground flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs font-semibold transition-colors"
          >
            <Chevron className="size-3.5 shrink-0 opacity-70" aria-hidden />
            <span
              className={`truncate ${group.monster === null ? "italic" : ""}`}
            >
              {name}
            </span>
            <span className="text-muted-foreground shrink-0 font-normal tabular-nums">
              {group.wikiIds.length}
            </span>
          </button>

          {requires !== null ? (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Not `disabled`: a disabled button takes neither hover nor
                    focus, and the reason is the whole point of the lock. */}
                <button
                  type="button"
                  onClick={(event) => event.preventDefault()}
                  aria-disabled
                  aria-label={`Can't plan ${name} yet. ${requires}`}
                  className="flex shrink-0 cursor-not-allowed items-center gap-1 rounded px-1.5 py-0.5 text-xs text-amber-500/70 hover:text-amber-500"
                >
                  <Lock className="size-3.5" aria-hidden />
                  Locked
                </button>
              </TooltipTrigger>
              <TooltipContent>{requires}</TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={() => onAddManyToList(toAdd)}
              disabled={toAdd.length === 0}
              title={
                toAdd.length === 0
                  ? `Nothing left to plan for ${name} — every task is done or already on your list`
                  : `Add ${toAdd.length} unfinished ${name} task${toAdd.length === 1 ? "" : "s"} to my list`
              }
              className="text-muted-foreground hover:bg-background hover:text-foreground flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-40"
            >
              <ListPlus className="size-3.5" aria-hidden />
              {/* The number is what makes this safe to click: it counts what is
                  actually about to be added, not how big the group is. */}
              Add {toAdd.length === 0 ? "all" : toAdd.length}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
