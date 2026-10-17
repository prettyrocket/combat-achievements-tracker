// The easiest points within reach, with a way to put each on the list.

import { TIER_TEXT_CLASS } from "@/lib/tier-style";
import { TIER_LABEL, type TaskRow } from "@/lib/types";
import { ListToggle } from "@/components/task-table/cells";

export function QuickWinsCard({
  tasks,
  listed,
  onToggleListed,
}: {
  /** Already ranked and cut -- see quickWins. */
  tasks: readonly TaskRow[];
  listed: ReadonlySet<number>;
  onToggleListed: (wikiId: number) => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <section
      aria-labelledby="quick-wins-heading"
      className="rounded-lg border p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="quick-wins-heading" className="font-semibold">
          Quick wins
        </h2>
      </div>

      <ul className="space-y-2.5">
        {tasks.map((task) => (
          <li key={task.wikiId} className="flex items-start gap-2.5">
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{task.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {task.completionPct!.toFixed(1)}%
                </span>
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {task.monster && <>{task.monster} · </>}
                <span className={TIER_TEXT_CLASS[task.tier]}>
                  {TIER_LABEL[task.tier]}
                </span>{" "}
                · {task.points} {task.points === 1 ? "pt" : "pts"}
              </p>
            </div>
            <ListToggle
              name={task.name}
              listed={listed.has(task.wikiId)}
              gateReason={null}
              onToggle={() => onToggleListed(task.wikiId)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
