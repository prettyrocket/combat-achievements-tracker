// What the header's Load button does, decided by how you last loaded.
//
// The full dialog lives on Profile. Everywhere else Load is the short way back
// to the same place: a lookup you already set up, run again for the name you
// already gave, or the form you already fill in by hand.

import type { ImportDiff } from "@/lib/import-diff";
import type { LoadSourceId } from "@/lib/load-source";

export type QuickLoad =
  /** Fetch achievements, levels and quests, and apply them. */
  | "runeprofile"
  /** Fetch levels, and apply them. */
  | "wiseoldman"
  /** Open the levels-and-quests form on its own. */
  | "manual"
  /** Nothing to repeat yet: go to Profile, where the full dialog is. */
  | "setup";

/**
 * A lookup needs a name to look up. Without one -- an import that somehow
 * landed before a name was remembered, or a name since cleared -- there's
 * nothing to repeat, and Profile is where you'd give one.
 *
 * A backup file is a one-off restore rather than somewhere progress keeps
 * coming from, so it counts as nothing set up.
 */
export function quickLoadFor(
  source: LoadSourceId | null,
  rsn: string | null,
): QuickLoad {
  const named = rsn !== null && rsn.trim() !== "";
  switch (source) {
    case "runeprofile":
    case "wiseoldman":
      return named ? source : "setup";
    case "manual":
      return "manual";
    default:
      return "setup";
  }
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The toast after a RuneProfile sync, or null when nothing changed and nothing
 * was written.
 */
export function runeProfileSyncMessage(
  diff: ImportDiff,
  profileChanged: boolean,
): string | null {
  const parts: string[] = [];
  if (diff.newlyCompleted.length > 0)
    parts.push(plural(diff.newlyCompleted.length, "new task", "new tasks"));
  if (diff.removed.length > 0)
    parts.push(plural(diff.removed.length, "task unticked", "tasks unticked"));
  if (profileChanged) parts.push("levels and quests updated");
  if (parts.length === 0) return null;
  return `Synced from RuneProfile: ${parts.join(", ")}.`;
}
