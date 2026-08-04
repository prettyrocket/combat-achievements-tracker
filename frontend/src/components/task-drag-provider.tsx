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
import { TASKLIST_DROPPABLE, parseDragId } from "@/lib/dnd";
import { BY_ID } from "@/lib/task-index";

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
  // checkbox and the monster pivot inside the row rather than starting a drag.
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
          the row stays put and the drag has nothing to show for itself. */}
      <DragOverlay dropAnimation={null}>
        {draggingTask && (
          <div className="bg-card rounded-md border px-3 py-2 text-sm font-medium shadow-lg">
            {draggingTask.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
