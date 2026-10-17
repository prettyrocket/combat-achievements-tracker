import { describe, expect, it } from "vitest";
import type { ImportDiff } from "@/lib/import-diff";
import { quickLoadFor, runeProfileSyncMessage } from "@/lib/quick-load";

describe("quickLoadFor", () => {
  it("repeats a lookup for the remembered name", () => {
    expect(quickLoadFor("runeprofile", "Lynx Titan")).toBe("runeprofile");
    expect(quickLoadFor("wiseoldman", "Lynx Titan")).toBe("wiseoldman");
  });

  it("sends a lookup with no name to set up", () => {
    expect(quickLoadFor("runeprofile", null)).toBe("setup");
    expect(quickLoadFor("wiseoldman", "  ")).toBe("setup");
  });

  it("opens the form for somebody who types their levels", () => {
    expect(quickLoadFor("manual", null)).toBe("manual");
  });

  it("treats nothing loaded, and a one-off restore, as nothing set up", () => {
    expect(quickLoadFor(null, "Lynx Titan")).toBe("setup");
    expect(quickLoadFor("file", "Lynx Titan")).toBe("setup");
  });
});

describe("runeProfileSyncMessage", () => {
  const diff = (newly: number[], removed: number[] = []): ImportDiff => ({
    newlyCompleted: newly,
    alreadyCompleted: [],
    removed,
    dropped: 0,
  });

  it("is null when nothing changed", () => {
    expect(runeProfileSyncMessage(diff([]), false)).toBeNull();
  });

  it("counts new tasks, with the right plural", () => {
    expect(runeProfileSyncMessage(diff([1]), false)).toBe(
      "Synced from RuneProfile: 1 new task.",
    );
    expect(runeProfileSyncMessage(diff([1, 2, 3]), false)).toBe(
      "Synced from RuneProfile: 3 new tasks.",
    );
  });

  it("says when ticks go and levels change", () => {
    expect(runeProfileSyncMessage(diff([1], [7, 8]), true)).toBe(
      "Synced from RuneProfile: 1 new task, 2 tasks unticked, levels and quests updated.",
    );
  });

  it("reports a levels-only change", () => {
    expect(runeProfileSyncMessage(diff([]), true)).toBe(
      "Synced from RuneProfile: levels and quests updated.",
    );
  });
});
