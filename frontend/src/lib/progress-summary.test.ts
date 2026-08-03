import { describe, expect, it } from "vitest";
import { percent, summarize, summarizeMonster } from "@/lib/progress-summary";
import { TIERS, type TaskRow, type Tier } from "@/lib/types";

let nextId = 0;
function task(tier: Tier, over: Partial<TaskRow> = {}): TaskRow {
  const points = {
    EASY: 1,
    MEDIUM: 2,
    HARD: 3,
    ELITE: 4,
    MASTER: 5,
    GRANDMASTER: 6,
  }[tier];
  return {
    wikiId: nextId++,
    name: `Task ${nextId}`,
    monster: "Zulrah",
    description: "Do the thing.",
    tier,
    points,
    type: "KILL_COUNT",
    leagueRegion: null,
    completionPct: null,
    ...over,
  };
}

describe("summarize: totals", () => {
  it("reports zeroes for no tasks at all", () => {
    const summary = summarize([], new Set());
    expect(summary.totalTasks).toBe(0);
    expect(summary.completedTasks).toBe(0);
    expect(summary.pointsTotal).toBe(0);
    expect(summary.pointsEarned).toBe(0);
  });

  it("counts every task regardless of completion", () => {
    const tasks = [task("EASY"), task("HARD"), task("GRANDMASTER")];
    expect(summarize(tasks, new Set()).totalTasks).toBe(3);
  });

  // The denominator is tier-weighted, not a task count -- one Grandmaster is
  // worth six Easies.
  it("totals points by tier weight, not by task count", () => {
    const tasks = [task("EASY"), task("HARD"), task("GRANDMASTER")];
    expect(summarize(tasks, new Set()).pointsTotal).toBe(1 + 3 + 6);
  });

  // #11 is explicit that a task the wiki has no completion data for still counts
  // toward the totals: a missing Comp% says nothing about whether *you* did it.
  it("counts tasks that have no wiki completion percentage", () => {
    const tasks = [
      task("ELITE", { completionPct: null }),
      task("ELITE", { completionPct: 12.3 }),
    ];
    const summary = summarize(tasks, new Set());
    expect(summary.totalTasks).toBe(2);
    expect(summary.pointsTotal).toBe(8);
  });
});

describe("summarize: what has been earned", () => {
  it("counts completed tasks", () => {
    const tasks = [task("EASY"), task("HARD"), task("GRANDMASTER")];
    const completed = new Set([tasks[0].wikiId, tasks[2].wikiId]);
    expect(summarize(tasks, completed).completedTasks).toBe(2);
  });

  it("earns points by tier weight, not one per task", () => {
    const tasks = [task("EASY"), task("HARD"), task("GRANDMASTER")];
    const completed = new Set([tasks[1].wikiId, tasks[2].wikiId]);
    expect(summarize(tasks, completed).pointsEarned).toBe(3 + 6);
  });

  it("earns everything when everything is done", () => {
    const tasks = [task("EASY"), task("MASTER")];
    const summary = summarize(tasks, new Set(tasks.map((t) => t.wikiId)));
    expect(summary.completedTasks).toBe(summary.totalTasks);
    expect(summary.pointsEarned).toBe(summary.pointsTotal);
  });

  // A completed id for a task that isn't in the list -- a retired task, or a
  // WikiSync paste from a newer release -- must not inflate either number, or
  // the header can read 647/646.
  it("ignores completed ids that match no task", () => {
    const tasks = [task("EASY")];
    const summary = summarize(tasks, new Set([tasks[0].wikiId, 999999]));
    expect(summary.completedTasks).toBe(1);
    expect(summary.pointsEarned).toBe(1);
  });

  it("never reports more earned than total", () => {
    const tasks = [task("MEDIUM"), task("ELITE")];
    const summary = summarize(tasks, new Set([1, 2, 3, 4, 5, 999]));
    expect(summary.pointsEarned).toBeLessThanOrEqual(summary.pointsTotal);
    expect(summary.completedTasks).toBeLessThanOrEqual(summary.totalTasks);
  });
});

describe("summarize: per-tier breakdown", () => {
  // The header renders six meters unconditionally. If a tier could go missing
  // from this array the layout would reflow as progress changes, so every tier
  // is always present, in TIERS order, even at zero.
  it("always returns all six tiers in TIERS order", () => {
    const summary = summarize([], new Set());
    expect(summary.perTier.map((t) => t.tier)).toEqual([...TIERS]);
  });

  it("keeps a tier with no tasks at zero rather than omitting it", () => {
    const summary = summarize([task("EASY")], new Set());
    const gm = summary.perTier.find((t) => t.tier === "GRANDMASTER");
    expect(gm).toEqual({
      tier: "GRANDMASTER",
      total: 0,
      completed: 0,
      pointsTotal: 0,
      pointsEarned: 0,
    });
  });

  it("splits tasks and points into the right tier", () => {
    const tasks = [task("HARD"), task("HARD"), task("ELITE")];
    const completed = new Set([tasks[0].wikiId]);
    const perTier = summarize(tasks, completed).perTier;

    expect(perTier.find((t) => t.tier === "HARD")).toEqual({
      tier: "HARD",
      total: 2,
      completed: 1,
      pointsTotal: 6,
      pointsEarned: 3,
    });
    expect(perTier.find((t) => t.tier === "ELITE")).toEqual({
      tier: "ELITE",
      total: 1,
      completed: 0,
      pointsTotal: 4,
      pointsEarned: 0,
    });
  });

  it("has per-tier figures that add up to the overall ones", () => {
    const tasks = [
      task("EASY"),
      task("MEDIUM"),
      task("MASTER"),
      task("MASTER"),
    ];
    const completed = new Set([tasks[0].wikiId, tasks[3].wikiId]);
    const summary = summarize(tasks, completed);
    const sum = (pick: (t: (typeof summary.perTier)[number]) => number) =>
      summary.perTier.reduce((acc, tier) => acc + pick(tier), 0);

    expect(sum((t) => t.total)).toBe(summary.totalTasks);
    expect(sum((t) => t.completed)).toBe(summary.completedTasks);
    expect(sum((t) => t.pointsTotal)).toBe(summary.pointsTotal);
    expect(sum((t) => t.pointsEarned)).toBe(summary.pointsEarned);
  });
});

describe("percent", () => {
  it("is the plain ratio, scaled", () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(3, 4)).toBe(75);
  });

  it("is 0 and 100 at the ends", () => {
    expect(percent(0, 10)).toBe(0);
    expect(percent(10, 10)).toBe(100);
  });

  // An empty tier divides by zero. NaN in a CSS width doesn't error, it just
  // silently renders nothing -- which is worse than a visibly wrong bar.
  it("is 0, not NaN, when the total is zero", () => {
    expect(percent(0, 0)).toBe(0);
    expect(Number.isNaN(percent(0, 0))).toBe(false);
  });

  it("never leaves the 0-100 range even if handed nonsense", () => {
    expect(percent(15, 10)).toBe(100);
    expect(percent(-5, 10)).toBe(0);
  });
});

describe("summarize: against the real bundle", () => {
  it("reproduces the known invariants with nothing completed", async () => {
    const { TASKS } = await import("@/data/tasks");
    const summary = summarize(TASKS, new Set());

    expect(summary.totalTasks).toBe(646);
    expect(summary.pointsTotal).toBe(2671);
    expect(summary.completedTasks).toBe(0);
    expect(summary.pointsEarned).toBe(0);
  });

  // 2671 is derived from the data, never typed into the UI -- so a CA release
  // moves the denominator without anyone editing a component.
  it("earns exactly 2671 when everything is completed", async () => {
    const { TASKS } = await import("@/data/tasks");
    const summary = summarize(TASKS, new Set(TASKS.map((t) => t.wikiId)));

    expect(summary.pointsEarned).toBe(2671);
    expect(summary.completedTasks).toBe(646);
    expect(
      summary.perTier.find((t) => t.tier === "GRANDMASTER")?.pointsEarned,
    ).toBe(726);
  });
});

describe("summarizeMonster", () => {
  it("counts only that monster, done and total", () => {
    const zulrah = [task("EASY"), task("HARD")];
    const other = task("ELITE", { monster: "Vorkath" });
    const summary = summarizeMonster(
      [...zulrah, other],
      new Set([zulrah[0].wikiId]),
      "Zulrah",
    );

    expect(summary).toEqual({ monster: "Zulrah", total: 2, completed: 1 });
  });

  it("matches case- and whitespace-insensitively, like the filter does", () => {
    const tasks = [task("EASY"), task("HARD")];
    expect(summarizeMonster(tasks, new Set(), "  zULRah ").total).toBe(2);
  });

  it("reports the data's casing, not the caller's", () => {
    expect(summarizeMonster([task("EASY")], new Set(), "zulrah").monster).toBe(
      "Zulrah",
    );
  });

  it("ignores tasks with no monster", () => {
    const tasks = [task("EASY", { monster: null }), task("HARD")];
    expect(summarizeMonster(tasks, new Set(), "Zulrah").total).toBe(1);
  });

  // A hand-edited ?monster=. The breadcrumb leans on total === 0 to say so
  // rather than showing a confident 0/0, and echoes back what was asked for.
  it("reports an empty summary for a monster that does not exist", () => {
    expect(summarizeMonster([task("EASY")], new Set(), " Chinchompa ")).toEqual(
      {
        monster: "Chinchompa",
        total: 0,
        completed: 0,
      },
    );
  });

  it("never counts an id that is completed but not in the list", () => {
    const summary = summarizeMonster(
      [task("EASY")],
      new Set([999_999]),
      "Zulrah",
    );
    expect(summary.completed).toBe(0);
  });
});
