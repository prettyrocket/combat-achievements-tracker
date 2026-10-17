import { describe, expect, it } from "vitest";
import { carryView, parseView, toUrl, withView } from "@/lib/view";

const params = (search: string) => new URLSearchParams(search);

describe("parseView", () => {
  it("is the table with no param, so old links land where they used to", () => {
    expect(parseView(params(""))).toBe("table");
    expect(parseView(params("tier=ELITE"))).toBe("table");
  });

  it("reads the list", () => {
    expect(parseView(params("view=list"))).toBe("list");
  });

  it("reads the profile", () => {
    expect(parseView(params("view=profile"))).toBe("profile");
  });

  it("treats a view it doesn't know as the table", () => {
    expect(parseView(params("view=kanban"))).toBe("table");
  });
});

describe("withView", () => {
  it("keeps the filters when switching to the list", () => {
    expect(withView(params("tier=ELITE&q=jad"), "list").toString()).toBe(
      "tier=ELITE&q=jad&view=list",
    );
  });

  it("drops the param for the table rather than writing view=table", () => {
    expect(withView(params("tier=ELITE&view=list"), "table").toString()).toBe(
      "tier=ELITE",
    );
  });

  it("doesn't touch what it was given", () => {
    const original = params("view=list");
    withView(original, "table");
    expect(original.toString()).toBe("view=list");
  });
});

describe("carryView", () => {
  it("survives a writer that rebuilds the query from scratch", () => {
    expect(
      carryView(params("q=jad"), params("view=list&q=old")).toString(),
    ).toBe("q=jad&view=list");
  });

  it("adds nothing on the table", () => {
    expect(carryView(params("q=jad"), params("q=old")).toString()).toBe(
      "q=jad",
    );
  });
});

describe("toUrl", () => {
  it("leaves no lone question mark", () => {
    expect(toUrl("/ca/", params(""), "#s=abc")).toBe("/ca/#s=abc");
  });

  it("keeps the hash after the query", () => {
    expect(toUrl("/ca/", params("view=list"), "#s=abc")).toBe(
      "/ca/?view=list#s=abc",
    );
  });
});
