// The Comp% scale: what share of players who've opened the CA interface have done
// this task. It reads as a rarity scale -- a low number means almost nobody has it,
// so red is "brutally rare" rather than "bad". Buckets are from the wiki's own
// presentation, kept as data so the table and any future legend agree.

export type CompletionTone =
  "na" | "red" | "orange" | "yellow" | "green" | "blue";

export function completionTone(pct: number | null): CompletionTone {
  if (pct === null) return "na";
  if (pct < 0.1) return "red";
  if (pct < 1) return "orange";
  if (pct < 10) return "yellow";
  if (pct < 50) return "green";
  return "blue";
}

/** One decimal, except below 0.1 where a rounded "0.1%" would overstate it. */
export function formatCompletion(pct: number | null): string {
  if (pct === null) return "N/A";
  if (pct < 0.1) return "<0.1%";
  return `${pct.toFixed(1)}%`;
}

export const COMPLETION_TONE_CLASS: Record<CompletionTone, string> = {
  na: "text-muted-foreground",
  red: "text-red-400",
  orange: "text-orange-400",
  yellow: "text-yellow-400",
  green: "text-green-400",
  blue: "text-sky-400",
};
