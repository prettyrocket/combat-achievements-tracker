// The levels-and-quests form on its own, for the header's Load button.
//
// Somebody who types their levels in has nothing to fetch, so their Load is
// the form itself -- without the rail, the name row, or the sources they don't
// use. The full dialog stays on Profile.

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
}

export function ManualDialog({
  open,
  onOpenChange,
  profile,
  profileIsEmpty,
  onSetLevel,
  onSetQuest,
  onClearProfile,
}: ManualDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[34rem] max-h-[90dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Levels and quests</DialogTitle>
        </DialogHeader>
        <ManualPanel
          profile={profile}
          isEmpty={profileIsEmpty}
          onSetLevel={onSetLevel}
          onSetQuest={onSetQuest}
          onClear={onClearProfile}
        />
      </DialogContent>
    </Dialog>
  );
}
