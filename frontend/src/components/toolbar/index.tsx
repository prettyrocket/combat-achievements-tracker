// Load / Share / Reset.
//
// Grouped by direction rather than by mechanism: Load is everything that writes
// your progress from somewhere else, Share is everything that takes it out.
//
// Load is one button here and nothing more. The dialog it opens is App's, not
// this bar's -- the requirement filter opens it too, and routing that through
// the toolbar meant seven props existed only to be forwarded. Share is a menu,
// because copying a link and saving a file are two acts rather than two sources
// for one; Reset is a dialog, because it can clear three separate stores.

import { Upload } from "lucide-react";
import type { Notice } from "@/lib/notice";
import type { PlayerProfile } from "@/lib/requirements";
import { ResetDialog } from "@/components/toolbar/reset-dialog";
import { ShareMenu } from "@/components/toolbar/share-menu";
import { Button } from "@/components/ui/button";

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
  /** Opens the Load dialog, which App owns. */
  onLoadOpen: () => void;
  /**
   * Owned by App because a file import finishes *after* its dialog has closed,
   * and that message describes three stores at once -- it has to outlive the
   * thing that produced it.
   */
  notice: Notice | null;
  onNotice: (notice: Notice) => void;
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
  onLoadOpen,
  notice,
  onNotice,
}: ProgressToolbarProps) {
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {/* One button, because there is one question -- where should this come
            from -- and the dialog is where it gets asked. A menu here would be
            the same five options with nowhere to say what any of them carry. */}
        <Button variant="outline" size="sm" onClick={onLoadOpen}>
          <Upload className="size-4" aria-hidden />
          Load
        </Button>

        <ShareMenu
          completed={completed}
          completedCount={completedCount}
          list={list}
          listCount={listCount}
          profile={profile}
          profileIsEmpty={profileIsEmpty}
          onNotice={onNotice}
        />

        <ResetDialog
          completedCount={completedCount}
          listCount={listCount}
          profileIsEmpty={profileIsEmpty}
          onReset={onReset}
          onClearList={onClearList}
          onClearProfile={onClearProfile}
          onNotice={onNotice}
        />
      </div>

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
