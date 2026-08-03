// The export file: everything this machine holds, in one document.
//
// Export is what makes localStorage an acceptable system of record rather than a
// trap, so the task list has to be in it -- a backup that restored your progress
// but silently dropped the plan you'd built would be a nasty surprise at exactly
// the wrong moment.
//
// The progress half is delegated to progress-store rather than reimplemented, so
// there is still exactly one place that decides what a valid file looks like.

import {
  buildExport,
  importProgress,
  sanitizeIds,
  type ProgressExport,
} from "@/lib/progress-store";
import { getProfile, sanitizeProfile, setProfile } from "@/lib/profile-store";
import { getList, setList } from "@/lib/tasklist-store";
import { profileIsEmpty, type PlayerProfile } from "@/lib/requirements";

/**
 * `list` and `profile` are optional, and the version deliberately does *not*
 * move for either.
 *
 * Adding a field that old readers ignore and new readers treat as empty is a
 * compatible change: a v1 file (exported before the list existed) restores
 * perfectly, and a file with a list fed to an older build restores the progress
 * and drops the rest. The version is there for a change that actually breaks.
 */
export interface Backup extends ProgressExport {
  list?: number[];
  profile?: PlayerProfile;
}

export function buildBackup(): Backup {
  const profile = getProfile();
  return {
    ...buildExport(),
    list: [...getList()],
    // Omitted rather than written empty, so a file from someone who never
    // entered their levels doesn't carry a field that means nothing.
    ...(profileIsEmpty(profile) ? {} : { profile }),
  };
}

export interface BackupImportResult {
  imported: number;
  dropped: number;
  listImported: number;
  listDropped: number;
  /** Whether the file carried levels and quests to restore. */
  profileImported: boolean;
}

/**
 * Restores both halves, replacing rather than merging -- an import is "put it
 * back the way it was", and a merge could neither un-complete a task nor drop
 * something from the plan.
 *
 * Progress is validated and committed first, by importProgress, which throws on
 * anything that isn't one of our files. The list is read only after that
 * succeeds, and never throws: it's an optional field, so a missing or malformed
 * one means "no plan in this file", not "reject the backup". Restoring progress
 * and then refusing over the softer half would be the worst of both.
 */
export function importBackup(text: string): BackupImportResult {
  const progress = importProgress(text);

  // Parsed a second time rather than threaded through importProgress: it keeps
  // that function's contract (and its tests) untouched, and the cost is one more
  // pass over a file measured in kilobytes.
  let list: number[] = [];
  let listDropped = 0;
  let profile: PlayerProfile | null = null;
  try {
    const parsed = JSON.parse(text) as {
      list?: unknown;
      profile?: unknown;
    } | null;
    const sanitized = sanitizeIds(parsed?.list);
    list = sanitized.ids;
    // Only count drops when there was something list-shaped to begin with --
    // a v1 file has no `list` at all, and that isn't data loss to report.
    listDropped = Array.isArray(parsed?.list) ? sanitized.dropped : 0;

    if (parsed?.profile !== undefined) {
      const read = sanitizeProfile(parsed.profile);
      // An empty result means the field was there but unreadable. Restoring it
      // would clear levels the player still has; leaving it alone is the
      // conservative half of a restore that has already succeeded.
      if (!profileIsEmpty(read)) profile = read;
    }
  } catch {
    // Unreachable: importProgress already parsed this successfully. Belt and
    // braces, because the alternative is losing a restore to a stray throw.
  }

  setList(list);
  // Unlike progress and the list, a missing profile is *not* an instruction to
  // clear one. Your levels aren't part of what a backup is a snapshot of in the
  // same way -- a file exported before this existed shouldn't wipe them.
  // 'manual' rather than remembering where the exporting browser got it: from
  // here it is a file you restored, and the only thing the source changes is one
  // sentence about which of the two ways to edit it wins.
  if (profile) setProfile(profile, "manual");

  return {
    imported: progress.imported,
    dropped: progress.dropped,
    listImported: list.length,
    listDropped,
    profileImported: profile !== null,
  };
}
