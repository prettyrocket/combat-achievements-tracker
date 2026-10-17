// Running the header's Load button: fetch, apply, report, offer Undo.
//
// No preview and no different-account check, both on purpose. The name is the
// one already remembered, so the account can't have changed, and the preview a
// dialog shows is for a first import -- the size of what's arriving. On a
// re-sync that is "the same account, a little further on", and the toast says
// exactly that afterwards with a way back.

import { useCallback, useState } from "react";
import { diffAgainst, diffIsNoop } from "@/lib/import-diff";
import type { Notice } from "@/lib/notice";
import {
  sameProfile,
  sanitizeLevels,
  sanitizeProfile,
} from "@/lib/profile-store";
import type { ProgressSource } from "@/lib/progress-store";
import { runeProfileSyncMessage, type QuickLoad } from "@/lib/quick-load";
import type { PlayerProfile } from "@/lib/requirements";
import { fetchRuneProfile, RuneProfileError } from "@/lib/runeprofile";
import { fetchWomLevels, WomLookupError } from "@/lib/wiseoldman";

export interface QuickLoadDeps {
  kind: QuickLoad;
  rsn: string | null;
  completed: ReadonlySet<number>;
  profile: PlayerProfile;
  setMany: (ids: Iterable<number>, source: ProgressSource) => void;
  setProfile: (profile: PlayerProfile, source: "runeprofile") => void;
  importLevels: (levels: Record<string, number>) => void;
  undoProgress: () => void;
  undoProfile: () => void;
  onNotice: (notice: Notice) => void;
  goToProfile: () => void;
}

export interface UseQuickLoad {
  /** A lookup is in flight; the button should show it and not fire again. */
  busy: boolean;
  /** Runs the lookup for `kind`. Does nothing for the kinds that don't fetch. */
  sync: () => Promise<void>;
}

export function useQuickLoad(deps: QuickLoadDeps): UseQuickLoad {
  const [busy, setBusy] = useState(false);
  const {
    kind,
    rsn,
    completed,
    profile,
    setMany,
    setProfile,
    importLevels,
    undoProgress,
    undoProfile,
    onNotice,
    goToProfile,
  } = deps;

  const failed = useCallback(
    (message: string) =>
      onNotice({
        tone: "error",
        message,
        action: { label: "Go to Profile", onClick: goToProfile },
      }),
    [onNotice, goToProfile],
  );

  const sync = useCallback(async () => {
    if (busy || rsn === null) return;
    if (kind !== "runeprofile" && kind !== "wiseoldman") return;
    setBusy(true);
    try {
      if (kind === "runeprofile") {
        const found = await fetchRuneProfile(rsn);
        const diff = diffAgainst(found, completed);
        const ticksChanged = !diffIsNoop(diff);
        const profileChanged =
          found.profile !== null &&
          !sameProfile(sanitizeProfile(found.profile), profile);
        const message = runeProfileSyncMessage(diff, profileChanged);
        if (message === null) {
          onNotice({ tone: "ok", message: "Already up to date." });
          return;
        }
        if (ticksChanged) setMany(found.ids, "runeprofile");
        if (profileChanged && found.profile)
          setProfile(found.profile, "runeprofile");
        onNotice({
          tone: "ok",
          message,
          action: {
            label: "Undo",
            onClick: () => {
              if (ticksChanged) undoProgress();
              if (profileChanged) undoProfile();
            },
          },
        });
      } else {
        const found = await fetchWomLevels(rsn);
        const next = { levels: sanitizeLevels(found.levels), quests: [] };
        const current = { levels: profile.levels, quests: [] };
        if (sameProfile(next, current)) {
          onNotice({ tone: "ok", message: "Already up to date." });
          return;
        }
        importLevels(found.levels);
        onNotice({
          tone: "ok",
          message: "Levels synced from Wise Old Man.",
          action: { label: "Undo", onClick: undoProfile },
        });
      }
    } catch (err) {
      if (err instanceof RuneProfileError || err instanceof WomLookupError)
        failed(err.message);
      else
        failed(
          kind === "runeprofile"
            ? "Couldn't reach RuneProfile."
            : "Couldn't reach Wise Old Man.",
        );
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    kind,
    rsn,
    completed,
    profile,
    setMany,
    setProfile,
    importLevels,
    undoProgress,
    undoProfile,
    onNotice,
    failed,
  ]);

  return { busy, sync };
}
