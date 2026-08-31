// Ids for the drag-and-drop layer.
//
// A task can be on screen three times at once -- as a row in the table, as an
// entry in the panel, and as a row in the plan overlay over the top of both --
// and dnd-kit needs every draggable to be unique within one context. So ids
// carry where they came from as well as which task they are, which the drop
// handler needs anyway: dragging a row *into* the plan and dragging an entry
// *within* it are different gestures with the same payload.

export const TASKLIST_DROPPABLE = "tasklist-drop";

export type DragOrigin = "table" | "list" | "plan";

export function dragId(origin: DragOrigin, wikiId: number): string {
  return `${origin}:${wikiId}`;
}

export interface ParsedDragId {
  origin: DragOrigin;
  wikiId: number;
}

/** Null for anything that isn't one of ours -- the droppable's own id, most of
 *  all, which shows up as `over` whenever you drop on empty panel space. */
export function parseDragId(id: unknown): ParsedDragId | null {
  if (typeof id !== "string") return null;
  const [origin, raw] = id.split(":");
  if (origin !== "table" && origin !== "list" && origin !== "plan") return null;
  const wikiId = Number(raw);
  if (!Number.isInteger(wikiId)) return null;
  return { origin, wikiId };
}
