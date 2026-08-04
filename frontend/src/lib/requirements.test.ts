// The gate table is data, and most of it is only checkable against the wiki --
// that's check-requirements.ts, which needs the network. What's testable offline
// is the *reasoning*: that a missing level blocks, that an absent one isn't
// assumed met, that no profile is a third answer rather than a no, and that the
// quest join survives the ways a quest name can be written.

import { describe, expect, it } from "vitest";
import { TASKS } from "@/data/tasks";
import {
  EMPTY_PROFILE,
  GATED_SKILLS,
  checkAll,
  checkGate,
  describeMissing,
  gateFor,
  gateReason,
  gatedMonsters,
  gatedQuests,
  normalizeQuest,
  profileIsEmpty,
  questLabel,
  type PlayerProfile,
} from "@/lib/requirements";

const MAXED: PlayerProfile = {
  levels: Object.fromEntries(GATED_SKILLS.map((skill) => [skill, 99])),
  quests: gatedQuests(),
};

const FRESH: PlayerProfile = { levels: { Slayer: 1 }, quests: [] };

describe("the table itself", () => {
  it("only names monsters that are actually in the data", () => {
    const known = new Set(
      TASKS.map((task) => task.monster)
        .filter((monster) => monster !== null)
        .map((monster) => monster.toLowerCase()),
    );
    const unknown = gatedMonsters().filter(
      (monster) => !known.has(monster.toLowerCase()),
    );
    expect(unknown).toEqual([]);
  });

  it("gates a minority of monsters, which is the point of the filter", () => {
    const monsters = new Set(
      TASKS.map((task) => task.monster).filter((m) => m !== null),
    );
    expect(gatedMonsters().length).toBeGreaterThan(30);
    expect(gatedMonsters().length).toBeLessThan(monsters.size);
  });

  it("only asks for skills the manual form offers", () => {
    const offered = new Set<string>(GATED_SKILLS);
    for (const monster of gatedMonsters()) {
      for (const skill of Object.keys(gateFor(monster)?.skills ?? {})) {
        expect(offered.has(skill), `${monster} needs ${skill}`).toBe(true);
      }
    }
  });

  it("lists every quest it gates on, so the form can never fall behind", () => {
    const listed = new Set(gatedQuests());
    for (const monster of gatedMonsters()) {
      for (const quest of gateFor(monster)?.quests ?? []) {
        expect(listed.has(quest), `${monster} needs ${quest}`).toBe(true);
      }
    }
  });
});

describe("checkGate", () => {
  it("opens an ungated monster to everyone, profile or not", () => {
    expect(checkGate("Scurrius", null).status).toBe("open");
    expect(checkGate("Scurrius", FRESH).status).toBe("open");
    // Tasks with no monster at all are the "Any monster" rows.
    expect(checkGate(null, null).status).toBe("open");
  });

  it("says unknown, not blocked, when there is no profile", () => {
    const check = checkGate("Vorkath", null);
    expect(check.status).toBe("unknown");
    expect(check.requires).toEqual(["Dragon Slayer II"]);
    expect(check.missing).toEqual([]);
  });

  it("treats an empty profile the same as none", () => {
    expect(checkGate("Vorkath", { levels: {}, quests: [] }).status).toBe(
      "unknown",
    );
  });

  it("blocks on a Slayer level and says how far off it is", () => {
    const check = checkGate("Araxxor", {
      levels: { Slayer: 78 },
      quests: ["Priest in Peril"],
    });
    expect(check.status).toBe("blocked");
    expect(check.missing).toEqual([
      { kind: "skill", label: "92 Slayer", have: 78 },
    ]);
  });

  it("opens at exactly the required level", () => {
    const at = { levels: { Slayer: 92 }, quests: ["Priest in Peril"] };
    expect(checkGate("Araxxor", at).status).toBe("open");
  });

  it("counts an absent skill as 1 rather than assuming it is met", () => {
    // Only Slayer entered. Nex asks for four other 70s, and none of them are it.
    const check = checkGate("Nex", { levels: { Slayer: 99 }, quests: [] });
    expect(check.status).toBe("blocked");
    expect(check.missing.map((item) => item.label).sort()).toEqual([
      "70 Agility",
      "70 Hitpoints",
      "70 Ranged",
      "70 Strength",
    ]);
  });

  it("blocks on a quest, and reports every clause that is missing", () => {
    const check = checkGate("Basilisk Knight", {
      levels: { Slayer: 42 },
      quests: [],
    });
    expect(check.missing).toEqual([
      { kind: "skill", label: "60 Slayer", have: 42 },
      { kind: "quest", label: "The Fremennik Exiles" },
    ]);
  });

  it("opens everything for a maxed account", () => {
    for (const monster of gatedMonsters()) {
      expect(checkGate(monster, MAXED).status, monster).toBe("open");
    }
  });

  it("matches a monster whatever its casing", () => {
    expect(checkGate("vORKATH", FRESH).status).toBe("blocked");
  });
});

describe("quest name matching", () => {
  it("joins the long Desert Treasure II name that WikiSync reports", () => {
    const done = {
      levels: {},
      quests: ["Desert Treasure II - The Fallen Empire"],
    };
    expect(checkGate("Vardorvis", done).status).toBe("open");
  });

  it("survives a typographic dash where the data has a hyphen", () => {
    const done = {
      levels: {},
      quests: ["Desert Treasure II – The Fallen Empire"],
    };
    expect(checkGate("Vardorvis", done).status).toBe("open");
  });

  it("survives case and stray whitespace", () => {
    const done = { levels: {}, quests: ["  dragon   slayer II "] };
    expect(checkGate("Vorkath", done).status).toBe("open");
  });

  it("does not match a near miss, because a near miss is a different quest", () => {
    expect(normalizeQuest("Dragon Slayer II")).not.toBe(
      normalizeQuest("Dragon Slayer I"),
    );
    const done = { levels: {}, quests: ["Dragon Slayer I"] };
    expect(checkGate("Vorkath", done).status).toBe("blocked");
  });

  it("shortens only the name that needs it", () => {
    expect(questLabel("Desert Treasure II - The Fallen Empire")).toBe(
      "Desert Treasure II",
    );
    expect(questLabel("Regicide")).toBe("Regicide");
  });
});

describe("profileIsEmpty", () => {
  it.each([
    ["null", null, true],
    ["no levels and no quests", { levels: {}, quests: [] }, true],
    ["one level", { levels: { Slayer: 1 }, quests: [] }, false],
    ["one quest", { levels: {}, quests: ["Regicide"] }, false],
  ])("%s", (_label, profile, expected) => {
    expect(profileIsEmpty(profile)).toBe(expected);
  });
});

describe("checkAll", () => {
  it("answers once per monster, not once per task", () => {
    const monsters = new Set(
      TASKS.map((task) => task.monster).filter((m) => m !== null),
    );
    expect(checkAll(TASKS, FRESH).size).toBe(monsters.size);
  });

  it("agrees with checkGate row by row", () => {
    const gates = checkAll(TASKS, FRESH);
    for (const [monster, gate] of gates) {
      expect(gate.status, monster).toBe(checkGate(monster, FRESH).status);
    }
  });
});

describe("describeMissing", () => {
  it("names what the gate asks for, not how far off you are", () => {
    expect(
      describeMissing([
        { kind: "skill", label: "92 Slayer", have: 78 },
        { kind: "quest", label: "Priest in Peril" },
      ]),
    ).toBe("92 Slayer and the quest Priest in Peril");
  });

  it("names a quest as a quest, so it does not read as a place", () => {
    expect(describeMissing([{ kind: "quest", label: "Regicide" }])).toBe(
      "the quest Regicide",
    );
  });

  it("reads as a sentence at three, not as a list of fragments", () => {
    expect(
      describeMissing([
        { kind: "skill", label: "70 Ranged", have: 61 },
        { kind: "skill", label: "50 Firemaking" },
        { kind: "quest", label: "Song of the Elves" },
      ]),
    ).toBe("70 Ranged, 50 Firemaking and the quest Song of the Elves");
  });

  it("is empty when nothing is missing, rather than a stray conjunction", () => {
    expect(describeMissing([])).toBe("");
  });
});

describe("gateReason", () => {
  // The question every lock in the table asks. Anything but `blocked` has to
  // come back null, because a null here is what lets a task onto the plan.
  const gated = gatedMonsters()[0];

  it("gives the requirement for a monster you can't face yet", () => {
    const reason = gateReason(checkAll(TASKS, FRESH), gated);
    expect(reason).toMatch(/^Requires /);
  });

  it("is null once the profile meets the gate", () => {
    expect(gateReason(checkAll(TASKS, MAXED), gated)).toBeNull();
  });

  it("is null with no profile, rather than locking the table on a guess", () => {
    const gates = checkAll(TASKS, EMPTY_PROFILE);
    expect(gates.get(gated)?.status).toBe("unknown");
    expect(gateReason(gates, gated)).toBeNull();
  });

  it("is null for a task with no monster -- nothing to stand in front of", () => {
    expect(gateReason(checkAll(TASKS, FRESH), null)).toBeNull();
  });

  it("is null for a monster the map has never heard of", () => {
    expect(gateReason(new Map(), gated)).toBeNull();
  });
});
