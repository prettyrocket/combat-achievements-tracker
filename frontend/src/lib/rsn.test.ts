import { describe, expect, it } from "vitest";
import { displayRsn, sameAccount } from "@/lib/rsn";

describe("displayRsn", () => {
  it("tidies spacing and underscores but keeps the player's capitals", () => {
    expect(displayRsn("  Lynx_Titan ")).toBe("Lynx Titan");
    expect(displayRsn("Lynx   Titan")).toBe("Lynx Titan");
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
