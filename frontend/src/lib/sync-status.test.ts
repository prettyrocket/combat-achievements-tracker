// The record is hand-editable and outlives releases, so what's worth pinning is
// that anything half-shaped or naming a retired source reads as "never synced"
// rather than reaching the screen as a broken date.

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

async function load() {
  vi.resetModules();
  const storage = fakeStorage();
  vi.stubGlobal("window", { localStorage: storage });
  const mod = await import("@/lib/sync-status");
  const put = (value: unknown) =>
    storage.setItem(mod.SYNC_STATUS_STORAGE_KEY, JSON.stringify(value));
  return { ...mod, put };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("recording a sync", () => {
  it("reads null when nothing was ever recorded", async () => {
    const { readSyncStatus } = await load();
    expect(readSyncStatus()).toBeNull();
  });

  it("round-trips, stamped now", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T12:00:00Z"));
    const { readSyncStatus, recordSync } = await load();
    const written = recordSync("runeprofile", new Date("2026-10-01T08:30:00Z"));
    expect(written).toEqual({
      source: "runeprofile",
      syncedAt: "2026-10-16T12:00:00.000Z",
      dataAsOf: "2026-10-01T08:30:00.000Z",
    });
    expect(readSyncStatus()).toEqual(written);
  });

  it("keeps a missing source date as null", async () => {
    const { readSyncStatus, recordSync } = await load();
    recordSync("manual", null);
    expect(readSyncStatus()?.dataAsOf).toBeNull();
  });

  it("treats an unparseable source date as no date", async () => {
    const { recordSync } = await load();
    expect(recordSync("wiseoldman", new Date("nope")).dataAsOf).toBeNull();
  });

  it("tells subscribers, and the snapshot holds still between writes", async () => {
    const { getSyncStatus, recordSync, subscribe } = await load();
    const heard = vi.fn();
    subscribe(heard);
    expect(getSyncStatus()).toBe(getSyncStatus());
    const written = recordSync("file", null);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(getSyncStatus()).toBe(written);
  });
});

describe("reading a record that isn't right", () => {
  const good = {
    source: "wiseoldman",
    syncedAt: "2026-10-16T12:00:00.000Z",
    dataAsOf: null,
  };

  it.each([
    ["a string", "runeprofile"],
    ["an array", [good]],
    ["no source", { ...good, source: undefined }],
    ["an unknown source", { ...good, source: "hiscores" }],
    ["no syncedAt", { ...good, syncedAt: undefined }],
    ["a syncedAt that isn't a date", { ...good, syncedAt: "yesterday-ish" }],
    ["a dataAsOf that isn't a date", { ...good, dataAsOf: 42 }],
  ])("reads null for %s", async (_, value) => {
    const { put, readSyncStatus } = await load();
    put(value);
    expect(readSyncStatus()).toBeNull();
  });

  // Somebody who last synced from WikiSync, before it was retired: there's no
  // way to do that again, so a date for it describes nothing.
  it("reads null for a retired source", async () => {
    const { put, readSyncStatus } = await load();
    put({ ...good, source: "wikisync" });
    expect(readSyncStatus()).toBeNull();
  });

  it("accepts the good one", async () => {
    const { put, readSyncStatus } = await load();
    put(good);
    expect(readSyncStatus()).toEqual(good);
  });
});
