// Tier icon + name.
//
// The in-game CA tier icons are Jagex assets, so these are lucide glyphs chosen to
// read as an escalating difficulty ramp instead. Swapping in real art later means
// changing this map and nothing else.
//
// The point value used to live here too, which made "Elite 4pt" on every row --
// a number fully determined by the word next to it. It has its own sortable
// column now; this badge says which tier and nothing more.
import { Shield, ShieldHalf, Swords, Flame, Crown, Skull } from "lucide-react";
import { type Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIER_ICON: Record<Tier, typeof Shield> = {
  EASY: ShieldHalf,
  MEDIUM: Shield,
  HARD: Swords,
  ELITE: Flame,
  MASTER: Crown,
  GRANDMASTER: Skull,
};

const TIER_CLASS: Record<Tier, string> = {
  EASY: "text-emerald-400",
  MEDIUM: "text-sky-400",
  HARD: "text-violet-400",
  ELITE: "text-amber-400",
  MASTER: "text-rose-400",
  GRANDMASTER: "text-fuchsia-400",
};

const TIER_LABEL: Record<Tier, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
  ELITE: "Elite",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
};

export function TierBadge({ tier }: { tier: Tier }) {
  const Icon = TIER_ICON[tier];
  return (
    <span className={cn("inline-flex items-center gap-1.5", TIER_CLASS[tier])}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="font-medium">{TIER_LABEL[tier]}</span>
    </span>
  );
}
