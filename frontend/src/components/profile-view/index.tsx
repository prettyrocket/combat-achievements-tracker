// Your progress as a screen of its own, at ?view=profile.
//
// The summary card used to sit above the table, where it was charged to the
// table's height and had to collapse to one line to earn its place. Here it has
// the room, and the page is where the rest of "what have I done" goes.

import type { RewardStatus } from "@/lib/rewards";
import type { ProgressSummary } from "@/lib/types";
import { SummaryCard } from "@/components/profile-view/summary";

export interface ProfileViewProps {
  summary: ProgressSummary;
  rewards: RewardStatus;
  /** Whose progress this is, or null before anything has been loaded. */
  rsn: string | null;
}

export function ProfileView({ summary, rewards, rsn }: ProfileViewProps) {
  return (
    <div className="h-full overflow-y-auto">
      <SummaryCard summary={summary} rewards={rewards} rsn={rsn} />
    </div>
  );
}
