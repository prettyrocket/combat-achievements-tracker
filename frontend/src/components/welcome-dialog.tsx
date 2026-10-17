// The first thing a first visit sees: every way in, as a card apiece.
//
// Not the Load dialog. That one is where you work a source -- its name row, its
// instructions, its Import button -- and opening on it asks a newcomer to have
// already chosen. This only asks which door, then hands them to Load standing
// in front of it.

import type { ReactNode } from "react";
import { FileUp, PenLine } from "lucide-react";
import { LOAD_SOURCES, type LoadSourceId } from "@/lib/load-source";
import runeProfileLogo from "@/assets/logos/runeprofile.png";
import wikiSyncLogo from "@/assets/logos/wikisync.png";
import wiseOldManLogo from "@/assets/logos/wiseoldman.svg";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function Logo({ src }: { src: string }) {
  return <img src={src} alt="" className="size-full object-cover" />;
}

// The two without a mark of their own get an icon on the same tile, so the five
// cards still line up as five of a kind.
const LOGO: Record<LoadSourceId, ReactNode> = {
  manual: <PenLine className="size-5" aria-hidden />,
  wikisync: <Logo src={wikiSyncLogo} />,
  runeprofile: <Logo src={runeProfileLogo} />,
  wiseoldman: <Logo src={wiseOldManLogo} />,
  file: <FileUp className="size-5" aria-hidden />,
};

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
        className="sm:max-w-xl"
        // Focus the dialog rather than its first card, which would otherwise
        // open wearing a focus ring and read as Manual already chosen.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg">
            Welcome to prettyrocket's Combat Achievements Tracker
          </DialogTitle>
          <DialogDescription>
            Would you like to sync your progress?
          </DialogDescription>
        </DialogHeader>

        <ul className="grid gap-2 sm:grid-cols-2">
          {LOAD_SOURCES.map((source) => (
            <li key={source.id}>
              <button
                type="button"
                onClick={() => onPick(source.id)}
                className="hover:bg-muted/60 hover:border-foreground/30 focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
                  {LOGO[source.id]}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {source.label}
                  </span>
                  {source.carries && (
                    <span className="text-muted-foreground block text-xs">
                      {source.carries}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="ghost" onClick={onSkip}>
            Skip to the catalog
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
