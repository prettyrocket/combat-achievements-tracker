// The two things that would go wrong here are both silent.
//
// One is the join: RuneProfile's `index` and the wiki's Bucket `id` were checked
// to agree on all 646 tasks, so the parser trusts it -- but the *shape* of the
// response is what the tests pin, because a field rename would import an empty
// list rather than throw.
//
// The other is staleness. A profile that predates 2026-05-14 answers 200 with
// every task marked incomplete, which reads exactly like a new player. Getting
// that wrong means telling someone with 500 achievements they have none, so it
// gets the most tests of anything in this file.

import { describe, expect, it } from "vitest";
import {
  parseFull,
  parseTasks,
  RuneProfileError,
  syncedLabel,
} from "@/lib/runeprofile";

/** A `/combat-achievements/tasks` body, shaped like the real one. */
function tasks(rows: Array<{ index: number; completed: boolean }>) {
  return {
    totalPoints: 109,
    tierReached: "Easy",
    data: rows.map((row) => ({
      ...row,
      tierId: 1,
      tierName: "Easy",
      name: "Noxious Foe",
      description: "Kill an Aberrant Spectre.",
      type: "Kill Count",
      monster: "Aberrant Spectre",
    })),
  };
}

/** A `/full` body, shaped like the real one. */
function full(over: Record<string, unknown> = {}) {
  return {
    username: "Iron 0pie",
    accountType: { key: "ironman" },
    skills: [
      { name: "Attack", xp: 761537, level: 70, virtualLevel: 70 },
      { name: "Slayer", xp: 200000, level: 62, virtualLevel: 62 },
      { name: "Runecraft", xp: 100000, level: 55, virtualLevel: 55 },
    ],
    quests: [
      {
        id: 6,
        name: "Priest in Peril",
        points: 1,
        type: "free",
        state: "finished",
      },
      {
        id: 7,
        name: "Dragon Slayer II",
        points: 5,
        type: "members",
        state: "in_progress",
      },
      {
        id: 8,
        name: "Monkey Madness II",
        points: 4,
        type: "members",
        state: "not_started",
      },
    ],
    combatAchievements: [
      { id: 1, name: "Easy", completed: 29, total: 41 },
      { id: 2, name: "Medium", completed: 29, total: 60 },
    ],
    updatedAt: "2026-08-02 18:26:28.409099",
    ...over,
  };
}

describe("parseTasks", () => {
  it("keeps only the completed indices", () => {
    const { ids } = parseTasks(
      tasks([
        { index: 0, completed: true },
        { index: 1, completed: false },
        { index: 27, completed: true },
      ]),
    );
    expect(ids).toEqual([0, 27]);
  });

  // An index the wiki data doesn't know is a CA release the app hasn't pulled
  // yet, not a user error. sanitizeIds counts it rather than failing.
  it("drops indices that are not known tasks", () => {
    const { ids, dropped } = parseTasks(
      tasks([
        { index: 0, completed: true },
        { index: 99999, completed: true },
      ]),
    );
    expect(ids).toEqual([0]);
    expect(dropped).toBe(1);
  });

  it("ignores rows that are not shaped like a task", () => {
    const body = {
      data: [{ index: 0, completed: true }, null, { completed: true }, 7],
    };
    expect(parseTasks(body).ids).toEqual([0]);
  });

  it("rejects a body with no task list", () => {
    expect(() => parseTasks({ totalPoints: 0 })).toThrow(RuneProfileError);
    expect(() => parseTasks(null)).toThrow(RuneProfileError);
  });

  it("reads an account with nothing done as empty rather than failing", () => {
    expect(parseTasks(tasks([{ index: 0, completed: false }])).ids).toEqual([]);
  });
});

describe("parseFull", () => {
  it("reads levels under the names the gate table uses", () => {
    // No rename table here, unlike the Wise Old Man reader: RuneProfile takes
    // skill names from the game cache, so Runecraft is already Runecraft.
    expect(parseFull(full()).profile?.levels).toEqual({
      Attack: 70,
      Slayer: 62,
      Runecraft: 55,
    });
  });

  it("counts only finished quests", () => {
    // in_progress is not finished. A started quest is a door still shut.
    expect(parseFull(full()).profile?.quests).toEqual(["Priest in Peril"]);
  });

  it("reads the account name, type and sync time", () => {
    const parsed = parseFull(full());
    expect(parsed.displayName).toBe("Iron 0pie");
    expect(parsed.accountType).toBe("ironman");
    expect(parsed.updatedAt?.toISOString()).toBe("2026-08-02T18:26:28.409Z");
  });

  // The API sends "2026-08-02 18:26:28.409099" -- a space, no zone, and six
  // fractional digits. Safari rejects that string outright.
  it("normalises the space-separated timestamp instead of trusting Date", () => {
    expect(
      parseFull(
        full({ updatedAt: "2026-01-05 00:00:00.000000" }),
      ).updatedAt?.toISOString(),
    ).toBe("2026-01-05T00:00:00.000Z");
    expect(parseFull(full({ updatedAt: "not a date" })).updatedAt).toBeNull();
    expect(parseFull(full({ updatedAt: null })).updatedAt).toBeNull();
  });

  it("returns a null profile when there is nothing to say about requirements", () => {
    expect(parseFull(full({ skills: [], quests: [] })).profile).toBeNull();
  });

  it("sums the tier summary, which is the staleness witness", () => {
    expect(parseFull(full()).tierCompleted).toBe(58);
    expect(parseFull(full({ combatAchievements: [] })).tierCompleted).toBe(0);
  });

  it("rejects a body that is not a profile", () => {
    expect(() => parseFull(null)).toThrow(RuneProfileError);
    expect(() => parseFull("nope")).toThrow(RuneProfileError);
  });
});

describe("syncedLabel", () => {
  const now = new Date("2026-08-02T12:00:00.000Z");

  it('reads as a phrase after "synced"', () => {
    expect(syncedLabel(new Date("2026-08-02T04:00:00.000Z"), now)).toBe(
      "synced today",
    );
    expect(syncedLabel(new Date("2026-08-01T04:00:00.000Z"), now)).toBe(
      "synced yesterday",
    );
    expect(syncedLabel(new Date("2026-07-20T12:00:00.000Z"), now)).toBe(
      "synced 13 days ago",
    );
  });

  it("switches to months once days stop being informative", () => {
    expect(syncedLabel(new Date("2026-01-02T12:00:00.000Z"), now)).toBe(
      "synced 7 months ago",
    );
  });

  it("says nothing when RuneProfile did not say", () => {
    expect(syncedLabel(null, now)).toBeNull();
  });
});
