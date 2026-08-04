import { useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { dragId } from "@/lib/dnd";
import type { TaskRow } from "@/lib/types";
import { TableRow } from "@/components/ui/table";

/**
 * Rows are draggable so they can be thrown at the panel. The pointer sensor is
 * distance-activated (see the drag provider), which is what keeps this from
 * swallowing clicks on the checkbox, the plan control and the two wiki links
 * living inside the same row.
 *
 * `measureRef` is the virtualiser's: rows wrap to different heights (a long
 * description is three lines), so each one reports its real height rather than
 * trusting the estimate.
 */
export function DraggableRow({
  task,
  isCompleted,
  locked,
  index,
  measureRef,
  children,
}: {
  task: TaskRow;
  isCompleted: boolean;
  /**
   * Requirements this row doesn't meet yet. Dragging is the third way onto the
   * plan, after the row's own button and the group banner's, so it has to
   * refuse for the same reason the other two do -- otherwise the lock is
   * decoration you can drag straight past.
   */
  locked: boolean;
  index: number;
  measureRef: (node: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId("table", task.wikiId),
    disabled: locked,
  });

  const ref = useCallback(
    (node: HTMLTableRowElement | null) => {
      setNodeRef(node);
      measureRef(node);
    },
    [setNodeRef, measureRef],
  );

  return (
    <TableRow
      ref={ref}
      data-index={index}
      data-state={isCompleted && "selected"}
      className={isDragging ? "opacity-40" : undefined}
      {...attributes}
      {...listeners}
      // The row is a drag surface, not a button: dnd-kit's default role would
      // tell a screen reader otherwise, and the ☰ button in the row is the
      // documented way in for anyone not using a pointer.
      role={undefined}
      tabIndex={undefined}
    >
      {children}
    </TableRow>
  );
}
