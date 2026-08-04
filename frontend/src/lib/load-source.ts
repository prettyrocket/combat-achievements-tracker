// The five ways progress gets into this app, as data.
//
// A list rather than five call sites, because the Load dialog's rail, its
// remembered default and its detail pane all have to agree on what exists and
// what each one can write.
//
// The order here is the order on screen. Manual leads because it is the only one
// that needs nothing at all -- no plugin, no name, no file -- so it is the floor
// everybody can stand on. The four that fetch or read follow in order of reach:
// WikiSync has roughly 335k Plugin Hub installs against RuneProfile's 92k, so
// the door most people can already walk through comes first among them,
// regardless of which is nicer once you're through it.
//
// Leading the rail is not the same as being the default -- a first visit still
// opens on WikiSync, because somebody who has never used this would rather
// import than type.

import { readJson, writeJson } from "@/lib/local-store";

export type LoadSourceId =
  "wikisync" | "runeprofile" | "wiseoldman" | "file" | "manual";

/**
 * The two that speak for a whole account: achievements *and* levels, from one
 * lookup or one paste.
 *
 * A named subset because they are the pair that writes to both stores at once,
 * and both stores have to call them the same thing -- `ProgressSource` and
 * `ProfileSource` overlap here and nowhere else that matters. Wise Old Man is
 * not among them: it knows levels and has never heard of a Combat Achievement.
 */
export type AccountSource = Extract<LoadSourceId, "wikisync" | "runeprofile">;

export interface LoadSourceMeta {
  id: LoadSourceId;
  /** The rail label. */
  label: string;
  /**
   * What this source can write, in the rail under the name.
   *
   * The single most useful thing the picker can say about the ones that import:
   * they look interchangeable until you notice that only three carry
   * achievements and only one carries a plan.
   *
   * Optional, and Manual is the one without it. Manual doesn't bring anything --
   * it *is* the form, sitting where the others put their instructions, so a line
   * claiming it "carries levels and quests" describes the pane you're already
   * looking at.
   */
  carries?: string;
}

export const LOAD_SOURCES: readonly LoadSourceMeta[] = [
  { id: "manual", label: "Manual" },
  {
    id: "wikisync",
    label: "WikiSync",
    carries: "Achievements, levels, quests",
  },
  {
    id: "runeprofile",
    label: "RuneProfile",
    carries: "Achievements, levels, quests",
  },
  { id: "wiseoldman", label: "Wise Old Man", carries: "Levels only" },
  {
    id: "file",
    label: "A backup file",
    carries: "Everything, including your plan",
  },
];

const IDS: ReadonlySet<string> = new Set(
  LOAD_SOURCES.map((source) => source.id),
);

/** Where the rail starts on a first visit: the one most people can use. */
export const DEFAULT_LOAD_SOURCE: LoadSourceId = "wikisync";

const STORAGE_KEY = "ca-tracker:load-source:v1";

/**
 * The source last imported from.
 *
 * Remembered because nobody switches: whichever door you came through the first
 * time is almost certainly the one you'll use again, and making a returning
 * player re-pick it every time is a click that buys nothing.
 */
export function readLastSource(): LoadSourceId {
  const stored = readJson(STORAGE_KEY);
  return typeof stored === "string" && IDS.has(stored)
    ? (stored as LoadSourceId)
    : DEFAULT_LOAD_SOURCE;
}

/**
 * Only ever called after something actually landed.
 *
 * Merely looking at a source isn't a preference -- clicking through the rail to
 * read what RuneProfile needs shouldn't change where the dialog opens next time.
 */
export function writeLastSource(id: LoadSourceId): void {
  writeJson(STORAGE_KEY, id);
}

export { STORAGE_KEY as LOAD_SOURCE_STORAGE_KEY };
