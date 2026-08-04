// The hook itself is React furniture and there is no DOM in this suite, so what
// gets tested is the one rule inside it that a person actually decided:
// when the checkbox column is there.

import { describe, expect, it } from "vitest";
import { resolveManualTracking } from "@/lib/use-ui-prefs";

describe("resolveManualTracking", () => {
  it("is on for a browser that tracks by hand", () => {
    expect(resolveManualTracking(null, "manual")).toBe(true);
  });

  it("is on after restoring a backup -- that is your own tracking coming home", () => {
    expect(resolveManualTracking(null, "file")).toBe(true);
  });

  it.each(["wikisync", "runeprofile", "sharecode"] as const)(
    "is off when %s is keeping the answers",
    (source) => {
      expect(resolveManualTracking(null, source)).toBe(false);
    },
  );

  // The sticky half, and the reason this is a default rather than a rule: a
  // choice survives every later import, in both directions.
  it("keeps it on through an import once you have said so", () => {
    expect(resolveManualTracking(true, "runeprofile")).toBe(true);
  });

  it("keeps it off while tracking by hand once you have said so", () => {
    expect(resolveManualTracking(false, "manual")).toBe(false);
  });
});
