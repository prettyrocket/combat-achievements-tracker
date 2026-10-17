// The levels-and-quests form on its own, for the header's Load button.
//
// Somebody who types their levels in has nothing to fetch, so their Load is
// the form itself -- without the rail, the name row, or the sources they don't
// use. The full dialog stays on Profile.

import { useEffect, useRef } from "react";
import type { PlayerProfile } from "@/lib/requirements";
import { ManualPanel } from "@/components/load/manual-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: PlayerProfile;
  profileIsEmpty: boolean;
  onSetLevel: (skill: string, level: number) => void;
  onSetQuest: (quest: string, finished: boolean) => void;
  onClearProfile: () => void;
  /** Closed after an edit that left something entered: a by-hand sync. */
  onManualLanded: () => void;
}

export function ManualDialog({
  open,
  onOpenChange,
  profile,
  profileIsEmpty,
  onSetLevel,
  onSetQuest,
  onClearProfile,
  onManualLanded,
}: ManualDialogProps) {
  // Same rule as the full dialog's by-hand pane: opening the form to look at it
  // isn't a sync, typing into it is.
  const edited = useRef(false);
  useEffect(() => {
    if (open) edited.current = false;
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && edited.current && !profileIsEmpty) onManualLanded();
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex h-[34rem] max-h-[90dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Levels and quests</DialogTitle>
        </DialogHeader>
        <ManualPanel
          profile={profile}
          isEmpty={profileIsEmpty}
          onSetLevel={(skill, level) => {
            edited.current = true;
            onSetLevel(skill, level);
          }}
          onSetQuest={(quest, finished) => {
            edited.current = true;
            onSetQuest(quest, finished);
          }}
          onClear={onClearProfile}
        />
      </DialogContent>
    </Dialog>
  );
}
