// Load / Share / Reset.
//
// Export is what makes localStorage an acceptable system of record rather than a
// trap, so it stays one click from the top level -- inside a menu, but never
// behind a settings screen the player finds only after losing their data.
//
// Load and Share are grouped by direction rather than by mechanism: Load is
// everything that writes your progress from somewhere else, Share is everything
// that takes it out. Load is one button and one dialog now -- which source, and
// whether it's a paste or a fetch or a file, is answered inside it (see
// load-dialog.tsx). Share is still a menu, because copying a link and saving a
// file are two acts rather than two sources for one.

import { useState } from "react";
import {
  Download,
  ChevronDown,
  Link2,
  Upload,
  RotateCcw,
  Share2,
} from "lucide-react";
import { buildBackup, importBackup } from "@/lib/backup";
import { buildShareUrl, profileWireLoss } from "@/lib/share-code";
import type { PlayerProfile } from "@/lib/requirements";
import type { ProfileSource } from "@/lib/profile-store";
import type { LoadSourceId } from "@/lib/load-source";
import { LoadDialog } from "@/components/load-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Notice = { tone: "ok" | "error"; message: string };

/** What Reset is allowed to clear, ticked one by one. */
interface ResetTargets {
  completed: boolean;
  list: boolean;
  profile: boolean;
}

// Progress only, because that's what Reset has always meant and it's the one
// with an undo. Levels and the list are opt-in every time.
const DEFAULT_RESET_TARGETS: ResetTargets = {
  completed: true,
  list: false,
  profile: false,
};

/** "a", "a and b", "a, b and c" -- for a sentence, not a table. */
function formatList(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** One tickable thing Reset can clear, with how much of it there is. */
function ResetOption({
  label,
  detail,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center gap-2.5 rounded px-1.5 py-1.5 text-sm ${
        disabled
          ? "opacity-50"
          : "hover:bg-muted cursor-pointer transition-colors"
      }`}
    >
      <Checkbox
        checked={checked && !disabled}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <span className="flex-1">{label}</span>
      <span className="text-muted-foreground text-xs tabular-nums">
        {detail}
      </span>
    </label>
  );
}

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

export interface ProgressToolbarProps {
  completed: ReadonlySet<number>;
  completedCount: number;
  /** The plan itself, in order -- the share link carries it, not just its size. */
  list: readonly number[];
  /** Entries on the plan, for the export message and the import warning. */
  listCount: number;
  /** The account the last WikiSync import came from, if any. */
  lastRsn: string | null;
  /** Clears completed tasks. Reset picks which of these three it calls. */
  onReset: () => void;
  onClearList: () => void;
  /**
   * One callback for both import doors. They differ only in where the data came
   * from, which the profile editor wants to name back at you -- the progress
   * half is identical either way.
   */
  onImportApply: (
    wikiIds: number[],
    rsn: string,
    clearList: boolean,
    profile: PlayerProfile | null,
    source: ProfileSource,
  ) => void;
  /** The levels and quests behind the requirement filter, and its editor. */
  profile: PlayerProfile;
  profileIsEmpty: boolean;
  /** Owned by App: the requirement filter opens this dialog too. */
  loadOpen: boolean;
  onLoadOpenChange: (open: boolean) => void;
  /** Which pane to land on, or null for whichever was used last. */
  loadSource: LoadSourceId | null;
  /** The name the Load dialog closed with. Typing it counts as saying so. */
  onRsnCommit: (rsn: string) => void;
  onSetLevel: (skill: string, level: number) => void;
  onImportLevels: (levels: Record<string, number>) => void;
  onSetQuest: (quest: string, finished: boolean) => void;
  onClearProfile: () => void;
}

export function ProgressToolbar({
  completed,
  completedCount,
  list,
  listCount,
  lastRsn,
  onReset,
  onClearList,
  onImportApply,
  profile,
  profileIsEmpty,
  loadOpen,
  onLoadOpenChange,
  loadSource,
  onRsnCommit,
  onSetLevel,
  onImportLevels,
  onSetQuest,
  onClearProfile,
}: ProgressToolbarProps) {
  const [notice, setNotice] = useState<Notice | null>(null);

  // Reset asks what to reset. Three separate stores, three separate answers --
  // wiping your levels because you wanted to re-tick your tasks was never
  // something anyone asked for, and the levels are the slowest to type back in.
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTargets, setResetTargets] = useState<ResetTargets>(
    DEFAULT_RESET_TARGETS,
  );
  const nothingToReset =
    completedCount === 0 && listCount === 0 && profileIsEmpty;
  const willReset =
    (resetTargets.completed && completedCount > 0) ||
    (resetTargets.list && listCount > 0) ||
    (resetTargets.profile && !profileIsEmpty);

  function handleReset() {
    const done: string[] = [];
    if (resetTargets.completed && completedCount > 0) {
      onReset();
      done.push(`${completedCount} completed tasks`);
    }
    if (resetTargets.list && listCount > 0) {
      onClearList();
      done.push(`your list of ${listCount}`);
    }
    if (resetTargets.profile && !profileIsEmpty) {
      onClearProfile();
      done.push("your levels and quests");
    }
    setNotice({ tone: "ok", message: `Cleared ${formatList(done)}.` });
  }

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
    setNotice({
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
      setNotice({
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
      setNotice({
        tone: "error",
        message: `Couldn't reach the clipboard. The link is: ${url}`,
      });
    }
  }

  /**
   * Rethrows rather than swallowing: the file pane shows the failure beside its
   * own button, where the person who picked the file is looking. Only a success
   * reaches the toolbar's notice line, because that message describes three
   * stores at once and is worth reading after the dialog has gone.
   */
  async function handleImportFile(file: File) {
    const result = importBackup(await file.text());
    setNotice({
      tone: "ok",
      message:
        `Imported ${result.imported} completed tasks` +
        (result.listImported > 0
          ? ` and ${result.listImported} on your list.`
          : ".") +
        (result.profileImported
          ? " Your levels and quests came with it."
          : "") +
        (result.dropped + result.listDropped > 0
          ? ` Ignored ${result.dropped + result.listDropped} unrecognised entries.`
          : ""),
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {/* One button, because there is one question -- where should this come
            from -- and the dialog is where it gets asked. A menu here would be
            the same five options with nowhere to say what any of them carry. */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onLoadOpenChange(true)}
        >
          <Upload className="size-4" aria-hidden />
          Load
        </Button>

        {/* Two answers to the same question with a different trade: the file is
            the durable copy, the link is the one that fits in a message. Neither
            is a server, and both say so when used. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Share2 className="size-4" aria-hidden />
              Share
              <ChevronDown className="size-3.5 opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => void handleCopyLink()}>
              <Link2 aria-hidden />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleExport}>
              <Download aria-hidden />
              Export a file
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog
          open={resetOpen}
          onOpenChange={(next) => {
            setResetOpen(next);
            // Back to defaults on the way in, not on the way out: a dialog that
            // reopens still holding "and my levels" from last time is how you
            // clear something you didn't mean to.
            if (next) setResetTargets(DEFAULT_RESET_TARGETS);
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={nothingToReset}>
              <RotateCcw className="size-4" aria-hidden />
              Reset
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset what?</AlertDialogTitle>
              <AlertDialogDescription>
                Nothing here is kept on a server, so nothing comes back from one
                — export first if you might want it. Ctrl+Z can bring completed
                tasks back until you reload the page; your levels and your list
                can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>

            {/* Each row disabled when there's nothing behind it, so the dialog
                says what you actually have as well as what it will do. */}
            <div className="space-y-1">
              <ResetOption
                label="Completed tasks"
                detail={
                  completedCount === 0
                    ? "none ticked"
                    : `${completedCount} ticked`
                }
                checked={resetTargets.completed}
                disabled={completedCount === 0}
                onChange={(next) =>
                  setResetTargets((targets) => ({
                    ...targets,
                    completed: next,
                  }))
                }
              />
              <ResetOption
                label="My list"
                detail={listCount === 0 ? "empty" : `${listCount} planned`}
                checked={resetTargets.list}
                disabled={listCount === 0}
                onChange={(next) =>
                  setResetTargets((targets) => ({ ...targets, list: next }))
                }
              />
              <ResetOption
                label="My levels and quests"
                detail={profileIsEmpty ? "not entered" : "entered"}
                checked={resetTargets.profile}
                disabled={profileIsEmpty}
                onChange={(next) =>
                  setResetTargets((targets) => ({ ...targets, profile: next }))
                }
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} disabled={!willReset}>
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Outside the row: it isn't a control here, just the panel Load opens.
          Its open state lives in App, because the requirement filter opens it
          too -- straight onto the by-hand pane when it has nothing to run on. */}
      <LoadDialog
        open={loadOpen}
        onOpenChange={onLoadOpenChange}
        initialSource={loadSource}
        completed={completed}
        listCount={listCount}
        lastRsn={lastRsn}
        onImportApply={onImportApply}
        onImportLevels={onImportLevels}
        onImportFile={handleImportFile}
        onRsnCommit={onRsnCommit}
        profile={profile}
        profileIsEmpty={profileIsEmpty}
        onSetLevel={onSetLevel}
        onSetQuest={onSetQuest}
        onClearProfile={onClearProfile}
      />

      {notice && (
        <p
          role="status"
          className={`text-xs ${notice.tone === "error" ? "text-red-400" : "text-muted-foreground"}`}
        >
          {notice.message}
        </p>
      )}
    </div>
  );
}
