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
  /** What this monster needs first, or null when nothing. Bulk-adding is the row
   *  control twenty times over, so it wears the lock on the same condition. */
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

  const addButton = (
    <button
      type="button"
      onClick={() => onAddManyToList(toAdd)}
      disabled={toAdd.length === 0}
      // The reason lives in the tooltip when the monster is gated, so `title`
      // stands down there rather than opening a second one beside it.
      title={
        requires !== null
          ? undefined
          : toAdd.length === 0
            ? `Nothing left to plan for ${name} — every task is done or already on your list`
            : `Add ${toAdd.length} unfinished ${name} task${toAdd.length === 1 ? "" : "s"} to my list`
      }
      aria-label={
        requires !== null
          ? `Add ${toAdd.length} unfinished ${name} task${toAdd.length === 1 ? "" : "s"} to my list. ${requires}`
          : undefined
      }
      className={`flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-40 ${
        requires !== null
          ? "hover:bg-background text-amber-500/70 hover:text-amber-500"
          : "text-muted-foreground hover:bg-background hover:text-foreground"
      }`}
    >
      {requires !== null ? (
        <Lock className="size-3.5" aria-hidden />
      ) : (
        <ListPlus className="size-3.5" aria-hidden />
      )}
      {/* The number is what makes this safe to click: it counts what is actually
          about to be added, not how big the group is. */}
      Add {toAdd.length === 0 ? "all" : toAdd.length}
    </button>
  );

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
              {/* A live button, so the reason is reachable by hover and by
                  focus. When there is nothing left to add it is disabled and
                  takes neither -- but then there is nothing to explain. */}
              <TooltipTrigger asChild>{addButton}</TooltipTrigger>
              <TooltipContent>{requires}</TooltipContent>
            </Tooltip>
          ) : (
            addButton
          )}
        </div>
      </td>
    </tr>
  );
}
