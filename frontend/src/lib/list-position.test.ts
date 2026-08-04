import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIST_POSITION,
  LIST_POSITIONS,
  isListPosition,
  isSideDocked,
} from "@/lib/list-position";

describe("isListPosition", () => {
  it("accepts every position the picker offers", () => {
    for (const { id } of LIST_POSITIONS) expect(isListPosition(id)).toBe(true);
  });

  // It guards a localStorage read, which is hand-editable and can hold anything
  // a previous version wrote. A bad value has to fall back, not lay out the app
  // with a class name nobody generated.
  it.each([["middle"], [""], [null], [undefined], [2], [["left"]], [{}]])(
    "rejects %p",
    (value) => {
      expect(isListPosition(value)).toBe(false);
    },
  );

  it("has a default it would accept itself", () => {
    expect(isListPosition(DEFAULT_LIST_POSITION)).toBe(true);
  });
});

describe("isSideDocked", () => {
  it("is the two that put the panel beside the table", () => {
    expect(isSideDocked("left")).toBe(true);
    expect(isSideDocked("right")).toBe(true);
  });

  it("is neither of the two that stack", () => {
    expect(isSideDocked("above")).toBe(false);
    expect(isSideDocked("below")).toBe(false);
  });
});
