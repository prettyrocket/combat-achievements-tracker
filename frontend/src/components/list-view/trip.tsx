import type { MouseEvent, ReactNode } from "react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical, ListX } from "lucide-react";
import { tripDragId } from "@/lib/dnd";
import type { Trip } from "@/lib/tasklist";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * One stop of the route: its heading, and its tasks underneath.
 *
 * A sortable item itself, in the same column as its tasks, so a trip moves the
 * way a task does -- by a grip, in edit mode, to wherever you put it down. The
 * whole section moves rather than just the heading, because what you are
 * moving is the visit and everything you'd do on it.
 */
export function TripSection({
  trip,
  anchor,
  shut,
  editing,
  taskIds,
  sectionRef,
  onToggle,
  onRemove,
  children,
}: {
  trip: Trip;
  anchor: number;
  shut: boolean;
  editing: boolean;
  /**
   * Every visible task in the list, in order. Handed back down so the rows
   * inside sort against each other rather than against the trips: useSortable
   * reads the nearest context, and the nearest one above a row would otherwise
   * be the trips'. All of them rather than this trip's, so a task can still be
   * dragged out of one trip and into another.
   */
  taskIds: readonly string[];
  sectionRef: (node: HTMLElement | null) => void;
  /** The heading was clicked; Alt is the caller's to read. */
  onToggle: (event: MouseEvent) => void;
  /** Takes this trip's tasks off the plan, once confirmed. */
  onRemove: () => void;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tripDragId(anchor), disabled: !editing });
  const name = trip.monster ?? "Any monster";

  return (
    <section
      ref={(node) => {
        setNodeRef(node);
        sectionRef(node);
      }}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // Above its neighbours while it travels, or the trips it passes paint
      // over it. Faded like a task in hand, for the same reason.
      className={isDragging ? "relative z-20 opacity-60" : ""}
    >
      {/* Sticky, so the boss whose tasks you are reading stays overhead while
          you scroll them.

          Laid out like a task row -- grip, body, remove -- so the heading is
          the first line of the trip's column rather than a strip of its own
          above it. The name is text, not a button: the arrow after it is what
          opens and shuts. */}
      <h3 className="bg-background sticky top-0 z-10 flex items-center gap-1 py-2 text-base font-semibold">
        {/* In the cards' handle column, so every grip in the list is in one
            line down the left edge, and what you hold a trip by looks like what
            you hold a task by. */}
        {editing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                aria-label={`Reorder ${name}`}
                className="text-muted-foreground hover:text-foreground -ml-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 font-normal active:cursor-grabbing"
              >
                <GripVertical className="size-4" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>Drag to move this trip</TooltipContent>
          </Tooltip>
        )}
        {/* Flush with the cards' left edge rather than indented to their
            text: the heading sits over the column of cards, not inside one. */}
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className={`truncate ${trip.monster === null ? "italic" : ""}`}>
            {name}
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!shut}
            aria-label={`${shut ? "Show" : "Hide"} the ${name} tasks`}
            className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded p-0.5 transition-colors"
          >
            {shut ? (
              <ChevronRight className="size-4" aria-hidden />
            ) : (
              <ChevronDown className="size-4" aria-hidden />
            )}
          </button>
        </div>
        {/* At the far end, in the cards' remove column, red with the same
            icon: the trip's version of the same act. Asked about for the same
            reason as a task, and more so -- this takes the whole visit. */}
        {editing && (
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Remove the ${name} trip from my list`}
                    className="text-destructive hover:bg-destructive/15 ml-auto shrink-0 rounded p-1 font-normal transition-colors"
                  >
                    <ListX className="size-4" aria-hidden />
                  </button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Remove this trip</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove the {name} trip?</AlertDialogTitle>
                <AlertDialogDescription>
                  {trip.entries.length === 1
                    ? "Its task comes"
                    : `Its ${trip.entries.length} tasks come`}{" "}
                  off the plan. Anything you have ticked stays ticked.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </h3>
      {!shut && (
        <SortableContext
          items={[...taskIds]}
          strategy={verticalListSortingStrategy}
        >
          {children}
        </SortableContext>
      )}
    </section>
  );
}
