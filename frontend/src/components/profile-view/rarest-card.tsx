// The completed tasks the fewest players have: the share of players is the
// figure, so it leads each row's right-hand side.

import type { RareTask } from "@/lib/rarest";
import { TIER_TEXT_CLASS } from "@/lib/tier-style";
import { TIER_LABEL } from "@/lib/types";

export function RarestCard({ tasks }: { tasks: readonly RareTask[] }) {
  return (
    <section aria-labelledby="rarest-heading" className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="rarest-heading" className="font-semibold">
          Rarest completions
        </h2>
      </div>

      <ol className="space-y-2.5">
        {tasks.map((task) => (
          <li key={task.wikiId} className="flex items-baseline gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{task.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                <span className={TIER_TEXT_CLASS[task.tier]}>
                  {TIER_LABEL[task.tier]}
                </span>
                {task.monster && <> · {task.monster}</>}
              </p>
            </div>
            <span className="shrink-0 text-base font-semibold tabular-nums">
              {task.completionPct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
