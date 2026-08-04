import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ListChecks,
} from "lucide-react";
import { isSideDocked, type ListPosition } from "@/lib/list-position";
import type { TaskListSummary } from "@/lib/tasklist";

/**
 * The panel put away: a narrow rail beside the table, a full-width bar where
 * the panel stacks.
 *
 * One element, two shapes. Which one it takes used to be purely a matter of
 * width -- a rail at `lg`, a bar below it. Now it is the position too: above and
 * below are the bar at every width, because a 48px rail lying across the top of
 * the table is nobody's idea of "above".
 *
 * Collapsing must never be a way to lose the list -- there is always something
 * to click to get it back, and the rail stays a drop target so a row dragged
 * toward a closed panel still has something to hit.
 *
 * The rail label used to be turned on its side. Sideways text for two words is a
 * party trick that reads badly, so the wide form is now the icon and the count --
 * both legible the normal way up -- with the words kept for the bar, where there
 * is room for them.
 */
export function CollapsedRail({
  summary,
  position,
  isOver,
  onOpen,
  dropRef,
}: {
  summary: TaskListSummary;
  position: ListPosition;
  /** True while a dragged row is over the rail. */
  isOver: boolean;
  onOpen: () => void;
  dropRef: (node: HTMLElement | null) => void;
}) {
  const docked = isSideDocked(position);
  // Pointing back the way the panel will come from.
  const Expand = {
    left: ChevronRight,
    right: ChevronLeft,
    above: ChevronDown,
    below: ChevronUp,
  }[position];

  return (
    <aside
      ref={dropRef}
      aria-label="My list"
      className={`w-full shrink-0 ${docked ? "lg:h-full lg:w-12" : ""}`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={false}
        title={
          isOver
            ? "Drop to add"
            : `My list — ${summary.completed}/${summary.total} done, ${summary.pointsEarned}/${summary.pointsTotal} points`
        }
        className={`hover:bg-muted flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
          docked ? "lg:h-full lg:flex-col lg:justify-start lg:px-0 lg:py-3" : ""
        } ${isOver ? "border-foreground bg-muted" : ""}`}
      >
        <ListChecks className="size-4 shrink-0" aria-hidden />
        <span className="text-xs font-medium tabular-nums">
          {summary.total}
        </span>
        {/* What the queue is worth, kept even on the 48px rail: it's the figure
            that decides whether the list is a session or a fortnight, and it
            fits at this size where a second fraction wouldn't. */}
        {summary.total > 0 && (
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {summary.pointsTotal} pts
          </span>
        )}
        {/* Words on the bar, where there is room for them; the rail says the
            same thing with its icon and its count. */}
        <span
          className={`text-muted-foreground text-xs ${docked ? "lg:hidden" : ""}`}
        >
          {isOver ? "Drop to add" : "My list"}
        </span>
        {/* The rail's own affordance, instead of a word lying on its side. The
            bar doesn't need it: it says "My list" in words. */}
        {docked && (
          <Expand
            className="text-muted-foreground hidden size-4 lg:block"
            aria-hidden
          />
        )}
      </button>
    </aside>
  );
}
