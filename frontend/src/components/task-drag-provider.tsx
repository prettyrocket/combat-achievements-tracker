// Dragging a task from the table onto the plan.
//
// Everything the drag needs is here: the sensors, where a drop lands, and the
// card that follows the cursor. The two ends of the gesture live elsewhere --
// the table's rows are draggables, the panel is the droppable -- and they only
// have to agree on the id format in lib/dnd.ts.

import { useCallback, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { TASKLIST_DROPPABLE, parseDragId } from "@/lib/dnd";
import { BY_ID } from "@/lib/task-index";
import { TierBadge } from "@/components/tier-badge";

export interface TaskDragProviderProps {
  /** The plan, in order -- a drop is positional, so it needs to be read. */
  list: readonly number[];
  /** Drop or reorder: move `wikiId` to `index`, adding it if it's new. */
  onInsertAt: (wikiId: number, index: number) => void;
  children: ReactNode;
}

export function TaskDragProvider({
  list,
  onInsertAt,
  children,
}: TaskDragProviderProps) {
  const [dragging, setDragging] = useState<number | null>(null);

  // Distance-activated, so a press that turns into a click still reaches the
  // checkbox and the wiki links inside the row rather than starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    setDragging(parseDragId(active.id)?.wikiId ?? null);
  }, []);

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setDragging(null);
      if (!over) return;

      const source = parseDragId(active.id);
      if (!source) return;

      const target = parseDragId(over.id);
      if (target) {
        // Dropped onto an entry: take that entry's place, pushing it down.
        onInsertAt(source.wikiId, list.indexOf(target.wikiId));
        return;
      }

      // Dropped on the panel itself rather than any entry -- append. Only the
      // panel is a valid target, so anything else is a drag that went nowhere.
      if (over.id === TASKLIST_DROPPABLE)
        onInsertAt(source.wikiId, list.length);
    },
    [list, onInsertAt],
  );

  const draggingTask = dragging === null ? null : BY_ID.get(dragging);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      {children}

      {/* Follows the cursor across the gap between table and panel -- without it
          the row stays put and the drag has nothing to show for itself.

          It is a panel entry, at the panel's width -- the same grip, the same
          name over the same tier and monster, in a card the same size. What you
          are carrying should be what you are about to put down, so the drop is
          a thing landing where it already looked like it belonged rather than a
          label turning into a row on arrival. A table row torn out of its
          columns was neither, and it is the same card whichever end the drag
          started at, so filling the plan and reordering it read as one gesture.

          What isn't copied is the state: no checkbox, no lock, no strike. Those
          answer questions about a task sitting still, and this one is moving.

          Only the shadow says "held", since nothing else here is allowed to
          differ, and the cursor, which dnd-kit leaves alone -- without the class
          it goes back to an arrow the moment the row leaves the table. */}
      <DragOverlay dropAnimation={null}>
        {draggingTask && (
          <div className="bg-card flex w-80 max-w-[80vw] cursor-grabbing items-start gap-2 rounded-md border p-2 shadow-xl">
            <GripVertical
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{draggingTask.name}</p>
              <p className="mt-0.5 flex items-center gap-2 text-xs">
                <TierBadge tier={draggingTask.tier} />
                {draggingTask.monster && (
                  <span className="text-muted-foreground truncate">
                    {draggingTask.monster}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
