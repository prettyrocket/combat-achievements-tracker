// What counts as a quick win: not done, reachable, and ranked by how many
// players have it.

import { describe, expect, it } from "vitest";
import { quickWins } from "@/lib/quick-wins";
import type { GateCheck, GateStatus } from "@/lib/requirements";
import type { TaskRow } from "@/lib/types";

function task(
  wikiId: number,
  completionPct: number | null,
  overrides: Partial<TaskRow> = {},
): TaskRow {
  return {
    wikiId,
    name: `Task ${wikiId}`,
    monster: "Goblin",
    description: "",
    tier: "EASY",
    points: 1,
    type: "KILL_COUNT",
    leagueRegion: "General",
    completionPct,
    ...overrides,
  } as TaskRow;
}

function gates(entries: Record<string, GateStatus>): Map<string, GateCheck> {
  return new Map(
    Object.entries(entries).map(([monster, status]) => [
      monster,
      { status, requires: [], missing: [] },
    ]),
  );
}

const ids = (rows: TaskRow[]) => rows.map((row) => row.wikiId);

describe("quickWins", () => {
  it("ranks the most-completed first", () => {
    const tasks = [task(1, 20), task(2, 80), task(3, 50)];
    expect(ids(quickWins(tasks, new Set(), gates({}), false))).toEqual([
      2, 3, 1,
    ]);
  });

  it("leaves out what's done and what has no figure", () => {
    const tasks = [task(1, 90), task(2, null), task(3, 10)];
    expect(ids(quickWins(tasks, new Set([1]), gates({}), false))).toEqual([3]);
  });

  it("keeps only open gates once there's a profile", () => {
    const tasks = [
      task(1, 90, { monster: "Zulrah" }),
      task(2, 80, { monster: "Vorkath" }),
      task(3, 70, { monster: "Goblin" }),
      task(4, 60, { monster: null }),
    ];
    const g = gates({ Zulrah: "blocked", Vorkath: "unknown", Goblin: "open" });
    expect(ids(quickWins(tasks, new Set(), g, false))).toEqual([3, 4]);
  });

  it("lets unknown gates through when the profile is empty", () => {
    const tasks = [
      task(1, 90, { monster: "Zulrah" }),
      task(2, 80, { monster: "Vorkath" }),
    ];
    const g = gates({ Zulrah: "blocked", Vorkath: "unknown" });
    expect(ids(quickWins(tasks, new Set(), g, true))).toEqual([2]);
  });

  it("breaks ties by points, then name", () => {
    const tasks = [
      task(1, 50, { points: 2, name: "B" }),
      task(2, 50, { points: 1, name: "C" }),
      task(3, 50, { points: 1, name: "A" }),
    ];
    expect(ids(quickWins(tasks, new Set(), gates({}), false))).toEqual([
      3, 2, 1,
    ]);
  });

  it("stops at the limit", () => {
    const tasks = Array.from({ length: 12 }, (_, i) => task(i, i));
    expect(quickWins(tasks, new Set(), gates({}), false)).toHaveLength(8);
    expect(quickWins(tasks, new Set(), gates({}), false, 3)).toHaveLength(3);
  });
});
