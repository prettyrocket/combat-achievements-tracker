import { describe, expect, it } from "vitest";
import { monsterWikiUrl, splitAtColon, taskWikiUrl } from "@/lib/wiki";

describe("wiki URLs", () => {
  it("uses underscores for spaces, the way MediaWiki titles do", () => {
    expect(monsterWikiUrl("Abyssal Sire")).toBe(
      "https://oldschool.runescape.wiki/w/Abyssal_Sire",
    );
  });

  it("encodes an apostrophe rather than leaving it raw in the URL", () => {
    expect(monsterWikiUrl("Kree'arra")).toBe(
      "https://oldschool.runescape.wiki/w/Kree'arra",
    );
  });

  // `Chambers of Xeric: Challenge Mode` redirects to a subpage. Encoding the
  // slash would break the redirect target for anyone linking to it directly.
  it("leaves a subpage slash alone", () => {
    expect(monsterWikiUrl("Chambers of Xeric/Challenge Mode")).toBe(
      "https://oldschool.runescape.wiki/w/Chambers_of_Xeric/Challenge_Mode",
    );
  });

  it("encodes a colon, which a title may legitimately contain", () => {
    expect(taskWikiUrl("Chambers of Xeric: CM Master")).toBe(
      "https://oldschool.runescape.wiki/w/Chambers_of_Xeric%3A_CM_Master",
    );
  });

  it("collapses stray whitespace instead of encoding it into the title", () => {
    expect(taskWikiUrl("  Noxious   Foe  ")).toBe(
      "https://oldschool.runescape.wiki/w/Noxious_Foe",
    );
  });
});

describe("splitAtColon", () => {
  it("leaves a name with no colon alone", () => {
    expect(splitAtColon("Vardorvis Sleeper")).toEqual([
      "Vardorvis Sleeper",
      null,
    ]);
  });

  it("splits at the first colon and trims the tail", () => {
    expect(
      splitAtColon("Chambers of Xeric: CM (5-Scale) Speed-Chaser"),
    ).toEqual(["Chambers of Xeric", "CM (5-Scale) Speed-Chaser"]);
  });

  it("splits only once, so a second colon stays in the tail", () => {
    expect(splitAtColon("A: B: C")).toEqual(["A", "B: C"]);
  });

  // A trailing colon would otherwise produce an empty second line.
  it("treats a colon with nothing after it as no colon at all", () => {
    expect(splitAtColon("Weird Name:")).toEqual(["Weird Name:", null]);
    expect(splitAtColon("Weird Name:   ")).toEqual(["Weird Name:   ", null]);
  });
});
