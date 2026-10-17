// Every way in, as a card apiece -- and each source's mark on its own.
//
// Lifted out of the welcome dialog once Profile wanted the same four doors: a
// first visit picks one here, and somebody already set up can see the one they
// use and switch. Same cards both places, so the choice looks like the same
// choice.

import type { ReactNode } from "react";
import { FileUp, PenLine } from "lucide-react";
import {
  LOAD_SOURCES,
  type LoadSourceId,
  type LoadSourceMeta,
} from "@/lib/load-source";
import { cn } from "@/lib/utils";
import runeProfileLogo from "@/assets/logos/runeprofile.png";
import wiseOldManLogo from "@/assets/logos/wiseoldman.svg";

/**
 * A source's mark, at whatever size `className` gives it.
 *
 * The two without a mark of their own get an icon, so that wherever these
 * appear side by side they still read as four of a kind. Decorative
 * everywhere: the label beside it is what says which source it is.
 */
export function SourceLogo({
  source,
  className,
}: {
  source: LoadSourceId;
  className?: string;
}) {
  switch (source) {
    case "runeprofile":
      return (
        <img
          src={runeProfileLogo}
          alt=""
          className={cn("object-cover", className)}
        />
      );
    case "wiseoldman":
      return (
        <img
          src={wiseOldManLogo}
          alt=""
          className={cn("object-cover", className)}
        />
      );
    case "manual":
      return <PenLine className={className} aria-hidden />;
    case "file":
      return <FileUp className={className} aria-hidden />;
  }
}

// The logos fill their tile; the icons sit in the middle of it, at the size
// that reads as the same weight as a logo.
const LOGO: Record<LoadSourceId, ReactNode> = {
  manual: <SourceLogo source="manual" className="size-8" />,
  runeprofile: <SourceLogo source="runeprofile" className="size-full" />,
  wiseoldman: <SourceLogo source="wiseoldman" className="size-full" />,
  file: <SourceLogo source="file" className="size-8" />,
};

// Not the rail's order: the one that brings achievements leads, then levels,
// then the two that need nothing fetched.
const ORDER: readonly LoadSourceId[] = [
  "runeprofile",
  "wiseoldman",
  "manual",
  "file",
];

const CARDS: readonly LoadSourceMeta[] = ORDER.map((id) =>
  LOAD_SOURCES.find((source) => source.id === id)!,
);

export interface SourceCardsProps {
  onPick: (source: LoadSourceId) => void;
  /** On the grid, for the caller's spacing. */
  className?: string;
}

export function SourceCards({ onPick, className }: SourceCardsProps) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3", className)}>
      {CARDS.map((source) => (
        <li key={source.id}>
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
  );
}
