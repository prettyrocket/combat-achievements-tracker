// The profile is the input to every requirement verdict, so what matters here is
// that a hand-editable file can't make the filter lie: a level of 0, a level of
// 2^31, a quest listed twice under two spellings. Sanitizing is the whole job.

import { afterEach, describe, expect, it, vi } from "vitest";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

async function load(seed?: unknown) {
  vi.resetModules();
  const storage = fakeStorage();
  if (seed !== undefined)
    storage.map.set("ca-tracker:profile:v1", JSON.stringify(seed));
  vi.stubGlobal("window", { localStorage: storage });
  return { store: await import("@/lib/profile-store"), storage };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sanitizeLevels", () => {
  it("keeps a plain map of levels", async () => {
    const { store } = await load();
    expect(store.sanitizeLevels({ Slayer: 92, Ranged: 70 })).toEqual({
      Slayer: 92,
      Ranged: 70,
    });
  });

  it.each([
    ["a level of zero", { Slayer: 0 }],
    ["a negative level", { Slayer: -5 }],
    ["a string", { Slayer: "92" }],
    ["a NaN", { Slayer: Number.NaN }],
    ["an infinity", { Slayer: Number.POSITIVE_INFINITY }],
  ])("drops %s", async (_label, input) => {
    const { store } = await load();
    expect(store.sanitizeLevels(input)).toEqual({});
  });

  it("floors a fractional level and caps a silly one", async () => {
    const { store } = await load();
    expect(store.sanitizeLevels({ Slayer: 92.7, Mining: 1e9 })).toEqual({
      Slayer: 92,
      Mining: 126,
    });
  });

  it.each([
    ["null", null],
    ["an array", [1, 2]],
    ["a string", "nope"],
  ])("returns nothing for %s", async (_label, input) => {
    const { store } = await load();
    expect(store.sanitizeLevels(input)).toEqual({});
  });
});

describe("sanitizeQuests", () => {
  it("dedupes by normalized name, keeping the first spelling", async () => {
    const { store } = await load();
    expect(
      store.sanitizeQuests(["Regicide", " regicide ", "Dragon Slayer II"]),
    ).toEqual(["Regicide", "Dragon Slayer II"]);
  });

  it("drops blanks and non-strings", async () => {
    const { store } = await load();
    expect(store.sanitizeQuests(["Regicide", "", "   ", 7, null])).toEqual([
      "Regicide",
    ]);
  });
});

describe("the store", () => {
  it("starts empty and reads back what it was given", async () => {
    const { store } = await load();
    expect(store.getProfile()).toEqual({ levels: {}, quests: [] });

    store.setProfile(
      { levels: { Slayer: 92 }, quests: ["Regicide"] },
      "wikisync",
    );
    expect(store.getProfile()).toEqual({
      levels: { Slayer: 92 },
      quests: ["Regicide"],
    });
    expect(store.getSource()).toBe("wikisync");
  });

  it("persists, and survives a reload", async () => {
    const first = await load();
    first.store.setProfile(
      { levels: { Slayer: 92 }, quests: ["Regicide"] },
      "wikisync",
    );
    const saved = JSON.parse(first.storage.map.get("ca-tracker:profile:v1")!);

    const second = await load(saved);
    expect(second.store.getProfile()).toEqual({
      levels: { Slayer: 92 },
      quests: ["Regicide"],
    });
    expect(second.store.getSource()).toBe("wikisync");
  });

  it("sanitizes what it reads off disk, not just what it is handed", async () => {
    const { store } = await load({
      levels: { Slayer: 0, Ranged: 70 },
      quests: ["a", "A"],
    });
    expect(store.getProfile()).toEqual({
      levels: { Ranged: 70 },
      quests: ["a"],
    });
  });

  it("marks a hand-edited level as manual, whatever it was before", async () => {
    const { store } = await load();
    store.setProfile({ levels: { Slayer: 92 }, quests: [] }, "wikisync");
    store.setLevel("Slayer", 93);
    expect(store.getSource()).toBe("manual");
    expect(store.getProfile().levels.Slayer).toBe(93);
  });

  it("removes a skill when its box is cleared", async () => {
    const { store } = await load();
    store.setLevel("Slayer", 92);
    store.setLevel("Slayer", 0);
    expect(store.getProfile().levels).toEqual({});
  });

  it("ticks and unticks a quest without disturbing the others", async () => {
    const { store } = await load();
    store.setQuest("Regicide", true);
    store.setQuest("Dragon Slayer II", true);
    store.setQuest("Regicide", false);
    expect(store.getProfile().quests).toEqual(["Dragon Slayer II"]);
  });

  it("does not add a quest twice when it's already ticked", async () => {
    const { store } = await load();
    store.setQuest("Regicide", true);
    store.setQuest(" regicide ", true);
    expect(store.getProfile().quests).toEqual([" regicide "]);
  });

  it("notifies subscribers on a change", async () => {
    const { store } = await load();
    const seen: number[] = [];
    const unsubscribe = store.subscribe(() => seen.push(1));
    store.setLevel("Slayer", 92);
    unsubscribe();
    store.setLevel("Slayer", 93);
    expect(seen).toHaveLength(1);
  });

  it("hands back a stable snapshot between changes", async () => {
    const { store } = await load();
    store.setLevel("Slayer", 92);
    expect(store.getProfile()).toBe(store.getProfile());
  });

  it("clears back to empty", async () => {
    const { store } = await load();
    store.setProfile({ levels: { Slayer: 92 }, quests: ["Regicide"] });
    store.clearProfile();
    expect(store.getProfile()).toEqual({ levels: {}, quests: [] });
  });
});
