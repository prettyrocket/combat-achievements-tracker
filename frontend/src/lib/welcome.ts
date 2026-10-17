// Whether this is somebody's first visit, and so whether they get the welcome.
//
// "First" means this browser holds nothing of ours at all: any ca-tracker key --
// progress, a plan, levels, a pref, a past welcome -- is somebody who has been
// here before, and none of them should meet a greeting on their hundredth visit.

import { readJson, storage, writeJson } from "@/lib/local-store";
import { readShareCode } from "@/lib/share-code";

const KEY_PREFIX = "ca-tracker:";
const WELCOMED_KEY = "ca-tracker:welcomed:v1";

/**
 * The rule, without the browser.
 *
 * A share link is not a first visit worth greeting: it arrives with its own
 * question, and two dialogs on top of each other is neither.
 */
export function isFirstVisit(keys: readonly string[], hash: string): boolean {
  if (readShareCode(hash) !== null) return false;
  return !keys.some((key) => key.startsWith(KEY_PREFIX));
}

export function shouldWelcome(): boolean {
  const store = storage();
  // Storage that can't be written can't remember a skip either, so the welcome
  // would greet them on every load.
  if (!store) return false;
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key !== null) keys.push(key);
  }
  return isFirstVisit(keys, window.location.hash);
}

/** Once seen, never again -- whether they picked a source or skipped. */
export function markWelcomed(): void {
  if (readJson(WELCOMED_KEY) !== true) writeJson(WELCOMED_KEY, true);
}
