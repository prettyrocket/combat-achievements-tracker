import { describe, expect, it } from "vitest";
import { TASKLIST_DROPPABLE, dragId, parseDragId } from "@/lib/dnd";

describe("dragId / parseDragId", () => {
  it("round-trips both origins", () => {
    expect(parseDragId(dragId("table", 42))).toEqual({
      origin: "table",
      wikiId: 42,
    });
    expect(parseDragId(dragId("list", 42))).toEqual({
      origin: "list",
      wikiId: 42,
    });
  });

  // The same task can be on screen twice; dnd-kit needs the two to be distinct.
  it("gives the same task different ids in the table and the panel", () => {
    expect(dragId("table", 42)).not.toBe(dragId("list", 42));
  });

  // This lands in `over` whenever you drop on empty panel space, and the handler
  // tells "an entry" from "the panel itself" by exactly this returning null.
  it("rejects the droppable container id", () => {
    expect(parseDragId(TASKLIST_DROPPABLE)).toBeNull();
  });

  it.each([
    ["an unknown origin", "monster:1"],
    ["no origin", "42"],
    ["a non-numeric id", "table:abc"],
    ["a fractional id", "table:1.5"],
    ["an empty string", ""],
    ["a number", 42],
    ["undefined", undefined],
    ["null", null],
  ])("returns null for %s", (_label, input) => {
    expect(parseDragId(input)).toBeNull();
  });
});
