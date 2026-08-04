// Where the plan sits relative to the table.
//
// Four positions, but only two *shapes*: beside the table, or stacked with it.
// That distinction is the one the panel actually cares about -- a 320px column
// and a full-width bar are different components' worth of layout -- so it gets a
// name of its own rather than being re-derived at each of the four call sites.

export type ListPosition = "left" | "right" | "above" | "below";

/**
 * Where it has always been. Right rather than left because the table is read
 * left to right and the plan is what you turn to *after* reading a row.
 */
export const DEFAULT_LIST_POSITION: ListPosition = "right";

export const LIST_POSITIONS: readonly {
  id: ListPosition;
  label: string;
}[] = [
  { id: "left", label: "Left of the table" },
  { id: "right", label: "Right of the table" },
  { id: "above", label: "Above the table" },
  { id: "below", label: "Below the table" },
];

const IDS: ReadonlySet<string> = new Set(
  LIST_POSITIONS.map((position) => position.id),
);

export function isListPosition(value: unknown): value is ListPosition {
  return typeof value === "string" && IDS.has(value);
}

/**
 * Whether this position puts the panel *beside* the table rather than above or
 * below it.
 *
 * Only true on a wide screen even then: under `lg` a 320px column leaves the
 * table unusable, so left and right both stack. Above and below stack at every
 * width, because that is what they were asked for.
 */
export function isSideDocked(position: ListPosition): boolean {
  return position === "left" || position === "right";
}
