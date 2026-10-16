// Share: the two ways progress leaves this browser, as actions for the
// toolbar's menu to call.
//
// Two answers to the same question with a different trade: the file is the
// durable copy, the link is the one that fits in a message. Neither is a server,
// and both say so when used.
//
// Export is what makes localStorage an acceptable system of record rather than a
// trap, so it stays one click from the top level -- inside a menu, but never
// behind a settings screen the player finds only after losing their data.

import { buildBackup } from "@/lib/backup";
import { buildShareUrl, profileWireLoss } from "@/lib/share-code";
import type { Notice } from "@/lib/notice";
import type { PlayerProfile } from "@/lib/requirements";

function exportFilename(): string {
  // Local date, not ISO: this filename is for a human sorting their own backups.
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  return `combat-achievements-${stamp}.json`;
}

export interface ShareActionsInput {
  completed: ReadonlySet<number>;
  completedCount: number;
  /** The plan itself, in order -- the share link carries it, not just its size. */
  list: readonly number[];
  listCount: number;
  profile: PlayerProfile;
  profileIsEmpty: boolean;
  onNotice: (notice: Notice) => void;
}

export function shareActions({
  completed,
  completedCount,
  list,
  listCount,
  profile,
  profileIsEmpty,
  onNotice,
}: ShareActionsInput) {
  function handleExport() {
    const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFilename();
    link.click();
    URL.revokeObjectURL(url);
    onNotice({
      tone: "ok",
      message:
        `Exported ${completedCount} completed tasks` +
        (listCount > 0 ? ` and ${listCount} on your list.` : "."),
    });
  }

  async function handleCopyLink() {
    const url = buildShareUrl({ completed, list, profile }, window.location);
    // Said here or nowhere: a link that never carried your other 200 quests looks
    // exactly like one made by someone who hasn't finished them, so the moment
    // the sender can still choose Export instead is the only moment worth
    // mentioning it.
    const loss = profileWireLoss(profile);
    const lost = [
      loss.levels > 0
        ? `${loss.levels} skill${loss.levels === 1 ? "" : "s"}`
        : null,
      loss.quests > 0
        ? `${loss.quests} quest${loss.quests === 1 ? "" : "s"}`
        : null,
    ].filter((part) => part !== null);
    try {
      await navigator.clipboard.writeText(url);
      onNotice({
        tone: "ok",
        message:
          `Link copied — ${completedCount} completed tasks` +
          (listCount > 0 ? `, ${listCount} on your list` : "") +
          (profileIsEmpty ? "." : ", and your levels and quests.") +
          " Opening it replaces whatever that browser holds." +
          (lost.length > 0
            ? ` ${lost.join(" and ")} can't fit in a link — export a file if you need those too.`
            : ""),
      });
    } catch {
      // Denied permission, or an insecure origin. The link is the useful thing,
      // not the copying, so hand it over rather than reporting a failure the
      // player can do nothing about.
      onNotice({
        tone: "error",
        message: `Couldn't reach the clipboard. The link is: ${url}`,
      });
    }
  }

  return {
    copyLink: () => void handleCopyLink(),
    exportFile: handleExport,
  };
}
