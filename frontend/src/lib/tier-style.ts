// The tier colour ramp, in both the forms the app uses it.
//
// Kept together because the two maps have to agree and used not to live in the
// same file: the badge's text colour was in tier-badge.tsx and the chip's fill
// in progress-header.tsx, so a tier that changed colour changed it in one place
// and quietly disagreed with itself in the other.
//
// Same reasoning as COMPLETION_TONE_CLASS in completion.ts: class names are
// data, so they sit in lib where anything can read them, rather than being
// exported out of a component that happened to need them first.

import type { Tier } from "@/lib/types";

/** The badge: solid colour on the tier's name. */
export const TIER_TEXT_CLASS: Record<Tier, string> = {
  EASY: "text-emerald-400",
  MEDIUM: "text-sky-400",
  HARD: "text-violet-400",
  ELITE: "text-amber-400",
  MASTER: "text-rose-400",
  GRANDMASTER: "text-fuchsia-400",
};

// The same ramp at low opacity: the fill *behind* a chip's text has to sit under
// type without fighting it, which the solid badge colours would.
export const TIER_FILL_CLASS: Record<Tier, string> = {
  EASY: "bg-emerald-400/25",
  MEDIUM: "bg-sky-400/25",
  HARD: "bg-violet-400/25",
  ELITE: "bg-amber-400/25",
  MASTER: "bg-rose-400/25",
  GRANDMASTER: "bg-fuchsia-400/25",
};
