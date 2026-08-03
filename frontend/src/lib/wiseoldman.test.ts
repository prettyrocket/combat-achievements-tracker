// What can actually go wrong with a Wise Old Man lookup is not the network --
// it's the join. These levels are written into the same record a WikiSync paste
// writes into and are read back by name, so a skill spelled WOM's way instead of
// the game's way doesn't throw, it just silently never matches a gate. The
// guard below is the same idea as check-requirements: assert the two halves
// still agree, and fail loudly on the day they stop.

import { describe, expect, it } from "vitest";
import { GATED_SKILLS } from "@/lib/requirements";
import {
  parseWomPlayer,
  skillName,
  updatedLabel,
  WomLookupError,
  type WomErrorCode,
} from "@/lib/wiseoldman";

/** A trimmed /v2/players/{name} body, shaped exactly like the real one. */
function player(
  skills: Record<string, { level: number }>,
  rest: Record<string, unknown> = {},
) {
  return {
    username: "lynx titan",
    displayName: "Lynx titan",
    type: "regular",
    updatedAt: "2026-08-02T04:28:48.457Z",
    latestSnapshot: { data: { skills } },
    ...rest,
  };
}

function codeOf(fn: () => unknown): WomErrorCode | "no-throw" {
  try {
    fn();
    return "no-throw";
  } catch (err) {
    return err instanceof WomLookupError ? err.code : "no-throw";
  }
}

describe("skillName", () => {
  it("capitalises the ordinary case", () => {
    expect(skillName("slayer")).toBe("Slayer");
    expect(skillName("firemaking")).toBe("Firemaking");
  });

  it("says Runecraft where WOM says runecrafting", () => {
    expect(skillName("runecrafting")).toBe("Runecraft");
  });

  it("rejects overall, which is a total and not a skill", () => {
    expect(skillName("overall")).toBeNull();
  });

  it("rejects keys that are not plain lower-case words", () => {
    expect(skillName("chambers_of_xeric")).toBeNull();
    expect(skillName("")).toBeNull();
  });

  // The one that matters. Every skill a monster gate asks for has to survive
  // the trip from WOM's key to the name requirements.ts looks up, or the
  // requirement filter reads a filled-in profile as an empty one.
  it("produces every gated skill from its WOM key", () => {
    for (const skill of GATED_SKILLS) {
      expect(skillName(skill.toLowerCase())).toBe(skill);
    }
  });
});

describe("parseWomPlayer", () => {
  it("reads levels out of the latest snapshot", () => {
    const parsed = parseWomPlayer(
      player({
        overall: { level: 2278 },
        slayer: { level: 99 },
        firemaking: { level: 61 },
        runecrafting: { level: 77 },
        sailing: { level: 1 },
      }),
    );

    expect(parsed.levels).toEqual({
      Slayer: 99,
      Firemaking: 61,
      Runecraft: 77,
      Sailing: 1,
    });
    expect(parsed.displayName).toBe("Lynx titan");
    expect(parsed.accountType).toBe("regular");
    expect(parsed.updatedAt?.toISOString()).toBe("2026-08-02T04:28:48.457Z");
  });

  it('drops levels below 1, which are WOM saying "no data"', () => {
    const parsed = parseWomPlayer(
      player({ slayer: { level: 92 }, sailing: { level: -1 } }),
    );
    expect(parsed.levels).toEqual({ Slayer: 92 });
  });

  it("ignores entries that are not shaped like a skill", () => {
    const parsed = parseWomPlayer(
      player({
        slayer: { level: 92 },
        mining: null,
        farming: { level: "x" },
      } as never),
    );
    expect(parsed.levels).toEqual({ Slayer: 92 });
  });

  it("falls back to username when there is no displayName", () => {
    const parsed = parseWomPlayer(
      player({ slayer: { level: 92 } }, { displayName: "   " }),
    );
    expect(parsed.displayName).toBe("lynx titan");
  });

  it("survives a missing updatedAt rather than inventing a date", () => {
    const parsed = parseWomPlayer(
      player({ slayer: { level: 92 } }, { updatedAt: null }),
    );
    expect(parsed.updatedAt).toBeNull();
  });

  // A player WOM has a row for but has never pulled the hiscores for. Distinct
  // from a 404, and the dialog says something different about it.
  it("reports NO_SNAPSHOT when there is no snapshot", () => {
    expect(
      codeOf(() => parseWomPlayer(player({}, { latestSnapshot: null }))),
    ).toBe("NO_SNAPSHOT");
  });

  it("reports NO_SNAPSHOT when the snapshot holds nothing usable", () => {
    expect(
      codeOf(() => parseWomPlayer(player({ overall: { level: 2278 } }))),
    ).toBe("NO_SNAPSHOT");
  });

  it("rejects a body that is not a player at all", () => {
    expect(codeOf(() => parseWomPlayer(null))).toBe("BAD_RESPONSE");
    expect(codeOf(() => parseWomPlayer("nope"))).toBe("BAD_RESPONSE");
  });
});

describe("updatedLabel", () => {
  const now = new Date("2026-08-02T12:00:00.000Z");

  it('reads as a phrase after "updated"', () => {
    expect(updatedLabel(new Date("2026-08-02T04:00:00.000Z"), now)).toBe(
      "updated today",
    );
    expect(updatedLabel(new Date("2026-08-01T04:00:00.000Z"), now)).toBe(
      "updated yesterday",
    );
    expect(updatedLabel(new Date("2026-07-20T12:00:00.000Z"), now)).toBe(
      "updated 13 days ago",
    );
  });

  it("switches to months once days stop being informative", () => {
    expect(updatedLabel(new Date("2026-01-02T12:00:00.000Z"), now)).toBe(
      "updated 7 months ago",
    );
  });

  it("says nothing when WOM didn't say", () => {
    expect(updatedLabel(null, now)).toBeNull();
  });
});
