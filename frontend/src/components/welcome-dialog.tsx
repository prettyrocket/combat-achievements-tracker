// The first thing a first visit sees: every way in, as a card apiece.
//
// Not the Load dialog. That one is where you work a source -- its name row, its
// instructions, its Import button -- and opening on it asks a newcomer to have
// already chosen. This only asks which door, then hands them to Load standing
// in front of it.

import type { ReactNode } from "react";
import { FileUp, PenLine } from "lucide-react";
import {
  LOAD_SOURCES,
  type LoadSourceId,
  type LoadSourceMeta,
} from "@/lib/load-source";
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
  manual: <PenLine className="size-8" aria-hidden />,
  wikisync: <Logo src={wikiSyncLogo} />,
  runeprofile: <Logo src={runeProfileLogo} />,
  wiseoldman: <Logo src={wiseOldManLogo} />,
  file: <FileUp className="size-8" aria-hidden />,
};

// Not the rail's order: the two that bring achievements lead, then levels,
// then the two that need nothing fetched.
const ORDER: readonly LoadSourceId[] = [
  "runeprofile",
  "wikisync",
  "wiseoldman",
  "manual",
  "file",
];

const CARDS: readonly LoadSourceMeta[] = ORDER.map((id) =>
  LOAD_SOURCES.find((source) => source.id === id)!,
);

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
        className="gap-6 sm:max-w-3xl"
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

        {/* Three over two at sm and up, the two centred under the three: six
            columns with every card spanning two, and the fourth nudged one
            column in. */}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-6 sm:[&>li:nth-child(4)]:col-start-2">
          {CARDS.map((source) => (
            <li key={source.id} className="sm:col-span-2">
              <button
                type="button"
                onClick={() => onPick(source.id)}
                className="hover:bg-muted/60 hover:border-foreground/30 focus-visible:ring-ring flex h-full w-full flex-col items-center gap-3 rounded-xl border px-4 py-6 text-center transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-md">
                  {LOGO[source.id]}
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold">
                    {source.label}
                  </span>
                  {source.carries && (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
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
