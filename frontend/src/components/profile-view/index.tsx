// Your progress as a screen of its own, at ?view=profile.
//
// The summary card used to sit above the table, where it was charged to the
// table's height and had to collapse to one line to earn its place. Here it has
// the room, and the page is where the rest of "what have I done" goes.

import { Upload } from "lucide-react";
import type { RewardStatus } from "@/lib/rewards";
import type { ProgressSummary } from "@/lib/types";
import { SummaryCard } from "@/components/profile-view/summary";
import { Button } from "@/components/ui/button";

export interface ProfileViewProps {
  summary: ProgressSummary;
  rewards: RewardStatus;
  /** Whose progress this is, or null before anything has been loaded. */
  rsn: string | null;
  /** Opens the Load dialog, which App owns. */
  onLoadOpen: () => void;
}

export function ProfileView({
  summary,
  rewards,
  rsn,
  onLoadOpen,
}: ProfileViewProps) {
  return (
    <div className="flex h-full flex-col items-start gap-3 overflow-y-auto">
      <SummaryCard summary={summary} rewards={rewards} rsn={rsn} />
      <Button variant="outline" size="sm" onClick={onLoadOpen}>
        <Upload />
        Load progress
      </Button>
    </div>
  );
}
