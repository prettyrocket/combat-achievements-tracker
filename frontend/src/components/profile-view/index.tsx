// Your progress as a screen of its own, at ?view=profile.
//
// The summary card used to sit above the table, where it was charged to the
// table's height and had to collapse to one line to earn its place. Here it has
// the room, and the page is where the rest of "what have I done" goes.

import type { LoadSourceId } from "@/lib/load-source";
import type { QuickLoad } from "@/lib/quick-load";
import type { RewardStatus, RewardTier } from "@/lib/rewards";
import type { ProgressSummary } from "@/lib/types";
import { ProfileEmpty } from "@/components/profile-view/empty";
import { RewardCard } from "@/components/profile-view/reward-card";
import { SummaryCard } from "@/components/profile-view/summary";
import { TierCard } from "@/components/profile-view/tier-card";

export interface ProfileViewProps {
  summary: ProgressSummary;
  rewards: RewardStatus;
  rewardTiers: readonly RewardTier[];
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
  /** Off to the catalog, from the empty state. */
  onBrowse: () => void;
}

export function ProfileView({
  summary,
  rewards,
  rewardTiers,
  rsn,
  syncKind,
  syncBusy,
  onSync,
  onLoadOpen,
  onLoadSource,
  onBrowse,
}: ProfileViewProps) {
  // Nothing set up, nothing ticked and no name is nobody's progress. Ticks or
  // a name without a source are somebody's, though, so they keep the cards.
  if (syncKind === "setup" && summary.completedTasks === 0 && rsn === null)
    return (
      <div className="h-full overflow-y-auto">
        <ProfileEmpty onPick={onLoadSource} onBrowse={onBrowse} />
      </div>
    );

  const account = (
    <SummaryCard
      kind={syncKind}
      rsn={rsn}
      busy={syncBusy}
      onSync={onSync}
      onChange={onLoadOpen}
      onPick={onLoadSource}
    />
  );
  // Before a source is set up the account card is the four source cards,
  // which want a row of their own across both columns.
  const setup = syncKind === "setup";

  return (
    <div className="flex h-full flex-col items-start gap-3 overflow-y-auto">
      {/* Two columns once there's the width, each its own stack, so the reward
          ladder's height never stretches the cards beside it. */}
      <div className="grid w-full items-start gap-3 md:grid-cols-2 xl:max-w-5xl">
        {setup && <div className="md:col-span-2">{account}</div>}
        <div className="flex flex-col gap-3">
          {!setup && account}
          <TierCard summary={summary} />
        </div>
        <RewardCard status={rewards} tiers={rewardTiers} />
      </div>
    </div>
  );
}
