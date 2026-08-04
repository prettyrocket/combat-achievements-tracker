import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { dragId } from "@/lib/dnd";
import type { TaskListEntry } from "@/lib/tasklist";
import { TierBadge } from "@/components/tier-badge";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * One planned task: position, name, tier, and whether it's done.
 *
 * Deliberately a narrow view. Everything else -- description, Comp%, the wiki
 * links -- is what the table on the left is for.
 */
export function Entry({
  entry,
  manualTracking,
  onToggleCompleted,
  onRemove,
}: {
  entry: TaskListEntry;
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

      <span className="text-muted-foreground mt-0.5 w-4 shrink-0 text-right text-xs tabular-nums">
        {position}
      </span>

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
