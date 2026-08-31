import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Lock, Undo2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { dragId } from "@/lib/dnd";
import type { TaskListEntry } from "@/lib/tasklist";
import { taskWikiUrl } from "@/lib/wiki";
import { WikiName } from "@/components/task-table/cells";
import { TierBadge } from "@/components/tier-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * One planned task, at the size you can actually work from.
 *
 * The panel's entry deliberately shows a name and a tier, because at 320px
 * anything more is a wall. This is the same task with the thing that was
 * missing: the description. A checklist you have to leave to find out what a
 * line means is a checklist you stop opening, and going back to the table for
 * every row was the tax the plan was quietly charging.
 */
export function PlanRow({
  entry,
  requires,
  inTrip,
  onToggleCompleted,
  onRemove,
}: {
  entry: TaskListEntry;
  /** What this task needs first, or null when nothing. */
  requires: string | null;
  /** Whether the trip heading above already names the monster. */
  inTrip: boolean;
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
  } = useSortable({ id: dragId("plan", task.wikiId) });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // Done is a state of the whole row, not a mark on one corner of it: green
      // and stood down, so a finished plan reads as a column of things you no
      // longer have to look at. Dragging still wins the fade -- that one says
      // "this is in your hand", and it outranks anything the row is otherwise.
      className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
        completed ? "border-emerald-500/30 bg-emerald-500/10" : "bg-card"
      } ${isDragging ? "opacity-40" : completed ? "opacity-70" : ""}`}
    >
      {/* The handle, not the row: the row holds a wiki link and two buttons at
          the far end, and a drag surface over those would eat their clicks. */}
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent>Drag to reorder</TooltipContent>
      </Tooltip>

      <div className="min-w-0 flex-1">
        <div
          className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-medium ${
            completed ? "text-muted-foreground line-through" : ""
          }`}
        >
          {/* The name is the wiki page, as it is in the table. Same gesture in
              both places, and it is the answer to most "what does this even
              mean" questions the description leaves standing. */}
          <WikiName value={task.name} href={taskWikiUrl(task.name)} />
          {showLock && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-xs font-normal text-amber-500/80">
                  <Lock className="size-3.5" aria-hidden />
                  {/* Room for the words here, unlike the panel, where the same
                      sentence has to hide inside a tooltip to fit. */}
                  {requires}
                </span>
              </TooltipTrigger>
              <TooltipContent>{requires}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* No second dimming for a finished task: the row is already standing
            down as a whole, and stacking the two makes the description of
            something you just did the hardest line on screen to read. */}
        <p className="text-muted-foreground mt-1 text-sm">{task.description}</p>

        <p className="mt-1.5 flex items-center gap-2 text-xs">
          <TierBadge tier={task.tier} />
          <span className="text-muted-foreground tabular-nums">
            {task.points} pt{task.points === 1 ? "" : "s"}
          </span>
          {/* The monster only where the heading isn't already saying it. */}
          {!inTrip && task.monster && (
            <span className="text-muted-foreground truncate">
              {task.monster}
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {/* A button rather than the checkbox the panel and the table use, and on
            the doing end of the row rather than the reading end: you come here
            with the game open beside you, finish something, and reach for the
            end of the line you just read.

            Always here, unlike those two, which both go when an account is
            keeping the answers -- a checklist you cannot tick is not one. An
            import still wins the next time it runs and rewrites what it fetched,
            this row included.

            The way back is the same button, because the mistake this guards
            against is the click itself. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onToggleCompleted(task.wikiId)}
              aria-pressed={completed}
              aria-label={`Mark "${task.name}" as ${completed ? "not completed" : "completed"}`}
              className={`rounded p-1 transition-colors ${
                completed
                  ? "text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {completed ? (
                <Undo2 className="size-4" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {completed ? "Mark as not done" : "Mark as done"}
          </TooltipContent>
        </Tooltip>

        {/* Asked about, unlike everywhere else this button appears. In the table
            and the panel it sits beside the thing that put it there, so an
            accident is one click to undo. Here it is the last control on a row
            you may have spent a while arranging, and the task takes its place in
            the plan with it -- add it back and it lands at the bottom, not where
            it was. */}
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  aria-label={`Remove "${task.name}" from my list`}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Remove from my list</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from my list?</AlertDialogTitle>
              {/* The name, because a row of icons all look the same at the
                  moment you realise you clicked the wrong one. */}
              <AlertDialogDescription>
                “{task.name}” comes off the plan. Anything you have ticked stays
                ticked.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction onClick={() => onRemove(task.wikiId)}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}
