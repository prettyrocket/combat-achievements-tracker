import { describe, expect, it } from "vitest";
import {
  COMPLETION_TONE_CLASS,
  completionTone,
  formatCompletion,
} from "@/lib/completion";

describe("completionTone", () => {
  // The buckets are exclusive (<0.1, <1, <10, <50), which has consequences at the
  // round numbers that are easy to get wrong by one bucket in either direction.
  it.each([
    [null, "na"],
    [0, "red"],
    [0.05, "red"],
    [0.099, "red"],
    [0.1, "orange"],
    [0.6, "orange"],
    [0.999, "orange"],
    [1, "yellow"],
    [9.8, "yellow"],
    [10, "green"],
    [49.5, "green"],
    [50, "blue"],
    [75.2, "blue"],
    [100, "blue"],
  ] as const)("maps %s to %s", (pct, expected) => {
    expect(completionTone(pct)).toBe(expected);
  });

  it("has a class for every tone it can return", () => {
    const tones = new Set(
      [null, 0, 0.5, 5, 25, 75].map((pct) =>
        completionTone(pct as number | null),
      ),
    );
    for (const tone of tones) {
      expect(COMPLETION_TONE_CLASS[tone]).toBeTruthy();
    }
  });
});

describe("formatCompletion", () => {
  it("shows one decimal", () => {
    expect(formatCompletion(41.9)).toBe("41.9%");
    expect(formatCompletion(10)).toBe("10.0%");
  });

  // Rounding 0.04 to "0.0%" reads as zero, and to "0.1%" overstates it.
  it("does not pretend to precision below 0.1", () => {
    expect(formatCompletion(0.04)).toBe("<0.1%");
    expect(formatCompletion(0)).toBe("<0.1%");
  });

  it("says N/A when there is no data", () => {
    expect(formatCompletion(null)).toBe("N/A");
  });
});
