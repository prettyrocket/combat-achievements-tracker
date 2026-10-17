import { describe, expect, it } from "vitest";
import { rarestCompletions } from "@/lib/rarest";
import type { TaskRow } from "@/lib/types";

function task(wikiId: number, completionPct: number | null): TaskRow {
  return {
    wikiId,
    name: `Task ${wikiId}`,
    monster: "Zulrah",
    description: "",
    tier: "ELITE",
    points: 5,
    type: "KILL_COUNT",
    leagueRegion: null,
    completionPct,
  };
}

const TASKS = [
  task(1, 40),
  task(2, 2.5),
  task(3, 12),
  task(4, 2.5),
  task(5, null),
  task(6, 0.9),
];

describe("rarestCompletions", () => {
  it("ranks completed tasks rarest first, ties by id", () => {
    const done = new Set([1, 2, 3, 4, 6]);
    expect(rarestCompletions(TASKS, done, 10).map((t) => t.wikiId)).toEqual([
      6, 2, 4, 3, 1,
    ]);
  });

  it("leaves out what isn't completed", () => {
    expect(
      rarestCompletions(TASKS, new Set([1, 3]), 10).map((t) => t.wikiId),
    ).toEqual([3, 1]);
  });

  it("leaves out a task with no figure", () => {
    expect(rarestCompletions(TASKS, new Set([5]), 10)).toEqual([]);
  });

  it("stops at the limit", () => {
    const done = new Set([1, 2, 3, 4, 6]);
    expect(rarestCompletions(TASKS, done, 2).map((t) => t.wikiId)).toEqual([
      6, 2,
    ]);
  });

  it("is empty with nothing completed", () => {
    expect(rarestCompletions(TASKS, new Set(), 8)).toEqual([]);
  });
});
