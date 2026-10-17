import { describe, expect, it } from "vitest";
import { isFirstVisit } from "@/lib/welcome";

describe("isFirstVisit", () => {
  it("is a first visit when nothing of ours is stored", () => {
    expect(isFirstVisit([], "")).toBe(true);
  });

  it("ignores keys that belong to somebody else on the origin", () => {
    expect(isFirstVisit(["theme", "__ca_probe__"], "")).toBe(true);
  });

  it("is a returning visit once any of our keys exists", () => {
    expect(isFirstVisit(["ca-tracker:progress:v1"], "")).toBe(false);
    expect(isFirstVisit(["ca-tracker:list-position:v1"], "")).toBe(false);
  });

  it("stays away after a skip", () => {
    expect(isFirstVisit(["ca-tracker:welcomed:v1"], "")).toBe(false);
  });

  it("leaves a share link to its own prompt", () => {
    expect(isFirstVisit([], "#s=abc")).toBe(false);
  });
});
