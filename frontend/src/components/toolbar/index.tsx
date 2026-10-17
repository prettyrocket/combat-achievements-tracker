// Load, and a menu holding Share / Settings / Reset.
//
// The first three are grouped by direction rather than by mechanism: Load is
// everything that writes your progress from somewhere else, Share is everything
// that takes it out, Reset is everything that throws it away. Settings sits
// apart at the end because it touches none of them -- it changes what this
// browser shows, not what it holds.
//
// Load is one button here and nothing more. The dialog it opens is App's, not
// this bar's -- the requirement filter opens it too, and routing that through
// the toolbar meant seven props existed only to be forwarded. The rest share one
// menu, in the same order and split by the same lines: the two ways progress
// leaves, then Settings, then Reset last and in red. Reset is still a dialog,
// because it can clear three separate stores.
//
// One button and one menu at every width, so the header never has to wrap or
// rearrange itself to fit a narrow window.

import { useState, type ReactNode } from "react";
import {
  Download,
  Ellipsis,
  Link2,
  LoaderCircle,
  RotateCcw,
  Settings,
} from "lucide-react";
import type { ListPosition } from "@/lib/list-position";
import type { Notice } from "@/lib/notice";
import type { PlayerProfile } from "@/lib/requirements";
import { SettingsDialog } from "@/components/settings";
import { ResetDialog } from "@/components/toolbar/reset-dialog";
import { shareActions } from "@/components/toolbar/share-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ProgressToolbarProps {
  completed: ReadonlySet<number>;
  completedCount: number;
  /** The plan itself, in order -- the share link carries it, not just its size. */
  list: readonly number[];
  /** Entries on the plan, for the export message and the reset options. */
  listCount: number;
  /** The levels and quests a share link carries. */
  profile: PlayerProfile;
  profileIsEmpty: boolean;
  onReset: () => void;
  onClearList: () => void;
  onClearProfile: () => void;
  /** What Load does depends on how you last loaded -- see quick-load.ts. */
  onLoad: () => void;
  /** The source's own mark, so the button says where it will load from. */
  loadIcon: ReactNode;
  /** A lookup is running. */
  loadBusy: boolean;
  /**
   * Owned by App because a file import finishes *after* its dialog has closed,
   * and that message describes three stores at once -- it has to outlive the
   * thing that produced it.
   */
  onNotice: (notice: Notice) => void;
  /** Furniture, not progress -- passed straight through to Settings. */
  manualTracking: boolean;
  onManualTrackingChange: (allowed: boolean) => void;
  listPosition: ListPosition;
  onListPositionChange: (position: ListPosition) => void;
}

export function ProgressToolbar({
  completed,
  completedCount,
  list,
  listCount,
  profile,
  profileIsEmpty,
  onReset,
  onClearList,
  onClearProfile,
  onLoad,
  loadIcon,
  loadBusy,
  onNotice,
  manualTracking,
  onManualTrackingChange,
  listPosition,
  onListPositionChange,
}: ProgressToolbarProps) {
  const [resetOpen, setResetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const share = shareActions({
    completed,
    completedCount,
    list,
    listCount,
    profile,
    profileIsEmpty,
    onNotice,
  });
  const nothingToReset =
    completedCount === 0 && listCount === 0 && profileIsEmpty;

  return (
    <div className="flex items-center gap-2">
      {/* One button, and it repeats whatever you set up rather than asking
          again: the full dialog lives on Profile. */}
      <Button
        variant="outline"
        size="sm"
        onClick={onLoad}
        disabled={loadBusy}
        aria-busy={loadBusy}
      >
        {loadBusy ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          loadIcon
        )}
        Load
      </Button>

      {/* Not modal: a modal menu hands focus back to its trigger as it closes,
          which fights the dialog an item has just opened. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="More">
            <Ellipsis className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={share.copyLink}>
            <Link2 aria-hidden />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={share.exportFile}>
            <Download aria-hidden />
            Export a file
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
            <Settings aria-hidden />
            Settings…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={nothingToReset}
            onSelect={() => setResetOpen(true)}
            className="text-destructive focus:text-destructive [&_svg]:text-destructive focus:[&_svg]:text-destructive"
          >
            <RotateCcw aria-hidden />
            Reset…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResetDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        completedCount={completedCount}
        listCount={listCount}
        profileIsEmpty={profileIsEmpty}
        onReset={onReset}
        onClearList={onClearList}
        onClearProfile={onClearProfile}
        onNotice={onNotice}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        manualTracking={manualTracking}
        onManualTrackingChange={onManualTrackingChange}
        listPosition={listPosition}
        onListPositionChange={onListPositionChange}
      />
    </div>
  );
}
