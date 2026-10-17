// The levels-and-quests form on its own, for the header's Load button.
//
// Somebody who types their levels in has nothing to fetch, so their Load is
// the form itself -- without the rail or the sources they don't use. The name
// row stays: with nothing to look up it's the only place a Manual player would
// say who they are. The full dialog stays on Profile.

import { useEffect, useRef, useState } from "react";
import type { PlayerProfile } from "@/lib/requirements";
import { ManualPanel } from "@/components/load/manual-panel";
import { NameRow } from "@/components/load/name-row";
import { useAccountTypeDraft } from "@/lib/use-account-type";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The account this browser tracks, which seeds the name row. */
  lastRsn: string | null;
  /** Remembers the name, on close -- the same timing as the full dialog. */
  onRsnCommit: (rsn: string) => void;
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
  lastRsn,
  onRsnCommit,
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
  const [rsn, setRsn] = useState("");
  const accountType = useAccountTypeDraft(open, lastRsn);
  useEffect(() => {
    if (!open) return;
    edited.current = false;
    setRsn(lastRsn ?? "");
  }, [open, lastRsn]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          const name = rsn.trim();
          if (name !== "") {
            onRsnCommit(name);
            accountType.commit(name);
          }
          if (edited.current && !profileIsEmpty) onManualLanded();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex h-[34rem] max-h-[90dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Levels and quests</DialogTitle>
        </DialogHeader>
        <NameRow
          rsn={rsn}
          onChange={setRsn}
          type={accountType.type}
          onTypeChange={accountType.pick}
        />
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
