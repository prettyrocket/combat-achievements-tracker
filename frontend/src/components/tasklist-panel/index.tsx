// The plan, docked to the right of the table.
//
// Deliberately a *narrow* view of a task: position, name, tier, and whether it's
// done. Everything else -- description, Comp%, the monster pivot -- is what the
// table on the left is for. The panel answers one question, "what am I doing
// next", and stays readable at a third of the width because it doesn't try to
// answer any of the others.
//
// Two shapes, in two files: the rail when it's put away, and this when it isn't.
// The droppable is registered here either way, so a row dragged toward a closed
// panel still has something to hit.

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronRight, ListChecks, ListPlus, X } from "lucide-react";
import { TASKLIST_DROPPABLE, dragId } from "@/lib/dnd";
import { percent } from "@/lib/progress-summary";
import type { RewardTier } from "@/lib/rewards";
import { summarize, type TaskListEntry } from "@/lib/tasklist";
import { CollapsedRail } from "@/components/tasklist-panel/collapsed-rail";
import { Entry } from "@/components/tasklist-panel/entry";
import { PlanReward } from "@/components/tasklist-panel/plan-reward";
import { Button } from "@/components/ui/button";

export interface TaskListPanelProps {
  entries: readonly TaskListEntry[];
  /** The reward thresholds, and the points already banked against them, so the
   *  panel can say what the plan is worth on top of what it costs. */
  rewardTiers: readonly RewardTier[];
  pointsEarned: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleCompleted: (wikiId: number) => void;
  onRemove: (wikiId: number) => void;
  onClear: () => void;
}

export function TaskListPanel({
  entries,
  rewardTiers,
  pointsEarned,
  open,
  onOpenChange,
  onToggleCompleted,
  onRemove,
  onClear,
}: TaskListPanelProps) {
  const summary = summarize(entries);
  // Registered even while collapsed, so dragging a row toward a closed panel
  // still has something to hit -- see the rail.
  const { setNodeRef, isOver } = useDroppable({ id: TASKLIST_DROPPABLE });

  if (!open) {
    return (
      <CollapsedRail
        summary={summary}
        isOver={isOver}
        onOpen={() => onOpenChange(true)}
        dropRef={setNodeRef}
      />
    );
  }

  return (
    <aside aria-label="My list" className="w-full shrink-0 lg:h-full lg:w-80">
      <div
        ref={setNodeRef}
        className={`flex max-h-[45vh] flex-col rounded-lg border transition-colors lg:h-full lg:max-h-full ${
          isOver ? "border-foreground bg-muted/40" : ""
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <ListChecks className="size-4 shrink-0" aria-hidden />
            My list
            {/* Two figures, one line: tasks left to do, and what they're worth.
                Points are the half that survives when the panel is narrow, so
                they read as "of 34 pts" rather than a bare second fraction. */}
            <span className="text-muted-foreground truncate font-normal tabular-nums">
              {summary.completed}/{summary.total} done ·{" "}
              <span className="whitespace-nowrap">
                {summary.pointsEarned}/{summary.pointsTotal} pts
              </span>
            </span>
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-expanded
            aria-label="Collapse my list"
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>

        {summary.total > 0 && (
          <div className="bg-muted h-1 w-full shrink-0 overflow-hidden">
            <div
              className="bg-foreground h-full transition-[width] duration-300"
              style={{ width: `${percent(summary.completed, summary.total)}%` }}
            />
          </div>
        )}

        <PlanReward
          rewardTiers={rewardTiers}
          pointsEarned={pointsEarned}
          outstanding={summary.pointsTotal - summary.pointsEarned}
        />

        {entries.length === 0 ? (
          <p className="text-muted-foreground px-3 py-8 text-center text-sm">
            Drag tasks here to plan your next session — or use the{" "}
            {/* The icon an unlisted row actually shows, so this reads as an
                instruction rather than a riddle. */}
            <ListPlus className="inline size-3.5" aria-hidden /> button on any
            row.
          </p>
        ) : (
          <>
            <SortableContext
              items={entries.map((entry) => dragId("list", entry.task.wikiId))}
              strategy={verticalListSortingStrategy}
            >
              {/* The one part of the panel that scrolls: the header, the meter
                  and Clear all stay put, however long the plan gets. */}
              <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
                {entries.map((entry) => (
                  <Entry
                    key={entry.task.wikiId}
                    entry={entry}
                    onToggleCompleted={onToggleCompleted}
                    onRemove={onRemove}
                  />
                ))}
              </ul>
            </SortableContext>

            <div className="flex shrink-0 justify-end border-t px-2 py-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClear}
                className="h-6 px-2 text-xs"
              >
                <X className="size-3" aria-hidden />
                Clear list
              </Button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
