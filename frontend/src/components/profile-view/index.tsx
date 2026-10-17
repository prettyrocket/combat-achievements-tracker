// Your progress as a screen of its own, at ?view=profile.
//
// The summary card used to sit above the table, where it was charged to the
// table's height and had to collapse to one line to earn its place. Here it has
// the room, and the page is where the rest of "what have I done" goes.

import type { LoadSourceId } from "@/lib/load-source";
import type { QuickLoad } from "@/lib/quick-load";
import type { RewardStatus } from "@/lib/rewards";
import type { ProgressSummary } from "@/lib/types";
import { RewardCard } from "@/components/profile-view/reward-card";
import { SummaryCard } from "@/components/profile-view/summary";
import { TierCard } from "@/components/profile-view/tier-card";
import { SyncSection } from "@/components/profile-view/sync-section";

export interface ProfileViewProps {
  summary: ProgressSummary;
  rewards: RewardStatus;
  /** Whose progress this is, or null before anything has been loaded. */
  rsn: string | null;
  /** How you last loaded, as the header's Load reads it. */
  syncKind: QuickLoad;
  syncBusy: boolean;
  /** The header's Load, run from here. */
  onSync: () => void;
  /** Opens the Load dialog, which App owns. */
  onLoadOpen: () => void;
  /** Opens the Load dialog on one source. */
  onLoadSource: (source: LoadSourceId) => void;
}

export function ProfileView({
  summary,
  rewards,
  rsn,
  syncKind,
  syncBusy,
  onSync,
  onLoadOpen,
  onLoadSource,
}: ProfileViewProps) {
  return (
    <div className="flex h-full flex-col items-start gap-3 overflow-y-auto">
      {/* Side by side once there's the width, so neither meter stretches into
          the hairline a single full-width bar becomes. */}
      <div className="grid w-full gap-3 md:grid-cols-2 xl:max-w-5xl">
        <SummaryCard summary={summary} rsn={rsn} />
        <RewardCard status={rewards} />
        <TierCard perTier={summary.perTier} />
      </div>
      <SyncSection
        kind={syncKind}
        rsn={rsn}
        busy={syncBusy}
        onSync={onSync}
        onChange={onLoadOpen}
        onPick={onLoadSource}
      />
    </div>
  );
}
