import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock, X } from "lucide-react";
import { dragId } from "@/lib/dnd";
import type { TaskListEntry } from "@/lib/tasklist";
import { TierBadge } from "@/components/tier-badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * One planned task: name, tier, and whether it's done.
 *
 * Deliberately a narrow view. Everything else -- description, Comp%, the wiki
 * links -- is what the table on the left is for.
 *
 * The order is the order of the rows; it is not also written down beside them.
 * A number that only ever reads 1, 2, 3 down a list you can already see costs a
 * column of a panel this narrow to say nothing. It survives where it is the only
 * way to know -- the drag handle's label, which is what a screen reader hears
 * while lifting a row.
 */
export function Entry({
  entry,
  requires,
  manualTracking,
  onToggleCompleted,
  onRemove,
}: {
  entry: TaskListEntry;
  /**
   * What this task still needs, or null when nothing. The table lets you plan
   * one of these deliberately; the lock rides along so the plan says which of
   * its rows you can't walk up to yet, rather than looking like the rest.
   */
  requires: string | null;
  /**
   * The panel's checkbox is the table's checkbox in a second place, so it goes
   * when that one does. The strike-through stays: what's done is still worth
   * seeing, it just isn't this browser's answer to give.
   */
  manualTracking: boolean;
  onToggleCompleted: (wikiId: number) => void;
  onRemove: (wikiId: number) => void;
}) {
  const { task, position, completed } = entry;
  const showLock = requires !== null && !completed;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dragId("list", task.wikiId) });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`bg-card flex items-start gap-2 rounded-md border p-2 ${
        // Left in place but faded while it's being dragged, so the gap you're
        // aiming at stays where you expect it.
        isDragging ? "opacity-40" : ""
      }`}
    >
      {/* The handle, not the whole row: the row holds a checkbox and a remove
          button, and a drag surface over the top of those would eat their clicks.
          dnd-kit wires this for the keyboard too -- space to lift, arrows to
          move, space to drop -- which is the accessible path to reordering. */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder "${task.name}", currently ${position}`}
        className="text-muted-foreground hover:text-foreground mt-0.5 cursor-grab touch-none rounded p-0.5 active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      {manualTracking && (
        <Checkbox
          checked={completed}
          onCheckedChange={() => onToggleCompleted(task.wikiId)}
          aria-label={`Mark "${task.name}" as ${completed ? "not completed" : "completed"}`}
          className="mt-0.5"
        />
      )}

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${completed ? "text-muted-foreground line-through" : ""}`}
        >
          {task.name}
          {/* Inline, so it follows the last word rather than sitting at the end
              of a box the name may not fill. Gone once the task is ticked: a
              requirement on something you have done is a contradiction, and the
              app takes your word for that over its own. */}
          {showLock && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-1 inline-flex align-text-bottom text-amber-500/70">
                  <Lock className="size-3.5" aria-hidden />
                  {/* The tooltip is hover-only on a span, so the reason is
                      spelled out here for anyone not using a pointer. */}
                  <span className="sr-only">{requires}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>{requires}</TooltipContent>
            </Tooltip>
          )}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-xs">
          <TierBadge tier={task.tier} />
          {task.monster && (
            <span className="text-muted-foreground truncate">
              {task.monster}
            </span>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(task.wikiId)}
        aria-label={`Remove "${task.name}" from my list`}
        className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}
