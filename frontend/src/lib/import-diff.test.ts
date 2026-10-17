import { describe, expect, it } from "vitest";
import { diffAgainst, diffIsNoop } from "@/lib/import-diff";

const incoming = (ids: number[], dropped = 0) => ({ ids, dropped });

describe("diffAgainst", () => {
  it("splits incoming ids into new and already-complete", () => {
    const diff = diffAgainst(incoming([1, 2, 3]), new Set([3]));
    expect(diff.newlyCompleted).toEqual([1, 2]);
    expect(diff.alreadyCompleted).toEqual([3]);
  });

  // An import always replaces: the account is the authority on what's done, so
  // a tick this import doesn't list is a tick that shouldn't be there.
  it("reports what will be un-ticked, sorted", () => {
    const diff = diffAgainst(incoming([1, 2, 3]), new Set([101, 3, 100]));
    expect(diff.removed).toEqual([100, 101]);
    expect(diff.newlyCompleted).toEqual([1, 2]);
  });

  it("never removes on account of an id it did not recognise", () => {
    const diff = diffAgainst(incoming([1], 1), new Set([1]));
    expect(diff.removed).toEqual([]);
    expect(diff.dropped).toBe(1);
  });
});

describe("diffIsNoop", () => {
  it("is true when the import matches current progress exactly", () => {
    expect(diffIsNoop(diffAgainst(incoming([1, 2]), new Set([1, 2])))).toBe(
      true,
    );
  });

  // The case the old "no new tasks" check got wrong: an import that only removes
  // is a real action, and treating it as a no-op disables the apply button on it.
  it("is false when it only removes", () => {
    const diff = diffAgainst(incoming([1]), new Set([1, 2, 3]));
    expect(diff.newlyCompleted).toEqual([]);
    expect(diff.removed).toEqual([2, 3]);
    expect(diffIsNoop(diff)).toBe(false);
  });
});
