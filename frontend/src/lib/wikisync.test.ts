import { describe, expect, it } from "vitest";
import {
  buildSyncUrl,
  diffAgainst,
  diffIsNoop,
  parseWikiSync,
  sameAccount,
  WikiSyncParseError,
} from "@/lib/wikisync";

const payload = (ids: unknown[]) =>
  JSON.stringify({ combat_achievements: ids });
const parse = (ids: unknown[]) => parseWikiSync(payload(ids));

describe("buildSyncUrl", () => {
  const BASE = "https://sync.runescape.wiki/runelite/player/";

  it("builds a plain name", () => {
    expect(buildSyncUrl("Zezima")).toBe(`${BASE}Zezima/STANDARD`);
  });

  // A raw space in the address bar is the most likely way this flow fails before
  // it starts, and the error it produces points at the wrong problem.
  it("encodes spaces", () => {
    expect(buildSyncUrl("Lynx Titan")).toBe(`${BASE}Lynx%20Titan/STANDARD`);
  });

  it("treats underscores, doubled spaces and padding as the same name", () => {
    const expected = `${BASE}Lynx%20Titan/STANDARD`;
    expect(buildSyncUrl("Lynx_Titan")).toBe(expected);
    expect(buildSyncUrl("Lynx  Titan")).toBe(expected);
    expect(buildSyncUrl("  Lynx Titan  ")).toBe(expected);
  });

  it("preserves hyphens", () => {
    expect(buildSyncUrl("a-b")).toBe(`${BASE}a-b/STANDARD`);
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
    ["underscores only", "___"],
  ])("returns null for %s", (_label, input) => {
    expect(buildSyncUrl(input)).toBeNull();
  });

  it("never emits a raw space", () => {
    expect(buildSyncUrl("Lynx Titan")).not.toContain(" ");
  });
});

describe("parseWikiSync", () => {
  it("reads the documented payload", () => {
    expect(parse([0, 16, 27, 28])).toEqual({
      ids: [0, 16, 27, 28],
      dropped: 0,
      profile: null,
    });
  });

  it("reads levels and finished quests out of a real profile", () => {
    const full = JSON.stringify({
      username: "Zezima",
      timestamp: 1,
      quests: { "Cook's Assistant": 2, "Dragon Slayer II": 2, Regicide: 1 },
      levels: { Attack: 99, Slayer: 92 },
      achievement_diaries: {},
      combat_achievements: [1, 2, 3],
    });
    const result = parseWikiSync(full);
    expect(result.ids).toEqual([1, 2, 3]);
    expect(result.profile?.levels).toEqual({ Attack: 99, Slayer: 92 });
    // Regicide is state 1 -- started, not finished -- so it doesn't come across.
    expect(result.profile?.quests).toEqual([
      "Cook's Assistant",
      "Dragon Slayer II",
    ]);
  });

  it("leaves the profile null when the payload has no levels or quests", () => {
    expect(parse([1]).profile).toBeNull();
    expect(parseWikiSync("[5, 6, 7]").profile).toBeNull();
  });

  it("reads a finished quest however the state is spelled", () => {
    const quests = {
      A: 2,
      B: true,
      C: "FINISHED",
      D: 1,
      E: false,
      F: "IN_PROGRESS",
    };
    const full = JSON.stringify({ quests, combat_achievements: [1] });
    expect(parseWikiSync(full).profile?.quests).toEqual(["A", "B", "C"]);
  });

  it("drops junk levels rather than failing the whole paste", () => {
    const levels = { Slayer: 92, Attack: "nine", Magic: 0, Ranged: null };
    const full = JSON.stringify({ levels, combat_achievements: [1] });
    expect(parseWikiSync(full).profile?.levels).toEqual({ Slayer: 92 });
  });

  it("accepts a bare id array, for anyone who pulled the list out themselves", () => {
    expect(parseWikiSync("[5, 6, 7]").ids).toEqual([5, 6, 7]);
  });

  it("dedupes and counts what it dropped", () => {
    expect(parse([1, 1, 2, 99999, "x", null])).toEqual({
      ids: [1, 2],
      dropped: 3,
      profile: null,
    });
  });

  it("tolerates whitespace around the paste", () => {
    expect(parseWikiSync('  \n {"combat_achievements":[1]}  \n ').ids).toEqual([
      1,
    ]);
  });

  it.each([
    ["an empty paste", "   "],
    ["something that is not JSON", "not json"],
    ["a bare number", "42"],
    ["null", "null"],
    [
      "a non-array combat_achievements",
      JSON.stringify({ combat_achievements: "nope" }),
    ],
    ["an empty achievement list", payload([])],
  ])("rejects %s", (_label, input) => {
    expect(() => parseWikiSync(input)).toThrow(WikiSyncParseError);
  });

  // Codes rather than message text: the wording belongs to the dialog, which
  // rephrases some of these entirely, but what went wrong has to stay stable.
  it.each([
    ["an empty paste", "   ", "EMPTY_PASTE"],
    ["something that is not JSON", "not json", "NOT_JSON"],
    ["a bare number", "42", "NOT_WIKISYNC"],
    [
      "a non-array combat_achievements",
      JSON.stringify({ combat_achievements: 1 }),
      "NOT_WIKISYNC",
    ],
    ["an unsynced name", JSON.stringify({ code: "NO_USER_DATA" }), "NO_USER"],
    [
      "a profile with no list",
      JSON.stringify({ username: "x", levels: {} }),
      "NO_CA_LIST",
    ],
    ["an empty list", payload([]), "EMPTY_LIST"],
  ])("codes %s", (_label, input, code) => {
    expect(() => parseWikiSync(input)).toThrow(
      expect.objectContaining({ code }),
    );
  });

  // The two a player will actually hit are the same situation from their side --
  // no achievements to bring over -- and the dialog treats them as one state.
  it('separates "never opened the interface" from "opened it, none done"', () => {
    const never = (() => {
      try {
        parseWikiSync(JSON.stringify({ username: "x", levels: {} }));
      } catch (err) {
        return err;
      }
    })();
    expect(never).toBeInstanceOf(WikiSyncParseError);
    expect((never as WikiSyncParseError).code).toBe("NO_CA_LIST");
  });
});

describe("diffAgainst", () => {
  it("splits incoming ids into new and already-complete", () => {
    const diff = diffAgainst(parse([1, 2, 3]), new Set([3]));
    expect(diff.newlyCompleted).toEqual([1, 2]);
    expect(diff.alreadyCompleted).toEqual([3]);
  });

  // An import always replaces: the account is the authority on what's done, so
  // a tick this paste doesn't list is a tick that shouldn't be there.
  it("reports what will be un-ticked, sorted", () => {
    const diff = diffAgainst(parse([1, 2, 3]), new Set([101, 3, 100]));
    expect(diff.removed).toEqual([100, 101]);
    expect(diff.newlyCompleted).toEqual([1, 2]);
  });

  it("never removes on account of an id it did not recognise", () => {
    const diff = diffAgainst(parseWikiSync(payload([1, 999999])), new Set([1]));
    expect(diff.removed).toEqual([]);
    expect(diff.dropped).toBe(1);
  });
});

describe("diffIsNoop", () => {
  it("is true when the paste matches current progress exactly", () => {
    expect(diffIsNoop(diffAgainst(parse([1, 2]), new Set([1, 2])))).toBe(true);
  });

  // The case the old "no new tasks" check got wrong: an import that only removes
  // is a real action, and treating it as a no-op disables the apply button on it.
  it("is false when it only removes", () => {
    const diff = diffAgainst(parse([1]), new Set([1, 2, 3]));
    expect(diff.newlyCompleted).toEqual([]);
    expect(diff.removed).toEqual([2, 3]);
    expect(diffIsNoop(diff)).toBe(false);
  });
});

describe("sameAccount", () => {
  // Underscores and spaces are the same character in a RuneScape name, so a
  // typed underscore must not read as "you've switched accounts".
  it("treats underscores, case and stray spaces as the same player", () => {
    expect(sameAccount("Lynx Titan", "lynx_titan")).toBe(true);
    expect(sameAccount("  Lynx  Titan ", "Lynx Titan")).toBe(true);
  });

  it("tells two different players apart", () => {
    expect(sameAccount("Lynx Titan", "Zezima")).toBe(false);
  });
});
