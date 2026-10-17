// Two sources with two vocabularies, and a record that only speaks for the name
// it was stored against.

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

async function load(storage = fakeStorage()) {
  vi.resetModules();
  vi.stubGlobal("window", { localStorage: storage });
  const mod = await import("@/lib/account-type");
  const put = (value: unknown) =>
    storage.setItem(mod.ACCOUNT_TYPE_STORAGE_KEY, JSON.stringify(value));
  const typeOf = (rsn: string | null) =>
    mod.accountTypeFor(mod.getStoredAccountType(), rsn);
  return { ...mod, storage, put, typeOf };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseAccountType", () => {
  it.each([
    // Wise Old Man
    ["regular", "regular"],
    ["ironman", "ironman"],
    ["hardcore", "hardcore"],
    ["ultimate", "ultimate"],
    // RuneProfile
    ["normal", "regular"],
    ["hardcore_ironman", "hardcore"],
    ["ultimate_ironman", "ultimate"],
    ["group_ironman", "group"],
    ["hardcore_group_ironman", "hardcore_group"],
    ["unranked_group_ironman", "unranked_group"],
  ])("reads %s as %s", async (raw, type) => {
    const { parseAccountType } = await load();
    expect(parseAccountType(raw)).toBe(type);
  });

  it("reads Wise Old Man's unknown, and anything else, as no answer", async () => {
    const { parseAccountType } = await load();
    expect(parseAccountType("unknown")).toBeNull();
    expect(parseAccountType("deadman")).toBeNull();
    expect(parseAccountType(3)).toBeNull();
    expect(parseAccountType(null)).toBeNull();
  });
});

describe("the stored type", () => {
  it("is null before any lookup", async () => {
    const { typeOf } = await load();
    expect(typeOf("Mock Player")).toBeNull();
  });

  it("answers for the name it was recorded against, however that's typed", async () => {
    const { typeOf, recordAccountType } = await load();
    recordAccountType("Mock_Player", "hardcore");
    expect(typeOf("mock player")).toBe("hardcore");
    expect(typeOf("Someone Else")).toBeNull();
    expect(typeOf(null)).toBeNull();
  });

  it("takes the latest answer", async () => {
    const { typeOf, recordAccountType } = await load();
    recordAccountType("Mock Player", "hardcore");
    recordAccountType("Mock Player", "ironman");
    expect(typeOf("Mock Player")).toBe("ironman");
  });

  it("keeps the last answer when a lookup has none", async () => {
    const { typeOf, recordAccountType } = await load();
    recordAccountType("Mock Player", "ultimate");
    recordAccountType("Mock Player", null);
    expect(typeOf("Mock Player")).toBe("ultimate");
  });

  it("survives a reload", async () => {
    const first = await load();
    first.recordAccountType("Mock Player", "group");
    const second = await load(first.storage);
    expect(second.typeOf("Mock Player")).toBe("group");
  });

  it("ignores a record that isn't one", async () => {
    const { typeOf, put } = await load();
    put({ rsn: "Mock Player", type: "deadman" });
    expect(typeOf("Mock Player")).toBeNull();
  });
});
