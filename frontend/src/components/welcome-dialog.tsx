// The first thing a first visit sees: every way in, as a card apiece.
//
// Not the Load dialog. That one is where you work a source -- its name row, its
// instructions, its Import button -- and opening on it asks a newcomer to have
// already chosen. This only asks which door, then hands them to Load standing
// in front of it.

import type { LoadSourceId } from "@/lib/load-source";
import { SourceCards } from "@/components/source-cards";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface WelcomeDialogProps {
  open: boolean;
  onPick: (source: LoadSourceId) => void;
  /** Also what closing it any other way means. */
  onSkip: () => void;
}

export function WelcomeDialog({ open, onPick, onSkip }: WelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onSkip()}>
      <DialogContent
        className="gap-6 sm:max-w-2xl"
        // Focus the dialog rather than its first card, which would otherwise
        // open wearing a focus ring and read as Manual already chosen.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
      >
        <DialogHeader className="items-center pt-4 text-center">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            Welcome to prettyrocket's Combat Achievements Tracker
          </DialogTitle>
          <DialogDescription className="text-base">
            Would you like to sync your progress?
          </DialogDescription>
        </DialogHeader>

        <SourceCards onPick={onPick} />

        <DialogFooter>
          <Button variant="ghost" onClick={onSkip}>
            Skip to the catalog
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
