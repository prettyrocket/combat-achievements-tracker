// The reward rules, pinned down. All pure: no store, no React, no network.

import { describe, expect, it } from "vitest";
import { TASKS } from "@/data/tasks";
import { projectRewards, rewardStatus, rewardTiers } from "@/lib/rewards";
import type { TaskRow, Tier } from "@/lib/types";

let nextId = 0;
function task(tier: Tier): TaskRow {
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
    name: "A task",
    monster: "Zulrah",
    description: "Do the thing.",
    tier,
    points,
    type: "KILL_COUNT",
    leagueRegion: null,
    completionPct: null,
  };
}

/** One task in every tier: thresholds 1, 3, 6, 10, 15, 21. Small enough to check
 *  the cumulative rule by eye. */
const ONE_EACH = [
  "EASY",
  "MEDIUM",
  "HARD",
  "ELITE",
  "MASTER",
  "GRANDMASTER",
].map((t) => task(t as Tier));
const TIERS_1_EACH = rewardTiers(ONE_EACH);

describe("rewardTiers", () => {
  it("accumulates each tier onto the ones below it", () => {
    expect(TIERS_1_EACH.map((t) => t.required)).toEqual([1, 3, 6, 10, 15, 21]);
  });

  it("always returns all six tiers, cheapest first", () => {
    expect(rewardTiers([]).map((t) => t.tier)).toEqual([
      "EASY",
      "MEDIUM",
      "HARD",
      "ELITE",
      "MASTER",
      "GRANDMASTER",
    ]);
  });

  it("names the hilt each tier is known by", () => {
    expect(TIERS_1_EACH.map((t) => t.hilt)).toEqual([
      "Ghommal's hilt 1",
      "Ghommal's hilt 2",
      "Ghommal's hilt 3",
      "Ghommal's hilt 4",
      "Ghommal's hilt 5",
      "Ghommal's hilt 6",
    ]);
  });

  // Requirements are cumulative, so they can never decrease as you go up.
  it("is monotonic", () => {
    const required = rewardTiers(TASKS).map((t) => t.required);
    expect([...required].sort((a, b) => a - b)).toEqual(required);
  });

  // The whole point of deriving rather than hardcoding: Grandmaster asks for
  // every point in the game, which is the wiki's "complete all currently
  // available tasks" rule falling out for free.
  it("requires every point in the bundle for Grandmaster", () => {
    const tiers = rewardTiers(TASKS);
    const allPoints = TASKS.reduce((sum, t) => sum + t.points, 0);
    expect(tiers[5].required).toBe(allPoints);
  });

  // A guard against the rule itself changing, not against our arithmetic: these
  // six are the wiki's own {{Globals|ca * points}} values, read off the Combat
  // Achievements article. If a refresh-data run makes this fail, check whether
  // the wiki agrees before touching the numbers -- it means new tasks landed,
  // and the *expectations* are what should move.
  it("matches the point requirements the wiki publishes", () => {
    expect(rewardTiers(TASKS).map((t) => t.required)).toEqual([
      41, 169, 436, 1100, 1965, 2697,
    ]);
  });
});

describe("rewardStatus", () => {
  it("has nothing unlocked at zero, and points at Easy", () => {
    const status = rewardStatus(TIERS_1_EACH, 0);
    expect(status.unlocked).toBeNull();
    expect(status.next?.tier).toBe("EASY");
    expect(status.pointsToNext).toBe(1);
  });

  // A threshold is met *at* its number, not one past it.
  it("unlocks a tier exactly on its requirement", () => {
    const status = rewardStatus(TIERS_1_EACH, 6);
    expect(status.unlocked?.tier).toBe("HARD");
    expect(status.next?.tier).toBe("ELITE");
    expect(status.pointsToNext).toBe(4);
  });

  it("reports the highest tier met, not the first", () => {
    expect(rewardStatus(TIERS_1_EACH, 14).unlocked?.tier).toBe("ELITE");
  });

  it("has no next once everything is claimed", () => {
    const status = rewardStatus(TIERS_1_EACH, 21);
    expect(status.unlocked?.tier).toBe("GRANDMASTER");
    expect(status.next).toBeNull();
    expect(status.pointsToNext).toBe(0);
  });

  // Points come from tasks of any tier -- 21 Easy tasks unlock Grandmaster's
  // requirement just as 6 Grandmaster ones would. This is the rule the whole
  // module exists to express.
  it("does not care which tiers the points came from", () => {
    expect(rewardStatus(TIERS_1_EACH, 21).unlocked?.tier).toBe("GRANDMASTER");
  });

  describe("percentToNext", () => {
    it("measures the current stretch, not the whole game", () => {
      // Hard (6) is met, Elite (10) is next: 8 is halfway across that gap.
      expect(rewardStatus(TIERS_1_EACH, 8).percentToNext).toBe(50);
    });

    it("runs from zero on the first stretch", () => {
      expect(rewardStatus(TIERS_1_EACH, 0).percentToNext).toBe(0);
    });

    it("is 100 when there is nothing left to work towards", () => {
      expect(rewardStatus(TIERS_1_EACH, 21).percentToNext).toBe(100);
    });

    // An empty tier shares its predecessor's threshold. The gap is then zero
    // wide, and a meter must not divide by it.
    it("survives a tier with no tasks of its own", () => {
      const tiers = rewardTiers([task("EASY")]);
      expect(tiers.map((t) => t.required)).toEqual([1, 1, 1, 1, 1, 1]);
      expect(rewardStatus(tiers, 0).percentToNext).toBe(0);
      expect(rewardStatus(tiers, 1).next).toBeNull();
    });
  });

  // A release adds tasks, the thresholds rise, and a tier you had met comes
  // undone -- the game unequips the hilt too. Nothing is remembered, so this
  // falls out of recomputing, but it's the behaviour that matters.
  it("drops a tier back when new tasks raise the bar", () => {
    const before = rewardTiers(ONE_EACH);
    expect(rewardStatus(before, 6).unlocked?.tier).toBe("HARD");

    const after = rewardTiers([...ONE_EACH, task("EASY"), task("EASY")]);
    expect(rewardStatus(after, 6).unlocked?.tier).toBe("MEDIUM");
  });
});

describe("projectRewards", () => {
  it("names the tier a plan would carry you across", () => {
    // At 5, one point short of Hard; a 3-point plan clears it.
    const { unlocks, status } = projectRewards(TIERS_1_EACH, 5, 3);
    expect(unlocks.map((t) => t.tier)).toEqual(["HARD"]);
    expect(status.unlocked?.tier).toBe("HARD");
  });

  it("names every tier crossed when a plan clears more than one", () => {
    expect(
      projectRewards(TIERS_1_EACH, 0, 10).unlocks.map((t) => t.tier),
    ).toEqual(["EASY", "MEDIUM", "HARD", "ELITE"]);
  });

  it("unlocks nothing when the plan falls short, and says how short", () => {
    const { unlocks, status } = projectRewards(TIERS_1_EACH, 6, 2);
    expect(unlocks).toEqual([]);
    expect(status.pointsToNext).toBe(2);
  });

  // Already-claimed tiers are not re-unlocked by a plan that happens to span
  // their threshold -- `unlocks` is what's *new*.
  it("leaves out tiers already unlocked", () => {
    expect(
      projectRewards(TIERS_1_EACH, 10, 5).unlocks.map((t) => t.tier),
    ).toEqual(["MASTER"]);
  });

  it("is a no-op for an empty plan", () => {
    const { unlocks, status } = projectRewards(TIERS_1_EACH, 7, 0);
    expect(unlocks).toEqual([]);
    expect(status).toEqual(rewardStatus(TIERS_1_EACH, 7));
  });

  it("handles a plan that finishes the game", () => {
    const { unlocks, status } = projectRewards(TIERS_1_EACH, 20, 1);
    expect(unlocks.map((t) => t.tier)).toEqual(["GRANDMASTER"]);
    expect(status.next).toBeNull();
  });
});
